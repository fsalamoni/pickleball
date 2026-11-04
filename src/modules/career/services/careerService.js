/**
 * Minha carreira — I/O de `career_events/{uid}_{id}` e da pasta `carreira/{uid}/`
 * do Storage. Só o dono lê e escreve (a regra confere `uid`, o prefixo do id
 * e a flag `athlete_career` em create/update — apagar vale sempre).
 *
 * Uma igualdade por consulta (`uid ==`), ordenação em memória: zero índice.
 * Tudo passa por `normalizeCareerEvent` antes de gravar (a regra é rasa).
 */
import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { CAREER_RANK, normalizeCareerRank } from '../domain/careerRank.js';
import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, functions, storage } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { storageFileName } from '@/modules/training/domain/media.js';
import { t } from '@/core/i18n';
import {
  CAREER_EVENTS, newCareerEventId, normalizeCareerEvent, withDerivedStatus,
} from '../domain/careerEvent.js';
import { CAREER_DEBRIEF_COLLECTION, careerDebriefDocId } from '../domain/careerDebrief.js';
import { CAREER_PARTNER, CAREER_PARTNER_INVITES, keepServerLinkedPartners } from '../domain/careerPartner.js';
import { CAREER_PUBLIC, sortShowcase } from '../domain/careerPublic.js';

export class CareerError extends Error {}

const toDoc = (d) => ({ id: d.id, ...d.data() });
const porData = (a, b) => String(b.start_date).localeCompare(String(a.start_date));

/** Os torneios de fora da pessoa, do mais novo ao mais antigo. */
export async function listCareerEvents(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, CAREER_EVENTS), where('uid', '==', uid)));
  // O status gravado é o do dia em que se salvou: o planejado que passou vira jogado.
  return snap.docs.map((d) => withDerivedStatus(toDoc(d))).sort(porData);
}

/**
 * Cria ou substitui um torneio de fora. `input.id` ausente = novo.
 * @returns {Promise<object>} o evento gravado, com `id`
 */
export async function saveCareerEvent(uid, input) {
  if (!uid) throw new CareerError(t('Entre na sua conta.'));
  const { valid, error, value } = normalizeCareerEvent(input, { uid });
  if (!valid) throw new CareerError(error);
  const id = input.id && String(input.id).startsWith(`${uid}_`) ? input.id : newCareerEventId(uid);
  let gravar = value;
  if (input.id && Number(input.updated_at_ms) > 0) {
    // A dupla pode ter aceitado o convite pelo link com a ficha aberta: não apagar a conta dela.
    try {
      const atual = await getDoc(doc(db, CAREER_EVENTS, id));
      if (atual.exists()) gravar = keepServerLinkedPartners(value, atual.data(), input.updated_at_ms);
    } catch (err) {
      logger.warn('[career] releitura antes de salvar falhou', err);
    }
  }
  await setDoc(doc(db, CAREER_EVENTS, id), gravar);
  return { id, ...gravar };
}

/** Grava vários de uma vez (modo lista): tudo ou nada, num lote só. */
export async function saveCareerEventsBatch(uid, events) {
  if (!uid) throw new CareerError(t('Entre na sua conta.'));
  const lista = (events || []).slice(0, 100);
  if (!lista.length) return [];
  const lote = writeBatch(db);
  const gravados = lista.map((ev) => {
    const { valid, error, value } = normalizeCareerEvent(ev, { uid });
    if (!valid) throw new CareerError(error);
    const id = ev.id && String(ev.id).startsWith(`${uid}_`) ? ev.id : newCareerEventId(uid);
    lote.set(doc(db, CAREER_EVENTS, id), value);
    return { id, ...value };
  });
  await lote.commit();
  return gravados;
}

/**
 * Apaga o torneio, as fotos e o BALANÇO dele (fotos e balanço best-effort: o
 * documento é o que importa). Quem apaga o torneio espera que tudo dele saia —
 * o balanço seguiria pesando no foco das semanas com o título antigo.
 */
export async function deleteCareerEvent(event) {
  if (!event?.id) return;
  await deleteDoc(doc(db, CAREER_EVENTS, event.id));
  const uid = event.uid || String(event.id).split('_')[0];
  await Promise.all([
    ...(event.photos || []).map((p) => deleteCareerPhoto(p.path)),
    // Balanço que não existe: a regra de delete olha `resource` (nulo) e recusa — ignorado.
    deleteDoc(doc(db, CAREER_DEBRIEF_COLLECTION, careerDebriefDocId(uid, event.id))).catch(() => {}),
  ]);
}

