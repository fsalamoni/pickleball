/**
 * Motor de rating "estilo DUPR" — próprio da plataforma, na escala 2.000–8.000.
 *
 * IMPORTANTE: o algoritmo oficial do DUPR é proprietário e NÃO é reproduzido
 * aqui. Este motor é uma aproximação independente que usa a MESMA escala e um
 * comportamento semelhante (sobe ao vencer, desce ao perder; converge mais
 * rápido nos primeiros jogos; simples e duplas separados; margem de vitória tem
 * peso leve). É um ranking INDEPENDENTE — não substitui o rating ELO existente.
 *
 * Puro/determinístico: um replay cronológico completo de todos os jogos
 * finalizados chega sempre ao mesmo resultado (sem estado incremental).
 */

/** Limites da escala (iguais aos do DUPR: 2.000–8.000). */
export const DUPR_MIN = 2.0;
export const DUPR_MAX = 8.0;
/** Semente padrão de quem não tem DUPR informado nem nível de nivelamento. */
export const DUPR_DEFAULT_SEED = 3.0;
/** Jogos abaixo dos quais o rating é considerado provisório (converge rápido). */
export const DUPR_PROVISIONAL_GAMES = 5;
/** "Espalhamento" da curva de expectativa na escala 2–8 (quanto 1.0 de
 *  diferença pesa). ~1.5 → diferença de 1.0 ponto ≈ 82% de expectativa. */
export const DUPR_SPREAD = 1.5;
/** Incremento base por jogo (jogador estabelecido). */
export const DUPR_K = 0.08;
/** Incremento na fase provisória (converge mais rápido no início). */
export const DUPR_PROVISIONAL_K = 0.20;

/** Arredonda para 3 casas decimais (formato x.xxx). */
export function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

/** Mantém o rating dentro de [DUPR_MIN, DUPR_MAX]. */
export function clampRating(value) {
  return Math.min(DUPR_MAX, Math.max(DUPR_MIN, Number(value) || DUPR_MIN));
}

/** Probabilidade esperada de vitória do lado A dados os ratings dos dois lados. */
export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / DUPR_SPREAD));
}

/** Fator K conforme experiência (maior enquanto provisório). */
export function kFactor(gamesPlayed) {
  return gamesPlayed < DUPR_PROVISIONAL_GAMES ? DUPR_PROVISIONAL_K : DUPR_K;
}

/**
 * Peso leve da margem de vitória (o DUPR considera o placar). Fica entre 1.0
 * (jogo apertado) e 1.5 (jogo muito desequilibrado). Nunca inverte o sinal do
 * ajuste — apenas modula a intensidade dentro de um teto seguro.
 *
 * @param {number} winnerPoints pontos de quem venceu
 * @param {number} loserPoints pontos de quem perdeu
 */
export function movMultiplier(winnerPoints, loserPoints) {
  const w = Number(winnerPoints) || 0;
  const l = Number(loserPoints) || 0;
  const total = w + l;
  if (total <= 0) return 1;
  const ratio = Math.abs(w - l) / total; // 0..1
  return 1 + Math.min(0.5, ratio * 0.5); // 1.0 .. 1.5
}

/**
 * Converte o valor USAP de um nível (string, ex.: "2.5" ou "1.0 – 1.5") em um
 * número na escala DUPR. Faixas viram a média dos limites. Fora da escala →
 * limitado a [2.000, 8.000].
 * @param {string} usap
 * @returns {number|null}
 */
export function usapToRating(usap) {
  if (usap == null) return null;
  const nums = String(usap).match(/\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length === 0) return null;
  const vals = nums.map((n) => Number(String(n).replace(',', '.'))).filter(Number.isFinite);
  if (vals.length === 0) return null;
  const avg = vals.reduce((sum, v) => sum + v, 0) / vals.length;
  return clampRating(avg);
}

/**
 * Semente do rating de um atleta, por ordem de prioridade:
 *   1) rating DUPR informado manualmente no perfil (`dupr_rating`);
 *   2) valor USAP do nível de nivelamento (`leveling_level` → LEVEL_TABLE.usap);
 *   3) semente padrão (DUPR_DEFAULT_SEED).
 *
 * @param {object} profile perfil do atleta
 * @param {Array<{ id: string, usap: string }>} levelTable tabela de nivelamento
 * @returns {number} rating semente na escala 2.000–8.000
 */
export function seedFromProfile(profile, levelTable = []) {
  const manual = Number(profile?.dupr_rating);
  if (Number.isFinite(manual) && manual > 0) return clampRating(manual);
  const lvl = levelTable.find((l) => l.id === profile?.leveling_level);
  const fromUsap = lvl ? usapToRating(lvl.usap) : null;
  if (Number.isFinite(fromUsap)) return fromUsap;
  return DUPR_DEFAULT_SEED;
}

