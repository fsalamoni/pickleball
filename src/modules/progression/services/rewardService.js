/**
 * rewardService — recompensas reais e os pedidos (I/O).
 *
 * O desenho está em `domain/rewards.js`: a recompensa é uma PORTA aberta por um
 * marco (não se compra com XP); a pessoa PEDE, o emissor CONFERE e entrega.
 */
import {
  collection, deleteDoc, doc, getDocs, limit, query, runTransaction, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  validateReward, generateClaimCode, claimDocId, rewardAvailability, canTransitionClaim,
} from '@/modules/progression/domain/rewards';
import { gamificationDb } from './firestoreDb.js';

const db = () => gamificationDb();

/** Todas as recompensas (a regra deixa qualquer conta logada ler). */
export async function listRewards() {
  const snap = await getDocs(query(collection(db(), 'gamification_rewards'), limit(300)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listRewardsByIssuer(issuerType, issuerId) {
  if (!issuerType || !issuerId) return [];
  const snap = await getDocs(query(
    collection(db(), 'gamification_rewards'),
    where('issuerType', '==', issuerType), where('issuerId', '==', issuerId), limit(200),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createReward(input, issuer, actor) {
  const v = validateReward({ ...input, approvedCount: 0 }, { ...issuer, uid: actor.uid });
  if (!v.ok) {
    const e = new Error(Object.values(v.errors)[0] || 'Recompensa inválida.');
    e.errors = v.errors;
    throw e;
  }
  const ref = doc(collection(db(), 'gamification_rewards'));
  await setDoc(ref, { ...v.value, createdAt: Date.now() });
  await createAuditLog({ action: 'gamification_reward_created', actor, details: { id: ref.id, issuerType: issuer.type, issuerId: issuer.id, title: v.value.title } });
  return ref.id;
}

export async function updateReward(id, atual, patch, issuer, actor) {
  const v = validateReward({ ...atual, ...patch }, { ...issuer, uid: atual.createdBy });
  if (!v.ok) {
    const e = new Error(Object.values(v.errors)[0] || 'Recompensa inválida.');
    e.errors = v.errors;
    throw e;
  }
  const { createdBy: _c, issuerType: _t, issuerId: _i, schemaVersion: _s, approvedCount: _a, ...editavel } = v.value;
  await updateDoc(doc(db(), 'gamification_rewards', id), { ...editavel, status: patch.status || atual.status });
  await createAuditLog({ action: 'gamification_reward_updated', actor, details: { id } });
}

export async function deleteReward(id) {
  await deleteDoc(doc(db(), 'gamification_rewards', id));
}

/* ------------------------------------------------------------------ pedidos -- */

export async function listMyClaims(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(db(), 'reward_claims'), where('uid', '==', uid), limit(200)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** A fila do emissor: os pedidos para as recompensas dele. */
export async function listClaimsByIssuer(issuerType, issuerId) {
  if (!issuerType || !issuerId) return [];
  const snap = await getDocs(query(
    collection(db(), 'reward_claims'),
    where('issuerType', '==', issuerType), where('issuerId', '==', issuerId), limit(300),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
}

/** Quem deve ser avisado de um pedido novo (best-effort). */
async function issuerRecipients(reward) {
  try {
    if (reward.issuerType === 'coach') return [reward.issuerId];
    if (reward.issuerType === 'arena') {
      const snap = await getDocs(query(collection(db(), 'arena_managers'), where('arena_id', '==', reward.issuerId), limit(30)));
      return snap.docs.map((d) => d.data().user_id).filter(Boolean);
    }
    if (reward.issuerType === 'club') {
      const snap = await getDocs(query(collection(db(), 'club_members'), where('club_id', '==', reward.issuerId), limit(200)));
      return snap.docs.map((d) => d.data()).filter((m) => m.role === 'admin').map((m) => m.user_id);
    }
  } catch {
    /* aviso é efeito colateral: nunca derruba o pedido */
  }
  return [];
}

/**
 * A pessoa PEDE a recompensa. O pedido leva um código para apresentar ao
 * emissor e a fotografia do que ela alegou (o emissor confere com os dados
 * públicos de progressão).
 *
 * @param {{ reward: object, user: { uid: string, displayName?: string }, snapshot: object }} p
 */
export async function requestReward({ reward, user, snapshot }) {
  const disp = rewardAvailability(reward);
  if (!disp.available) throw new Error(disp.reason);
  const id = claimDocId(reward.id, user.uid);
  const code = generateClaimCode();
  await setDoc(doc(db(), 'reward_claims', id), {
    uid: user.uid,
    userName: String(user.displayName || '').slice(0, 60),
    rewardId: reward.id,
    rewardTitle: String(reward.title || '').slice(0, 80),
    issuerType: reward.issuerType,
    issuerId: reward.issuerId,
    status: 'requested',
    code,
    snapshot: {
      tier: String(snapshot?.tier || ''), level: Number(snapshot?.level) || 1,
      games: Number(snapshot?.games) || 0, streakWeeks: Number(snapshot?.streakWeeks) || 0,
    },
    createdAt: Date.now(),
  });
  const alvos = await issuerRecipients(reward);
  if (alvos.length > 0) {
    await notifyUsers(alvos, {
      title: 'Novo pedido de recompensa',
      message: `${user.displayName || 'Um atleta'} pediu "${reward.title}". Confira e libere.`,
      type: NOTIFICATION_TYPE.GAMIFICATION,
      link: '/gamification',
      actor: user,
    });
  }
  return { id, code };
}

export async function cancelClaim(claimId) {
  await updateDoc(doc(db(), 'reward_claims', claimId), { status: 'cancelled' });
}

/**
 * O emissor decide um pedido. Aprovar sobe o contador da recompensa (de 1 em 1,
 * numa transação que reconfere a quantidade) e avisa a pessoa.
 *
 * @param {object} claim
 * @param {'approved'|'rejected'|'redeemed'} next
 * @param {object} actor
 * @param {string} [note]
 */
export async function decideClaim(claim, next, actor, note = '') {
  if (!canTransitionClaim(claim.status, next, 'issuer')) {
    throw new Error('Este pedido não pode ir para esse estado.');
  }
  const claimRef = doc(db(), 'reward_claims', claim.id);
  const rewardRef = doc(db(), 'gamification_rewards', claim.rewardId);
  await runTransaction(db(), async (tx) => {
    if (next === 'approved') {
      const r = await tx.get(rewardRef);
      if (!r.exists()) throw new Error('A recompensa não existe mais.');
      const dados = r.data();
      const disp = rewardAvailability({ ...dados, id: r.id });
      if (!disp.available) throw new Error(disp.reason);
      tx.update(rewardRef, { approvedCount: (Number(dados.approvedCount) || 0) + 1 });
    }
    tx.update(claimRef, {
      status: next, decidedAt: Date.now(), decidedBy: actor.uid, note: String(note || '').slice(0, 200),
    });
  });
  await createAuditLog({ action: 'gamification_claim_decided', actor, details: { claimId: claim.id, status: next } });
  const textos = {
    approved: `Seu pedido de "${claim.rewardTitle}" foi liberado. Apresente o código ${claim.code}.`,
    rejected: `Seu pedido de "${claim.rewardTitle}" não foi liberado.${note ? ` Motivo: ${note}` : ''}`,
    redeemed: `"${claim.rewardTitle}" foi marcada como usada. Aproveite!`,
  };
  await notifyUsers([claim.uid], {
    title: next === 'rejected' ? 'Pedido de recompensa' : 'Recompensa',
    message: textos[next],
    type: NOTIFICATION_TYPE.GAMIFICATION,
    link: '/gamification?aba=recompensas',
    actor,
  });
}
