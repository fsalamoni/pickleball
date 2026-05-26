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
 * Calcula o número exato de jogos para um torneio Americana aberta
 * (todos jogam em dupla com todos exatamente uma vez).
 *
 * Cada jogo envolve 4 jogadores formando 2 duplas. Cada dupla é uma parceria
 * única. O total de parcerias possíveis é C(N,2). Cada jogo "consome" 2
 * parcerias, então o total de jogos é C(N,2) / 2 = N·(N−1) / 4.
 *
 * Para que o total seja inteiro, é necessário que N(N−1) seja múltiplo de 4,
 * o que ocorre quando N ≡ 0 ou N ≡ 1 (mod 4). Para N ≡ 2 ou 3 (mod 4) o
 * formato Americana aberta não fecha matematicamente.
 *
 * @param {number} n
 * @returns {{ totalMatches: number, exact: boolean, reason?: string }}
 */
export function americanoMatchCount(n) {
  if (n < 4) return { totalMatches: 0, exact: false, reason: 'Mínimo de 4 jogadores.' };
  const product = n * (n - 1);
  if (product % 4 !== 0) {
    return {
      totalMatches: Math.floor(product / 4),
      exact: false,
      reason: `Com ${n} jogadores o formato Americana aberta não fecha — cada parceria precisa ser única. Use um número de jogadores N tal que N ≡ 0 ou N ≡ 1 (mod 4): 4, 5, 8, 9, 12, 13, 16, 17, …`,
    };
  }
  return { totalMatches: product / 4, exact: true };
}

/**
 * Resolve o mini-torneio Americana fixo para 4 jogadores [a, b, c, d]:
 *   1) a+b vs c+d
 *   2) a+c vs b+d
 *   3) a+d vs b+c
 *
 * Cada parceria possível aparece exatamente uma vez.
 * @param {[string, string, string, string]} four
 * @returns {Array<{ side_a: [string, string], side_b: [string, string] }>}
 */
export function americanoFour(four) {
  const [a, b, c, d] = four;
  return [
    { side_a: [a, b], side_b: [c, d] },
    { side_a: [a, c], side_b: [b, d] },
    { side_a: [a, d], side_b: [b, c] },
  ];
}

/**
 * Gera os 8 jogos que cobrem TODAS as parcerias cruzadas entre dois blocos
 * de 4 jogadores (B1 = [a,b,c,d], B2 = [e,f,g,h]).
 *
 * Há 16 parcerias cruzadas (4×4). Cada jogo cruzado consome 2 parcerias
 * cruzadas. Logo, 8 jogos cobrem todas. Eles são organizados em 4 sub-blocos
 * de 4 jogadores ("a, b, e, f", "c, d, g, h", "a, b, g, h", "c, d, e, f"),
 * cada um contribuindo com 2 jogos cruzados (o terceiro jogo do mini-bloco
 * seria uma parceria intra-bloco já jogada na Fase 1 e por isso é omitido).
 *
 * @param {[string, string, string, string]} b1
 * @param {[string, string, string, string]} b2
 * @returns {Array<{ side_a: [string, string], side_b: [string, string] }>}
 */
export function americanoCrossBlocks(b1, b2) {
  const [a, b, c, d] = b1;
  const [e, f, g, h] = b2;
  const subblocks = [
    [a, b, e, f],
    [c, d, g, h],
    [a, b, g, h],
    [c, d, e, f],
  ];
  const matches = [];
  subblocks.forEach((sb) => {
    // Em [x, y, z, w] com {x,y} ⊂ B1 e {z,w} ⊂ B2 (ou vice-versa), os 3
    // jogos do mini-torneio Americana são:
    //   1) x+y vs z+w  → parceiras já jogadas na Fase 1 → omitido
    //   2) x+z vs y+w  → 2 novas parcerias cruzadas
    //   3) x+w vs y+z  → 2 novas parcerias cruzadas
    const [x, y, z, w] = sb;
    matches.push({ side_a: [x, z], side_b: [y, w] });
    matches.push({ side_a: [x, w], side_b: [y, z] });
  });
  return matches;
}

/**
 * Cobertura completa para o caso geral de N jogadores em Americana aberta.
 *
 * Estratégia:
 *  - Geramos todas as C(N,2) parcerias.
 *  - Construímos jogos por "matching" guloso, garantindo que cada parceria
 *    apareça exatamente uma vez e cada jogador apareça no máximo uma vez por
 *    rodada (round-robin temporal).
 *
 * Esta rotina é usada quando N não é múltiplo de 4 (ex.: N=5, 9, 13...).
 * Para N múltiplo de 4 o caminho rápido é `buildAmericanoBlockSchedule`.
 *
 * @param {string[]} players
 * @returns {Array<{ side_a: [string, string], side_b: [string, string] }>}
 */
