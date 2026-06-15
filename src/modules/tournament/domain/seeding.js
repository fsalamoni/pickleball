/**
 * Ordenação dos participantes para o sorteio, levando em conta nível e gênero.
 *
 * Objetivos (todos "dentro do possível", nunca regras absolutas):
 *  - Níveis mais elevados têm preferência em se enfrentar (evitar que duplas
 *    fortes encarem duplas muito mais fracas).
 *  - Quando o gênero competitivo é conhecido, duplas masculinas tendem a
 *    enfrentar masculinas e femininas a enfrentar femininas.
 *
 * Estas funções são puras e só dependem de dados (sem I/O). O ranking de nível
 * usa a tabela oficial de nivelamento (do mais fraco ao mais forte).
 */

import { LEVEL_TABLE } from '../../leveling/data/levels.js';
import { COMPETITION_GENDER } from './constants.js';

// id do nível → posição na tabela (0 = mais fraco). Aceita também badge/nome
// como fallback, espelhando getLevelByCode da tabela de níveis.
const LEVEL_RANK = new Map();
LEVEL_TABLE.forEach((level, index) => {
  LEVEL_RANK.set(level.id, index);
  LEVEL_RANK.set(level.badge, index);
  LEVEL_RANK.set(level.name, index);
});

/**
 * Retorna a força do nível (0 = mais fraco, maior = mais forte) ou -1 quando
 * desconhecido/ausente.
 * @param {string|null|undefined} code
 * @returns {number}
 */
export function levelRank(code) {
  if (code == null) return -1;
  return LEVEL_RANK.has(code) ? LEVEL_RANK.get(code) : -1;
}

/**
 * Bucket de gênero competitivo de uma inscrição:
 *  - 'male' / 'female' quando conhecido (e homogêneo, no caso de duplas);
 *  - 'unknown' caso contrário (duplas mistas ou sem dado).
 * @param {{ gender?: string|null }} meta
 * @returns {'male'|'female'|'unknown'}
 */
export function genderBucket(meta) {
  const g = meta?.gender;
  if (g === COMPETITION_GENDER.MALE) return 'male';
  if (g === COMPETITION_GENDER.FEMALE) return 'female';
  return 'unknown';
}

/**
 * Força combinada de uma inscrição (para duplas, média dos dois níveis quando
 * ambos conhecidos; senão o que houver). Retorna -1 quando nada é conhecido.
 * @param {{ level?: string|null, partner_level?: string|null }} meta
 * @returns {number}
 */
export function combinedStrength(meta) {
  const a = levelRank(meta?.level);
  const b = levelRank(meta?.partner_level);
  const known = [a, b].filter((r) => r >= 0);
  if (known.length === 0) return -1;
  return known.reduce((s, r) => s + r, 0) / known.length;
}

/**
 * Indica se há informação de nível suficiente para valer a pena ordenar por
 * força (pelo menos dois participantes com nível conhecido).
 * @param {Array<object>} metas
 */
export function hasUsefulLevels(metas = []) {
  return metas.filter((m) => combinedStrength(m) >= 0).length >= 2;
}

/**
 * Ordena as inscrições da mais forte para a mais fraca (estável; inscrições sem
 * nível conhecido vão para o fim preservando a ordem original).
 *
 * @param {Array<{ id: string }>} metas
 * @returns {Array<object>} mesma forma de entrada, reordenada
 */
export function orderByStrengthDesc(metas = []) {
  return metas
    .map((m, index) => ({ m, index, strength: combinedStrength(m) }))
    .sort((x, y) => {
      const ax = x.strength < 0 ? -Infinity : x.strength;
      const ay = y.strength < 0 ? -Infinity : y.strength;
      if (ay !== ax) return ay - ax; // mais forte primeiro
      return x.index - y.index; // estável
    })
    .map((e) => e.m);
}

/**
 * Produz a ordem final dos ids de participantes para o sorteio.
 *
 * Estratégia:
 *  - Se nenhum nível útil estiver disponível, devolve null para sinalizar que o
 *    chamador deve manter a ordem atual (sem mudança de comportamento).
 *  - Caso contrário, agrupa por gênero (masculino, feminino, desconhecido) — o
 *    que faz duplas do mesmo gênero ficarem próximas e tenderem a se enfrentar —
 *    e, dentro de cada grupo, ordena da mais forte para a mais fraca.
 *
 * Como agrupamos por gênero apenas quando ele é conhecido para parte dos
 * inscritos, a preferência de gênero é sempre "dentro do possível": inscrições
 * sem gênero definido não são penalizadas, apenas ordenadas por nível.
 *
 * @param {Array<{ id: string, level?: string|null, partner_level?: string|null, gender?: string|null }>} metas
 * @param {{ clusterByGender?: boolean }} [options]
 * @returns {string[]|null} ids ordenados, ou null se não houver dado útil
 */
export function balancedParticipantOrder(metas = [], options = {}) {
  const { clusterByGender = true } = options;
  if (!hasUsefulLevels(metas)) return null;

  if (!clusterByGender) {
    return orderByStrengthDesc(metas).map((m) => m.id);
  }

  const buckets = { male: [], female: [], unknown: [] };
  metas.forEach((m) => buckets[genderBucket(m)].push(m));

  // Se gênero é desconhecido para todos, o agrupamento não muda nada.
  const knownGendered = buckets.male.length + buckets.female.length;
  const order =
    knownGendered === 0
      ? orderByStrengthDesc(metas)
      : [
          ...orderByStrengthDesc(buckets.male),
          ...orderByStrengthDesc(buckets.female),
          ...orderByStrengthDesc(buckets.unknown),
        ];

  return order.map((m) => m.id);
}
