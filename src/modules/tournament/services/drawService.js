/**
 * Serviço de sorteio: orquestra a geração e persistência das chaves/grupos.
 */

import { generateDraw } from '../domain/draw.js';
import { listRegistrations } from './registrationService.js';
import { persistMatches } from './matchService.js';
import { getModality } from './modalityService.js';
import { REGISTRATION_STATUS } from '../domain/constants.js';

/**
 * Executa o sorteio de uma determinada fase de uma modalidade.
 *
 * @param {object} params
 * @param {string} params.tournamentId
 * @param {string} params.modalityId
 * @param {number} params.stageIndex
 * @param {string} [params.seed] — semente do RNG; se ausente, gerada automaticamente
 * @param {Array<string>} [params.participantOrder] — ordem manual (sobrescreve registrations)
 * @param {object} actor
 * @returns {Promise<object>}
 */
export async function runDraw(params, actor) {
  const { tournamentId, modalityId, stageIndex, seed: providedSeed, participantOrder } = params;
  const modality = await getModality(modalityId);
  if (!modality) throw new Error('Modalidade não encontrada.');
  if (modality.tournament_id !== tournamentId) throw new Error('Modalidade não pertence ao torneio.');
  const stage = modality.stages?.[stageIndex];
  if (!stage) throw new Error('Fase não encontrada na modalidade.');

  const registrations = await listRegistrations(modalityId);
  const confirmed = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED);
  if (confirmed.length < 2) throw new Error('São necessários ao menos 2 inscritos confirmados.');

  const participants =
    participantOrder && participantOrder.length > 0
      ? participantOrder
      : confirmed.sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity)).map((r) => r.id);

  const seed = providedSeed || `${tournamentId}_${modalityId}_${stageIndex}_${Date.now()}`;

  const draw = generateDraw({
    format: modality.format,
    stageType: stage.type,
    participants,
    groupCount: stage.group_count || 1,
    seedCount: stage.seed_count || 0,
    seed,
  });

  await persistMatches(tournamentId, modalityId, stageIndex, draw, actor);
  return { ...draw, seed_used: seed };
}
