/**
 * Catálogo de MODELOS de torneio (presets) — o mapa organizado de todas as
 * estruturas viáveis de torneio que a plataforma sabe rodar.
 *
 * Cada modelo é uma função `build(format)` que devolve um array de fases
 * (`stages`) já configuradas, pronto para o editor de fases. Servem como ponto
 * de partida: o organizador escolhe um modelo e ajusta os números (grupos,
 * classificados, etc.). A normalização final acontece em `phases.js`.
 *
 * Os modelos cobrem, de forma organizada, o espectro completo:
 *  - Volta única: pontos corridos, mata-mata, dupla eliminação, suíço,
 *    americano, mexicano;
 *  - Grupos + eliminatória (clássico e cruzado A×B/C×D);
 *  - Combinações por fases (suíço → playoffs; cascata de grupos);
 *  - Os formatos sociais por rotação com final (incl. duplas mistas formadas
 *    pelos classificados).
 *
 * Puro (sem I/O).
 */

import {
  MODALITY_FORMAT,
  TOURNAMENT_STAGE_TYPE,
  PHASE_DIVISION_MODE,
  PHASE_QUALIFIER_MODE,
  PHASE_FEED_MODE,
  PHASE_PAIRING_MODE,
  PHASE_BRACKET_SEEDING,
} from './constants.js';

const T = TOURNAMENT_STAGE_TYPE;
const BOTH = [MODALITY_FORMAT.SINGLES, MODALITY_FORMAT.DOUBLES];
const SINGLES = [MODALITY_FORMAT.SINGLES];

/** Atalho de fase de grupos (todos-contra-todos dentro do grupo). */
function groupsPhase({ groupCount = 4, qualifiers = 2, qualifierMode = PHASE_QUALIFIER_MODE.OVERALL, pairing = PHASE_PAIRING_MODE.NONE } = {}) {
  return {
    type: T.GROUPS,
    division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
    group_count: groupCount,
    qualifiers_per_group: qualifiers,
    qualifier_mode: qualifierMode,
    pairing_mode: pairing,
  };
}

/** Atalho de fase em chave (mata-mata). */
function knockoutPhase({ seeding = PHASE_BRACKET_SEEDING.STANDARD, thirdPlace = false } = {}) {
  return { type: T.KNOCKOUT, bracket_seeding: seeding, third_place: thirdPlace };
}

/**
 * Catálogo. `formats` indica a quais formatos de inscrição o modelo se aplica.
 */
