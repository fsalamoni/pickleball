/**
 * Jogos do torneio: persistência e lançamento de resultados.
 * Os jogos são gerados a partir do "draw" e gravados em lote.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { MATCH_STATUS } from '../domain/constants.js';
import { getMatchResult } from '../domain/scoring.js';

const COL = 'tournament_matches';

export async function persistMatches(tournamentId, modalityId, stageIndex, draw, actor) {
  const batch = writeBatch(db);
  // remove jogos anteriores da fase (se houver) → este re-sorteio sobrescreve
  const existing = await listMatches(modalityId, stageIndex);
  existing.forEach((m) => batch.delete(doc(db, COL, m.id)));

  draw.matches.forEach((m, idx) => {
    const id = doc(collection(db, COL)).id;
    const payload = {
      id,
      tournament_id: tournamentId,
      modality_id: modalityId,
      stage_index: stageIndex,
      stage_type: draw.stageType,
      group: m.group || null,
      round: m.round || 1,
      position: m.position || idx + 1,
      side_a: serializeSide(m.side_a),
      side_b: serializeSide(m.side_b),
      side_a_ids: normalizeIds(m.side_a),
      side_b_ids: normalizeIds(m.side_b),
      games: [],
      walkover: null,
      status: m.bye ? MATCH_STATUS.WALKOVER : MATCH_STATUS.SCHEDULED,
      scheduled_at: null,
      court: null,
      result_recorded_at: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
    batch.set(doc(db, COL, id), payload);
  });

  if (draw.groups) {
    // persiste a definição de grupos como metadados em tournament_groups
    const groupsCol = collection(db, 'tournament_groups');
    const existingGroupQ = query(
      groupsCol,
      where('modality_id', '==', modalityId),
      where('stage_index', '==', stageIndex),
    );
    const existingGroupSnap = await getDocs(existingGroupQ);
    existingGroupSnap.docs.forEach((g) => batch.delete(g.ref));
    draw.groups.forEach((g) => {
      const gid = doc(groupsCol).id;
      batch.set(doc(groupsCol, gid), {
        id: gid,
        tournament_id: tournamentId,
        modality_id: modalityId,
        stage_index: stageIndex,
        name: g.name,
        participants: g.participants,
        created_at: serverTimestamp(),
      });
    });
  }
  await batch.commit();
  await createAuditLog({
    action: 'matches_generated',
    actor,
    details: { tournament_id: tournamentId, modality_id: modalityId, stage_index: stageIndex, count: draw.matches.length },
  });
}

function serializeSide(side) {
  // Aceita string (id de uma inscrição) ou array de 2 ids (americana).
  if (!side) return null;
  if (Array.isArray(side)) return side.join('+');
  return String(side);
}
function normalizeIds(side) {
  if (!side) return [];
  if (Array.isArray(side)) return side;
  return [String(side)];
}

export async function listMatches(modalityId, stageIndex) {
  const q = query(
    collection(db, COL),
    where('modality_id', '==', modalityId),
    where('stage_index', '==', Number(stageIndex)),
    orderBy('round', 'asc'),
    orderBy('position', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function listMatchesByTournament(tournamentId) {
  const q = query(collection(db, COL), where('tournament_id', '==', tournamentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function getMatch(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? snap.data() : null;
}

export async function recordMatchResult(matchId, payload, scoringConfig, actor) {
  const updates = {
    games: payload.games || [],
    walkover: payload.walkover || null,
    updated_at: serverTimestamp(),
  };
  const result = getMatchResult({ games: updates.games, walkover: updates.walkover }, scoringConfig);
  if (result.finished) {
    updates.status = updates.walkover ? MATCH_STATUS.WALKOVER : MATCH_STATUS.FINISHED;
    updates.winner_side = result.winner;
    updates.sets_a = result.sets_a;
    updates.sets_b = result.sets_b;
    updates.result_recorded_at = serverTimestamp();
  } else {
    updates.status = MATCH_STATUS.IN_PROGRESS;
    updates.winner_side = null;
  }
  await updateDoc(doc(db, COL, matchId), updates);
  await createAuditLog({
    action: 'match_result_recorded',
    actor,
    details: { match_id: matchId, status: updates.status, winner: updates.winner_side || null },
  });
  return updates;
}

export async function deleteMatch(id, actor) {
  await deleteDoc(doc(db, COL, id));
  await createAuditLog({ action: 'match_deleted', actor, details: { match_id: id } });
}

export async function scheduleMatch(id, schedule, actor) {
  await updateDoc(doc(db, COL, id), {
    scheduled_at: schedule.scheduled_at || null,
    court: schedule.court || null,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'match_scheduled', actor, details: { match_id: id } });
}
