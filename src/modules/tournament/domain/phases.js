/**
 * Modelo de múltiplas fases de uma modalidade.
 *
 * Uma modalidade tem um array `stages` executado em ordem. Cada fase descreve:
 *  - o FORMATO de jogo (pontos corridos, americano, mata-mata, dupla
 *    eliminação, suíço, grupos);
 *  - como os atletas são DIVIDIDOS em grupos (único, nº de grupos, ou máximo
 *    por grupo) — sempre equilibrados (ver `grouping.js`);
 *  - quem se CLASSIFICA para a fase seguinte (quantos por grupo e por qual
 *    critério: geral ou por gênero);
 *  - como os classificados ALIMENTAM a próxima fase (por grupo, fundindo
 *    grupos, ou juntando todos) e se formam DUPLAS (mista por grupo, etc.).
 *
 * Estas funções são puras: normalizam, validam e descrevem fases, sem I/O.
 * Tudo é retrocompatível com as fases simples já existentes (`{ type,
 * group_count, seed_count }`) — campos novos ganham padrões inertes.
 */

import {
  MODALITY_FORMAT,
  TOURNAMENT_STAGE_TYPE,
  STAGE_TYPES_BY_FORMAT,
  PHASE_DIVISION_MODE,
  PHASE_QUALIFIER_MODE,
  PHASE_FEED_MODE,
  PHASE_PAIRING_MODE,
  PHASE_BRACKET_SEEDING,
  MAX_PHASES_PER_MODALITY,
} from './constants.js';
import { normalizeStageScoringOverride } from './scoring.js';

/** Formatos que se dividem naturalmente em grupos paralelos. */
const GROUPED_FORMATS = new Set([
  TOURNAMENT_STAGE_TYPE.ROUND_ROBIN,
  TOURNAMENT_STAGE_TYPE.AMERICANO,
  TOURNAMENT_STAGE_TYPE.GROUPS,
]);

/** Formatos de chave (eliminatórios): jogam todos numa só chave. */
export const BRACKET_FORMATS = new Set([
  TOURNAMENT_STAGE_TYPE.KNOCKOUT,
  TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT,
]);

/** Um formato suporta divisão em vários grupos? */
export function supportsGroups(stageType) {
  return GROUPED_FORMATS.has(stageType);
}

/**
 * Normaliza uma fase, preenchendo os campos novos com padrões seguros e
 * mantendo compatibilidade com o formato antigo.
 *
 * @param {object} raw
 * @param {{ isFirst?: boolean }} [ctx]
 * @returns {object} fase normalizada
 */
export function normalizePhase(raw = {}, ctx = {}) {
  const type = raw.type || TOURNAMENT_STAGE_TYPE.ROUND_ROBIN;
  const isGrouped = supportsGroups(type);

  // Modo de divisão: herda do legado (group_count > 1 → por nº de grupos).
  let divisionMode = raw.division_mode;
  if (!divisionMode) {
    if (!isGrouped) divisionMode = PHASE_DIVISION_MODE.SINGLE;
    else if (Number(raw.group_count) > 1) divisionMode = PHASE_DIVISION_MODE.GROUP_COUNT;
    else divisionMode = PHASE_DIVISION_MODE.SINGLE;
  }
  if (!isGrouped) divisionMode = PHASE_DIVISION_MODE.SINGLE;

  const groupCount = Math.max(1, Math.floor(Number(raw.group_count)) || 1);
  const maxPerGroup = Math.max(2, Math.floor(Number(raw.max_per_group)) || 4);

  const qualifierMode = Object.values(PHASE_QUALIFIER_MODE).includes(raw.qualifier_mode)
    ? raw.qualifier_mode
    : PHASE_QUALIFIER_MODE.OVERALL;
  // Padrão 2 classificados por grupo quando não informado (cobre o caso comum
  // de alimentar uma próxima fase — inclusive Americano, que exige ≥ 4). Um 0
  // explícito é preservado (validado adiante para fases não-finais).
  const qualifiersPerGroup = raw.qualifiers_per_group == null
    ? 2
    : Math.max(0, Math.floor(Number(raw.qualifiers_per_group)) || 0);

  const feedMode = Object.values(PHASE_FEED_MODE).includes(raw.feed_mode)
    ? raw.feed_mode
    : PHASE_FEED_MODE.POOL_ALL;
  const mergeSize = Math.max(2, Math.floor(Number(raw.merge_size)) || 2);

  const pairingMode = Object.values(PHASE_PAIRING_MODE).includes(raw.pairing_mode)
    ? raw.pairing_mode
    : PHASE_PAIRING_MODE.NONE;

  const bracketSeeding = Object.values(PHASE_BRACKET_SEEDING).includes(raw.bracket_seeding)
    ? raw.bracket_seeding
    : PHASE_BRACKET_SEEDING.STANDARD;

  return {
    type,
    name: raw.name || '',
    scoring_override: normalizeStageScoringOverride(raw.scoring_override || {}),
    division_mode: divisionMode,
    group_count: groupCount,
    max_per_group: maxPerGroup,
    seed_count: Math.max(0, Math.floor(Number(raw.seed_count)) || 0),
    // Classificação para a próxima fase (ignorado na última fase).
    qualifiers_per_group: qualifiersPerGroup,
    qualifier_mode: qualifierMode,
    // Alimentação desta fase a partir da anterior (ignorado na primeira fase).
    feed_mode: ctx.isFirst ? PHASE_FEED_MODE.POOL_ALL : feedMode,
    merge_size: mergeSize,
    pairing_mode: pairingMode,
    // Como uma fase de chave monta os confrontos a partir dos classificados.
    bracket_seeding: bracketSeeding,
    // Disputa de 3º lugar (só faz sentido em mata-mata simples).
    third_place: Boolean(raw.third_place),
  };
}

