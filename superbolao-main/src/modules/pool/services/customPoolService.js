import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';

export async function createPoolCompetitor(poolId, payload, actor = null) {
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Informe o nome do competidor.');
  const ref = await addDoc(collection(db, 'pool_competitors'), {
    pool_id: poolId,
    name,
    code: String(payload.code || '').trim().toUpperCase().slice(0, 8),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  if (actor) {
    await createAuditLog({ action: 'pool_competitor_created', actor, poolId, details: { competitor_id: ref.id, name } });
  }
  return ref.id;
}

export async function deletePoolCompetitor(poolId, competitorId, actor = null) {
  await deleteDoc(doc(db, 'pool_competitors', competitorId));
  if (actor) {
    await createAuditLog({ action: 'pool_competitor_deleted', actor, poolId, details: { competitor_id: competitorId } });
  }
}

export async function createPoolMatch(poolId, payload, actor = null) {
  if (!payload.home_team_id || !payload.away_team_id) throw new Error('Selecione os dois competidores.');
  if (payload.home_team_id === payload.away_team_id) throw new Error('Os competidores precisam ser diferentes.');
  const kickoff = payload.kickoff_at ? new Date(payload.kickoff_at) : null;
  const betLock = payload.bet_lock_at ? new Date(payload.bet_lock_at) : kickoff;
  const ref = await addDoc(collection(db, 'pool_matches'), {
    pool_id: poolId,
    stage_code: payload.stage_code,
    stage_label: payload.stage_label || payload.stage_code,
    group_code: payload.group_code || '',
    sequence_in_stage: Number(payload.sequence_in_stage) || Date.now(),
    kickoff_at: kickoff,
    bet_lock_at: betLock,
    home_team_id: payload.home_team_id,
    away_team_id: payload.away_team_id,
    home_placeholder: '',
    away_placeholder: '',
    official_home_score: null,
    official_away_score: null,
    official_home_penalties: null,
    official_away_penalties: null,
    penalty_winner_team_id: null,
    zebra_team_id: null,
    zebra_multiplier: null,
    status: 'scheduled',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  if (actor) {
    await createAuditLog({ action: 'pool_match_created', actor, poolId, details: { match_id: ref.id } });
  }
  return ref.id;
}

export async function updatePoolMatchResult(poolId, matchId, updates, actor = null) {
  await updateDoc(doc(db, 'pool_matches', matchId), {
    official_home_score: updates.official_home_score,
    official_away_score: updates.official_away_score,
    official_home_penalties: updates.official_home_penalties ?? null,
    official_away_penalties: updates.official_away_penalties ?? null,
    penalty_winner_team_id: updates.penalty_winner_team_id || null,
    zebra_team_id: updates.zebra_team_id || null,
    zebra_multiplier: updates.zebra_multiplier || null,
    status: updates.status,
    updated_at: serverTimestamp(),
  });
  if (actor) {
    await createAuditLog({ action: 'pool_match_result_updated', actor, poolId, details: { match_id: matchId, status: updates.status } });
  }
}

export async function deletePoolMatch(poolId, matchId, actor = null) {
  await deleteDoc(doc(db, 'pool_matches', matchId));
  if (actor) {
    await createAuditLog({ action: 'pool_match_deleted', actor, poolId, details: { match_id: matchId } });
  }
}
