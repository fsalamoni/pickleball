/**
 * Sistema MEXICANO (rotação dinâmica por classificação).
 *
 * É um primo do Americano, muito popular no pickleball/padel social, mas com
 * uma diferença essencial: os pares de cada rodada são definidos PELA
 * CLASSIFICAÇÃO ATUAL, não por uma tabela fixa.
 *
 * Regras:
 *  - Joga-se em quadras de 4 (duas duplas). A inscrição é individual (Simples) e
 *    as duplas são montadas a cada rodada.
 *  - Rodada 1: jogadores ordenados (cabeças-de-chave/sorteio) e divididos em
 *    quadras de 4 por posição; dentro da quadra, 1º+4º × 2º+3º.
 *  - Rodadas seguintes: re-ordena TODOS por pontos somados (rally points) e
 *    reagrupa de 4 em 4 (1–4, 5–8, …), repetindo o pareamento 1º+4º × 2º+3º.
 *    Assim, quem vai bem sobe de quadra e enfrenta os melhores; quem vai mal
 *    desce — os jogos ficam sempre equilibrados.
 *  - Quando o número de inscritos não é múltiplo de 4, os excedentes folgam na
 *    rodada (bye), com a folga circulando de forma justa (recebe a folga quem
 *    menos folgou até então).
 *
 * Tudo é puro e determinístico dada a seed. A classificação por pontos é
 * calculada a partir do placar dos jogos (independe da config de pontuação).
 */

import { seededRng, shuffle } from './draw.js';

const COURT_SIZE = 4;

/** Pareamento dentro de uma quadra de 4 (ordenados): 1º+4º × 2º+3º. */
export function mexicanoCourtPairing(four) {
  return { side_a: [four[0], four[3]], side_b: [four[1], four[2]] };
}

/** Número de rodadas recomendado para N jogadores (organizador pode ajustar). */
export function recommendedMexicanoRounds(n) {
  if (n < COURT_SIZE) return 0;
  return Math.max(3, Math.min(8, n - 1));
}

/** Pontos somados (rally points) e folgas recebidas por jogador, das rodadas dadas. */
export function mexicanoStandings(matches, playerIds) {
  const points = new Map(playerIds.map((id) => [id, 0]));
  const wins = new Map(playerIds.map((id) => [id, 0]));
  const rounds = new Set();
  const playedInRound = new Map(); // round -> Set(playerId)

  const sideIds = (m, key) => {
    const ids = m[key === 'a' ? 'side_a_ids' : 'side_b_ids'];
    if (Array.isArray(ids) && ids.length) return ids.map(String);
    const raw = m[key === 'a' ? 'side_a' : 'side_b'];
    if (raw == null) return [];
    return Array.isArray(raw) ? raw.map(String) : String(raw).split('+').map((s) => s.trim());
  };

  matches.forEach((m) => {
    const r = m.round || 1;
    rounds.add(r);
    if (!playedInRound.has(r)) playedInRound.set(r, new Set());
    const idsA = sideIds(m, 'a');
    const idsB = sideIds(m, 'b');
    [...idsA, ...idsB].forEach((id) => playedInRound.get(r).add(id));

    const ptsA = (m.games || []).reduce((s, g) => s + (Number(g?.a) || 0), 0);
    const ptsB = (m.games || []).reduce((s, g) => s + (Number(g?.b) || 0), 0);
    const finished = m.status === 'finished' || m.status === 'walkover';
    if (!finished) return;
    idsA.forEach((id) => points.set(id, (points.get(id) || 0) + ptsA));
    idsB.forEach((id) => points.set(id, (points.get(id) || 0) + ptsB));
    if (ptsA > ptsB) idsA.forEach((id) => wins.set(id, (wins.get(id) || 0) + 1));
    else if (ptsB > ptsA) idsB.forEach((id) => wins.set(id, (wins.get(id) || 0) + 1));
  });

  // Folgas: rodadas já ocorridas em que o jogador não apareceu em nenhum jogo.
  const byes = new Map(playerIds.map((id) => [id, 0]));
  rounds.forEach((r) => {
    const present = playedInRound.get(r) || new Set();
    playerIds.forEach((id) => {
      if (!present.has(id)) byes.set(id, (byes.get(id) || 0) + 1);
    });
  });

  return playerIds.map((id) => ({
    id,
    points: points.get(id) || 0,
    wins: wins.get(id) || 0,
    byesReceived: byes.get(id) || 0,
  }));
}

