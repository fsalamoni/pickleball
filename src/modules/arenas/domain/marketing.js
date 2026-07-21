/**
 * Domínio: Marketing (Arena V3 — sprint 6).
 * Campanhas, fidelidade, cupons, referral, NPS.
 */

export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENT: 'sent',
  CANCELLED: 'cancelled',
});

export const COUPON_TYPE = Object.freeze({
  PERCENT: 'percent',
  FIXED: 'fixed',
});

export const NPS_SCORE = Object.freeze({
  DETRACTOR: 'detractor',     // 0-6
  PASSIVE: 'passive',         // 7-8
  PROMOTER: 'promoter',       // 9-10
});

/** Classifica nota NPS (0-10). */
export function classifyNps(score) {
  if (!Number.isFinite(score)) return null;
  if (score <= 6) return NPS_SCORE.DETRACTOR;
  if (score <= 8) return NPS_SCORE.PASSIVE;
  return NPS_SCORE.PROMOTER;
}

/** Calcula NPS score (-100 a +100). */
export function calculateNps(responses = []) {
  if (responses.length === 0) return 0;
  const promoters = responses.filter((r) => r.score >= 9).length;
  const detractors = responses.filter((r) => r.score <= 6).length;
  return Math.round(((promoters - detractors) / responses.length) * 100);
}

/** Normaliza cupom. */
export function normalizeCouponInput(input = {}) {
  const errors = {};
  const code = String(input.code || '').trim().toUpperCase();
  if (!code) errors.code = 'Código obrigatório.';
  if (code.length > 30) errors.code = 'Máx. 30 chars.';
  const type = Object.values(COUPON_TYPE).includes(input.type) ? input.type : COUPON_TYPE.PERCENT;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) errors.value = 'Valor inválido.';
  if (type === COUPON_TYPE.PERCENT && value > 100) errors.value = 'Desconto máx. 100%.';
  const maxUses = Number(input.max_uses);
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      code,
      type,
      value,
      max_uses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
      expires_at: input.expires_at || null,
      active: input.active !== false,
    },
  };
}

/** Verifica se cupom é válido. */
export function isCouponValid(coupon, now = Date.now()) {
  if (!coupon) return false;
  if (!coupon.active) return false;
  if (coupon.max_uses && (coupon.used_count || 0) >= coupon.max_uses) return false;
  if (coupon.expires_at) {
    const exp = coupon.expires_at instanceof Date ? coupon.expires_at.getTime() : Number(coupon.expires_at);
    if (Number.isFinite(exp) && exp < now) return false;
  }
  return true;
}

/** Aplica cupom a um preço. */
export function applyCoupon(price, coupon) {
  if (!isCouponValid(coupon) || !Number.isFinite(price) || price <= 0) return price;
  if (coupon.type === COUPON_TYPE.PERCENT) {
    return Math.max(0, Math.round(price * (1 - coupon.value / 100) * 100) / 100);
  }
  return Math.max(0, Math.round((price - coupon.value) * 100) / 100);
}

/** Gera código de indicação único. */
export function generateReferralCode(userId) {
  if (!userId) return '';
  return userId.slice(0, 6).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

/** Calcula pontos de fidelidade baseado em gasto. */
export function calculateLoyaltyPoints(amountSpent) {
  if (!Number.isFinite(amountSpent) || amountSpent <= 0) return 0;
  return Math.floor(amountSpent);  // 1 ponto por R$1
}
