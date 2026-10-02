/**
 * gamificationAdminService — o que só o admin da plataforma faz: revisar os
 * sinais de integridade, moderar uma conta no placar, ver as métricas e
 * recalcular a progressão de alguém do zero.
 */
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { createAuditLog } from '@/core/services/auditService';
import { gamificationDb } from './firestoreDb.js';

const db = () => gamificationDb();

/* -------------------------------------------------------------- sinais ---- */

/** Os sinais de integridade (todos os estados), do mais recente. */
export async function listFlags(status = null) {
  const base = collection(db(), 'gamification_flags');
  const snap = await getDocs(status ? query(base, where('status', '==', status), limit(300)) : query(base, limit(300)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

/** O veredito do admin — a regra só deixa mudar status e anotação. */
export async function reviewFlag(flagId, status, note, actor) {
  await updateDoc(doc(db(), 'gamification_flags', flagId), {
    status, reviewNote: String(note || '').slice(0, 300), reviewedBy: actor.uid, reviewedAt: Date.now(),
  });
  await createAuditLog({ action: 'gamification_flag_reviewed', actor, details: { flagId, status } });
}

/* ------------------------------------------------------------ moderação ---- */

export async function getModeration(uid) {
  const snap = await getDoc(doc(db(), 'gamification_moderation', uid));
  return snap.exists() ? snap.data() : null;
}

export async function listModerated() {
  const snap = await getDocs(query(collection(db(), 'gamification_moderation'), limit(300)));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/**
 * Tira a conta do placar (`excluded`), só a esconde do público
 * (`hiddenFromPublic`) ou devolve ao normal. O servidor lê isto na próxima
 * passada — a decisão vale para a temporada e para o Hall.
 */
export async function setModeration(uid, { excluded = false, hiddenFromPublic = false, reason = '' }, actor) {
  if (!excluded && !hiddenFromPublic) {
    await deleteDoc(doc(db(), 'gamification_moderation', uid));
  } else {
    await setDoc(doc(db(), 'gamification_moderation', uid), {
      excluded: Boolean(excluded), hiddenFromPublic: Boolean(hiddenFromPublic),
      reason: String(reason || '').slice(0, 200), by: actor.uid, at: Date.now(),
    });
  }
  await createAuditLog({
    action: 'gamification_account_moderated', actor, userId: uid,
    details: { excluded: Boolean(excluded), hiddenFromPublic: Boolean(hiddenFromPublic), reason: String(reason || '').slice(0, 200) },
  });
}

/**
 * Recalcula a progressão de alguém DO ZERO: apaga o snapshot, as missões e as
 * conquistas registradas. Na próxima abertura da gamificação a pessoa as refaz
 * a partir dos jogos e registros reais — o que for fabricado não volta.
 * (O que o servidor concedeu e as preferências NÃO são tocados.)
 */
export async function resetAthleteProgress(uid, actor, motivo = '') {
  const colecoes = [
    ['user_missions', 'uid'],
    ['user_achievements_v2', 'uid'],
  ];
  let apagados = 0;
  for (const [col, campo] of colecoes) {
    const snap = await getDocs(query(collection(db(), col), where(campo, '==', uid), limit(2000)));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db());
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
      apagados += Math.min(400, snap.docs.length - i);
    }
  }
  await deleteDoc(doc(db(), 'user_progression_v2', uid));
  apagados += 1;
  await createAuditLog({
    action: 'gamification_progress_reset', actor, userId: uid, details: { deleted: apagados, reason: String(motivo || '').slice(0, 200) },
  });
  return apagados;
}

/* -------------------------------------------------------------- métricas --- */

/** Os retratos diários das métricas (os últimos `max`), do mais antigo ao mais novo. */
export async function listMetrics(max = 60) {
  // Os `max` retratos MAIS NOVOS: sem a ordem, o `limit` pegava os mais antigos
  // (o id é o dia) e, passados `max` dias, o painel mostrava o retrato velho
  // como se fosse o último. Um campo só, índice automático.
  const snap = await getDocs(query(collection(db(), 'gamification_metrics'), orderBy('day', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.day).localeCompare(String(b.day)));
}

/** Cartas denunciadas esperando decisão. */
export async function listReportedLettersForAdmin() {
  const snap = await getDocs(query(collection(db(), 'partner_letters'), where('reported', '==', true), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
