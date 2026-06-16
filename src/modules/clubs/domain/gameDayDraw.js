/**
 * Sorteio de jogos para o "Dia de jogo" de um clube.
 *
 * Diferente do Americano de torneio (que exige N ≡ 0 ou 1 mod 4 e garante
 * cobertura EXATA de parcerias), aqui o objetivo é prático e flexível:
 *
 *  - Funciona com QUALQUER número de participantes (N ≥ 4).
 *  - Segue a mesma lógica/estrutura do Americano (jogos de duplas 2×2, todos
 *    rodando), priorizando parcerias e adversários inéditos.
 *  - É PERMITIDA a repetição de duplas e de adversários, mas só "depois de
 *    esgotadas as possibilidades normais": o motor sempre escolhe as
 *    combinações com menos repetições primeiro.
 *  - Equilibra a PARTICIPAÇÃO: em cada rodada quem menos jogou entra em quadra,
 *    e quem mais jogou descansa (quando N não é múltiplo de 4). O descanso
 *    circula de forma justa.
 *
 * Determinístico dada a seed (reprodutível ao re-sortear com a mesma seed).
 */

/* RNG determinístico (mulberry32 semeado por string) — auto-contido. */
function seededRng(seed = 'gameday') {
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

function shuffle(list, rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Escolhe a melhor das 3 formações de duplas para um grupo de 4 jogadores,
 * minimizando repetições de parceria (peso maior) e de adversários.
 *
 * @returns {{ side_a: [number, number], side_b: [number, number], cost: number }}
 */
function bestPairingOfFour(group, partnerCount, oppCount, rng) {
  const [a, b, c, d] = group;
  const W_PARTNER = 10; // repetir dupla é pior que repetir adversário
  const W_OPP = 3;
  const partnerCost = (x, y) => (partnerCount.get(pairKey(x, y)) || 0);
  const oppCost = (p, q) =>
    (oppCount.get(pairKey(p[0], q[0])) || 0) +
    (oppCount.get(pairKey(p[0], q[1])) || 0) +
    (oppCount.get(pairKey(p[1], q[0])) || 0) +
    (oppCount.get(pairKey(p[1], q[1])) || 0);

  const options = [
    { side_a: [a, b], side_b: [c, d] },
    { side_a: [a, c], side_b: [b, d] },
    { side_a: [a, d], side_b: [b, c] },
  ];
  let best = null;
  for (const opt of options) {
    const cost =
      W_PARTNER * (partnerCost(opt.side_a[0], opt.side_a[1]) + partnerCost(opt.side_b[0], opt.side_b[1])) +
      W_OPP * oppCost(opt.side_a, opt.side_b) +
      rng() * 0.001; // desempate determinístico
    if (!best || cost < best.cost) best = { ...opt, cost };
  }
  return best;
}

/**
 * Monta uma rodada (lista de jogos de 4 jogadores) a partir do conjunto de
 * jogadores que vão jogar, escolhendo grupos e formações que minimizem
 * repetições. Faz várias tentativas e fica com a de menor custo.
 *
 * @param {number[]} playing  índices dos jogadores que jogam nesta rodada
 * @returns {{ games: Array<{side_a:[number,number], side_b:[number,number]}>, cost: number }}
 */
function buildRound(playing, partnerCount, oppCount, rng) {
  const courts = Math.floor(playing.length / 4);
  let best = null;
  const attempts = 24;
  for (let t = 0; t < attempts; t += 1) {
    const order = shuffle(playing, rng);
    // Clones locais para acumular o efeito dentro da própria rodada.
    const localP = new Map(partnerCount);
    const localO = new Map(oppCount);
    const games = [];
    let totalCost = 0;
    for (let g = 0; g < courts; g += 1) {
      const group = order.slice(g * 4, g * 4 + 4);
      const pick = bestPairingOfFour(group, localP, localO, rng);
      games.push({ side_a: pick.side_a, side_b: pick.side_b });
      totalCost += pick.cost;
      // Atualiza os clones para refletir a escolha na mesma rodada.
      localP.set(pairKey(pick.side_a[0], pick.side_a[1]), (localP.get(pairKey(pick.side_a[0], pick.side_a[1])) || 0) + 1);
      localP.set(pairKey(pick.side_b[0], pick.side_b[1]), (localP.get(pairKey(pick.side_b[0], pick.side_b[1])) || 0) + 1);
      for (const x of pick.side_a) {
        for (const y of pick.side_b) {
          localO.set(pairKey(x, y), (localO.get(pairKey(x, y)) || 0) + 1);
        }
      }
    }
    if (!best || totalCost < best.cost) best = { games, cost: totalCost };
  }
  return best || { games: [], cost: 0 };
}

/**
 * Gera os jogos do dia em `rounds` rodadas, equilibrando a participação.
 *
 * @param {string[]} playerIds  ids/identificadores únicos dos participantes
 * @param {{ rounds?: number, seed?: string }} [options]
 * @returns {Array<{ round: number, side_a: [string, string], side_b: [string, string] }>}
 *   Jogos de duplas. Os ids retornados são os mesmos recebidos em `playerIds`.
 */
export function generateGameDayGames(playerIds, options = {}) {
  const ids = (playerIds || []).filter(Boolean);
  const n = ids.length;
  if (n < 4) {
    throw new Error('O sorteio do dia de jogo exige no mínimo 4 participantes.');
  }
  const { seed = 'gameday', rounds = suggestRounds(n) } = options;
  const totalRounds = Math.max(1, Math.min(60, Math.floor(rounds)));
  const rng = seededRng(seed);

  // Trabalhamos com índices 0..n-1; mapeamos para ids no final.
  const players = shuffle(
    Array.from({ length: n }, (_, i) => i),
    rng,
  );
  const gamesPlayed = new Array(n).fill(0);
  const restCount = new Array(n).fill(0);
  const partnerCount = new Map();
  const oppCount = new Map();

  const courts = Math.floor(n / 4);
  const playPerRound = courts * 4;
  const out = [];

  for (let r = 0; r < totalRounds; r += 1) {
    // Quem joga: os que menos jogaram (e, em empate, os que mais descansaram).
    const ranked = players
      .slice()
      .sort((x, y) => {
        if (gamesPlayed[x] !== gamesPlayed[y]) return gamesPlayed[x] - gamesPlayed[y];
        if (restCount[x] !== restCount[y]) return restCount[y] - restCount[x];
        return rng() - 0.5;
      });
    const playing = ranked.slice(0, playPerRound);
    const resting = ranked.slice(playPerRound);
    resting.forEach((p) => {
      restCount[p] += 1;
    });

    const { games } = buildRound(playing, partnerCount, oppCount, rng);
    games.forEach((gm) => {
      // Persiste o efeito nos contadores globais.
      partnerCount.set(pairKey(gm.side_a[0], gm.side_a[1]), (partnerCount.get(pairKey(gm.side_a[0], gm.side_a[1])) || 0) + 1);
      partnerCount.set(pairKey(gm.side_b[0], gm.side_b[1]), (partnerCount.get(pairKey(gm.side_b[0], gm.side_b[1])) || 0) + 1);
      for (const x of gm.side_a) {
        for (const y of gm.side_b) {
          oppCount.set(pairKey(x, y), (oppCount.get(pairKey(x, y)) || 0) + 1);
        }
      }
      [...gm.side_a, ...gm.side_b].forEach((p) => {
        gamesPlayed[p] += 1;
      });
      out.push({
        round: r + 1,
        side_a: [ids[gm.side_a[0]], ids[gm.side_a[1]]],
        side_b: [ids[gm.side_b[0]], ids[gm.side_b[1]]],
      });
    });
  }
  return out;
}

/**
 * Sugestão de número de rodadas para que todos joguem um número equilibrado de
 * vezes — algo próximo de "cada jogador participa de N−1 jogos" do Americano,
 * limitado para não gerar uma grade gigante.
 */
export function suggestRounds(n) {
  if (n < 4) return 0;
  // Um valor prático: o suficiente para uma boa rotação sem exagero.
  return Math.max(3, Math.min(12, n - 1));
}
