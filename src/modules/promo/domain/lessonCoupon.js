/**
 * O cupom no PEDIDO DE AULA — a parte LEVE (Onda CG).
 *
 * Arquivo próprio e sem dependências: o domínio de aulas (`coaches/domain/
 * lesson.js`) o importa para sanear o campo, e ele não pode puxar junto o
 * marketing inteiro das arenas para toda tela que mostra uma aula. A conta do
 * desconto e a conferência do cupom moram em `promo.js`.
 */

export const LESSON_COUPON_STATUS = Object.freeze({
  PENDING: 'pending',
  APPLIED: 'applied',
  REJECTED: 'rejected',
});

/** O cupom gravado na aula, saneado (o aluno escreve a aula; nada além disto). */
export function normalizeLessonCoupon(input) {
  if (!input || typeof input !== 'object') return null;
  const code = String(input.code || '').trim().toUpperCase().slice(0, 30);
  const id = String(input.coupon_id || '').trim().slice(0, 120);
  if (!code || !id) return null;
  return {
    coupon_id: id,
    code,
    benefit: String(input.benefit || '').slice(0, 120),
    kind: String(input.kind || 'discount').slice(0, 30),
    // O aluno só cria PENDENTE: aplicado/recusado é decisão do professor.
    status: LESSON_COUPON_STATUS.PENDING,
  };
}

/** A linha do cupom na aula, para aluno e professor. */
export function lessonCouponLine(coupon) {
  if (!coupon?.code) return '';
  const reais = (n) => `R$ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`;
  if (coupon.status === LESSON_COUPON_STATUS.APPLIED) {
    return coupon.discount_value != null
      ? `Cupom ${coupon.code} aplicado: −${reais(coupon.discount_value)}`
      : `Cupom ${coupon.code} aplicado: ${coupon.benefit || 'desconto combinado na aula'}`;
  }
  if (coupon.status === LESSON_COUPON_STATUS.REJECTED) {
    return `Cupom ${coupon.code} não aplicado${coupon.reason ? `: ${coupon.reason}` : ''}`;
  }
  return `Cupom ${coupon.code} · ${coupon.benefit || 'desconto'} — aplicado quando o professor confirmar`;
}
