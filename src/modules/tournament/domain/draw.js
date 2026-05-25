/**
 * Engine de sorteio e geração de chaves/grupos/rodadas para torneios de pickleball.
 *
 * Todas as funções aqui são puras e determinísticas dado um RNG semeado.
 * Isso garante reprodutibilidade: o admin pode "re-sortear" com a mesma seed
 * e obter o mesmo resultado, ou trocar a seed para uma nova distribuição.
 */

import { MODALITY_FORMAT } from './constants.js';

/* ----------------------------- RNG semeado ------------------------------- */

/**
 * Gera um RNG determinístico baseado em mulberry32, semeado por uma string.
 * @param {string|number} seed
 * @returns {() => number}
 */
export function seededRng(seed = 'pickleball') {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffle Fisher–Yates determinístico.
 * @template T
 * @param {T[]} list
 * @param {() => number} rng
 * @returns {T[]}
 */
export function shuffle(list, rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ----------------------------- Grupos ------------------------------------ */

/**
 * Distribui participantes em N grupos, equilibrando tamanhos.
 * Suporta "seeds" (cabeças-de-chave) — os primeiros `seedCount` itens da lista
 * de entrada são distribuídos um por grupo antes do sorteio dos demais.
 *
 * @param {string[]} participantIds
 * @param {{ groupCount: number, seedCount?: number, seed?: string }} options
 * @returns {Array<{ name: string, participants: string[] }>}
 */
export function distributeGroups(participantIds, options) {
  const { groupCount, seedCount = 0, seed = 'groups' } = options;
  if (groupCount <= 0) return [];
  if (!participantIds || participantIds.length === 0) return [];

  const rng = seededRng(seed);
  const groups = Array.from({ length: groupCount }, (_, i) => ({
    name: `Grupo ${String.fromCharCode(65 + i)}`,
    participants: [],
  }));

  const seeds = participantIds.slice(0, seedCount);
  const rest = shuffle(participantIds.slice(seedCount), rng);

  seeds.forEach((p, i) => {
    groups[i % groupCount].participants.push(p);
  });
  rest.forEach((p, i) => {
    // distribui em round-robin a partir do grupo com menor número
    groups
      .slice()
      .sort((g1, g2) => g1.participants.length - g2.participants.length || groups.indexOf(g1) - groups.indexOf(g2))[0]
      .participants.push(p);
  });

  return groups;
}

/**
 * Gera os jogos de uma fase de grupos (todos contra todos dentro de cada grupo).
 * @param {Array<{ name: string, participants: string[] }>} groups
 * @returns {Array<{ group: string, side_a: string, side_b: string, round: number }>}
 */
export function buildGroupMatches(groups) {
  const matches = [];
  groups.forEach((g) => {
    const ps = g.participants;
    for (let i = 0; i < ps.length; i += 1) {
      for (let j = i + 1; j < ps.length; j += 1) {
        matches.push({ group: g.name, side_a: ps[i], side_b: ps[j], round: 1 });
      }
    }
  });
  return matches;
}

/* ----------------------------- Round-robin (pontos corridos) ------------ */

/**
 * Gera jogos para um torneio de pontos corridos (todos contra todos, ida).
 * Algoritmo round-robin "circle method".
 * @param {string[]} participantIds
 * @returns {Array<{ side_a: string, side_b: string, round: number }>}
 */
export function buildRoundRobinMatches(participantIds) {
  const ps = participantIds.slice();
  if (ps.length % 2 === 1) ps.push('__BYE__');
  const n = ps.length;
  const rounds = n - 1;
  const half = n / 2;
  const matches = [];
  const ring = ps.slice();
  for (let r = 0; r < rounds; r += 1) {
    for (let i = 0; i < half; i += 1) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (a !== '__BYE__' && b !== '__BYE__') {
        matches.push({ side_a: a, side_b: b, round: r + 1 });
      }
    }
    // rotaciona mantendo o primeiro fixo
    ring.splice(1, 0, ring.pop());
  }
  return matches;
}

/* ----------------------------- Mata-mata (chaves) ----------------------- */

/**
 * Calcula a próxima potência de 2 >= n.
 */
export function nextPowerOfTwo(n) {
  if (n <= 1) return 1;
  return 1 << Math.ceil(Math.log2(n));
}

/**
 * Gera a primeira rodada de uma chave (single-elimination).
 * `seeds` indica os cabeças-de-chave (em ordem 1, 2, 3, ...). Os demais
 * participantes são sorteados nas posições restantes via RNG semeado.
 *
 * Retorna os matches da rodada 1 e uma estrutura de bracket pronta para
 * preenchimento das rodadas seguintes (`null` significa vaga a definir).
 *
 * @param {string[]} participantIds
 * @param {{ seedCount?: number, seed?: string }} [options]
 * @returns {{
 *   slots: Array<string|null>,
 *   matches: Array<{ round: number, position: number, side_a: string|null, side_b: string|null, bye?: boolean }>,
 *   totalRounds: number,
 * }}
 */
export function buildKnockoutBracket(participantIds, options = {}) {
  const { seedCount = 0, seed = 'bracket' } = options;
  const size = nextPowerOfTwo(participantIds.length);
  const totalRounds = Math.log2(size);
  const rng = seededRng(seed);
  const slots = new Array(size).fill(null);

  // posições "padrão" de cabeça-de-chave em uma chave de tamanho N:
  // 1 vs (N), 2 vs (N-1), ... mas para evitar que se cruzem cedo,
  // adotamos: seed k vai na posição seedSlot(k, size)
  const seeds = participantIds.slice(0, seedCount);
  seeds.forEach((p, idx) => {
    const pos = seedSlot(idx + 1, size);
    slots[pos] = p;
  });

  // Demais participantes são sorteados nos slots restantes.
  const rest = shuffle(participantIds.slice(seedCount), rng);
  for (let i = 0; i < slots.length && rest.length > 0; i += 1) {
    if (slots[i] === null) {
      slots[i] = rest.shift();
    }
  }

  // Gera matches da rodada 1 considerando byes (slot vazio = bye p/ adversário)
  const matches = [];
  for (let i = 0; i < size; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    matches.push({
      round: 1,
      position: i / 2 + 1,
      side_a: a,
      side_b: b,
      bye: a === null || b === null,
    });
  }
  return { slots, matches, totalRounds };
}

/**
 * Calcula o slot de uma cabeça-de-chave numa chave de tamanho N
 * usando a ordem clássica de torneio (1, N, N/2+1, N/2, ...).
 * Para um seed k em uma chave de tamanho N, retorna o índice 0-based.
 */
export function seedSlot(seedNum, size) {
  // Algoritmo: gera a sequência canônica de posições para seeds 1..N
  // e retorna a posição correspondente ao seedNum.
  let positions = [0];
  let n = 1;
  while (n < size) {
    const next = [];
    const m = n * 2;
    for (let i = 0; i < positions.length; i += 1) {
      next.push(positions[i]);
      next.push(m - 1 - positions[i]);
    }
    positions = next;
    n = m;
  }
  return positions[(seedNum - 1) % size];
}

/* ----------------------------- Americana -------------------------------- */

/**
 * Gera as rodadas da Americana: cada jogador joga em dupla com cada outro
 * jogador exatamente uma vez, contra outra dupla.
 *
 * Para N jogadores, são necessárias N-1 rodadas (com N par), cada rodada
 * formando N/4 jogos (ou N/2 quadras simultâneas se N múltiplo de 4).
 *
 * Quando N não é múltiplo de 4, os jogos restantes ficam balanceados.
 * Quando N é ímpar, um jogador descansa em cada rodada.
 *
 * @param {string[]} playerIds
 * @param {{ seed?: string }} [options]
 * @returns {Array<{ round: number, side_a: [string, string], side_b: [string, string] }>}
 */
export function buildAmericanoRotation(playerIds, options = {}) {
  const { seed = 'americano' } = options;
  const rng = seededRng(seed);
  const players = shuffle(playerIds, rng);
  const matches = [];
  const seenPairs = new Set();

  const pairKey = (x, y) => [x, y].sort().join('|');

  // Para cada par possível, joga uma vez. Distribui em rodadas tentando
  // que cada jogador atue uma vez por rodada quando possível.
  const allPairs = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      allPairs.push([players[i], players[j]]);
    }
  }

  // Agrupa em rodadas: em cada rodada montamos jogos (par-vs-par) usando
  // jogadores ainda não escalados nessa rodada.
  let round = 1;
  let remaining = allPairs.slice();
  while (remaining.length > 0) {
    const busy = new Set();
    const roundGames = [];
    const skipped = [];
    // ordena por par com mais "déficit" de jogos primeiro para balancear
    const sorted = remaining.slice().sort(() => rng() - 0.5);
    for (let idx = 0; idx < sorted.length; idx += 1) {
      const pairA = sorted[idx];
      if (!pairA) continue;
      if (busy.has(pairA[0]) || busy.has(pairA[1])) {
        skipped.push(pairA);
        continue;
      }
      // procura um pairB compatível
      const pairBIdx = sorted.findIndex((p, k) => {
        if (k <= idx) return false;
        if (!p) return false;
        return !busy.has(p[0]) && !busy.has(p[1]) && !pairA.includes(p[0]) && !pairA.includes(p[1]);
      });
      if (pairBIdx === -1) {
        skipped.push(pairA);
        continue;
      }
      const pairB = sorted[pairBIdx];
      busy.add(pairA[0]);
      busy.add(pairA[1]);
      busy.add(pairB[0]);
      busy.add(pairB[1]);
      roundGames.push({ round, side_a: pairA, side_b: pairB });
      seenPairs.add(pairKey(pairA[0], pairA[1]));
      seenPairs.add(pairKey(pairB[0], pairB[1]));
      sorted[idx] = null;
      sorted[pairBIdx] = null;
    }
    matches.push(...roundGames);
    // remove pares já utilizados
    const used = new Set(roundGames.flatMap((g) => [pairKey(...g.side_a), pairKey(...g.side_b)]));
    remaining = remaining.filter((p) => !used.has(pairKey(p[0], p[1])));
    if (roundGames.length === 0) break; // proteção contra loop infinito
    round += 1;
  }
  return matches;
}

