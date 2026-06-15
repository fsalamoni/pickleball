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
import { assignSchedule } from '../domain/scheduling.js';

const COL = 'tournament_matches';

/**
 * Persiste os jogos gerados por um sorteio. Quando uma configuração de
 * agendamento é fornecida (`scheduleOptions.schedulingConfig`), cada jogo é
 * automaticamente alocado em uma quadra e horário, sem conflito de jogadores,
 * respeitando a duração média e a janela de horários da modalidade.
 *
 * @param {string} tournamentId
 * @param {string} modalityId
 * @param {number} stageIndex
 * @param {object} draw saída de generateDraw
 * @param {object} actor
 * @param {{ schedulingConfig?: object, fallbackDate?: string|Date|null }} [scheduleOptions]
 * @returns {Promise<{ scheduleWarnings: string[] }>}
 */
export async function persistMatches(tournamentId, modalityId, stageIndex, draw, actor, scheduleOptions = {}) {
  const batch = writeBatch(db);
  // remove jogos anteriores da fase (se houver) → este re-sorteio sobrescreve
  const existing = await listMatches(modalityId, stageIndex);
  existing.forEach((m) => batch.delete(doc(db, COL, m.id)));

  // 1) Monta os payloads (com ids estáveis) antes de agendar.
  const payloads = draw.matches.map((m, idx) => {
    const id = doc(collection(db, COL)).id;
    return {
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
      court_index: null,
      slot: null,
      result_recorded_at: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    };
  });

  // 2) Agendamento automático em quadras/horários (somente jogos disputáveis;
  // byes não ocupam quadra).
  let scheduleWarnings = [];
  if (scheduleOptions.schedulingConfig) {
    const schedulable = payloads.filter((p) => p.status !== MATCH_STATUS.WALKOVER);
    const { byMatchId, warnings } = assignSchedule(schedulable, scheduleOptions.schedulingConfig, {
      fallbackDate: scheduleOptions.fallbackDate || null,
    });
    payloads.forEach((p) => {
      const slot = byMatchId.get(p.id);
      if (slot) {
        p.court = slot.court;
        p.court_index = slot.court_index;
        p.slot = slot.slot;
        p.scheduled_at = slot.scheduled_at;
      }
    });
    scheduleWarnings = warnings;
  }

  // 3) Grava todos os jogos.
  payloads.forEach((p) => batch.set(doc(db, COL, p.id), p));

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
    details: {
      tournament_id: tournamentId,
      modality_id: modalityId,
      stage_index: stageIndex,
      count: draw.matches.length,
      schedule_warnings: scheduleWarnings.length,
    },
  });
  return { scheduleWarnings };
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
  // Apenas `round` é ordenado no servidor para não exigir um índice composto
  // adicional com `position`. A ordenação fina por `position` é feita no
  // cliente — quantidades de jogos por fase são pequenas (centenas) e isso
  // evita falhas silenciosas do botão "Sortear" quando o índice composto
  // (modality_id, stage_index, round, position) não está provisionado.
  const q = query(
    collection(db, COL),
    where('modality_id', '==', modalityId),
    where('stage_index', '==', Number(stageIndex)),
    orderBy('round', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (a.round - b.round) || ((a.position || 0) - (b.position || 0)));
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

export async function markMatchInProgress(matchId, actor) {
  await updateDoc(doc(db, COL, matchId), {
    status: MATCH_STATUS.IN_PROGRESS,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'match_started', actor, details: { match_id: matchId } });
}

/**
 * Reagenda (recalcula quadras e horários) os jogos de uma fase SEM alterar os
 * confrontos. Útil após substituições, troca de configuração de quadras/horário
 * ou simplesmente para reorganizar a grade. Bloqueia se algum jogo já começou
 * ou terminou, para não bagunçar o andamento.
 *
 * @param {string} modalityId
 * @param {number} stageIndex
 * @param {object} modality modalidade (com a config de agendamento)
 * @param {object|null} tournament torneio (para data base, opcional)
 * @param {object} actor
 * @returns {Promise<{ scheduleWarnings: string[], count: number }>}
 */
export async function rescheduleMatches(modalityId, stageIndex, modality, tournament, actor) {
  const all = await listMatches(modalityId, stageIndex);
  if (all.length === 0) {
    throw new Error('Não há jogos para reagendar. Faça o sorteio primeiro.');
  }
  const started = all.filter(
    (m) => m.status === MATCH_STATUS.IN_PROGRESS || m.status === MATCH_STATUS.FINISHED,
  );
  if (started.length > 0) {
    throw new Error(
      'Já existem jogos em andamento ou encerrados. Não é possível reagendar sem afetar o andamento.',
    );
  }

  const schedulable = all.filter((m) => m.status !== MATCH_STATUS.WALKOVER);
  const { byMatchId, warnings } = assignSchedule(schedulable, modality || {}, {
    fallbackDate: tournament?.starts_at || null,
  });

  const batch = writeBatch(db);
  all.forEach((m) => {
    const slot = byMatchId.get(m.id);
    batch.update(doc(db, COL, m.id), {
      court: slot?.court ?? null,
      court_index: slot?.court_index ?? null,
      slot: slot?.slot ?? null,
      scheduled_at: slot?.scheduled_at ?? null,
      updated_at: serverTimestamp(),
    });
  });
  await batch.commit();
  await createAuditLog({
    action: 'matches_rescheduled',
    actor,
    details: {
      modality_id: modalityId,
      stage_index: stageIndex,
      count: schedulable.length,
      schedule_warnings: warnings.length,
    },
  });
  return { scheduleWarnings: warnings, count: schedulable.length };
}

export async function reShuffleRemainingMatches(modalityId, stageIndex, actor) {
  const allMatches = await listMatches(modalityId, stageIndex);
  const doneStatuses = new Set([MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER]);
  const pending = allMatches.filter((m) => !doneStatuses.has(m.status));

  if (pending.length === 0) throw new Error('Nenhum jogo pendente para resortear.');

  // Fisher-Yates inline com Math.random (reshuffle não precisa ser reproduzível)
  const shuffled = pending.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Reatribui rodadas garantindo que nenhum jogador jogue duas vezes na mesma rodada
  const reassigned = [];
  const remaining = shuffled.slice();
  let round = 1;
  while (remaining.length > 0) {
    const busy = new Set();
    const scheduled = [];
    const leftovers = [];
    for (const m of remaining) {
      const players = [...(m.side_a_ids || []), ...(m.side_b_ids || [])];
      if (players.some((p) => busy.has(p))) {
        leftovers.push(m);
      } else {
        players.forEach((p) => busy.add(p));
        scheduled.push({ ...m, round, position: reassigned.length + scheduled.length + 1 });
      }
    }
    if (scheduled.length === 0 && leftovers.length > 0) {
      const m = leftovers.shift();
      reassigned.push({ ...m, round, position: reassigned.length + 1 });
      remaining.splice(0, remaining.length, ...leftovers);
    } else {
      reassigned.push(...scheduled);
      remaining.splice(0, remaining.length, ...leftovers);
    }
    round++;
  }

  const batch = writeBatch(db);
  reassigned.forEach((m) => {
    batch.update(doc(db, COL, m.id), {
      round: m.round,
      position: m.position,
      updated_at: serverTimestamp(),
    });
  });
  await batch.commit();
  await createAuditLog({
    action: 'matches_reshuffled',
    actor,
    details: { modality_id: modalityId, stage_index: stageIndex, count: reassigned.length },
  });
  return { count: reassigned.length };
}

export async function substitutePlayer(matchId, { oldRegistrationId, newRegistrationId }, actor) {
  const match = await getMatch(matchId);
  if (!match) throw new Error('Jogo não encontrado.');

  const sideAIds = match.side_a_ids || [];
  const sideBIds = match.side_b_ids || [];

  const newSideAIds = sideAIds.map((id) => (id === oldRegistrationId ? newRegistrationId : id));
  const newSideBIds = sideBIds.map((id) => (id === oldRegistrationId ? newRegistrationId : id));

  const unchanged =
    newSideAIds.every((id, i) => id === sideAIds[i]) &&
    newSideBIds.every((id, i) => id === sideBIds[i]);
  if (unchanged) throw new Error('Jogador não encontrado no jogo.');

  const serializeIds = (ids) => {
    if (!ids || ids.length === 0) return null;
    if (ids.length === 1) return ids[0];
    return ids.join('+');
  };

  await updateDoc(doc(db, COL, matchId), {
    side_a_ids: newSideAIds,
    side_b_ids: newSideBIds,
    side_a: serializeIds(newSideAIds),
    side_b: serializeIds(newSideBIds),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'match_player_substituted',
    actor,
    details: { match_id: matchId, old_registration_id: oldRegistrationId, new_registration_id: newRegistrationId },
  });
}
