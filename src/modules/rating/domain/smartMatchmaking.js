/**
 * Matchmaking inteligente (lógica pura, sem I/O).
 *
 * Calcula um score de compatibilidade (0–100) entre o usuário e um candidato,
 * cruzando os dados que a plataforma JÁ coleta:
 *  - proximidade de nível (rating),
 *  - lado da quadra (parceria de duplas é melhor com lados complementares),
 *  - mesma cidade,
 *  - interesses em comum.
 *
 * Usado por "Encontrar jogadores" (flag smart_matchmaking). Puro e testável.
 */

import { COURT_SIDE } from '@/modules/athletes/domain/profileMeta';

/** Pesos de cada dimensão (somam 100). */
export const SMART_WEIGHTS = Object.freeze({
  rating: 40, courtSide: 25, city: 20, interests: 15,
});

/** Diferença de rating a partir da qual a proximidade zera. */
export const RATING_SCALE = 300;

function isSpecificSide(side) {
  return side === COURT_SIDE.LEFT || side === COURT_SIDE.RIGHT;
}

/** Score de proximidade de rating (0..peso). */
export function ratingProximityScore(meRating, candRating) {
  const a = Number(meRating);
  const b = Number(candRating);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const diff = Math.abs(a - b);
  return SMART_WEIGHTS.rating * Math.max(0, 1 - diff / RATING_SCALE);
}

/**
 * Score do lado da quadra. Em duplas, o ideal é lados complementares
 * (um esquerda, outro direita). Mesmo lado específico → baixo. Ao menos um
 * "qualquer" → flexível (meio termo).
 */
export function courtSideScore(meSide, candSide) {
  const a = meSide || COURT_SIDE.ANY;
  const b = candSide || COURT_SIDE.ANY;
  if (isSpecificSide(a) && isSpecificSide(b)) {
    return a !== b ? SMART_WEIGHTS.courtSide : SMART_WEIGHTS.courtSide * 0.25;
  }
  return SMART_WEIGHTS.courtSide * 0.6;
}

/** Score de cidade (tudo ou nada). */
export function cityScore(meCity, candCity) {
  const a = String(meCity || '').trim().toLowerCase();
  const b = String(candCity || '').trim().toLowerCase();
  if (!a || !b) return 0;
  return a === b ? SMART_WEIGHTS.city : 0;
}

/** Interesses em comum: score proporcional + contagem de compartilhados. */
export function interestsOverlap(meInterests, candInterests) {
  const a = new Set((meInterests || []).filter(Boolean));
  const b = new Set((candInterests || []).filter(Boolean));
  if (a.size === 0 || b.size === 0) return { score: 0, shared: 0 };
  let shared = 0;
  a.forEach((x) => { if (b.has(x)) shared += 1; });
  const ratio = shared / Math.min(a.size, b.size);
  return { score: SMART_WEIGHTS.interests * ratio, shared };
}

/**
 * Compatibilidade entre o usuário e um candidato.
 * @param {{ rating?, city?, court_side?, interests? }} me
 * @param {{ rating?, city?, court_side?, interests? }} candidate
 * @returns {{ score: number, reasons: string[] }} score 0..100 + motivos legíveis
 */
export function computeMatchCompatibility(me = {}, candidate = {}) {
  const rating = ratingProximityScore(me.rating, candidate.rating);
  const court = courtSideScore(me.court_side, candidate.court_side);
  const city = cityScore(me.city, candidate.city);
  const { score: interests, shared } = interestsOverlap(me.interests, candidate.interests);

  const total = Math.max(0, Math.min(100, Math.round(rating + court + city + interests)));

  const reasons = [];
  const mr = Number(me.rating);
  const cr = Number(candidate.rating);
  if (Number.isFinite(mr) && Number.isFinite(cr) && Math.abs(mr - cr) <= 100) {
    reasons.push('Nível parecido');
  }
  if (isSpecificSide(me.court_side) && isSpecificSide(candidate.court_side)
    && me.court_side !== candidate.court_side) {
    reasons.push('Lados complementares');
  }
  if (city > 0) reasons.push('Mesma cidade');
  if (shared > 0) reasons.push(`${shared} interesse${shared > 1 ? 's' : ''} em comum`);

  return { score: total, reasons };
}

/**
 * Ordena candidatos por compatibilidade (maior primeiro), anotando cada um com
 * `compatibility: { score, reasons }`.
 * @param {object} me
 * @param {Array<object>} candidates já SEM o próprio usuário
 * @param {{ minScore?: number }} [options]
 */
export function rankSmartMatchmaking(me, candidates, options = {}) {
  const { minScore = 0 } = options;
  return (candidates || [])
    .map((c) => ({ ...c, compatibility: computeMatchCompatibility(me, c) }))
    .filter((c) => c.compatibility.score >= minScore)
    .sort((a, b) => b.compatibility.score - a.compatibility.score
      || (a.ratingDiff || 0) - (b.ratingDiff || 0));
}