/**
 * Normaliza um array de fases. Garante ao menos 1 fase e aplica os padrões de
 * primeira/última fase. Trunca ao limite de segurança.
 *
 * @param {Array<object>} stages
 * @returns {Array<object>}
 */
export function normalizePhases(stages) {
  const list = Array.isArray(stages) && stages.length > 0
    ? stages
    : [{ type: TOURNAMENT_STAGE_TYPE.ROUND_ROBIN }];
  return list
    .slice(0, MAX_PHASES_PER_MODALITY)
    .map((s, i) => normalizePhase(s, { isFirst: i === 0 }));
}

/**
 * Fábrica de uma fase padrão para um dado formato de inscrição.
 * @param {string} format MODALITY_FORMAT
 * @param {boolean} isFirst
 */
export function defaultPhase(format = MODALITY_FORMAT.DOUBLES, isFirst = true) {
  const allowed = STAGE_TYPES_BY_FORMAT[format] || [TOURNAMENT_STAGE_TYPE.ROUND_ROBIN];
  return normalizePhase({ type: allowed[0], scoring_override: {} }, { isFirst });
}

/**
 * Valida a configuração de fases de uma modalidade.
 *
 * @param {Array<object>} stages
 * @param {string} format MODALITY_FORMAT
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePhases(stages, format) {
  const errors = [];
  const phases = normalizePhases(stages);
  const allowed = new Set(STAGE_TYPES_BY_FORMAT[format] || []);

  phases.forEach((p, i) => {
    const human = `Fase ${i + 1}`;
    if (!allowed.has(p.type)) {
      errors.push(`${human}: formato incompatível com a inscrição (${format}).`);
    }
    if (p.division_mode === PHASE_DIVISION_MODE.GROUP_COUNT && p.group_count < 1) {
      errors.push(`${human}: número de grupos inválido.`);
    }
    if (p.division_mode === PHASE_DIVISION_MODE.MAX_PER_GROUP && p.max_per_group < 2) {
      errors.push(`${human}: máximo por grupo deve ser ao menos 2.`);
    }
    // Toda fase, exceto a última, precisa classificar alguém.
    const isLast = i === phases.length - 1;
    if (!isLast && p.qualifiers_per_group < 1) {
      errors.push(`${human}: defina quantos classificados avançam para a próxima fase.`);
    }
    // Coerência da formação de duplas mistas.
    if (
      p.pairing_mode === PHASE_PAIRING_MODE.MIXED_BY_GROUP
      && p.qualifier_mode !== PHASE_QUALIFIER_MODE.BY_GENDER
    ) {
      errors.push(`${human}: formar dupla mista por grupo exige classificação por gênero (M e F).`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Quantidade de grupos prevista para uma fase, dado o total de atletas.
 * @param {object} phase fase normalizada
 * @param {number} total
 * @returns {number}
 */
export function plannedGroupCount(phase, total) {
  if (!supportsGroups(phase.type)) return 1;
  if (phase.division_mode === PHASE_DIVISION_MODE.SINGLE) return 1;
  if (phase.division_mode === PHASE_DIVISION_MODE.MAX_PER_GROUP) {
    const cap = Math.max(1, phase.max_per_group);
    return Math.max(1, Math.min(total || 1, Math.ceil((total || 0) / cap) || 1));
  }
  return Math.max(1, Math.min(total || 1, phase.group_count));
}
