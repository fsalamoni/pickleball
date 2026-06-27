/**
 * Lógica pura de matchmaking por nível (sem I/O).
 *
 * Dado o rating do usuário e uma lista de candidatos (atletas com rating e
 * cidade), ordena por proximidade de nível, priorizando opcionalmente a mesma
 * cidade. Usado pela página "Encontrar jogadores".
 */

/** Faixa padrão de rating para considerar "nível parecido". */
export const DEFAULT_MAX_RATING_DIFF = 150;

/**
 * Ordena candidatos por proximidade de rating ao usuário.
 *
 * @param {number} meRating rating do usuário
 * @param {Array<{ id?: string, uid?: string, rating?: number, city?: string|null }>} candidates
 *   já SEM o próprio usuário
 * @param {{ city?: string|null, maxDiff?: number|null }} [options]
 *   `city`: prioriza candidatos da mesma cidade; `maxDiff`: filtra por faixa.
 * @returns {Array<object>} candidatos anotados com `ratingDiff`, ordenados
 */
export function rankMatchmakingCandidates(meRating, candidates, options = {}) {
  const base = Number.isFinite(meRating) ? meRating : 0;
  const { city, maxDiff } = options;
  const normalizedCity = city ? String(city).trim().toLowerCase() : null;

  let list = (candidates || []).map((c) => ({
    ...c,
    ratingDiff: Math.abs((Number(c.rating) || 0) - base),
  }));

  if (Number.isFinite(maxDiff)) {
    list = list.filter((c) => c.ratingDiff <= maxDiff);
  }

  list.sort((a, b) => {
    if (normalizedCity) {
      const aSame = String(a.city || '').trim().toLowerCase() === normalizedCity ? 0 : 1;
      const bSame = String(b.city || '').trim().toLowerCase() === normalizedCity ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
    }
    return a.ratingDiff - b.ratingDiff;
  });

  return list;
}
