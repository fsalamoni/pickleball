/**
 * Motor de divisão de atletas em grupos equilibrados.
 *
 * Regras (exatas, claras e precisas — espelham o pedido do produto):
 *  1. TAMANHO: os grupos são equilibrados. A diferença de tamanho entre
 *     qualquer par de grupos nunca passa de 1 atleta (ex.: 19 atletas em 4
 *     grupos → 3 grupos de 5 e 1 grupo de 4).
 *  2. GÊNERO: homens e mulheres são distribuídos de forma equilibrada — a
 *     diferença na contagem de cada gênero entre grupos é a menor possível
 *     (no máximo 1 quando o total daquele gênero permite).
 *  3. NÍVEL: dentro de cada gênero os atletas são distribuídos em "serpentina"
 *     por força (nivelamento), de modo que nenhum grupo concentre os mais
 *     fortes — os grupos ficam o mais parelhos possível em força total.
 *
 * Tudo é PURO e DETERMINÍSTICO dada a `seed` (reprodutível: re-sortear com a
 * mesma seed devolve o mesmo resultado; trocar a seed gera nova distribuição).
 *
 * O motor opera sobre "entrants" abstratos (um atleta individual, uma dupla
 * fixa, ou uma dupla formada por classificação) — cada entrant é uma unidade
 * indivisível que entra inteira num grupo.
 */

import { PHASE_DIVISION_MODE } from './constants.js';
import { seededRng, shuffle } from './draw.js';

/** Nome canônico do grupo de índice 0-based: Grupo A, B, C, … (AA, AB após Z). */
export function groupLetter(index) {
  if (index < 26) return String.fromCharCode(65 + index);
  const first = Math.floor(index / 26) - 1;
  const second = index % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}

/**
 * Calcula a quantidade de grupos e o tamanho de cada um, equilibrados, a partir
 * do total de atletas e do modo de divisão escolhido.
 *
 * @param {number} total número de entrants
 * @param {{ mode?: string, groupCount?: number, maxPerGroup?: number }} options
 * @returns {{ groupCount: number, sizes: number[] }}
 *   `sizes[i]` = quantidade de atletas do grupo i (diferença máxima de 1).
 */
export function computeGroupSizes(total, options = {}) {
  const n = Math.max(0, Math.floor(total) || 0);
  const mode = options.mode || PHASE_DIVISION_MODE.SINGLE;

  let groupCount;
  if (mode === PHASE_DIVISION_MODE.SINGLE) {
    groupCount = 1;
  } else if (mode === PHASE_DIVISION_MODE.MAX_PER_GROUP) {
    const cap = Math.max(1, Math.floor(options.maxPerGroup) || 1);
    groupCount = n > 0 ? Math.ceil(n / cap) : 1;
  } else {
    groupCount = Math.max(1, Math.floor(options.groupCount) || 1);
  }
  // Nunca mais grupos do que atletas (evita grupos vazios).
  if (n > 0) groupCount = Math.min(groupCount, n);
  groupCount = Math.max(1, groupCount);

  const base = Math.floor(n / groupCount);
  const extra = n % groupCount; // os primeiros `extra` grupos recebem +1
  const sizes = Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0));
  return { groupCount, sizes };
}

/**
 * Bucket de gênero de um entrant: 'male' | 'female' | 'unknown'.
 * Aceita tanto 'male'/'female' (string) quanto 1/0 (numérico).
 */
function genderOf(entrant) {
  const g = entrant?.gender;
  if (g === 'male' || g === 1) return 'male';
  if (g === 'female' || g === 0) return 'female';
  return 'unknown';
}

function strengthOf(entrant) {
  const s = Number(entrant?.strength);
  return Number.isFinite(s) ? s : -1;
}

/**
 * Ordena os entrants de um gênero do mais forte ao mais fraco, com desempate
 * determinístico pela seed (dá variedade sem quebrar o equilíbrio por força).
 */
function sortByStrengthSeeded(list, seed) {
  const shuffled = shuffle(list, seededRng(seed)); // desempate estável e variado
  return shuffled
    .map((e, i) => ({ e, i, s: strengthOf(e) }))
    .sort((x, y) => {
      if (y.s !== x.s) return y.s - x.s; // mais forte primeiro
      return x.i - y.i; // mantém a ordem embaralhada nos empates
    })
    .map((o) => o.e);
}