/* --------------------------------------------- "Mandar ao meu professor" -- */

/**
 * Mostra (ou deixa de mostrar, `coachId` nulo) o torneio — e o balanço dele —
 * ao professor. Ato explícito. A regra confere o vínculo ATIVO e só deixa
 * mandar a quem é professor da pessoa; o balanço que ainda não existe
 * recebe o professor quando for feito (a ficha o passa ao salvar).
 */
export async function shareCareerWithCoach(event, coachId) {
  if (!event?.id) throw new CareerError(t('Torneio inválido.'));
  const uid = event.uid || String(event.id).split('_')[0];
  const coach = coachId || null;
  await updateDoc(doc(db, CAREER_EVENTS, event.id), { shared_coach_id: coach || deleteField(), updated_at_ms: Date.now() });
  // Balanço que ainda não existe: nada a fazer (ele leva o professor ao ser feito).
  // O que EXISTE e falha sobe — a tela não pode afirmar que o professor o vê.
  const balanco = doc(db, CAREER_DEBRIEF_COLLECTION, careerDebriefDocId(uid, event.id));
  const existe = await getDoc(balanco).then((s) => s.exists(), (err) => {
    if (err?.code === 'permission-denied') return false; // inexistente: a regra olha `resource` nulo
    throw err;
  });
  if (existe) await updateDoc(balanco, { shared_coach_id: coach || deleteField() });
}

/**
 * O que os ALUNOS mandaram ao professor: torneios e balanços de torneio, de UM
 * aluno. As consultas fixam `uid ==` do aluno e `shared_coach_id ==` o
 * professor — é o que torna a regra (`hasActiveStudent`) provável. Vínculo
 * encerrado ⇒ a regra recusa: a tela diz que o acesso fechou.
 */
export async function listStudentCareerShares(coachUid, studentUid) {
  if (!db || !coachUid || !studentUid) return { events: [], debriefs: [] };
  const filtro = [where('shared_coach_id', '==', coachUid), where('uid', '==', studentUid)];
  const [evs, bal] = await Promise.all([
    getDocs(query(collection(db, CAREER_EVENTS), ...filtro)),
    getDocs(query(collection(db, CAREER_DEBRIEF_COLLECTION), ...filtro)),
  ]);
  return {
    events: evs.docs.map((d) => withDerivedStatus(toDoc(d))).sort(porData),
    debriefs: bal.docs.map(toDoc).filter((d) => d.source?.type === 'externo'),
  };
}

/* ------------------------------------------------ posição no ranking -- */

/** As posições digitadas da pessoa (`career_rank`, `uid ==`). */
export async function listCareerRanks(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, CAREER_RANK), where('uid', '==', uid)));
  return snap.docs.map(toDoc).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Grava (cria ou substitui) uma posição digitada. */
export async function saveCareerRank(uid, input) {
  if (!uid) throw new CareerError(t('Entre na sua conta.'));
  const { valid, error, value } = normalizeCareerRank(input, { uid });
  if (!valid) throw new CareerError(error);
  const id = input.id && String(input.id).startsWith(`${uid}_`) ? input.id : newCareerEventId(uid);
  await setDoc(doc(db, CAREER_RANK, id), value);
  return { id, ...value };
}

export async function deleteCareerRank(id) {
  if (!id) return;
  await deleteDoc(doc(db, CAREER_RANK, id));
}

/* ------------------------------------------------------------- a dupla -- */

/**
 * Os pedidos da DUPLA em que a pessoa está, dos dois lados: os que ela fez
 * (`owner_uid ==`) e os que recebeu (`partner_uid ==`) — uma igualdade cada,
 * a que a regra prova. Só o servidor grava `career_partner`.
 */
export async function listMyCareerPartnerDocs(uid) {
  if (!db || !uid) return [];
  const [fiz, recebi] = await Promise.all([
    getDocs(query(collection(db, CAREER_PARTNER), where('owner_uid', '==', uid))),
    getDocs(query(collection(db, CAREER_PARTNER), where('partner_uid', '==', uid))),
  ]);
  const vistos = new Map();
  [...fiz.docs, ...recebi.docs].forEach((d) => vistos.set(d.id, toDoc(d)));
  return [...vistos.values()].sort((a, b) => (Number(b.invited_at_ms) || 0) - (Number(a.invited_at_ms) || 0));
}

