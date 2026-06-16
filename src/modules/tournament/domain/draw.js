/**
 * Engine de sorteio e geração de chaves/grupos/rodadas para torneios de pickleball.
 *
 * Todas as funções aqui são puras e determinísticas dado um RNG semeado.
 * Isso garante reprodutibilidade: o admin pode "re-sortear" com a mesma seed
 * e obter o mesmo resultado, ou trocar a seed para uma nova distribuição.
 */

import { MODALITY_FORMAT } from './constants.js';
import { buildDoubleEliminationBracket } from './doubleElimination.js';
import { pairSwissRound } from './swiss.js';
import { getWhistTable } from './whistTables.js';

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
 * Estratégias:
 *  - 'shuffle' (padrão): sorteia os não-cabeças e distribui em round-robin.
 *  - 'tiered': preserva a ordem recebida (já ordenada por nível/gênero) e
 *    preenche os grupos com blocos contíguos, formando grupos homogêneos —
 *    níveis próximos no mesmo grupo (assim os fortes se enfrentam entre si) e
 *    duplas do mesmo gênero juntas, dentro do possível.
 *
 * @param {string[]} participantIds
 * @param {{ groupCount: number, seedCount?: number, seed?: string, strategy?: 'shuffle'|'tiered' }} options
 * @returns {Array<{ name: string, participants: string[] }>}
 */
