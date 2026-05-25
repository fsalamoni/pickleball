/**
 * Engine de pontuação de pickleball.
 *
 * Cobre:
 *  - Determinação de vencedor de um game / partida considerando regras CBP/USAP.
 *  - Cálculo de pontos de classificação por vitória, set e saldo configurável pelo admin.
 *  - Validação básica de placar de game.
 *
 * Regras principais (CBP e USAP convergem na maioria dos pontos competitivos):
 *  - Game termina quando um lado atinge a pontuação alvo (11/15/21) com
 *    diferença mínima de 2 pontos sobre o adversário.
 *  - Em torneios pode-se jogar 1, 3 ou 5 sets (best-of).
 *  - Em regras CBP, o "rally scoring" é uma variante: ponto a cada bola jogada.
 *    Em regras USAP tradicionais, só pontua quem sacou.
 *    Para fins de pontuação no torneio, só o placar final do game importa.
 */

import { RULESET, TARGET_SCORE } from './constants.js';

/** Configuração padrão de pontuação do torneio. */
export const DEFAULT_SCORING_CONFIG = Object.freeze({
  ruleset: RULESET.CBP,
  target_score: TARGET_SCORE.ELEVEN,
  win_by_two: true,
  /** Hard cap quando há vantagem (ex.: 11 com cap 15 = quem chegar primeiro a 15, mesmo sem 2 pts). */
  max_score_cap: null,
  /** Quantidade de sets em um match. */
  sets_per_match: 1,
  /** Pontos atribuídos no ranking. */
  points: {
    match_win: 3,
    match_draw: 1, // só faz sentido se sets_per_match for par; default não usado
    match_loss: 0,
    walkover_win: 3,
    walkover_loss: 0,
    /** Pontos extras por set vencido. */
    per_set_won: 0,
  },
});

/**
 * Normaliza configuração parcial mesclando com defaults.
 * @param {object} [config]
 */
export function normalizeScoringConfig(config) {
  const cfg = { ...DEFAULT_SCORING_CONFIG, ...(config || {}) };
  cfg.points = { ...DEFAULT_SCORING_CONFIG.points, ...(config?.points || {}) };
  if (!Object.values(TARGET_SCORE).includes(cfg.target_score)) {
    cfg.target_score = TARGET_SCORE.ELEVEN;
  }
  if (!Object.values(RULESET).includes(cfg.ruleset)) {
    cfg.ruleset = RULESET.CBP;
  }
  if (![1, 3, 5].includes(cfg.sets_per_match)) {
    cfg.sets_per_match = 1;
  }
  return cfg;
}

/**
 * Valida e classifica o vencedor de um único game.
 * @param {{a: number, b: number}} game
 * @param {object} config
 * @returns {{winner: 'a' | 'b' | null, valid: boolean, reason?: string}}
 */
export function getGameWinner(game, config) {
  const cfg = normalizeScoringConfig(config);
  const a = Number(game?.a ?? 0);
  const b = Number(game?.b ?? 0);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
    return { winner: null, valid: false, reason: 'Placar inválido.' };
  }
  if (a === b) return { winner: null, valid: false, reason: 'Empate não permitido em pickleball.' };
  const target = cfg.target_score;
  const cap = cfg.max_score_cap;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const winner = a > b ? 'a' : 'b';
  if (hi < target) return { winner: null, valid: false, reason: `Nenhum lado atingiu ${target}.` };
  if (cfg.win_by_two) {
    if (cap && hi >= cap) return { winner, valid: true };
    if (hi - lo < 2) return { winner: null, valid: false, reason: 'É necessária vantagem de 2 pontos.' };
  }
  return { winner, valid: true };
}

/**
 * Calcula o vencedor de uma partida (best-of-sets) e o placar consolidado.
 * @param {{games: Array<{a:number,b:number}>, walkover?: 'a'|'b'|null}} match
 * @param {object} config
 * @returns {{
 *   winner: 'a' | 'b' | null,
 *   sets_a: number,
 *   sets_b: number,
 *   points_diff: number,
 *   finished: boolean,
 *   walkover: boolean,
 *   game_results: Array<{winner: 'a'|'b'|null, valid: boolean}>,
 * }}
 */
export function getMatchResult(match, config) {
  const cfg = normalizeScoringConfig(config);
  if (match?.walkover === 'a' || match?.walkover === 'b') {
    return {
      winner: match.walkover,
      sets_a: 0,
      sets_b: 0,
      points_diff: 0,
      finished: true,
      walkover: true,
      game_results: [],
    };
  }
  const games = Array.isArray(match?.games) ? match.games : [];
  const setsNeeded = Math.ceil(cfg.sets_per_match / 2);
  let setsA = 0;
  let setsB = 0;
  let diff = 0;
  const gameResults = games.map((g) => {
    const res = getGameWinner(g, cfg);
    if (res.valid) {
      if (res.winner === 'a') setsA += 1;
      else if (res.winner === 'b') setsB += 1;
      diff += (Number(g.a) || 0) - (Number(g.b) || 0);
    }
    return res;
  });
  const finished = setsA >= setsNeeded || setsB >= setsNeeded;
  const winner = finished ? (setsA > setsB ? 'a' : 'b') : null;
  return {
    winner,
    sets_a: setsA,
    sets_b: setsB,
    points_diff: diff,
    finished,
    walkover: false,
    game_results: gameResults,
  };
}

/**
 * Calcula os pontos de ranking concedidos a cada lado por um match finalizado.
 * @returns {{a: number, b: number, sets_a: number, sets_b: number, points_diff: number}}
 */
export function getMatchPoints(match, config) {
  const cfg = normalizeScoringConfig(config);
  const result = getMatchResult(match, cfg);
  if (!result.finished) {
    return { a: 0, b: 0, sets_a: 0, sets_b: 0, points_diff: 0 };
  }
  if (result.walkover) {
    const winSide = result.winner;
    return {
      a: winSide === 'a' ? cfg.points.walkover_win : cfg.points.walkover_loss,
      b: winSide === 'b' ? cfg.points.walkover_win : cfg.points.walkover_loss,
      sets_a: 0,
      sets_b: 0,
      points_diff: 0,
    };
  }
  return {
    a:
      (result.winner === 'a' ? cfg.points.match_win : cfg.points.match_loss) +
      result.sets_a * cfg.points.per_set_won,
    b:
      (result.winner === 'b' ? cfg.points.match_win : cfg.points.match_loss) +
      result.sets_b * cfg.points.per_set_won,
    sets_a: result.sets_a,
    sets_b: result.sets_b,
    points_diff: result.points_diff,
  };
}