/** As denúncias que a PESSOA fez (`career_partner_reports`, lê só quem denunciou) — para a exportação. */
export async function listMyCareerPartnerReports(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, 'career_partner_reports'), where('reporter_uid', '==', uid)));
  return snap.docs.map(toDoc);
}

/**
 * Os convites pelo WhatsApp que a pessoa mandou à dupla SEM conta
 * (`career_partner_invites`, `owner_uid ==`; só o servidor grava). O documento
 * não guarda o token nem telefone — só o hash, que é o id.
 */
export async function listMyCareerPartnerInvites(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, CAREER_PARTNER_INVITES), where('owner_uid', '==', uid)));
  return snap.docs.map(toDoc);
}

/* ------------------------------------------------- a vitrine pública -- */

/**
 * A VITRINE pública de `uid` (`career_public`, `uid ==`, leitura aberta — o
 * perfil público e a própria pessoa). Só o servidor grava: publicar e tirar
 * passam por `careerAction('publish' | 'unpublish')`.
 */
export async function listCareerPublic(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, CAREER_PUBLIC), where('uid', '==', uid)));
  return sortShowcase(snap.docs.map(toDoc));
}

function mensagemDoServidor(err) {
  const code = String(err?.code || '');
  if (code.endsWith('unauthenticated')) return t('Entre na sua conta.');
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded')) return t('Sem conexão com o servidor. Tente de novo.');
  if (code.endsWith('internal')) return t('Não foi possível concluir. Tente de novo.');
  return err?.message || t('Não foi possível concluir. Tente de novo.');
}

/**
 * Uma ação da dupla no servidor (`functions/career.js`): `invite`, `respond`,
 * `feedback`, `decide`, `remove`, `report`, `moderate`, `queue`; da dupla
 * sem conta (PR 6), `invite_link`, `invite_cancel`, `invite_peek`, `invite_accept`;
 * e as da vitrine (`functions/careerPublic.js`): `publish`, `unpublish`, `public_consent`.
 */
export async function careerAction(action, payload = {}) {
  if (!functions) throw new CareerError(t('Firebase não está configurado neste ambiente.'));
  try {
    const { data } = await httpsCallable(functions, 'career', { timeout: 60_000 })({ action, ...payload });
    return data;
  } catch (err) {
    const e = new CareerError(mensagemDoServidor(err));
    e.code = err?.code;
    throw e;
  }
}

/* -------------------------------------------------------------- fotos -- */

/** Caminho no Storage — o mesmo que o `storage.rules` autoriza. */
export const careerPhotoPath = (uid, fileName) => `carreira/${uid}/${fileName}`;

/**
 * Sobe uma foto JÁ preparada (`prepareUpload`: comprimida, sem EXIF).
 * @returns {Promise<{ path: string, url: string }>}
 */
export async function uploadCareerPhoto(uid, file) {
  if (!storage) throw new CareerError(t('Envio de arquivos indisponível neste ambiente.'));
  if (!uid) throw new CareerError(t('Entre na sua conta.'));
  const path = careerPhotoPath(uid, storageFileName(file.type));
  try {
    const snap = await uploadBytes(ref(storage, path), file, { contentType: file.type, cacheControl: 'private, max-age=31536000' });
    return { path, url: await getDownloadURL(snap.ref) };
  } catch (err) {
    logger.error('Falha no envio da foto da carreira:', err);
    throw new CareerError(t('Não foi possível enviar a foto. Confira a conexão e tente de novo.'));
  }
}

/** Apaga uma foto (só o dono consegue; best-effort). */
export async function deleteCareerPhoto(path) {
  if (!storage || !path || !String(path).startsWith('carreira/')) return;
  try {
    await deleteObject(ref(storage, path));
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') logger.error('Falha ao apagar foto da carreira:', err);
  }
}

/** Os caminhos da pasta da pessoa (`carreira/{uid}/…`) — para a exportação. */
export async function listMyCareerPhotoPaths(uid) {
  if (!storage || !uid) return [];
  const res = await listAll(ref(storage, `carreira/${uid}`));
  return res.items.map((i) => i.fullPath);
}
