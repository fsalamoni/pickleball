/**
 * Minha carreira — I/O de `career_events/{uid}_{id}` e da pasta `carreira/{uid}/`
 * do Storage. Só o dono lê e escreve (a regra confere `uid`, o prefixo do id
 * e a flag `athlete_career` em create/update — apagar vale sempre).
 *
 * Uma igualdade por consulta (`uid ==`), ordenação em memória: zero índice.
 * Tudo passa por `normalizeCareerEvent` antes de gravar (a regra é rasa).
 */
import {
  collection, deleteDoc, doc, getDocs, query, setDoc, where, writeBatch,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { storageFileName } from '@/modules/training/domain/media.js';
import { t } from '@/core/i18n';
import {
  CAREER_EVENTS, newCareerEventId, normalizeCareerEvent, withDerivedStatus,
} from '../domain/careerEvent.js';
import { CAREER_DEBRIEF_COLLECTION, careerDebriefDocId } from '../domain/careerDebrief.js';

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
  await setDoc(doc(db, CAREER_EVENTS, id), value);
  return { id, ...value };
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
