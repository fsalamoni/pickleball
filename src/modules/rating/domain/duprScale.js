/**
 * Motor de rating "estilo DUPR" — próprio da plataforma, na escala 2.000–8.000.
 *
 * IMPORTANTE: o algoritmo oficial do DUPR é proprietário e NÃO é reproduzido
 * aqui. Este é uma aproximação independente na MESMA escala, desenhada para
 * chegar o mais perto possível do COMPORTAMENTO do DUPR:
 *
 *   1) BASEADO NO PLACAR (não em vitória/derrota): usa a PARTICIPAÇÃO no placar
 *      (pontos do lado / pontos totais) contra a participação ESPERADA pela
 *      diferença de rating. Assim, uma derrota apertada contra um adversário
 *      muito mais forte PODE SUBIR o rating, e uma vitória magra sobre iguais
 *      quase não mexe — igual ao DUPR.
 *   2) CONFIABILIDADE (reliability): cresce com o número de jogos. Ratings com
 *      muitos jogos se movem pouco (K menor); novatos convergem rápido (K maior).
 *   3) SIMPLES E DUPLAS separados. Em duplas, o lado = média dos parceiros e
 *      cada parceiro se move pelo próprio K/confiabilidade.
 *   4) W.O. / jogos sem placar NÃO pontuam (o DUPR ignora forfeits).
 *
 * Puro/determinístico: um replay cronológico completo dos jogos finalizados
 * chega sempre ao mesmo resultado.
 *
 * Ainda NÃO reproduzido (parte proprietária do DUPR): o "ajuste global em rede"
 * (recalcular todos os ratings conectados simultaneamente) e o decaimento por
 * inatividade/half-life. São refinamentos futuros; o replay sequential com
 * placar + confiabilidade já captura a essência.
 */

/** Limites da escala (iguais aos do DUPR: 2.000–8.000). */
export const DUPR_MIN = 2.0;
export const DUPR_MAX = 8.0;
/** Semente padrão de quem não tem DUPR informado nem nível de nivelamento. */
export const DUPR_DEFAULT_SEED = 3.0;

/** "Espalhamento" da curva: quanto 1.0 de diferença de rating altera a
 *  participação esperada no placar. Calibrado para gaps grandes preverem
 *  domínio moderado (ex.: +1.0 → ~0.60 de participação esperada). */
export const DUPR_SHARE_SPREAD = 5.5;
/** K máximo (rating novo, baixa confiabilidade — converge rápido). */
export const DUPR_K_MAX = 0.30;
/** K mínimo (rating maduro, alta confiabilidade — estável). */
export const DUPR_K_MIN = 0.05;
/** Constante de decaimento do K conforme os jogos acumulam. */
export const DUPR_K_TAU = 8;
/** Constante da curva de confiabilidade (0–100%). ~63% em 10 jogos. */
export const DUPR_RELIABILITY_TAU = 10;
/** Abaixo desta confiabilidade o rating é marcado como provisório. */
export const DUPR_PROVISIONAL_RELIABILITY = 50;

/** Arredonda para 3 casas decimais (formato x.xxx). */
export function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

/** Mantém o rating dentro de [DUPR_MIN, DUPR_MAX]. */
export function clampRating(value) {
  return Math.min(DUPR_MAX, Math.max(DUPR_MIN, Number(value) || DUPR_MIN));
}

/**
 * Participação ESPERADA do lado A no placar (0–1), dada a diferença de rating.
 * Ratings iguais → 0.5. Curva logística base-10 com espalhamento configurável.
 */
export function expectedShare(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / DUPR_SHARE_SPREAD));
}

/**
 * Fator K conforme experiência: alto no começo (converge rápido) decaindo
 * suavemente para um piso estável conforme a confiabilidade cresce.
 */
export function kFactor(gamesPlayed) {
  const g = Math.max(0, Number(gamesPlayed) || 0);
  return DUPR_K_MIN + (DUPR_K_MAX - DUPR_K_MIN) * Math.exp(-g / DUPR_K_TAU);
}

/** Confiabilidade (0–100%) a partir do número de jogos. Cresce rápido e satura. */
export function reliabilityFromGames(gamesPlayed) {
  const g = Math.max(0, Number(gamesPlayed) || 0);
  return Math.round(100 * (1 - Math.exp(-g / DUPR_RELIABILITY_TAU)));
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
    // Trajetória: rating APÓS cada jogo (para o gráfico de evolução).
    trajectory: [],
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

/**
 * Ajusta o rating de um lado pela diferença entre a participação REAL e a
 * ESPERADA no placar (baseado no placar, no estilo DUPR).
 */
function updateSide(side, actualShare, expShare, win, pointsFor, pointsAgainst, tournamentId, at) {
  const delta = kFactor(side.games) * (actualShare - expShare);
  side.rating = clampRating(side.rating + delta);
  side.games += 1;
  if (win) side.wins += 1; else side.losses += 1;
  if (side.rating > side.peak_rating) side.peak_rating = side.rating;
  side.points_for += Number(pointsFor) || 0;
  side.points_against += Number(pointsAgainst) || 0;
  if (tournamentId) side.tournaments.add(tournamentId);
  side.trajectory.push({ at: Number.isFinite(at) ? at : null, rating: round3(side.rating) });
}

/**
 * Aplica um único jogo ao estado mutável, com base no PLACAR. Jogos de simples
 * atualizam o rating de simples; de duplas, o de duplas (lado = média).
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

  const pointsA = Number(match.points_a) || 0;
  const pointsB = Number(match.points_b) || 0;
  const totalPts = pointsA + pointsB;
  // Sem placar (W.O./forfeit) não carrega informação de desempenho → ignora,
  // como o DUPR faz com jogos sem resultado disputado.
  if (totalPts <= 0) return;

  const key = idsA.length > 1 || idsB.length > 1 ? 'doubles' : 'singles';
  const playersA = idsA.map((id) => ensurePlayer(state, id, seeds, defaultSeed));
  const playersB = idsB.map((id) => ensurePlayer(state, id, seeds, defaultSeed));

  const teamA = mean(playersA.map((p) => p[key].rating));
  const teamB = mean(playersB.map((p) => p[key].rating));
  const expA = expectedShare(teamA, teamB);
  const actualA = pointsA / totalPts;
  const aWon = match.winner === 'a';
  const tournamentId = match.tournament_id || null;

  const at = Number.isFinite(match.at) ? match.at : null;
  playersA.forEach((p) => updateSide(p[key], actualA, expA, aWon, pointsA, pointsB, tournamentId, at));
  playersB.forEach((p) => updateSide(p[key], 1 - actualA, 1 - expA, !aWon, pointsB, pointsA, tournamentId, at));
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
    reliability: reliabilityFromGames(side.games),
    provisional: reliabilityFromGames(side.games) < DUPR_PROVISIONAL_RELIABILITY,
    // Evolução: rating após cada jogo, em ordem cronológica.
    trajectory: side.trajectory,
  };
}

/**
 * Recalcula os ratings "estilo DUPR" a partir do histórico completo de jogos
 * finalizados. Retorna um item por jogador, com blocos `singles` e `doubles`.
 *
 * @param {Array<{ side_a: string[], side_b: string[], winner: 'a'|'b', points_a?: number, points_b?: number, at?: number }>} matches
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