/**
 * Sequência de índices de grupos em "serpentina" (0,1,2,…,k,k,…,1,0,0,1,…),
 * respeitando capacidades: pula grupos que já atingiram o tamanho-alvo.
 *
 * @param {number} groupCount
 * @param {number[]} remaining capacidade restante por grupo (será consumida)
 * @param {number} count quantos itens distribuir
 * @param {boolean} reverseStart começa pela ponta oposta (para alternar gêneros)
 * @returns {number[]} índices de grupo, em ordem de distribuição
 */
function serpentineSlots(groupCount, remaining, count, reverseStart) {
  const slots = [];
  let dir = reverseStart ? -1 : 1;
  let g = reverseStart ? groupCount - 1 : 0;
  let placed = 0;
  let guard = 0;
  const maxGuard = count * (groupCount + 2) + groupCount + 4;
  while (placed < count && guard < maxGuard) {
    guard += 1;
    if (remaining[g] > 0) {
      slots.push(g);
      remaining[g] -= 1;
      placed += 1;
    }
    // avança na serpentina
    if (dir === 1) {
      if (g === groupCount - 1) dir = -1;
      else g += 1;
    } else if (g === 0) {
      dir = 1;
    } else {
      g -= 1;
    }
  }
  return slots;
}

/**
 * Distribui os entrants nos grupos respeitando tamanho, gênero e nível.
 *
 * @param {Array<{ id: string, gender?: string|number|null, strength?: number, members?: string[] }>} entrants
 * @param {number[]} sizes tamanho-alvo de cada grupo (de `computeGroupSizes`)
 * @param {{ seed?: string, startIndex?: number }} [options]
 *   `startIndex` desloca a numeração das letras (para fases que continuam a
 *   sequência de grupos da anterior — normalmente 0).
 * @returns {Array<{ name: string, index: number, entrants: object[] }>}
 */
export function assignBalancedGroups(entrants, sizes, options = {}) {
  const seed = options.seed || 'groups';
  const startIndex = options.startIndex || 0;
  const groupCount = sizes.length;
  const groups = sizes.map((_, i) => ({
    name: `Grupo ${groupLetter(startIndex + i)}`,
    index: i,
    entrants: [],
  }));
  if (!entrants || entrants.length === 0 || groupCount === 0) return groups;

  const remaining = sizes.slice();

  const males = sortByStrengthSeeded(entrants.filter((e) => genderOf(e) === 'male'), `${seed}:m`);
  const females = sortByStrengthSeeded(entrants.filter((e) => genderOf(e) === 'female'), `${seed}:f`);
  const unknown = sortByStrengthSeeded(entrants.filter((e) => genderOf(e) === 'unknown'), `${seed}:u`);

  // Distribui cada gênero em serpentina por força, respeitando as capacidades.
  // As mulheres começam pela ponta oposta à dos homens para equilibrar a força
  // total (o grupo que recebeu o homem mais forte recebe uma mulher mais fraca).
  const maleSlots = serpentineSlots(groupCount, remaining, males.length, false);
  males.forEach((e, i) => groups[maleSlots[i]].entrants.push(e));

  const femaleSlots = serpentineSlots(groupCount, remaining, females.length, true);
  females.forEach((e, i) => groups[femaleSlots[i]].entrants.push(e));

  // Sem gênero conhecido: preenche o que sobra, também em serpentina por força.
  const unknownSlots = serpentineSlots(groupCount, remaining, unknown.length, false);
  unknown.forEach((e, i) => groups[unknownSlots[i]].entrants.push(e));

  return groups;
}

/**
 * Atalho de alto nível: calcula os tamanhos e distribui em uma só chamada.
 *
 * @param {Array<object>} entrants
 * @param {{ mode?: string, groupCount?: number, maxPerGroup?: number, seed?: string, startIndex?: number }} options
 * @returns {Array<{ name: string, index: number, entrants: object[] }>}
 */
export function drawGroups(entrants, options = {}) {
  const { sizes } = computeGroupSizes(entrants.length, options);
  return assignBalancedGroups(entrants, sizes, options);
}

/**
 * Verifica se uma divisão em grupos respeita a regra de tamanho (diferença
 * máxima de 1 atleta). Útil para validar tanto sorteios quanto montagens
 * manuais antes de prosseguir.
 *
 * @param {Array<{ entrants: object[] }>} groups
 * @returns {{ valid: boolean, min: number, max: number }}
 */
export function validateGroupBalance(groups) {
  if (!groups || groups.length === 0) return { valid: true, min: 0, max: 0 };
  const counts = groups.map((g) => (g.entrants ? g.entrants.length : 0));
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  return { valid: max - min <= 1, min, max };
}
