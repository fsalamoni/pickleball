/**
 * Operações sobre palpites (bets) e palpites especiais (special_bets).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { MAX_PENALTY_SCORE } from '@/modules/pool/domain/penaltyShootout';

/**
 * Salva ou atualiza um lote de palpites para um usuário em um bolão.
 *
 * Palpite nunca é deletado — se o usuário zerar o palpite, salvamos com 0×0
 * (que é o palpite-padrão da regra do bolão).
 *
 * IMPORTANTE: Security Rules + Cloud Function rejeitam a operação se algum
 * dos matches já estiver com `bet_lock_at` no passado. O cliente também
 * deve filtrar antes de enviar para boa UX.
 *
 * @param {string} userId
 * @param {string} poolId
 * @param {Array<{match_id:string, predicted_home:number, predicted_away:number, predicted_home_penalties?:number|null, predicted_away_penalties?:number|null, penalty_winner_team_id?:string|null}>} entries
 */
export async function saveBets(userId, poolId, entries, actor = null) {
  if (!entries?.length) return;
  const batch = writeBatch(db);
  let createdCount = 0;
  let updatedCount = 0;

  for (const e of entries) {
    const betId = `${userId}_${poolId}_${e.match_id}`;
    const betRef = doc(db, 'bets', betId);
    const existingBet = await getDoc(betRef);
    if (existingBet.exists()) updatedCount += 1;
    else createdCount += 1;
    batch.set(
      betRef,
      {
        user_id: userId,
        pool_id: poolId,
        match_id: e.match_id,
        predicted_home: clampScore(e.predicted_home, e.max_score, e.score_step),
        predicted_away: clampScore(e.predicted_away, e.max_score, e.score_step),
        predicted_home_penalties: nullableClampScore(e.predicted_home_penalties, e.penalty_max_score, e.penalty_score_step),
        predicted_away_penalties: nullableClampScore(e.predicted_away_penalties, e.penalty_max_score, e.penalty_score_step),
        penalty_winner_team_id: e.penalty_winner_team_id ?? null,
        revealed: false,
        updated_at: serverTimestamp(),
        ...(existingBet.exists() ? {} : { created_at: serverTimestamp() }),
      },
      { merge: true },
    );
  }

  await batch.commit();
  if (actor) {
    await createAuditLog({
      action: updatedCount > 0 && createdCount === 0 ? 'bets_updated' : 'bets_created',
      actor,
      poolId,
      userId,
      details: {
        total: entries.length,
        created: createdCount,
        updated: updatedCount,
        match_ids: entries.map((entry) => entry.match_id),
      },
    });
  }
  logger.info(`Saved ${entries.length} bets for user ${userId} pool ${poolId}`);
}

function clampScore(n, maxScore = 20, scoreStep = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const max = Number.isFinite(Number(maxScore)) ? Number(maxScore) : 20;
  const step = Number.isFinite(Number(scoreStep)) && Number(scoreStep) > 0 ? Number(scoreStep) : 1;
  const clamped = Math.max(0, Math.min(max, v));
  return Number((Math.round(clamped / step) * step).toFixed(4));
}

function nullableClampScore(n, maxScore = MAX_PENALTY_SCORE, scoreStep = 1) {
  if (n === null || n === undefined || n === '') return null;
  return clampScore(n, maxScore, scoreStep);
}

/**
 * Carrega todos os palpites do usuário em um bolão.
 */
export async function listMyBets(userId, poolId) {
  const snap = await getDocs(
    query(collection(db, 'bets'), where('user_id', '==', userId), where('pool_id', '==', poolId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Salva um palpite especial (campeão ou artilheiro).
 */
export async function saveSpecialBet(userId, poolId, payload, actor = null) {
  const id = `${userId}_${poolId}_${payload.type}`;
  const specialBetRef = doc(db, 'special_bets', id);
  const existingBet = await getDoc(specialBetRef);
  await setDoc(
    specialBetRef,
    {
      user_id: userId,
      pool_id: poolId,
      type: payload.type,
      team_id: payload.team_id ?? null,
      player_name: payload.player_name ?? null,
      revealed: false,
      updated_at: serverTimestamp(),
      ...(existingBet.exists() ? {} : { created_at: serverTimestamp() }),
    },
    { merge: true },
  );
  if (actor) {
    await createAuditLog({
      action: existingBet.exists() ? 'special_bet_updated' : 'special_bet_created',
      actor,
      poolId,
      userId,
      details: { type: payload.type },
    });
  }
}

export async function listMySpecialBets(userId, poolId) {
  const snap = await getDocs(
    query(
      collection(db, 'special_bets'),
      where('user_id', '==', userId),
      where('pool_id', '==', poolId),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