/* ----------------------------- Entrypoint ------------------------------- */

/**
 * Gera o "draw" inicial completo para uma fase/modalidade.
 * @param {{
 *   format: keyof typeof MODALITY_FORMAT extends never ? string : string,
 *   stageType: string,
 *   participants: string[],
 *   groupCount?: number,
 *   seedCount?: number,
 *   seed?: string,
 * }} input
 * @returns {{
 *   stageType: string,
 *   groups?: Array<{ name: string, participants: string[] }>,
 *   matches: Array<object>,
 *   bracket?: { slots: Array<string|null>, totalRounds: number },
 * }}
 */
export function generateDraw(input) {
  const {
    format,
    stageType,
    participants,
    groupCount = 4,
    seedCount = 0,
    seed = 'draw',
  } = input;

  if (format === MODALITY_FORMAT.AMERICANO || stageType === 'americano') {
    return { stageType: 'americano', matches: buildAmericanoRotation(participants, { seed }) };
  }
  if (stageType === 'round_robin') {
    return { stageType, matches: buildRoundRobinMatches(participants) };
  }
  if (stageType === 'groups') {
    const groups = distributeGroups(participants, { groupCount, seedCount, seed });
    return { stageType, groups, matches: buildGroupMatches(groups) };
  }
  if (stageType === 'knockout') {
    const { slots, matches, totalRounds } = buildKnockoutBracket(participants, { seedCount, seed });
    return { stageType, bracket: { slots, totalRounds }, matches };
  }
  throw new Error(`Tipo de fase desconhecido: ${stageType}`);
}
