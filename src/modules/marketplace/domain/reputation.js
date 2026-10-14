/**
 * MERCADO — avaliações e reputação (lógica pura).
 *
 * Só quem concluiu um pedido avalia (o servidor confere). A avaliação é
 * mútua e CEGA: fica escondida até os dois lados avaliarem ou passarem 14
 * dias — ninguém responde a uma nota ruim com outra por vingança. A nota do
 * vendedor só aparece com 3 avaliações ou mais; antes disso, "Vendedor novo".
 */

export const REVIEW_REVEAL_DAYS = 14;
export const MIN_REVIEWS_FOR_RATING = 3;

export function validateReview({ rating, comment } = {}) {
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) return { error: 'Escolha de 1 a 5 estrelas.' };
  const c = String(comment || '').trim().slice(0, 1000);
  if (r <= 2 && c.length < 10) return { error: 'Conte em poucas palavras o que deu errado.' };
  return { value: { rating: r, comment: c } };
}

/** A avaliação já pode aparecer? */
export function reviewIsVisible(review, { otherSideReviewed = false, now = Date.now() } = {}) {
  if (!review) return false;
  if (review.visible) return true;
  if (otherSideReviewed) return true;
  const at = Number(review.created_at_ms) || 0;
  return at > 0 && now - at >= REVIEW_REVEAL_DAYS * 86400000;
}

/** Resumo das avaliações visíveis de um vendedor. */
export function summarizeReviews(reviews = []) {
  const visible = reviews.filter((r) => r && r.visible && r.rating >= 1 && r.rating <= 5);
  const histogram = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  visible.forEach((r) => { histogram[r.rating] += 1; });
  const count = visible.length;
  const avg = count ? visible.reduce((n, r) => n + r.rating, 0) / count : 0;
  return {
    count,
    avg: Math.round(avg * 10) / 10,
    histogram,
    showRating: count >= MIN_REVIEWS_FOR_RATING,
  };
}

/** "4,8 (23)" ou "Vendedor novo". */
export function ratingLabel(avg, count) {
  if (!(count >= MIN_REVIEWS_FOR_RATING)) return 'Vendedor novo';
  return `${String((Math.round(avg * 10) / 10).toFixed(1)).replace('.', ',')} (${count})`;
}

/** Selos derivados (nunca escritos à mão, exceto o "verificada" que o admin dá). */
export function sellerBadges(seller = {}) {
  const badges = [];
  if (seller.verified) badges.push({ id: 'verified', label: seller.seller_type === 'store' ? 'Loja verificada' : 'Verificado' });
  if (seller.seller_type === 'arena') badges.push({ id: 'arena', label: 'Arena' });
  if (seller.seller_type === 'coach') badges.push({ id: 'coach', label: 'Professor' });
  if ((seller.sales_count || 0) >= 10 && (seller.rating_avg || 0) >= 4.7 && (seller.rating_count || 0) >= MIN_REVIEWS_FOR_RATING) {
    badges.push({ id: 'top', label: 'Vendedor destaque' });
  }
  return badges;
}
