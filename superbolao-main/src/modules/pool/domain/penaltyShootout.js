// Shootouts are rare beyond 20 cobranças por lado; this keeps inputs bounded while allowing long disputes.
export const MAX_PENALTY_SCORE = 20;

export function normalizePenaltyScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(MAX_PENALTY_SCORE, Math.round(numeric)));
}

export function hasPenaltyScore(home, away) {
  return normalizePenaltyScore(home) !== null && normalizePenaltyScore(away) !== null && normalizePenaltyScore(home) !== normalizePenaltyScore(away);
}

export function getPenaltyWinner(homeTeamId, awayTeamId, homeScore, awayScore) {
  const normalizedHome = normalizePenaltyScore(homeScore);
  const normalizedAway = normalizePenaltyScore(awayScore);
  if (normalizedHome === null || normalizedAway === null || normalizedHome === normalizedAway) return null;
  return normalizedHome > normalizedAway ? homeTeamId : awayTeamId;
}
