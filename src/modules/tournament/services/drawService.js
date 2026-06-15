/**
 * Serviço de sorteio: orquestra a geração e persistência das chaves/grupos,
 * o equilíbrio das duplas/adversários (nível e gênero, dentro do possível) e o
 * agendamento automático dos jogos em quadras e horários.
 */

import { generateDraw } from '../domain/draw.js';
import { stageFormatCompatibility } from '../domain/formatExplain.js';
import { balancedParticipantOrder } from '../domain/seeding.js';
import { listRegistrations } from './registrationService.js';
import { persistMatches } from './matchService.js';
import { getModality } from './modalityService.js';
import { getTournament } from './tournamentService.js';
import {
  REGISTRATION_STATUS,
  MODALITY_FORMAT,
  GENDER_CATEGORY,
  COMPETITION_GENDER,
  TOURNAMENT_STAGE_TYPE,
} from '../domain/constants.js';

/**
 * Deriva o gênero competitivo de uma inscrição, dentro do que é conhecido:
 *  - Se a modalidade já é exclusivamente masculina/feminina, todas as duplas
 *    são desse gênero.
 *  - Caso contrário (aberta/mista), usa o gênero competitivo informado por
 *    jogador; em duplas só conclui quando ambos são do mesmo gênero conhecido.
 */
function deriveGender(reg, modality) {
  if (modality.gender_category === GENDER_CATEGORY.MALE) return COMPETITION_GENDER.MALE;
  if (modality.gender_category === GENDER_CATEGORY.FEMALE) return COMPETITION_GENDER.FEMALE;

  const a = reg.player_a_competition_gender || null;
  if (modality.format !== MODALITY_FORMAT.DOUBLES) return a;

  const b = reg.player_b_competition_gender || null;
  if (a && b && a === b) return a;
  return null; // misto ou desconhecido → preferência de gênero não se aplica
}

/**
 * Monta os metadados (nível e gênero) de cada inscrição confirmada, para o
 * equilíbrio do sorteio.
 */
function buildMeta(registrations, modality) {
  return registrations.map((reg) => ({
    id: reg.id,
    level: reg.player_a_level || null,
    partner_level: modality.format === MODALITY_FORMAT.DOUBLES ? reg.player_b_level || null : null,
    gender: deriveGender(reg, modality),
  }));
}

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

  // A estrutura escolhida precisa ser compatível com o formato de inscrição
  // (ex.: Americano exige inscrição Simples). Falha cedo com mensagem clara.
  const compat = stageFormatCompatibility(modality.format, stage.type);
  if (!compat.compatible) throw new Error(compat.reason);

  const registrations = await listRegistrations(modalityId);
  const confirmed = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED);
  if (confirmed.length < 2) throw new Error('São necessários ao menos 2 inscritos confirmados.');

  // Define a ordem dos participantes:
  //  1) ordem manual explícita, se fornecida;
  //  2) ordem por cabeças-de-chave (seed) quando o admin definiu seeds;
  //  3) equilíbrio automático por nível/gênero (dentro do possível);
  //  4) ordem de inscrição (fallback estável).
  const hasManualSeeds = confirmed.some((r) => Number.isFinite(Number(r.seed)));
  const byCreation = confirmed
    .slice()
    .sort((a, b) => (a.seed ?? Infinity) - (b.seed ?? Infinity));

  let participants;
  let balanced = false;
  if (participantOrder && participantOrder.length > 0) {
    participants = participantOrder;
  } else if (hasManualSeeds) {
    participants = byCreation.map((r) => r.id);
  } else {
    const meta = buildMeta(byCreation, modality);
    const ordered = balancedParticipantOrder(meta);
    if (ordered) {
      participants = ordered;
      balanced = true;
    } else {
      participants = byCreation.map((r) => r.id);
    }
  }

  const seed = providedSeed || `${tournamentId}_${modalityId}_${stageIndex}_${Date.now()}`;

  // Quando o equilíbrio por nível foi aplicado:
  //  - grupos usam distribuição "tiered" (grupos homogêneos por nível/gênero);
  //  - chaves usam o nível como cabeça-de-chave (fortes em lados opostos,
  //    encontrando-se nas fases finais).
  const groupStrategy = balanced ? 'tiered' : 'shuffle';
  let seedCount = stage.seed_count || 0;
  const bracketTypes = [
    TOURNAMENT_STAGE_TYPE.KNOCKOUT,
    TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT,
  ];
  if (balanced && bracketTypes.includes(stage.type)) {
    // Em chaves, o nível vira cabeça-de-chave: os mais fortes ficam em lados
    // opostos e só se encontram nas fases finais.
    seedCount = participants.length;
  }

  const draw = generateDraw({
    format: modality.format,
    stageType: stage.type,
    participants,
    groupCount: stage.group_count || 1,
    seedCount,
    seed,
    groupStrategy,
  });

  const tournament = await getTournament(tournamentId);
  const { scheduleWarnings } = await persistMatches(
    tournamentId,
    modalityId,
    stageIndex,
    draw,
    actor,
    {
      schedulingConfig: modality,
      fallbackDate: tournament?.starts_at || null,
    },
  );

  return { ...draw, seed_used: seed, balanced, scheduleWarnings: scheduleWarnings || [] };
}
