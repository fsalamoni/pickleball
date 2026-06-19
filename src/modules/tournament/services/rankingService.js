/**
 * Cálculo de ranking ao vivo a partir dos jogos persistidos.
 * Não persiste nada — é consumido pelos hooks para exibição.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { listMatches } from './matchService.js';
import { listRegistrations } from './registrationService.js';
import { getModality } from './modalityService.js';
import { getTournament } from './tournamentService.js';
import { normalizeScoringConfig } from '../domain/scoring.js';
import { buildRanking } from '../domain/ranking.js';
import { normalizePhases, supportsGroups } from '../domain/phases.js';
import { rankEntrantsInGroup } from '../domain/phaseProgression.js';
import { TOURNAMENT_STAGE_TYPE_LABELS } from '../domain/constants.js';

/**
 * Calcula o ranking de uma modalidade considerando todas as fases já jogadas
 * (ou apenas uma fase específica se `stageIndex` for fornecido).
 */
export async function computeModalityRanking(modalityId, stageIndex) {
  const modality = await getModality(modalityId);
  if (!modality) return [];
  const tournament = await getTournament(modality.tournament_id);
  const cfg = normalizeScoringConfig(modality.scoring_override || tournament?.scoring);

  const stages = modality.stages || [];
  const matches = [];
  if (typeof stageIndex === 'number') {
    matches.push(...(await listMatches(modalityId, stageIndex)));
  } else {
    for (let i = 0; i < stages.length; i += 1) {
      matches.push(...(await listMatches(modalityId, i)));
    }
  }

  const registrations = await listRegistrations(modalityId);
  const participantIds = registrations.map((r) => r.id);

  const ranking = buildRanking(matches, participantIds, cfg);

  // enriquece com label e fotos dos participantes para o front
  const regById = new Map(registrations.map((r) => [r.id, r]));
  return ranking.map((r) => {
    const reg = regById.get(r.participant_id);
    const label = reg?.label || (reg ? `${reg.player_a_name}${reg.player_b_name ? ' / ' + reg.player_b_name : ''}` : r.participant_id);
    const players = reg
      ? [
          { name: reg.player_a_name, photoUrl: reg.player_a_photo || null },
          ...(reg.player_b_name ? [{ name: reg.player_b_name, photoUrl: reg.player_b_photo || null }] : []),
        ]
      : [];
    return { ...r, label, players };
  });
}

/* --------------------- Ranking estruturado (por fase/grupo) -------------- */

/** Lê os grupos persistidos de uma fase (com a estrutura de entrants). */
async function readPhaseGroups(modalityId, stageIndex) {
  const q = query(
    collection(db, 'tournament_groups'),
    where('modality_id', '==', modalityId),
    where('stage_index', '==', Number(stageIndex)),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data()).sort((a, b) => (a.group_index ?? 0) - (b.group_index ?? 0));
}

/** Monta rótulo e fotos de um entrant a partir das inscrições dos seus membros. */
function describeEntrant(entrant, regById) {
  const members = entrant.members || [entrant.id];
  const players = [];
  const names = [];
  members.forEach((mid) => {
    const reg = regById.get(mid);
    if (!reg) {
      names.push(entrant.label || mid);
      return;
    }
    names.push(reg.label || reg.player_a_name || mid);
    players.push({ name: reg.player_a_name, photoUrl: reg.player_a_photo || null });
    if (reg.player_b_name) players.push({ name: reg.player_b_name, photoUrl: reg.player_b_photo || null });
  });
  return { label: names.join(' + '), players };
}

/** Converte um entrant classificado em uma linha de ranking para o front. */
function rowFromRanked(ranked, regById) {
  const { label, players } = describeEntrant(ranked, regById);
  const s = ranked.stats || {};
  return {
    key: ranked.id,
    position: ranked.rank,
    label,
    players,
    played: Math.round(s.played || 0),
    wins: Math.round(s.wins || 0),
    losses: Math.round(s.losses || 0),
    sets_won: Math.round(s.sets_won || 0),
    sets_lost: Math.round(s.sets_lost || 0),
    points_for: Math.round(s.points_for || 0),
    points_against: Math.round(s.points_against || 0),
  };
}

/**
 * Ranking ESTRUTURADO de uma modalidade, condizente com a estrutura do torneio:
 * uma seção por fase e, dentro dela, uma classificação por grupo (ou uma única
 * tabela quando não há subdivisão). Duplas formadas são classificadas como uma
 * unidade (não divididas em jogadores).
 *
 * @param {string} modalityId
 * @returns {Promise<{ structured: boolean, phases: Array<object> }>}
 */
export async function computeModalityRankingStructured(modalityId) {
  const modality = await getModality(modalityId);
  if (!modality) return { structured: false, phases: [] };
  const tournament = await getTournament(modality.tournament_id);
  const cfg = normalizeScoringConfig(modality.scoring_override || tournament?.scoring);

  const phases = normalizePhases(modality.stages);
  const registrations = await listRegistrations(modalityId);
  const regById = new Map(registrations.map((r) => [r.id, r]));

  const result = [];
  for (let i = 0; i < phases.length; i += 1) {
    const phase = phases[i];
    const matches = await listMatches(modalityId, i);
    if (matches.length === 0) {
      result.push({
        stageIndex: i,
        type: phase.type,
        typeLabel: TOURNAMENT_STAGE_TYPE_LABELS[phase.type] || phase.type,
        groups: [],
        played: false,
      });
      continue;
    }
    const storedGroups = await readPhaseGroups(modalityId, i);

    let groups;
    if (storedGroups.length > 0) {
      groups = storedGroups.map((g) => {
        const entrants = Array.isArray(g.entrants) && g.entrants.length
          ? g.entrants
          : (g.participants || []).map((id) => ({ id, members: [id] }));
        const memberSet = new Set(entrants.flatMap((e) => e.members || [e.id]));
        const groupMatches = matches.filter((m) =>
          (m.group ? m.group === g.name : (m.side_a_ids || []).some((id) => memberSet.has(id))));
        const ranked = rankEntrantsInGroup(entrants, groupMatches, cfg);
        return { name: g.name, rows: ranked.map((r) => rowFromRanked(r, regById)) };
      });
    } else {
      // Sem subdivisão: um único grupo com todos os participantes da fase.
      const ids = new Set();
      matches.forEach((m) => {
        (m.side_a_ids || []).forEach((id) => ids.add(id));
        (m.side_b_ids || []).forEach((id) => ids.add(id));
      });
      const entrants = [...ids].map((id) => ({ id, members: [id] }));
      const ranked = rankEntrantsInGroup(entrants, matches, cfg);
      groups = [{ name: null, rows: ranked.map((r) => rowFromRanked(r, regById)) }];
    }

    result.push({
      stageIndex: i,
      type: phase.type,
      typeLabel: TOURNAMENT_STAGE_TYPE_LABELS[phase.type] || phase.type,
      isGrouped: supportsGroups(phase.type) && groups.length > 1,
      groups,
      played: true,
    });
  }

  const structured = phases.length > 1 || result.some((p) => p.groups.length > 1);
  return { structured, phases: result };
}
