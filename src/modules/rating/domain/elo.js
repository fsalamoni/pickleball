/**
 * Motor de rating ELO próprio da Pickleholics (lógica pura, sem I/O).
 *
 * O rating é recalculado por um replay determinístico de todos os jogos
 * finalizados em ordem cronológica. Suporta simples (1 jogador por lado) e
 * duplas (rating do lado = média dos ratings dos jogadores; cada jogador do
 * lado recebe o próprio delta conforme seu fator K).
 *
 * Como o replay é completo e ordenado, qualquer cliente/admin que rode o
 * cálculo chega ao mesmo resultado — não há divergência de estado incremental.
 */

/** Rating inicial padrão de quem não tem semente por nível. */
export const DEFAULT_SEED_RATING = 1000;
/** Fator K padrão (jogadores já estabelecidos). */
export const ELO_K = 24;
/** Fator K maior na fase provisória (rating converge mais rápido no início). */
export const PROVISIONAL_K = 40;
/** Quantidade de jogos abaixo da qual o jogador é considerado provisório. */
export const PROVISIONAL_GAMES = 10;

/** Probabilidade esperada de vitória do lado A dado os ratings dos dois lados. */
export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** Fator K conforme experiência (maior enquanto provisório). */
export function kFactor(gamesPlayed) {
  return gamesPlayed < PROVISIONAL_GAMES ? PROVISIONAL_K : ELO_K;
}

/**
 * Semente de rating a partir do índice (0-based) do nível na tabela ordenada de
 * nivelamento. Níveis mais altos começam com rating maior. Índice inválido →
 * rating padrão.
 * @param {number} ordinal índice 0-based (0 = nível mais baixo)
 * @param {number} totalLevels quantidade de níveis na tabela
 */
export function seedFromLevelOrdinal(ordinal, totalLevels) {
  if (!Number.isInteger(ordinal) || ordinal < 0 || !Number.isInteger(totalLevels) || totalLevels <= 1) {
    return DEFAULT_SEED_RATING;
  }
  const min = 800;
  const max = 1600;
  const step = (max - min) / (totalLevels - 1);
  return Math.round(min + Math.min(ordinal, totalLevels - 1) * step);
}

function mean(values) {
  if (values.length === 0) return DEFAULT_SEED_RATING;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function ensurePlayer(state, id, seeds, defaultSeed) {
  let player = state.get(id);
  if (!player) {
    const seed = Number.isFinite(seeds?.[id]) ? seeds[id] : defaultSeed;
    player = {
      player_id: id,
      rating: seed,
      games: 0,
      wins: 0,
      losses: 0,
      peak_rating: seed,
      // Saldo de pontos (pontos marcados − sofridos) e torneios distintos.
      points_for: 0,
      points_against: 0,
      tournaments: new Set(),
    };
    state.set(id, player);
  }
  return player;
}

/**
 * Aplica um único jogo ao estado mutável `state` (Map id → estatísticas).
 * @param {Map<string, object>} state
 * @param {{ side_a: string[], side_b: string[], winner: 'a'|'b', points_a?: number, points_b?: number, tournament_id?: string }} match
 * @param {{ seeds?: Record<string, number>, defaultSeed?: number }} [options]
 */
export function applyMatch(state, match, options = {}) {
  const seeds = options.seeds || {};
  const defaultSeed = Number.isFinite(options.defaultSeed) ? options.defaultSeed : DEFAULT_SEED_RATING;
  const idsA = (match.side_a || []).filter(Boolean);
  const idsB = (match.side_b || []).filter(Boolean);
  if (idsA.length === 0 || idsB.length === 0) return;
  if (match.winner !== 'a' && match.winner !== 'b') return;

  const playersA = idsA.map((id) => ensurePlayer(state, id, seeds, defaultSeed));
  const playersB = idsB.map((id) => ensurePlayer(state, id, seeds, defaultSeed));

  const teamA = mean(playersA.map((p) => p.rating));
  const teamB = mean(playersB.map((p) => p.rating));
  const expA = expectedScore(teamA, teamB);
  const scoreA = match.winner === 'a' ? 1 : 0;

  const pointsA = Number(match.points_a) || 0;
  const pointsB = Number(match.points_b) || 0;
  const tournamentId = match.tournament_id || null;

  playersA.forEach((p) => {
    p.rating += kFactor(p.games) * (scoreA - expA);
    p.games += 1;
    if (scoreA === 1) p.wins += 1; else p.losses += 1;
    if (p.rating > p.peak_rating) p.peak_rating = p.rating;
    p.points_for += pointsA;
    p.points_against += pointsB;
    if (tournamentId) p.tournaments.add(tournamentId);
  });
  playersB.forEach((p) => {
    p.rating += kFactor(p.games) * ((1 - scoreA) - (1 - expA));
    p.games += 1;
    if (scoreA === 0) p.wins += 1; else p.losses += 1;
    if (p.rating > p.peak_rating) p.peak_rating = p.rating;
    p.points_for += pointsB;
    p.points_against += pointsA;
    if (tournamentId) p.tournaments.add(tournamentId);
  });
}

/**
 * Recalcula os ratings a partir do histórico completo de jogos finalizados.
 *
 * @param {Array<{ side_a: string[], side_b: string[], winner: 'a'|'b', at?: number }>} matches
 *   já ordenados cronologicamente (ascendente); se `at` for fornecido, são reordenados.
 * @param {{ seeds?: Record<string, number>, defaultSeed?: number }} [options]
 * @returns {Array<{ player_id, rating, games, wins, losses, peak_rating }>} ordenado por rating desc
 */
export function computeRatings(matches, options = {}) {
  const ordered = (matches || []).slice();
  if (ordered.some((m) => Number.isFinite(m.at))) {
    ordered.sort((a, b) => (a.at || 0) - (b.at || 0));
  }
  const state = new Map();
  ordered.forEach((m) => applyMatch(state, m, options));

  return Array.from(state.values())
    .map((p) => ({
      player_id: p.player_id,
      rating: Math.round(p.rating),
      peak_rating: Math.round(p.peak_rating),
      games: p.games,
      wins: p.wins,
      losses: p.losses,
      points_for: p.points_for,
      points_against: p.points_against,
      points_balance: p.points_for - p.points_against,
      tournaments: p.tournaments.size,
    }))
    .sort((a, b) => b.rating - a.rating || b.games - a.games);
}
