/**
 * Cálculo de ranking ao vivo a partir dos jogos persistidos.
 * Não persiste nada — é consumido pelos hooks para exibição.
 */

import { listMatches } from './matchService.js';
import { listRegistrations } from './registrationService.js';
import { getModality } from './modalityService.js';
import { getTournament } from './tournamentService.js';
import { normalizeScoringConfig } from '../domain/scoring.js';
import { buildRanking } from '../domain/ranking.js';

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

  // enriquece com label do participante para o front
  const labelByReg = new Map(registrations.map((r) => [r.id, r.label || `${r.player_a_name}${r.player_b_name ? ' / ' + r.player_b_name : ''}`]));
  return ranking.map((r) => ({ ...r, label: labelByReg.get(r.participant_id) || r.participant_id }));
}
