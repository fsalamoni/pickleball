/**
 * Contato do inscrito, FORA do documento público — achado P0-02.
 *
 * `tournament_registrations` é `allow read: if true` porque o quadro do
 * torneio, a impressão de grupos e o telão são páginas legítimas sem login.
 * Fechar a leitura quebraria as três. Então o e-mail sai de dentro do
 * documento em vez de a leitura sair de cima dele:
 *
 *   tournament_registrations/{rid}/private/contact  ← restrito pela regra
 *   provisional_claims/{rid}_a|b                    ← só o dono do e-mail lê
 *
 * Este módulo é o ÚNICO lugar que sabe disso. Todo leitor passa por aqui e
 * recebe o contato já resolvido — da subcoleção quando existe, do campo
 * público (legado) quando não existe.
 *
 * Tolerância a falha é proposital: se a regra recusar a leitura do contato,
 * a função devolve vazio em vez de estourar. Uma inscrição sem e-mail à vista
 * é um incômodo; uma tela de inscrições que não abre é um estrago.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where,
  serverTimestamp, writeBatch, documentId,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import {
  resolveRegistrationContact, buildContactPayload, buildProvisionalClaims,
  provisionalClaimId, normalizeEmail,
} from '../domain/registrationContact.js';

const COL = 'tournament_registrations';
const SUB_PRIVATE = 'private';
const DOC_CONTACT = 'contact';
const COL_CLAIMS = 'provisional_claims';

/** Máximo de leituras simultâneas ao buscar contato de muitas inscrições. */
const LOTE_LEITURA = 25;

const refContato = (rid) => doc(db, COL, rid, SUB_PRIVATE, DOC_CONTACT);

/**
 * Grava o contato na subcoleção privada e, para os slots provisórios, a prova
 * de reivindicação. Chamado logo depois de criar/editar a inscrição — o
 * documento-pai precisa existir, porque a regra o consulta.
 */
export async function saveRegistrationContact({
  registrationId, tournamentId, modalityId = null,
  playerAEmail, playerAUserId, playerBEmail, playerBUserId,
}) {
  const payload = buildContactPayload({ playerAEmail, playerBEmail });
  const temAlgum = Boolean(payload.player_a_email || payload.player_b_email);
  if (!temAlgum) return { contact: false, claims: 0 };

  await setDoc(refContato(registrationId), { ...payload, updated_at: serverTimestamp() }, { merge: true });

  const claims = buildProvisionalClaims({
    registrationId, tournamentId, modalityId,
    playerAEmail, playerAUserId, playerBEmail, playerBUserId,
  });
  if (claims.length > 0) {
    const batch = writeBatch(db);
    claims.forEach((c) => {
      batch.set(doc(db, COL_CLAIMS, c.id), { ...c.data, created_at: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
  return { contact: true, claims: claims.length };
}

/** Contato de UMA inscrição, já resolvido (privado > legado público). */
export async function fetchRegistrationContact(reg) {
  if (!reg?.id) return resolveRegistrationContact(reg, null);
  try {
    const snap = await getDoc(refContato(reg.id));
    return resolveRegistrationContact(reg, snap.exists() ? snap.data() : null);
  } catch (e) {
    // Sem permissão (espectador) ou offline: cai no legado, não quebra a tela.
    logger.debug?.('contato da inscrição indisponível', { id: reg.id, erro: e?.code });
    return resolveRegistrationContact(reg, null);
  }
}

/**
 * Contato de VÁRIAS inscrições, em lotes. Devolve um Map id → contato.
 *
 * Custo honesto: é uma leitura por inscrição. Só vale a pena chamar em tela de
 * organizador (aba de inscrições, exportação) — nunca no quadro público, que
 * não mostra e-mail nenhum.
 */
export async function fetchRegistrationContacts(regs = []) {
  const mapa = new Map();
  const lista = (regs || []).filter((r) => r?.id);
  for (let i = 0; i < lista.length; i += LOTE_LEITURA) {
    const fatia = lista.slice(i, i + LOTE_LEITURA);
    // eslint-disable-next-line no-await-in-loop
    const contatos = await Promise.all(fatia.map((r) => fetchRegistrationContact(r)));
    fatia.forEach((r, idx) => mapa.set(r.id, contatos[idx]));
  }
  return mapa;
}

/**
 * As inscrições provisórias que pertencem a estes e-mails, pela coleção de
 * provas. A regra só devolve o que casa com o e-mail do TOKEN — então esta
 * consulta nunca vê inscrição de outra pessoa.
 */
export async function findProvisionalClaims(emails = []) {
  const alvos = Array.from(new Set((emails || []).map(normalizeEmail).filter(Boolean)));
  if (alvos.length === 0) return [];
  const snaps = await Promise.all(alvos.map((em) => getDocs(query(
    collection(db, COL_CLAIMS), where('email_lc', '==', em),
  )).catch((e) => {
    logger.debug?.('consulta de provisional_claims recusada', { erro: e?.code });
    return { docs: [] };
  })));
  const vistos = new Set();
  const saida = [];
  snaps.forEach((snap) => (snap.docs || []).forEach((d) => {
    if (vistos.has(d.id)) return;
    vistos.add(d.id);
    saida.push({ id: d.id, ...d.data() });
  }));
  return saida;
}

/** Busca as inscrições apontadas por um conjunto de provas. */
export async function fetchRegistrationsForClaims(claims = []) {
  const ids = Array.from(new Set((claims || []).map((c) => c?.registration_id).filter(Boolean)));
  if (ids.length === 0) return [];
  const saida = [];
  // `in` aceita no máximo 30 valores por consulta.
  for (let i = 0; i < ids.length; i += 30) {
    const fatia = ids.slice(i, i + 30);
    // eslint-disable-next-line no-await-in-loop
    const snap = await getDocs(query(collection(db, COL), where(documentId(), 'in', fatia)));
    snap.docs.forEach((d) => saida.push({ id: d.id, ref: d.ref, data: d.data() }));
  }
  return saida;
}

/** Marca as provas como reivindicadas (o titular pode, pela regra). */
export async function markClaimsClaimed(claims = [], uid) {
  const alvos = (claims || []).filter((c) => c?.id && !c.claimed);
  if (alvos.length === 0 || !uid) return 0;
  const batch = writeBatch(db);
  alvos.forEach((c) => batch.update(doc(db, COL_CLAIMS, c.id), {
    claimed: true, claimed_by: uid, claimed_at: serverTimestamp(),
  }));
  try {
    await batch.commit();
    return alvos.length;
  } catch (e) {
    // Não é fatal: a inscrição já foi vinculada; a prova ficar aberta apenas
    // faz o próximo login tentar de novo, sem efeito.
    logger.debug?.('não foi possível marcar provas como reivindicadas', { erro: e?.code });
    return 0;
  }
}

/** Remove a prova de um slot (ex.: inscrição apagada). Best-effort. */
export async function deleteProvisionalClaim(registrationId, slot) {
  try {
    await deleteDoc(doc(db, COL_CLAIMS, provisionalClaimId(registrationId, slot)));
  } catch (e) {
    logger.debug?.('não foi possível remover a prova', { registrationId, slot, erro: e?.code });
  }
}