/**
 * Monta os jogos de UMA rodada a partir de uma ordem de jogadores e das folgas
 * acumuladas. Os excedentes (N mod 4) folgam, escolhidos entre os que menos
 * folgaram (desempate: pior colocado e, por fim, id), para circular a folga.
 *
 * @param {string[]} orderedIds jogadores em ordem de classificação (melhor 1º)
 * @param {Map<string, number>} byesByPlayer folgas acumuladas
 * @param {number} round número da rodada a gerar
 * @returns {{ matches: object[] }}
 */
export function buildMexicanoRoundFromOrder(orderedIds, byesByPlayer, round) {
  const n = orderedIds.length;
  const sittingCount = n % COURT_SIZE;
  let sitters = new Set();
  if (sittingCount > 0) {
    // candidatos ordenados por menos folgas, depois pior colocado (fim da lista).
    const rankByPlayer = new Map(orderedIds.map((id, i) => [id, i]));
    const chosen = orderedIds
      .slice()
      .sort((x, y) => {
        const bx = byesByPlayer.get(x) || 0;
        const by = byesByPlayer.get(y) || 0;
        if (bx !== by) return bx - by; // menos folgas primeiro
        return rankByPlayer.get(y) - rankByPlayer.get(x); // pior colocado primeiro
      })
      .slice(0, sittingCount);
    sitters = new Set(chosen);
  }

  const playing = orderedIds.filter((id) => !sitters.has(id));
  const matches = [];
  for (let i = 0; i < playing.length; i += COURT_SIZE) {
    const court = playing.slice(i, i + COURT_SIZE);
    if (court.length < COURT_SIZE) break;
    const { side_a, side_b } = mexicanoCourtPairing(court);
    matches.push({ round, position: matches.length + 1, side_a, side_b, bye: false });
  }
  return { matches };
}

/**
 * Primeira rodada do Mexicano: ordem por cabeças-de-chave/sorteio.
 * @param {string[]} playerIds
 * @param {{ seed?: string, seedCount?: number }} [options]
 * @returns {{ matches: object[] }}
 */
export function buildMexicanoFirstRound(playerIds, options = {}) {
  const { seed = 'mexicano', seedCount = 0 } = options;
  if (playerIds.length < COURT_SIZE) {
    throw new Error('O Mexicano exige no mínimo 4 jogadores.');
  }
  const rng = seededRng(seed);
  const seeds = playerIds.slice(0, seedCount);
  const rest = shuffle(playerIds.slice(seedCount), rng);
  const ordered = [...seeds, ...rest];
  const byes = new Map(ordered.map((id) => [id, 0]));
  return buildMexicanoRoundFromOrder(ordered, byes, 1);
}

/**
 * Próxima rodada do Mexicano a partir dos resultados.
 * @param {object[]} matches jogos já jogados da fase
 * @param {string[]} playerIds todos os participantes
 * @param {{ round?: number, totalRounds?: number, seed?: string }} [options]
 * @returns {{ pending: true } | { complete: true } | { matches: object[], nextRound: number }}
 */
export function mexicanoNextRound(matches, playerIds, options = {}) {
  const totalRounds = options.totalRounds || recommendedMexicanoRounds(playerIds.length);
  if (!matches || matches.length === 0) return { pending: true };

  const byRound = new Map();
  matches.forEach((m) => {
    const r = m.round || 1;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r).push(m);
  });
  const maxRound = Math.max(...byRound.keys());
  const current = byRound.get(maxRound);
  const decided = (m) => m.status === 'finished' || m.status === 'walkover';
  if (!current.every(decided)) return { pending: true };
  if (maxRound >= totalRounds) return { complete: true };

  const standings = mexicanoStandings(matches, playerIds);
  const ordered = standings
    .slice()
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return String(a.id).localeCompare(String(b.id));
    })
    .map((s) => s.id);
  const byes = new Map(standings.map((s) => [s.id, s.byesReceived]));

  const { matches: next } = buildMexicanoRoundFromOrder(ordered, byes, maxRound + 1);
  return { matches: next, nextRound: maxRound + 1 };
}
