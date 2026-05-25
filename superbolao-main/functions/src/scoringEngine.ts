/**
 * Engine de pontuação (TypeScript) — espelha exatamente o módulo do front
 * em src/domain/scoringEngine.js. Consolidamos aqui em TS porque é o local
 * onde a pontuação é canonicamente calculada (não no cliente).
 *
 * Mantém-se sincronizada manualmente. Em ambos os lugares há testes
 * unitários cobrindo a mesma matriz de casos.
 */

export const HIT_TYPES = {
  EXACT_SCORE: 'exact_score',
  WINNER_PLUS_DIFF: 'winner_plus_diff',
  WINNER_PLUS_TEAM_GOALS: 'winner_plus_team_goals',
  WINNER_ONLY: 'winner_only',
  TEAM_GOALS_ONLY: 'team_goals_only',
  NONE: 'none',
} as const;

export type HitType = (typeof HIT_TYPES)[keyof typeof HIT_TYPES];

export interface Bet {
  predicted_home: number;
  predicted_away: number;
  penalty_winner_team_id?: string | null;
  predicted_home_penalties?: number | null;
  predicted_away_penalties?: number | null;
}

export interface Match {
  home_team_id: string;
  away_team_id: string;
  official_home_score: number;
  official_away_score: number;
  zebra_team_id?: string | null;
  zebra_multiplier?: number | null;
  penalty_winner_team_id?: string | null;
  official_home_penalties?: number | null;
  official_away_penalties?: number | null;
}

export interface ScoringTier {
  exact_score: number;
  winner_plus_diff: number;
  winner_plus_team_goals: number;
  winner_only: number;
  team_goals_only: number;
  penalty_winner: number;
}

export interface ScoreResult {
  total_points: number;
  base_points: number;
  penalty_points: number;
  penalty_hit_type: HitType | null;
  bucha_count: number;
  super_bucha_count: number;
  multiplier: number;
  hit_type: HitType;
  is_bucha: boolean;
  is_super_bucha: boolean;
  zebra_applied: boolean;
}

function resultWinner(h: number, a: number): 'home' | 'away' | 'draw' {
  if (h > a) return 'home';
  if (h < a) return 'away';
  return 'draw';
}

/**
 * Retorna placares válidos do desempate por pênaltis.
 * Pênaltis são tratados como jogo extra sem empate; por isso placares iguais
 * ou incompletos não representam um desempate oficial/palpitado válido.
 */
function shootoutScores(home: unknown, away: unknown): [number, number] | null {
  if (typeof home !== 'number' || !Number.isFinite(home)) return null;
  if (typeof away !== 'number' || !Number.isFinite(away)) return null;
  if (home === away) return null;
  return [home, away];
}

function teamIdForSide(match: Match, side: 'home' | 'away' | 'draw'): string | null {
  if (side === 'home') return match.home_team_id;
  if (side === 'away') return match.away_team_id;
  return null;
}

export function classifyHit(bet: Bet, match: Match): HitType {
  const ph = bet.predicted_home;
  const pa = bet.predicted_away;
  const ah = match.official_home_score;
  const aw = match.official_away_score;

  if (ph === ah && pa === aw) return HIT_TYPES.EXACT_SCORE;

  const betWinner = resultWinner(ph, pa);
  const actualWinner = resultWinner(ah, aw);

  if (betWinner === actualWinner) {
    if (actualWinner === 'draw') return HIT_TYPES.WINNER_PLUS_DIFF;
    const betDiff = Math.abs(ph - pa);
    const actualDiff = Math.abs(ah - aw);
    if (betDiff === actualDiff) return HIT_TYPES.WINNER_PLUS_DIFF;
    if (ph === ah || pa === aw) return HIT_TYPES.WINNER_PLUS_TEAM_GOALS;
    return HIT_TYPES.WINNER_ONLY;
  }
  if (ph === ah || pa === aw) return HIT_TYPES.TEAM_GOALS_ONLY;
  return HIT_TYPES.NONE;
}

function pointsForHit(tier: ScoringTier, hit: HitType): number {
  switch (hit) {
    case HIT_TYPES.EXACT_SCORE:
      return tier.exact_score;
    case HIT_TYPES.WINNER_PLUS_DIFF:
      return tier.winner_plus_diff;
    case HIT_TYPES.WINNER_PLUS_TEAM_GOALS:
      return tier.winner_plus_team_goals;
    case HIT_TYPES.WINNER_ONLY:
      return tier.winner_only;
    case HIT_TYPES.TEAM_GOALS_ONLY:
      return tier.team_goals_only;
    default:
      return 0;
  }
}