export function distributeGroups(participantIds, options) {
  const { groupCount, seedCount = 0, seed = 'groups', strategy = 'shuffle' } = options;
  if (groupCount <= 0) return [];
  if (!participantIds || participantIds.length === 0) return [];

  const groups = Array.from({ length: groupCount }, (_, i) => ({
    name: `Grupo ${String.fromCharCode(65 + i)}`,
    participants: [],
  }));

  if (strategy === 'tiered') {
    // Tamanhos equilibrados: os primeiros (resto) grupos recebem um a mais.
    const total = participantIds.length;
    const base = Math.floor(total / groupCount);
    const extra = total % groupCount;
    let cursor = 0;
    for (let g = 0; g < groupCount; g += 1) {
      const size = base + (g < extra ? 1 : 0);
      groups[g].participants = participantIds.slice(cursor, cursor + size);
      cursor += size;
    }
    return groups;
  }

  const rng = seededRng(seed);
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
 *
 * Dentro de cada grupo usamos o "método do círculo" (mesmo do pontos corridos),
 * que organiza os confrontos em rodadas equilibradas: em cada rodada todos os
 * jogadores do grupo entram em quadra no máximo uma vez e, quando o grupo tem
 * número ímpar de participantes, o descanso (bye) circula de forma justa — cada
 * um folga no máximo uma vez. Isso dá ao grupo a mesma distribuição equilibrada
 * de rotação/espera das demais modalidades (o agendador depois aproveita essas
 * rodadas para paralelizar as quadras entre os grupos).
 *
 * @param {Array<{ name: string, participants: string[] }>} groups
 * @returns {Array<{ group: string, side_a: string, side_b: string, round: number }>}
 */
export function buildGroupMatches(groups) {
  const matches = [];
  groups.forEach((g) => {
    buildRoundRobinMatches(g.participants).forEach((m) => {
      matches.push({ group: g.name, side_a: m.side_a, side_b: m.side_b, round: m.round });
    });
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
 * Calcula o número de jogos de um torneio Americana, no qual todos jogam em
 * dupla com todos (rotação de parceiros), e indica se o número de inscritos
 * permite uma cobertura EXATA.
 *
 * Cada jogo envolve 4 jogadores formando 2 duplas. Cada dupla é uma parceria
 * única. O total de parcerias possíveis é C(N,2). Cada jogo "consome" 2
 * parcerias, então o número de jogos é N·(N−1) / 4.
 *
 * A cobertura é EXATA (cada parceria acontece exatamente uma vez, e cada
 * jogador forma dupla com todos os demais) somente quando N·(N−1) é múltiplo
 * de 4, ou seja, N ≡ 0 ou N ≡ 1 (mod 4): 4, 5, 8, 9, 12, 13, 16, 17, …
 *
 * Para N ≡ 2 ou 3 (mod 4), C(N,2) é ímpar e é matematicamente impossível
 * fechar todas as duplas exatamente uma vez. Nesses casos o formato Americana
 * é considerado INVÁLIDO (exact=false com um `reason` bloqueante): o sistema
 * não deve gerar uma chave parcial — o número de inscritos não é condizente
 * com o formato escolhido.
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
      reason: `O número de inscritos (${n}) não é condizente com o formato Americano: não é possível formar todas as duplas exatamente uma vez. Use um número com N ≡ 0 ou 1 (mod 4): 4, 5, 8, 9, 12, 13, 16, 17…`,
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

/* --------------------- Motor de equilíbrio da Americana ------------------ */
//
// O coração da Americana individual é um problema combinatório clássico
// (conhecido como Whist Tournament / Social Golfer): com N ≡ 0 ou 1 (mod 4)
// jogadores precisamos montar jogos 2×2 tais que
//
//   (1) cada jogador forme dupla com cada outro EXATAMENTE uma vez
//       (parceria única — regra absoluta), e
//   (2) cada jogador enfrente cada outro como adversário o MESMO número de
//       vezes (equilíbrio de adversários — regra absoluta).
//
// A média de confrontos é sempre exatamente 2 (cada jogador disputa N−1 jogos,
// com 2 adversários por jogo → 2·(N−1) "vagas" de adversário divididas pelos
// N−1 demais jogadores = 2). O objetivo é fazer essa média valer para TODOS os
// pares, minimizando a variância. Quando isso é alcançado, cada jogador
// enfrenta cada outro exatamente 2 vezes — o equilíbrio perfeito (teoricamente
// possível para todo N ≡ 0 ou 1 mod 4).
//
// Como o número de duplas C(N,2) é par exatamente quando N ≡ 0 ou 1 (mod 4),
// elas sempre podem ser distribuídas em jogos (pares de duplas disjuntas). A
// liberdade está em ESCOLHER quais duas duplas se enfrentam em cada jogo — é
// isso que determina o equilíbrio de adversários. Otimizamos essa escolha por
// recozimento simulado (simulated annealing) determinístico:
//
//   - Partimos de uma 1-fatoração pelo "método do círculo" (cada jogador
//     forma dupla com todos uma vez), que já garante a regra (1).
//   - Movimento 2-opt: tomamos dois jogos (A vs B) e (C vs D) e recombinamos as
//     duplas — (A vs C) e (B vs D), por exemplo. Isso preserva a regra (1)
//     (cada dupla continua aparecendo uma única vez) e só altera quem enfrenta
//     quem, permitindo equilibrar os adversários.
//   - Custo primário = Σ (confrontos(i,j) − 2)² → zero no equilíbrio perfeito.
//
// Tudo é determinístico dada a seed (reprodutível), usando arrays tipados para
// custo incremental O(1) por movimento.

const americanoDisjoint = (a, b) =>
  a[0] !== b[0] && a[0] !== b[1] && a[1] !== b[0] && a[1] !== b[1];

/**
 * 1-fatoração inicial pelo método do círculo: distribui os N jogadores
 * (índices 0..N−1) em duplas tais que cada par apareça uma única vez, e
 * pré-agrupa as duplas em jogos. Serve de ponto de partida para o otimizador.
 *
 * @param {number} n
 * @returns {{ pairs: Array<[number, number]>, games: Array<[number, number]> }}
 *   `pairs` é a lista de duplas (por índice); `games` casa duas duplas (por
 *   índice em `pairs`) por jogo.
 */
function americanoCircleInit(n) {
  const m = n % 2 === 0 ? n : n + 1; // jogador fantasma (folga) quando ímpar
  const bye = n;
  const ring = Array.from({ length: m }, (_, i) => i);
  const pairs = [];
  const games = [];
  const pairIndex = new Map();
  const addPair = (x, y) => {
    const key = x < y ? x * 1000 + y : y * 1000 + x;
    if (pairIndex.has(key)) return pairIndex.get(key);
    const id = pairs.length;
    pairs.push([x, y]);
    pairIndex.set(key, id);
    return id;
  };
  for (let r = 0; r < m - 1; r += 1) {
    const roundPairs = [];
    for (let i = 0; i < m / 2; i += 1) {
      const a = ring[i];
      const b = ring[m - 1 - i];
      if (a !== bye && b !== bye) roundPairs.push(addPair(a, b));
    }
    for (let i = 0; i + 1 < roundPairs.length; i += 2) {
      games.push([roundPairs[i], roundPairs[i + 1]]);
    }
    ring.splice(1, 0, ring.pop()); // rotaciona mantendo o primeiro fixo
  }
  return { pairs, games };
}

/**
 * Uma execução do recozimento simulado que minimiza o desequilíbrio de
 * adversários, preservando a regra de parceria única. Determinística pela seed.
 *
 * @param {number} n
 * @param {string} seed
 * @returns {{ oppCost: number, gameList: Array<[[number,number],[number,number]]> }}
 *   `oppCost` = Σ (confrontos(i,j) − 2)² (0 = equilíbrio perfeito);
 *   `gameList` = jogos como par de duplas (cada dupla é [iJogador, jJogador]).
 */
function optimizeAmericanoOpponents(n, seed) {
  const { pairs, games } = americanoCircleInit(n);
  const nPairs = (n * (n - 1)) / 2;
  const totalGames = nPairs / 2;
  const idx = (a, b) => (a < b ? a * n + b : b * n + a);
  const sq = (x) => x * x;

  const opp = new Int32Array(n * n);
  let cost = nPairs * 4; // base: todos os pares em 0 confrontos → (0−2)² = 4
  const applyGame = (p, q, d) => {
    const A = pairs[p];
    const B = pairs[q];
    for (let x = 0; x < 2; x += 1) {
      for (let y = 0; y < 2; y += 1) {
        const k = idx(A[x], B[y]);
        const c = opp[k];
        cost -= sq(c - 2);
        const nc = c + d;
        opp[k] = nc;
        cost += sq(nc - 2);
      }
    }
  };
  games.forEach(([gi, gj]) => applyGame(gi, gj, 1));

  let bestCost = cost;
  const bestFlat = new Int32Array(totalGames * 2);
  const snapshot = () => {
    for (let i = 0; i < totalGames; i += 1) {
      bestFlat[i * 2] = games[i][0];
      bestFlat[i * 2 + 1] = games[i][1];
    }
  };
  snapshot();
  const restore = () => {
    opp.fill(0);
    cost = nPairs * 4;
    for (let i = 0; i < totalGames; i += 1) {
      games[i][0] = bestFlat[i * 2];
      games[i][1] = bestFlat[i * 2 + 1];
    }
    games.forEach(([gi, gj]) => applyGame(gi, gj, 1));
  };

  const rng = seededRng(seed);
  const cycles = 6;
  const itersPer = Math.min(250000, Math.max(30000, nPairs * 1200));
  for (let cy = 0; cy < cycles && bestCost > 0; cy += 1) {
    const t0 = cy === 0 ? 1.0 : 0.5; // reaquecimento a cada ciclo
    for (let it = 0; it < itersPer && cost > 0; it += 1) {
      const temp = t0 * (1 - it / itersPer) + 0.01;
      const a = (rng() * totalGames) | 0;
      const b = (rng() * totalGames) | 0;
      if (a === b) continue;
      const a1 = games[a][0];
      const a2 = games[a][1];
      const b1 = games[b][0];
      const b2 = games[b][1];
      // Duas recombinações possíveis; cada uma exige duplas disjuntas (jogo
      // válido com 4 jogadores distintos).
      const opt1 = americanoDisjoint(pairs[a1], pairs[b1]) && americanoDisjoint(pairs[a2], pairs[b2]);
      const opt2 = americanoDisjoint(pairs[a1], pairs[b2]) && americanoDisjoint(pairs[a2], pairs[b1]);
      let n0;
      let n1;
      if (opt1 && opt2) {
        if (rng() < 0.5) { n0 = [a1, b1]; n1 = [a2, b2]; } else { n0 = [a1, b2]; n1 = [a2, b1]; }
      } else if (opt1) {
        n0 = [a1, b1]; n1 = [a2, b2];
      } else if (opt2) {
        n0 = [a1, b2]; n1 = [a2, b1];
      } else {
        continue;
      }
      const before = cost;
      applyGame(a1, a2, -1);
      applyGame(b1, b2, -1);
      applyGame(n0[0], n0[1], 1);
      applyGame(n1[0], n1[1], 1);
      if (cost <= before || rng() < Math.exp((before - cost) / temp)) {
        games[a][0] = n0[0];
        games[a][1] = n0[1];
        games[b][0] = n1[0];
        games[b][1] = n1[1];
        if (cost < bestCost) { bestCost = cost; snapshot(); }
      } else {
        // reverte
        applyGame(n0[0], n0[1], -1);
        applyGame(n1[0], n1[1], -1);
        applyGame(a1, a2, 1);
        applyGame(b1, b2, 1);
      }
    }
    if (cost !== bestCost) restore();
  }

  const gameList = [];
  for (let i = 0; i < totalGames; i += 1) {
    gameList.push([pairs[bestFlat[i * 2]].slice(), pairs[bestFlat[i * 2 + 1]].slice()]);
  }
  return { oppCost: bestCost, gameList };
}

/**
 * Custo do objetivo SECUNDÁRIO (gênero e nível) de uma escala de jogos.
 *
 * Dentro do equilíbrio de adversários (regra absoluta), preferimos — "dentro do
 * possível" — que duplas do mesmo gênero se enfrentem (masculina×masculina,
 * feminina×feminina) e que duplas de nível semelhante se enfrentem. Este custo
 * é usado apenas como CRITÉRIO DE DESEMPATE entre escalas igualmente
 * equilibradas: nunca sacrifica o equilíbrio de adversários.
 *
 * @param {Array<[[number,number],[number,number]]>} gameList
 * @param {{ gender: Array<0|1|null>, level: Array<number|null> }} meta
 *   gênero por índice de jogador (1 = masculino, 0 = feminino, null = desconhecido)
 *   e força/nível por índice (null = desconhecido).
 * @returns {number}
 */
function americanoSecondaryCost(gameList, meta) {
  if (!meta) return 0;
  const { gender, level } = meta;
  const profile = (pair) => {
    const a = gender[pair[0]];
    const b = gender[pair[1]];
    if (a == null || b == null) return 'UN';
    if (a === 1 && b === 1) return 'MM';
    if (a === 0 && b === 0) return 'FF';
    return 'MX';
  };
  const strength = (pair) => {
    const a = level[pair[0]];
    const b = level[pair[1]];
    if (a == null || b == null) return null;
    return a + b;
  };
  let cost = 0;
  for (const [P, Q] of gameList) {
    const gp = profile(P);
    const gq = profile(Q);
    if (gp !== 'UN' && gq !== 'UN' && gp !== gq) {
      // gênero diferente entre as duplas adversárias: penaliza, com peso maior
      // para o caso mais "fora do espírito" (masculina × feminina).
      cost += (gp === 'MM' && gq === 'FF') || (gp === 'FF' && gq === 'MM') ? 4 : 2;
    }
    const sp = strength(P);
    const sq = strength(Q);
    if (sp != null && sq != null) cost += Math.abs(sp - sq);
  }
  return cost;
}

/**
 * Conta em quantas rodadas a escala de jogos cabe quando nenhum jogador pode
 * jogar duas vezes na mesma rodada (empacotamento guloso). Usado apenas como
 * critério de desempate final — quanto menos rodadas, mais "enxuta" a grade.
 *
 * @param {Array<[[number,number],[number,number]]>} gameList
 * @param {number} n
 * @returns {number}
 */
function americanoRoundCount(gameList, n) {
  const cap = n % 2 === 0 ? n / 4 : (n - 1) / 4;
  let remaining = gameList.slice();
  let rounds = 0;
  while (remaining.length > 0) {
    const busy = new Set();
    const keep = [];
    let placed = 0;
    for (const g of remaining) {
      const players = [g[0][0], g[0][1], g[1][0], g[1][1]];
      if (placed < cap && !players.some((p) => busy.has(p))) {
        players.forEach((p) => busy.add(p));
        placed += 1;
      } else {
        keep.push(g);
      }
    }
    remaining = keep;
    rounds += 1;
  }
  return rounds;
}

/**
 * Monta a melhor escala da Americana para N jogadores (índices 0..N−1):
 * roda o otimizador várias vezes (restarts determinísticos) e escolhe a escala
 * que melhor atende, NESTA ORDEM de prioridade:
 *   1) menor desequilíbrio de adversários (regra absoluta);
 *   2) MENOS rodadas — uma escala "resolúvel" em poucas rodadas permite que os
 *      jogos rodem em paralelo nas várias quadras e que o tempo de espera de
 *      cada jogador seja equilibrado (logística da segunda etapa);
 *   3) menor custo de gênero/nível ("dentro do possível").
 *
 * O número mínimo de rodadas é N−1 (N par) ou N (N ímpar): nesse caso cada
 * jogador joga exatamente uma vez por rodada, todas as quadras ficam ocupadas e
 * ninguém acumula jogos no início ou no fim. Para N pequenos (ex.: 8) o motor
 * costuma achar essa escala perfeita; para N maiores chega o mais perto
 * possível, sem nunca abrir mão do equilíbrio de adversários.
 *
 * @param {number} n
 * @param {string} seed
 * @param {{ gender: Array<0|1|null>, level: Array<number|null> }|null} meta
 * @returns {{ oppCost: number, gameList: Array<[[number,number],[number,number]]> }}
 */
function buildAmericanoSchedule(n, seed, meta) {
  const restarts = n <= 13 ? 12 : n <= 20 ? 6 : 3;
  const idealRounds = n % 2 === 0 ? n - 1 : n;
  let champion = null;
  for (let k = 0; k < restarts; k += 1) {
    const { oppCost, gameList } = optimizeAmericanoOpponents(n, `${seed}:${k}`);
    const rounds = americanoRoundCount(gameList, n);
    const secCost = americanoSecondaryCost(gameList, meta);
    // ordenação lexicográfica (oppCost, rounds, secCost) num único número:
    // o equilíbrio de adversários domina; depois a "resolubilidade" (poucas
    // rodadas, boa para a logística de quadras); por fim, gênero/nível.
    const score = oppCost * 1e12 + rounds * 1e6 + secCost;
    if (!champion || score < champion.score) {
      champion = { score, oppCost, secCost, rounds, gameList };
    }
    // Parada antecipada no ótimo absoluto: equilíbrio perfeito, grade mínima
    // (totalmente paralelizável) e sem penalidade secundária.
    if (oppCost === 0 && rounds === idealRounds && secCost === 0) break;
  }
  return { oppCost: champion.oppCost, gameList: champion.gameList };
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

/* ----------------- Whist resolúvel (regras absolutas exatas) ------------- */

/** Verdadeiro se p é primo. */
function americanoIsPrime(p) {
  if (p < 2) return false;
  for (let i = 2; i * i <= p; i += 1) if (p % i === 0) return false;
  return true;
}

/** Exponenciação modular. */
function americanoModpow(b, e, m) {
  let r = 1;
  let base = b % m;
  let exp = e;
  while (exp > 0) {
    if (exp & 1) r = (r * base) % m;
    base = (base * base) % m;
    exp >>= 1;
  }
  return r;
}

/** Menor raiz primitiva módulo p (p primo). */
function americanoPrimitiveRoot(p) {
  const factors = [];
  let m = p - 1;
  for (let d = 2; d * d <= m; d += 1) {
    if (m % d === 0) {
      factors.push(d);
      while (m % d === 0) m /= d;
    }
  }
  if (m > 1) factors.push(m);
  for (let g = 2; g < p; g += 1) {
    if (factors.every((q) => americanoModpow(g, (p - 1) / q, p) !== 1)) return g;
  }
  return -1;
}

/**
 * Constrói um Torneio de Whist resolúvel para N primo ≡ 1 (mod 4) pela
 * construção Z-cíclica clássica: jogadores 0..N−1, raiz primitiva g, t=(N−1)/4
 * mesas por rodada; a rodada base é desenvolvida somando r (mod N). Garante, de
 * forma exata, parceria única, adversário exatamente 2× e resolubilidade (N
 * rodadas, um jogador folga por rodada, folga circulando).
 *
 * @param {number} n
 * @returns {Array<Array<[[number,number],[number,number]]>>}
 */
function americanoPrimeCyclic(n) {
  const g = americanoPrimitiveRoot(n);
  const t = (n - 1) / 4;
  const pw = [];
  let c = 1;
  for (let i = 0; i < n - 1; i += 1) {
    pw.push(c);
    c = (c * g) % n;
  }
  const base = [];
  for (let i = 0; i < t; i += 1) {
    base.push([[pw[i], pw[i + 2 * t]], [pw[i + t], pw[i + 3 * t]]]);
  }
  const rounds = [];
  for (let r = 0; r < n; r += 1) {
    rounds.push(
      base.map(([P, Q]) => [
        [(P[0] + r) % n, (P[1] + r) % n],
        [(Q[0] + r) % n, (Q[1] + r) % n],
      ]),
    );
  }
  return rounds;
}

/**
 * Retorna as rodadas de um Torneio de Whist resolúvel para N jogadores
 * (índices 0..N−1), ou null se não houver uma escala exata pré-computada nem
 * construtível diretamente. Fontes, em ordem:
 *   1) tabela verificada (cobre os tamanhos usuais: 4,5,8,9,12,13,16,17,20,21,
 *      24,25,28,29,32);
 *   2) construção cíclica para qualquer N primo ≡ 1 (mod 4) (instantânea).
 *
 * @param {number} n
 * @returns {Array<Array<[[number,number],[number,number]]>>|null}
 */
function americanoWhistRounds(n) {
  const table = getWhistTable(n);
  if (table) return table;
  if (n % 4 === 1 && americanoIsPrime(n)) return americanoPrimeCyclic(n);
  return null;
}

/**
 * Penalidade secundária (gênero/nível) de uma escala de Whist sob um dado
 * mapeamento jogador→índice. Usada apenas para ESCOLHER o melhor mapeamento,
 * sem jamais alterar a estrutura (qualquer permutação preserva as regras
 * absolutas). Mesmos pesos de `americanoSecondaryCost`.
 */
function americanoAssignmentCost(rounds, slot, meta) {
  const { gender, level } = meta;
  const profile = (i, j) => {
    const a = gender[slot[i]];
    const b = gender[slot[j]];
    if (a == null || b == null) return 'UN';
    if (a === 1 && b === 1) return 'MM';
    if (a === 0 && b === 0) return 'FF';
    return 'MX';
  };
  const strength = (i, j) => {
    const a = level[slot[i]];
    const b = level[slot[j]];
    if (a == null || b == null) return null;
    return a + b;
  };
  let cost = 0;
  for (const round of rounds) {
    for (const [P, Q] of round) {
      const gp = profile(P[0], P[1]);
      const gq = profile(Q[0], Q[1]);
      if (gp !== 'UN' && gq !== 'UN' && gp !== gq) {
        cost += (gp === 'MM' && gq === 'FF') || (gp === 'FF' && gq === 'MM') ? 4 : 2;
      }
      const sp = strength(P[0], P[1]);
      const sq = strength(Q[0], Q[1]);
      if (sp != null && sq != null) cost += Math.abs(sp - sq);
    }
  }
  return cost;
}

/**
 * Escolhe o mapeamento índice-da-tabela → jogador que melhor aproxima o
 * equilíbrio de gênero/nível, por busca local (troca de dois jogadores de
 * posição). Como permutar rótulos não altera parceria-única nem adversário-2×,
 * isso refina o objetivo secundário sem tocar nas regras absolutas.
 *
 * @returns {number[]} slot — slot[k] = índice do jogador (em `players`) que
 *   ocupa a posição k da tabela.
 */
function americanoOptimizeAssignment(n, rounds, meta, rng) {
  const slot = Array.from({ length: n }, (_, i) => i);
  if (!meta) return slot;
  let cost = americanoAssignmentCost(rounds, slot, meta);
  const iters = Math.min(40000, Math.max(4000, n * n * 30));
  let temp = 1.0;
  for (let it = 0; it < iters && cost > 0; it += 1) {
    temp = 1.0 * (1 - it / iters) + 0.01;
    const i = (rng() * n) | 0;
    const j = (rng() * n) | 0;
    if (i === j) continue;
    [slot[i], slot[j]] = [slot[j], slot[i]];
    const c2 = americanoAssignmentCost(rounds, slot, meta);
    if (c2 <= cost || rng() < Math.exp((cost - c2) / temp)) {
      cost = c2;
    } else {
      [slot[i], slot[j]] = [slot[j], slot[i]];
    }
  }
  return slot;
}

/**
 * Gera as rodadas da Americana: cada jogador joga em dupla com TODOS os demais
 * jogadores (rotação de parceiros), contra outra dupla, e nenhuma dupla se
 * repete. A inscrição é individual (Simples) e as duplas são montadas aqui.
 *
 * Garantias (regras absolutas EXATAS, para todo N ≡ 0 ou 1 mod 4):
 *  - PARCERIA ÚNICA: cada jogador forma dupla com cada outro exatamente uma vez
 *    (são N·(N−1)/4 jogos, cobrindo as C(N,2) duplas possíveis sem repetição).
 *  - ADVERSÁRIO 2×: cada jogador enfrenta cada outro EXATAMENTE duas vezes — o
 *    equilíbrio perfeito, independente do número de inscritos. Isso é garantido
 *    por um "Torneio de Whist" resolúvel (tabela verificada para os tamanhos
 *    usuais; construção cíclica para N primo; ver `whistTables.js`).
 *  - GRADE RESOLÚVEL: os jogos já saem organizados em rodadas (N−1 se N é par, N
 *    se ímpar), em que cada jogador joga uma vez por rodada — quando N é ímpar a
 *    folga circula (cada um folga uma vez). Isso permite rodar todas as quadras
 *    em paralelo e equilibrar perfeitamente o tempo de espera.
 *
 * Preferência secundária ("dentro do possível", sem jamais violar as regras
 * acima): duplas do mesmo gênero se enfrentam entre si e duplas de nível
 * semelhante se enfrentam entre si. Como permutar os rótulos dos jogadores
 * preserva as regras absolutas, o mapeamento jogador→posição é escolhido para
 * aproximar esse equilíbrio. Informe `playerMeta` (gênero/nível por id).
 *
 * Para N grande e sem escala de Whist pré-computada (ex.: N não-primo > 32), há
 * um fallback heurístico que mantém a parceria única e equilibra os adversários
 * ao máximo, para que o sistema funcione com qualquer número de inscritos.
 *
 * Para N ≡ 2 ou 3 (mod 4) o método lança erro: seria impossível formar todas as
 * duplas exatamente uma vez (C(N,2) é ímpar) — o número de inscritos não é
 * condizente com o formato.
 *
 * @param {string[]} playerIds
 * @param {{
 *   seed?: string,
 *   playerMeta?: Record<string, { gender?: 0|1|null, level?: number|null }>,
 * }} [options]
 * @returns {Array<{ round: number, side_a: [string, string], side_b: [string, string] }>}
 */
export function buildAmericanoRotation(playerIds, options = {}) {
  const { seed = 'americano', playerMeta = null } = options;
  const n = playerIds.length;
  if (n < 4) {
    throw new Error('Americano exige no mínimo 4 jogadores.');
  }
  const { exact, reason } = americanoMatchCount(n);
  if (!exact) {
    throw new Error(
      reason ||
        `O formato Americano exige um número de inscritos que permita formar todas as duplas exatamente uma vez (N ≡ 0 ou 1 mod 4: 4, 5, 8, 9, 12, 13, 16, 17…). Com ${n} inscritos não é possível gerar todos os jogos sem deixar duplas de fora.`,
    );
  }

  // Embaralhamento determinístico: dá variedade ao resultado conforme a seed,
  // sem alterar a estrutura matemática do torneio (índice → id de jogador).
  const rng = seededRng(seed);
  const players = shuffle(playerIds, rng);

  // Metadados por índice de jogador (gênero/nível), quando disponíveis, para o
  // objetivo secundário de equilíbrio por gênero e nível.
  let meta = null;
  if (playerMeta) {
    const gender = players.map((id) => {
      const g = playerMeta[id]?.gender;
      return g === 0 || g === 1 ? g : null;
    });
    const level = players.map((id) => {
      const l = playerMeta[id]?.level;
      return Number.isFinite(l) ? l : null;
    });
    const hasAny = gender.some((g) => g != null) || level.some((l) => l != null);
    if (hasAny) meta = { gender, level };
  }

  // Caminho preferencial: Torneio de Whist RESOLÚVEL — garante, de forma exata,
  // parceria única E adversário exatamente 2× para todos, já organizado em
  // rodadas (cada jogador joga uma vez por rodada; em N ímpar a folga circula).
  // Isso dá o equilíbrio perfeito de adversários e uma grade que roda todas as
  // quadras em paralelo com espera uniforme. O mapeamento jogador→índice é
  // escolhido para aproximar o equilíbrio de gênero/nível, sem afetar as regras
  // absolutas (permutar rótulos as preserva).
  const whist = americanoWhistRounds(n);
  if (whist) {
    const slot = americanoOptimizeAssignment(n, whist, meta, seededRng(`${seed}:assign`));
    const matches = [];
    whist.forEach((round, r) => {
      round.forEach(([sideA, sideB]) => {
        matches.push({
          round: r + 1,
          side_a: [players[slot[sideA[0]]], players[slot[sideA[1]]]],
          side_b: [players[slot[sideB[0]]], players[slot[sideB[1]]]],
        });
      });
    });
    return matches;
  }

  // Fallback (tamanhos sem escala de Whist pré-computada, ex.: N muito grande e
  // não-primo): otimização heurística que preserva a parceria única e equilibra
  // ao máximo os adversários. Mantém o sistema funcionando para qualquer N
  // válido, ainda que sem a resolubilidade perfeita das tabelas.
  const { gameList } = buildAmericanoSchedule(n, seed, meta);
  const baseMatches = gameList.map(([sideA, sideB]) => ({
    side_a: [players[sideA[0]], players[sideA[1]]],
    side_b: [players[sideB[0]], players[sideB[1]]],
  }));
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
 *   groupStrategy?: 'shuffle'|'tiered',
 *   playerMeta?: Record<string, { gender?: 0|1|null, level?: number|null }>,
 * }} input
 *   `playerMeta` (opcional) é usado apenas pelo formato Americano para o
 *   equilíbrio secundário por gênero/nível, sem afetar o equilíbrio de
 *   adversários (regra absoluta).
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
    groupStrategy = 'shuffle',
    playerMeta = null,
  } = input;

  if (stageType === 'americano') {
    if (format === MODALITY_FORMAT.DOUBLES) {
      throw new Error(
        'O formato Americano (rotação de duplas) só é compatível com inscrição individual (Simples). Para inscrição em Duplas, escolha Pontos corridos, Fase de grupos, Chaves, Dupla eliminação ou Sistema suíço.',
      );
    }
    return {
      stageType: 'americano',
      matches: buildAmericanoRotation(participants, { seed, playerMeta }),
    };
  }
  if (stageType === 'round_robin') {
    return { stageType, matches: buildRoundRobinMatches(participants) };
  }
  if (stageType === 'groups') {
    const groups = distributeGroups(participants, { groupCount, seedCount, seed, strategy: groupStrategy });
    return { stageType, groups, matches: buildGroupMatches(groups) };
  }
  if (stageType === 'knockout') {
    const { slots, matches, totalRounds } = buildKnockoutBracket(participants, { seedCount, seed });
    return { stageType, bracket: { slots, totalRounds }, matches };
  }
  if (stageType === 'double_knockout') {
    // Gera a chave completa; persistimos os jogos jogáveis da 1ª rodada da
    // chave de vencedores (os demais dependem dos resultados, como no mata-mata
    // simples). A estrutura da chave fica disponível como metadado.
    const bracket = buildDoubleEliminationBracket(participants, { seedCount, seed });
    const matches = bracket.wb
      .filter((m) => m.round === 1)
      .map((m) => ({
        bracket: 'wb',
        round: 1,
        position: m.position,
        side_a: m.side_a,
        side_b: m.side_b,
        bye: Boolean(m.bye),
      }));
    return {
      stageType,
      bracket: { size: bracket.size, wbRounds: bracket.wbRounds, lbRounds: bracket.lbRounds },
      matches,
    };
  }
  if (stageType === 'swiss') {
    // Pareamento da 1ª rodada (sem pontuação ainda). As rodadas seguintes são
    // pareadas conforme a classificação, após os resultados.
    const standings = participants.map((id) => ({ id, points: 0, byesReceived: 0 }));
    const { pairings } = pairSwissRound(standings, [], { round: 1, seed });
    const matches = pairings.map((p, i) => ({
      round: 1,
      position: i + 1,
      side_a: p.side_a,
      side_b: p.side_b ?? null,
      bye: Boolean(p.bye),
    }));
    return { stageType, matches };
  }
  throw new Error(`Tipo de fase desconhecido: ${stageType}`);
}
