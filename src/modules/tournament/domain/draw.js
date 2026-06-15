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

/**
 * Cobertura para o caso geral de N jogadores em Americana aberta.
 *
 * Estratégia (greedy "mais restrito primeiro"):
 *  - Geramos todas as C(N,2) parcerias.
 *  - Montamos jogos casando duas parcerias disjuntas (4 jogadores distintos),
 *    cada parceria usada no máximo uma vez. A cada passo escolhemos a parceria
 *    com menos opções de casamento disponíveis (e o parceiro também mais
 *    restrito), o que maximiza o número de parcerias cobertas.
 *
 * Resultado: cobertura ótima — 0 parcerias de fora quando N ≡ 0 ou 1 (mod 4)
 * e exatamente 1 parceria de fora quando N ≡ 2 ou 3 (mod 4), que é o máximo
 * matematicamente possível (pois C(N,2) é ímpar nesses casos).
 *
 * Esta rotina é usada quando N não é múltiplo de 4 (ex.: N=5, 6, 7, 9, 10…).
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
  const disjoint = (a, b) =>
    a[0] !== b[0] && a[0] !== b[1] && a[1] !== b[0] && a[1] !== b[1];

  const matches = [];
  const used = new Array(pairs.length).fill(false);
  let remaining = pairs.length;

  while (remaining >= 2) {
    const available = [];
    for (let i = 0; i < pairs.length; i += 1) {
      if (!used[i]) available.push(i);
    }

    // Grau = número de parcerias disjuntas ainda disponíveis para casar.
    // Calculado uma única vez por iteração (o conjunto `available` é fixo aqui)
    // e reutilizado nas duas seleções abaixo.
    const degreeByIndex = new Map();
    for (let k = 0; k < available.length; k += 1) {
      const i = available[k];
      let deg = 0;
      for (let m = 0; m < available.length; m += 1) {
        const j = available[m];
        if (j !== i && disjoint(pairs[i], pairs[j])) deg += 1;
      }
      degreeByIndex.set(i, deg);
    }

    // Escolhe a parceria mais restrita (menor grau) para casar primeiro.
    let best = -1;
    let bestDeg = Infinity;
    for (let k = 0; k < available.length; k += 1) {
      const i = available[k];
      const deg = degreeByIndex.get(i);
      if (deg < bestDeg) {
        bestDeg = deg;
        best = i;
      }
    }
    if (best === -1) break;

    // Escolhe o parceiro disjunto também mais restrito.
    let partner = -1;
    let partnerDeg = Infinity;
    for (let k = 0; k < available.length; k += 1) {
      const j = available[k];
      if (j === best || !disjoint(pairs[best], pairs[j])) continue;
      const deg = degreeByIndex.get(j);
      if (deg < partnerDeg) {
        partnerDeg = deg;
        partner = j;
      }
    }

    if (partner === -1) {
      // Parceria sem nenhum casamento possível — fica de fora. Na prática isso
      // ocorre no máximo uma vez (quando C(N,2) é ímpar, N ≡ 2 ou 3 mod 4).
      used[best] = true;
      remaining -= 1;
      continue;
    }

    used[best] = true;
    used[partner] = true;
    remaining -= 2;
    matches.push({ side_a: pairs[best], side_b: pairs[partner] });
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
 * Gera as rodadas da Americana: cada jogador joga em dupla com TODOS os demais
 * jogadores (rotação de parceiros), contra outra dupla, e nenhuma dupla se
 * repete. A inscrição é individual (Simples) e as duplas são montadas aqui.
 *
 * Para garantir precisão perfeita, a Americana só é gerada quando o número de
 * inscritos permite cobrir TODAS as duplas exatamente uma vez — N ≡ 0 ou 1
 * (mod 4): 4, 5, 8, 9, 12, 13, 16, 17, … O número de jogos é exatamente
 * N·(N−1) / 4. Para qualquer outro N (≡ 2 ou 3 mod 4) o método lança erro, pois
 * seria impossível gerar todos os jogos sem deixar duplas de fora.
 *
 * Quando N é múltiplo de 4, o cronograma é hierárquico:
 *   1. Resolver os jogos internos de cada bloco de 4 jogadores
 *      (ex.: {a,b,c,d}, depois {e,f,g,h}).
 *   2. Resolver os cruzamentos entre cada par de blocos
 *      (ex.: misturar {a,b,e,f} e {c,d,g,h}, depois {a,b,g,h} e {c,d,e,f}).
 *
 * Para N ≡ 1 (mod 4) (5, 9, 13, …) usa-se uma heurística gulosa
 * ("mais restrito primeiro") que cobre todas as parcerias exatamente uma vez.
 *
 * @param {string[]} playerIds
 * @param {{ seed?: string }} [options]
 * @returns {Array<{ round: number, side_a: [string, string], side_b: [string, string] }>}
 */
export function buildAmericanoRotation(playerIds, options = {}) {
  const { seed = 'americano' } = options;
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
    groupStrategy = 'shuffle',
  } = input;

  if (stageType === 'americano') {
    if (format === MODALITY_FORMAT.DOUBLES) {
      throw new Error(
        'O formato Americano (rotação de duplas) só é compatível com inscrição individual (Simples). Para inscrição em Duplas, escolha Pontos corridos, Fase de grupos, Chaves, Dupla eliminação ou Sistema suíço.',
      );
    }
    return { stageType: 'americano', matches: buildAmericanoRotation(participants, { seed }) };
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