function mean(values) {
  if (values.length === 0) return DUPR_DEFAULT_SEED;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function makeSide(seed) {
  return {
    rating: seed,
    games: 0,
    wins: 0,
    losses: 0,
    peak_rating: seed,
    points_for: 0,
    points_against: 0,
    tournaments: new Set(),
  };
}

function ensurePlayer(state, id, seeds, defaultSeed) {
  let player = state.get(id);
  if (!player) {
    const seed = clampRating(Number.isFinite(seeds?.[id]) ? seeds[id] : defaultSeed);
    // Simples e duplas partem da mesma semente e evoluem separadamente.
    player = { player_id: id, singles: makeSide(seed), doubles: makeSide(seed) };
    state.set(id, player);
  }
  return player;
}

function updateSide(side, score, expected, mov, pointsFor, pointsAgainst, tournamentId) {
  const delta = kFactor(side.games) * mov * (score - expected);
  side.rating = clampRating(side.rating + delta);
  side.games += 1;
  if (score === 1) side.wins += 1; else side.losses += 1;
  if (side.rating > side.peak_rating) side.peak_rating = side.rating;
  side.points_for += Number(pointsFor) || 0;
  side.points_against += Number(pointsAgainst) || 0;
  if (tournamentId) side.tournaments.add(tournamentId);
}

/**
 * Aplica um único jogo ao estado mutável. Jogos de simples atualizam o rating
 * de simples; jogos de duplas atualizam o de duplas (lado = média dos dois).
 *
 * @param {Map<string, object>} state
 * @param {{ side_a: string[], side_b: string[], winner: 'a'|'b', points_a?: number, points_b?: number, tournament_id?: string }} match
 * @param {{ seeds?: Record<string, number>, defaultSeed?: number }} [options]
 */
export function applyDuprMatch(state, match, options = {}) {
  const seeds = options.seeds || {};
  const defaultSeed = Number.isFinite(options.defaultSeed) ? options.defaultSeed : DUPR_DEFAULT_SEED;
  const idsA = (match.side_a || []).filter(Boolean);
  const idsB = (match.side_b || []).filter(Boolean);
  if (idsA.length === 0 || idsB.length === 0) return;
  if (match.winner !== 'a' && match.winner !== 'b') return;

  const key = idsA.length > 1 || idsB.length > 1 ? 'doubles' : 'singles';
  const playersA = idsA.map((id) => ensurePlayer(state, id, seeds, defaultSeed));
  const playersB = idsB.map((id) => ensurePlayer(state, id, seeds, defaultSeed));

  const teamA = mean(playersA.map((p) => p[key].rating));
  const teamB = mean(playersB.map((p) => p[key].rating));
  const expA = expectedScore(teamA, teamB);
  const scoreA = match.winner === 'a' ? 1 : 0;

  const pointsA = Number(match.points_a) || 0;
  const pointsB = Number(match.points_b) || 0;
  const mov = movMultiplier(
    scoreA === 1 ? pointsA : pointsB,
    scoreA === 1 ? pointsB : pointsA,
  );
  const tournamentId = match.tournament_id || null;

  playersA.forEach((p) => updateSide(p[key], scoreA, expA, mov, pointsA, pointsB, tournamentId));
  playersB.forEach((p) => updateSide(p[key], 1 - scoreA, 1 - expA, mov, pointsB, pointsA, tournamentId));
}

function finalizeSide(side) {
  return {
    rating: round3(side.rating),
    peak_rating: round3(side.peak_rating),
    games: side.games,
    wins: side.wins,
    losses: side.losses,
    points_for: side.points_for,
    points_against: side.points_against,
    points_balance: side.points_for - side.points_against,
    tournaments: side.tournaments.size,
    provisional: side.games < DUPR_PROVISIONAL_GAMES,
  };
}

/**
 * Recalcula os ratings "estilo DUPR" a partir do histórico completo de jogos
 * finalizados. Retorna um item por jogador, com blocos `singles` e `doubles`.
 *
 * @param {Array<{ side_a: string[], side_b: string[], winner: 'a'|'b', at?: number }>} matches
 * @param {{ seeds?: Record<string, number>, defaultSeed?: number }} [options]
 * @returns {Array<{ player_id: string, singles: object, doubles: object }>}
 */
export function computeDuprRatings(matches, options = {}) {
  const ordered = (matches || []).slice();
  if (ordered.some((m) => Number.isFinite(m.at))) {
    ordered.sort((a, b) => (a.at || 0) - (b.at || 0));
  }
  const state = new Map();
  ordered.forEach((m) => applyDuprMatch(state, m, options));

  return Array.from(state.values()).map((p) => ({
    player_id: p.player_id,
    singles: finalizeSide(p.singles),
    doubles: finalizeSide(p.doubles),
  }));
}