export const TOURNAMENT_PRESETS = Object.freeze([
  {
    id: 'rr_simple',
    label: 'Pontos corridos (todos contra todos)',
    description: 'Uma única fase: todos jogam contra todos. A classificação final sai do desempenho geral. Simples e justo para grupos pequenos.',
    formats: BOTH,
    build: () => [{ type: T.ROUND_ROBIN, division_mode: PHASE_DIVISION_MODE.SINGLE }],
  },
  {
    id: 'rr_final',
    label: 'Pontos corridos + final',
    description: 'Todos contra todos e, em seguida, os 2 melhores disputam a grande final em jogo único.',
    formats: BOTH,
    build: () => [
      {
        type: T.ROUND_ROBIN,
        division_mode: PHASE_DIVISION_MODE.SINGLE,
        qualifiers_per_group: 2,
        qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
        feed_mode: PHASE_FEED_MODE.POOL_ALL,
      },
      knockoutPhase(),
    ],
  },
  {
    id: 'groups_ko',
    label: 'Grupos + mata-mata (clássico)',
    description: 'Fase de grupos e depois mata-mata com os 2 melhores de cada grupo, cabeças-de-chave espalhadas (os primeiros colocados só se encontram nas fases finais).',
    formats: BOTH,
    build: () => [
      groupsPhase({ groupCount: 4, qualifiers: 2 }),
      { type: T.KNOCKOUT, feed_mode: PHASE_FEED_MODE.POOL_ALL, bracket_seeding: PHASE_BRACKET_SEEDING.STANDARD },
    ],
  },
  {
    id: 'groups_ko_cross',
    label: 'Grupos + mata-mata cruzado (A×B, C×D)',
    description: 'Fase de grupos e depois mata-mata cruzado: o vencedor do grupo A enfrenta o do B, o do C enfrenta o do D, e os vencedores se cruzam.',
    formats: BOTH,
    build: () => [
      groupsPhase({ groupCount: 4, qualifiers: 1 }),
      { type: T.KNOCKOUT, feed_mode: PHASE_FEED_MODE.INHERIT_GROUPS, bracket_seeding: PHASE_BRACKET_SEEDING.ADJACENT },
    ],
  },
  {
    id: 'single_ko',
    label: 'Mata-mata simples',
    description: 'Eliminação direta: quem perde está fora. Rápido e decisivo.',
    formats: BOTH,
    build: () => [knockoutPhase()],
  },
  {
    id: 'single_ko_bronze',
    label: 'Mata-mata + disputa de 3º lugar',
    description: 'Eliminação direta com disputa de 3º lugar entre os perdedores das semifinais (medalha de bronze).',
    formats: BOTH,
    build: () => [knockoutPhase({ thirdPlace: true })],
  },
  {
    id: 'double_ko',
    label: 'Dupla eliminação',
    description: 'Cada participante só é eliminado após duas derrotas. Quem perde vai para a chave de repescagem e ainda pode ser campeão.',
    formats: BOTH,
    build: () => [{ type: T.DOUBLE_KNOCKOUT }],
  },
  {
    id: 'swiss',
    label: 'Sistema suíço',
    description: 'A cada rodada, quem tem pontuação parecida se enfrenta, sem eliminação e sem repetir confrontos. Ótimo para muitos inscritos e poucas rodadas.',
    formats: BOTH,
    build: () => [{ type: T.SWISS, division_mode: PHASE_DIVISION_MODE.SINGLE }],
  },
  {
    id: 'swiss_ko',
    label: 'Suíço + playoffs (mata-mata)',
    description: 'Rodadas suíças para classificar e, em seguida, mata-mata entre os 4 melhores.',
    formats: BOTH,
    build: () => [
      {
        type: T.SWISS,
        division_mode: PHASE_DIVISION_MODE.SINGLE,
        qualifiers_per_group: 4,
        qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
        feed_mode: PHASE_FEED_MODE.POOL_ALL,
      },
      knockoutPhase(),
    ],
  },
  {
    id: 'groups_cascade',
    label: 'Cascata de grupos (grupos → grupos → final)',
    description: 'Grupos grandes que afunilam: os melhores se juntam em novos grupos (A+B → AB) e, por fim, os finalistas decidem no mata-mata.',
    formats: BOTH,
    build: () => [
      groupsPhase({ groupCount: 4, qualifiers: 2 }),
      {
        type: T.GROUPS,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 2,
        feed_mode: PHASE_FEED_MODE.MERGE_GROUPS,
        merge_size: 2,
        qualifiers_per_group: 1,
        qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
      },
      { type: T.KNOCKOUT, feed_mode: PHASE_FEED_MODE.INHERIT_GROUPS, bracket_seeding: PHASE_BRACKET_SEEDING.ADJACENT },
    ],
  },
  {
    id: 'americano',
    label: 'Americano (rotação)',
    description: 'Inscrição individual. Cada jogador forma dupla com todos os demais uma vez; nenhuma dupla se repete e os adversários ficam equilibrados.',
    formats: SINGLES,
    build: () => [{ type: T.AMERICANO, division_mode: PHASE_DIVISION_MODE.SINGLE }],
  },
  {
    id: 'mexicano',
    label: 'Mexicano (rotação dinâmica)',
    description: 'Inscrição individual. Quadras de 4 reorganizadas a cada rodada pela classificação (1º+4º × 2º+3º): quem vence sobe de quadra. Jogos sempre equilibrados.',
    formats: SINGLES,
    build: () => [{ type: T.MEXICANO, division_mode: PHASE_DIVISION_MODE.SINGLE }],
  },
  {
    id: 'americano_groups_mixed_final',
    label: 'Americano em grupos + final de duplas mistas',
    description: 'Grupos no formato americano; passam o melhor homem e a melhor mulher de cada grupo, que formam uma dupla mista. As duplas decidem no mata-mata cruzado (A×B, C×D).',
    formats: SINGLES,
    build: () => [
      groupsPhase({
        groupCount: 4,
        qualifiers: 1,
        qualifierMode: PHASE_QUALIFIER_MODE.BY_GENDER,
        pairing: PHASE_PAIRING_MODE.MIXED_BY_GROUP,
      }),
      // a fase de grupos no formato americano:
      { type: T.KNOCKOUT, feed_mode: PHASE_FEED_MODE.INHERIT_GROUPS, bracket_seeding: PHASE_BRACKET_SEEDING.ADJACENT },
    ].map((s, i) => (i === 0 ? { ...s, type: T.AMERICANO } : s)),
  },
  {
    id: 'americano_three_phase',
    label: 'Americano em 3 fases (com fusão de grupos)',
    description: 'Fase 1: 4 grupos no americano, passam os 2 melhores. Fase 2: grupos AB e CD (fusão), passam os 2 melhores que formam uma dupla. Fase 3: final entre as duplas AB e CD.',
    formats: SINGLES,
    build: () => [
      {
        type: T.AMERICANO,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 4,
        qualifiers_per_group: 2,
        qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
      },
      {
        type: T.AMERICANO,
        division_mode: PHASE_DIVISION_MODE.GROUP_COUNT,
        group_count: 2,
        feed_mode: PHASE_FEED_MODE.MERGE_GROUPS,
        merge_size: 2,
        qualifiers_per_group: 2,
        qualifier_mode: PHASE_QUALIFIER_MODE.OVERALL,
        pairing_mode: PHASE_PAIRING_MODE.PAIR_TOP_TWO,
      },
      { type: T.KNOCKOUT, feed_mode: PHASE_FEED_MODE.INHERIT_GROUPS, bracket_seeding: PHASE_BRACKET_SEEDING.ADJACENT },
    ],
  },
]);

/** Modelos aplicáveis a um formato de inscrição. */
export function presetsForFormat(format) {
  return TOURNAMENT_PRESETS.filter((p) => p.formats.includes(format));
}

/** Constrói as fases (cruas) de um modelo para um formato. */
export function buildPreset(presetId, format) {
  const preset = TOURNAMENT_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  return preset.build(format);
}