function betPredictsZebraWin(bet: Bet, match: Match): boolean {
  if (!match.zebra_team_id) return false;
  const betShootout = shootoutScores(bet.predicted_home_penalties, bet.predicted_away_penalties);
  const penaltyWinner = betShootout
    ? teamIdForSide(match, resultWinner(betShootout[0], betShootout[1]))
    : bet.penalty_winner_team_id;
  if (match.zebra_team_id === match.home_team_id) {
    return bet.predicted_home > bet.predicted_away || penaltyWinner === match.zebra_team_id;
  }
  if (match.zebra_team_id === match.away_team_id) {
    return bet.predicted_away > bet.predicted_home || penaltyWinner === match.zebra_team_id;
  }
  return false;
}

function actualIsZebraWin(match: Match): boolean {
  if (!match.zebra_team_id) return false;
  const w = resultWinner(match.official_home_score, match.official_away_score);
  if (w === 'draw') {
    const matchShootout = shootoutScores(match.official_home_penalties, match.official_away_penalties);
    const penaltyWinner = matchShootout
      ? teamIdForSide(match, resultWinner(matchShootout[0], matchShootout[1]))
      : match.penalty_winner_team_id;
    return penaltyWinner === match.zebra_team_id;
  }
  if (match.zebra_team_id === match.home_team_id) return w === 'home';
  if (match.zebra_team_id === match.away_team_id) return w === 'away';
  return false;
}

function computePenaltyResult(bet: Bet, match: Match, tier: ScoringTier): { points: number; hitType: HitType | null } {
  if (!tier.penalty_winner) return { points: 0, hitType: null };
  const matchShootout = shootoutScores(match.official_home_penalties, match.official_away_penalties);
  if (matchShootout) {
    const betShootout = shootoutScores(bet.predicted_home_penalties, bet.predicted_away_penalties);
    if (!betShootout) return { points: 0, hitType: null };
    const hitType = classifyHit(
      { predicted_home: betShootout[0], predicted_away: betShootout[1] },
      { ...match, official_home_score: matchShootout[0], official_away_score: matchShootout[1] },
    );
    const points = hitType === HIT_TYPES.WINNER_ONLY ? tier.penalty_winner : pointsForHit(tier, hitType);
    return { points, hitType };
  }
  if (!match.penalty_winner_team_id) return { points: 0, hitType: null };
  if (!bet.penalty_winner_team_id) return { points: 0, hitType: null };
  return bet.penalty_winner_team_id === match.penalty_winner_team_id
    ? { points: tier.penalty_winner, hitType: HIT_TYPES.WINNER_ONLY }
    : { points: 0, hitType: HIT_TYPES.NONE };
}

export function computeMatchPoints(bet: Bet, match: Match, tier: ScoringTier): ScoreResult {
  if (typeof match.official_home_score !== 'number' || typeof match.official_away_score !== 'number') {
    throw new Error('Match must have official scores set before computing points.');
  }
  const hitType = classifyHit(bet, match);
  const baseRaw = pointsForHit(tier, hitType);

  const zebraApplied =
    !!match.zebra_team_id &&
    !!match.zebra_multiplier &&
    betPredictsZebraWin(bet, match) &&
    actualIsZebraWin(match);

  const multiplier = zebraApplied ? match.zebra_multiplier! : 1;
  const basePoints = baseRaw * multiplier;
  const penaltyResult = computePenaltyResult(bet, match, tier);
  const penaltyPoints = penaltyResult.points * multiplier;
  const totalPoints = basePoints + penaltyPoints;
  const baseBuchaCount = hitType === HIT_TYPES.EXACT_SCORE ? 1 : 0;
  const penaltyBuchaCount = penaltyResult.hitType === HIT_TYPES.EXACT_SCORE ? 1 : 0;
  const buchaCount = baseBuchaCount + penaltyBuchaCount;
  const isBucha = buchaCount > 0;
  const isSuperBucha = isBucha && (penaltyPoints > 0 || zebraApplied);
  const superBuchaCount = isSuperBucha ? 1 : 0;

  return {
    total_points: totalPoints,
    base_points: basePoints,
    penalty_points: penaltyPoints,
    penalty_hit_type: penaltyResult.hitType,
    bucha_count: buchaCount,
    super_bucha_count: superBuchaCount,
    multiplier,
    hit_type: hitType,
    is_bucha: isBucha,
    is_super_bucha: isSuperBucha,
    zebra_applied: zebraApplied,
  };
}

export function defaultBet(): Bet {
  return { predicted_home: 0, predicted_away: 0, penalty_winner_team_id: null, predicted_home_penalties: null, predicted_away_penalties: null };
}