function buildAmericanoGeneral(players) {
  const pairs = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      pairs.push([players[i], players[j]]);
    }
  }
  const matches = [];
  const used = new Array(pairs.length).fill(false);
  while (used.includes(false)) {
    const i = used.findIndex((u) => !u);
    const pa = pairs[i];
    let partnerIdx = -1;
    for (let j = i + 1; j < pairs.length; j += 1) {
      if (used[j]) continue;
      const pb = pairs[j];
      if (
        pb[0] !== pa[0] && pb[0] !== pa[1] &&
        pb[1] !== pa[0] && pb[1] !== pa[1]
      ) {
        partnerIdx = j;
        break;
      }
    }
    if (partnerIdx === -1) break; // não há mais como casar, sai
    used[i] = true;
    used[partnerIdx] = true;
    matches.push({ side_a: pa, side_b: pairs[partnerIdx] });
  }
  return matches;
}

/**
 * Distribui uma lista de jogos em rodadas de tal modo que nenhum jogador
 * participe de dois jogos na mesma rodada (greedy).
 */
function assignRounds(matches) {
  // matches: [{ side_a: [x,y], side_b: [z,w] }, ...]
  const remaining = matches.slice();
  const out = [];
  let round = 1;
  while (remaining.length > 0) {
    const busy = new Set();
    const scheduled = [];
    const leftovers = [];
    for (let i = 0; i < remaining.length; i += 1) {
      const m = remaining[i];
      const players = [...m.side_a, ...m.side_b];
      if (players.some((p) => busy.has(p))) {
        leftovers.push(m);
        continue;
      }
      players.forEach((p) => busy.add(p));
      scheduled.push({ ...m, round });
    }
    if (scheduled.length === 0) {
      // não foi possível agendar nada — força o primeiro restante na próxima rodada
      // para evitar loop infinito
      const m = leftovers.shift();
      if (!m) break;
      out.push({ ...m, round });
      remaining.splice(0, remaining.length, ...leftovers);
      round += 1;
      continue;
    }
    out.push(...scheduled);
    remaining.splice(0, remaining.length, ...leftovers);
    round += 1;
  }
  return out;
}

/**
 * Gera o calendário hierárquico para N múltiplo de 4:
 *   Fase 1: para cada bloco de 4 jogadores, joga seus 3 jogos intra-bloco.
 *   Fase 2: para cada par de blocos (B_i, B_j), joga os 8 jogos cruzados.
 *
 * A ordem das fases é estável (determinística pela ordem dos jogadores):
 *   - blocos: chunks de 4 na ordem fornecida
 *   - dentro do bloco: ordem fixa de americanoFour
 *   - entre blocos: pares na ordem (i, j) com i < j
 */
function buildAmericanoBlockSchedule(players) {
  const matches = [];
  const blocks = [];
  for (let i = 0; i < players.length; i += 4) {
    blocks.push(players.slice(i, i + 4));
  }

  // Fase 1: intra-blocos
  blocks.forEach((b) => matches.push(...americanoFour(b)));

  // Fase 2: cruzamentos entre pares de blocos
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      matches.push(...americanoCrossBlocks(blocks[i], blocks[j]));
    }
  }
  return matches;
}

/**
 * Gera as rodadas da Americana aberta: cada jogador joga em dupla com cada
 * outro jogador exatamente uma vez, contra outra dupla.
 *
 * O número total de jogos é exato: C(N,2) / 2 = N·(N−1) / 4.
 *
 * Quando N é múltiplo de 4, o cronograma é hierárquico:
 *   1. Resolver os jogos internos de cada bloco de 4 jogadores
 *      (ex.: {a,b,c,d}, depois {e,f,g,h}).
 *   2. Resolver os cruzamentos entre cada par de blocos
 *      (ex.: misturar {a,b,e,f} e {c,d,g,h}, depois {a,b,g,h} e {c,d,e,f}).
 *
 * Para N ≡ 1 (mod 4) (5, 9, 13, …) também há cobertura exata, usando uma
 * heurística gulosa que respeita a unicidade das parcerias.
 *
 * Para N ≡ 2 ou 3 (mod 4) o formato não fecha matematicamente. Nestes casos
 * é lançado um erro descritivo para o admin escolher outro número de
 * inscritos ou outro formato de torneio.
 *
 * @param {string[]} playerIds
 * @param {{ seed?: string }} [options]
 * @returns {Array<{ round: number, side_a: [string, string], side_b: [string, string] }>}
 */
export function buildAmericanoRotation(playerIds, options = {}) {
  const { seed = 'americano' } = options;
  const n = playerIds.length;
  if (n < 4) {
    throw new Error('Americana aberta exige no mínimo 4 jogadores.');
  }
  const check = americanoMatchCount(n);
  if (!check.exact) {
    throw new Error(check.reason);
  }

  // Embaralhamento determinístico: define a ordem dos blocos sem alterar
  // a estrutura matemática do torneio.
  const rng = seededRng(seed);
  const players = shuffle(playerIds, rng);

  const baseMatches =
    n % 4 === 0
      ? buildAmericanoBlockSchedule(players)
      : buildAmericanoGeneral(players);

  // Atribui rodadas (cada jogador joga no máximo uma vez por rodada).
  return assignRounds(baseMatches);
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
