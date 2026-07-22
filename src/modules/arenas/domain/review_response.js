/**
 * Domínio puro de resposta de review (Sprint 3 ARE-09).
 *
 * Manager da arena pode responder publicamente a uma review/reclamação/
 * sugestão do atleta. A resposta fica gravada em
 * `arena_reviews/{id}.response` (string) + `responded_at` (timestamp) +
 * `responded_by` (uid).
 *
 * Decisões:
 * - Validação de tamanho: max 500 chars (suficiente pra resposta pública)
 * - Trim de whitespace antes de validar (evita " " que passa)
 * - `delete` é representado por `response = null` (não deleta o doc)
 * - Auditoria via createAuditLog no service (best-effort)
 */

export const REVIEW_RESPONSE_MAX = 500;

function str(v) { return String(v ?? '').trim(); }

/**
 * Normaliza e valida a resposta a uma review.
 * @returns {{ valid: boolean, error: string|null, value: string }}
 */
export function normalizeReviewResponse(input = {}) {
  const response = str(input.response);
  if (!response) {
    return { valid: false, error: 'Resposta não pode estar vazia.', value: '' };
  }
  if (response.length > REVIEW_RESPONSE_MAX) {
    return { valid: false, error: `Resposta muito longa (máx. ${REVIEW_RESPONSE_MAX} chars).`, value: response.slice(0, REVIEW_RESPONSE_MAX) };
  }
  return { valid: true, error: null, value: response };
}

/** Decide se o user pode responder (manager da arena OU platform_admin). */
export function canRespondToReview(user, arena, managedArenas = []) {
  if (!user?.uid) return false;
  if (user.isPlatformAdmin) return true;
  if (arena?.owner_id === user.uid) return true;
  return managedArenas.some((a) => a.id === arena?.id);
}

/** Indica se a review já tem resposta. */
export function hasResponse(review) {
  return Boolean(review?.response && review.response.trim().length > 0);
}

/** Calcula quanto tempo desde a resposta (em horas, ou null). */
export function responseAgeHours(review) {
  if (!hasResponse(review)) return null;
  const ts = review.responded_at;
  if (!ts) return null;
  // Firestore Timestamp: { seconds, nanoseconds }
  let ms = 0;
  if (typeof ts.seconds === 'number') ms = ts.seconds * 1000;
  else if (typeof ts.toMillis === 'function') ms = ts.toMillis();
  else if (typeof ts === 'number') ms = ts;
  else return null;
  const now = Date.now();
  if (ms > now) return 0;
  return Math.round((now - ms) / (1000 * 60 * 60));
}
