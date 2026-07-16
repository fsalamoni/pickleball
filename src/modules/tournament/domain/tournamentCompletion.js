/**
 * Detecção de conclusão de um torneio (lógica pura, sem I/O).
 *
 * Um torneio está concluído quando todas as modalidades que têm jogos estão
 * concluídas. Uma modalidade está concluída quando:
 *   1. não há jogos pendentes (agendados/em andamento);
 *   2. alcançou a sua última fase configurada; e
 *   3. essa última fase realmente terminou:
 *        - formatos "completos" (grupos/americana): todos os jogos já saem no
 *          sorteio, então basta não haver pendências;
 *        - formatos progressivos (mata-mata, dupla eliminação, suíço, mexicano):
 *          as rodadas são geradas sob demanda, então usamos a MESMA lógica de
 *          avanço (`computeStageAdvance`) para saber se já há campeão — evitando
 *          encerrar cedo demais, entre uma rodada e a próxima.
 *
 * Modalidades sem jogos (ex.: sem inscritos suficientes) não bloqueiam a
 * conclusão do torneio.
 */

import { MATCH_STATUS } from './constants.js';
import { computeStageAdvance, stageSupportsAdvance } from './progression.js';
import { recommendedSwissRounds } from './swiss.js';
import { recommendedMexicanoRounds } from './mexicano.js';

const PENDING_STATUSES = new Set([MATCH_STATUS.SCHEDULED, MATCH_STATUS.IN_PROGRESS]);

/** Índice da última fase configurada da modalidade (0-based). */
function finalStageIndex(modality) {
  const stages = Array.isArray(modality?.stages) ? modality.stages : [];
  return Math.max(stages.length, 1) - 1;
}

/** Existe algum jogo pendente (agendado/em andamento) na lista? */
export function hasPendingMatch(matches = []) {
  return (matches || []).some((m) => PENDING_STATUSES.has(m.status));
}

/**
 * A modalidade alcançou a sua última fase configurada? Verdadeiro quando o maior
 * `stage_index` entre seus jogos é o índice da última fase. Sem jogos → false.
 */
export function isModalityFinalStageReached(modality, modalityMatches = []) {
  if (!modalityMatches || modalityMatches.length === 0) return false;
  const maxStage = modalityMatches.reduce((mx, m) => Math.max(mx, Number(m.stage_index) || 0), 0);
  return maxStage >= finalStageIndex(modality);
}

/** Deriva o contexto de avanço a partir dos jogos da fase final (como o serviço). */
function deriveAdvanceCtx(stageType, stage, stageMatches) {
  if (stageType === 'knockout') {
    return { thirdPlace: Boolean(stage?.third_place) };
  }
  if (stageType === 'swiss' || stageType === 'mexicano') {
    const ids = new Set();
    stageMatches.forEach((m) => {
      (m.side_a_ids || []).forEach((id) => ids.add(id));
      (m.side_b_ids || []).forEach((id) => ids.add(id));
    });
    const participantIds = [...ids];
    return {
      participantIds,
      totalRounds: stageType === 'mexicano'
        ? recommendedMexicanoRounds(participantIds.length)
        : recommendedSwissRounds(participantIds.length),
    };
  }
  if (stageType === 'double_knockout') {
    const wbR1 = stageMatches.filter((m) => (m.bracket || 'wb') === 'wb' && (m.round || 1) === 1);
    return { participantCount: wbR1.length * 2 };
  }
  return {};
}

/**
 * A modalidade está concluída? Ver regra no topo do arquivo.
 *
 * @param {object} modality
 * @param {Array<object>} modalityMatches jogos dessa modalidade (todas as fases)
 * @returns {boolean}
 */
export function isModalityComplete(modality, modalityMatches = []) {
  if (!modalityMatches || modalityMatches.length === 0) return false;
  if (hasPendingMatch(modalityMatches)) return false;
  if (!isModalityFinalStageReached(modality, modalityMatches)) return false;

  const idx = finalStageIndex(modality);
  const stage = Array.isArray(modality?.stages) ? modality.stages[idx] : null;
  const stageType = stage?.type;
  const finalStageMatches = modalityMatches.filter((m) => (Number(m.stage_index) || 0) === idx);

  if (!stageSupportsAdvance(stageType)) {
    // Grupos/americana: todos os jogos saem no sorteio → sem pendências = fim.
    return true;
  }

  // Progressivos: só está concluída quando há campeão (não há próxima rodada).
  const advance = computeStageAdvance(stageType, finalStageMatches, deriveAdvanceCtx(stageType, stage, finalStageMatches));
  return advance?.complete === true;
}

/**
 * O torneio está concluído (pronto para encerrar)?
 *
 * @param {Array<object>} modalities
 * @param {Array<object>} matches todos os jogos do torneio
 * @returns {boolean}
 */
export function isTournamentComplete(modalities = [], matches = []) {
  if (!matches || matches.length === 0) return false;
  if (hasPendingMatch(matches)) return false;

  const byModality = new Map();
  matches.forEach((m) => {
    const key = m.modality_id;
    if (!byModality.has(key)) byModality.set(key, []);
    byModality.get(key).push(m);
  });

  let anyComplete = false;
  for (const modality of (modalities || [])) {
    const mm = byModality.get(modality.id) || [];
    if (mm.length === 0) continue; // modalidade sem jogos não bloqueia
    if (!isModalityComplete(modality, mm)) return false;
    anyComplete = true;
  }
  return anyComplete;
}
