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

/** Aula que não vai acontecer: cancelada ou recusada. */
const AULA_DESFEITA = new Set(['cancelled', 'declined']);

/**
 * A aula foi desfeita com o cupom JÁ contado — o uso tem de voltar para o
 * aluno. Quem devolve é o PROFESSOR (só o emissor escreve o cupom): na hora,
 * quando é ele quem cancela; e, quando o aluno cancela, na próxima vez que a
 * agenda do professor abre ou que ele confirma outra aula desse aluno.
 */
export function pendingCouponReturn(lesson) {
  const c = lesson?.coupon;
  return Boolean(lesson?.id && AULA_DESFEITA.has(lesson.status)
    && c?.coupon_id && c.status === LESSON_COUPON_STATUS.APPLIED && !c.returned);
}

/**
 * Este aluno tem o uso deste cupom "preso" numa aula desfeita? Para o aluno o
 * uso JÁ voltou (a tela diz "devolvido"), e a conferência do pedido não pode
 * dizer "você já usou" por causa de um contador que ainda não foi acertado.
 */
export function hasReturnableUse(lessons = [], couponId) {
  if (!couponId) return false;
  return (lessons || []).some((l) => l?.coupon?.coupon_id === couponId && pendingCouponReturn(l));
}

const reais = (n) => `R$ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`;

/**
 * A linha do cupom na aula, para aluno e professor. Com o preço conhecido, diz
 * o valor final — "−R$ 15" sozinho obriga a pessoa a fazer a conta. Numa série
 * (aula recorrente), o cupom vale para UMA aula, e a linha diz qual.
 *
 * @param {object} coupon o cupom gravado na aula
 * @param {{ lessonStatus?: string }} [ctx] o status da aula, para dizer que o
 *   uso voltou quando ela foi desfeita
 */
export function lessonCouponLine(coupon, { lessonStatus } = {}) {
  if (!coupon?.code) return '';
  if (coupon.status === LESSON_COUPON_STATUS.APPLIED) {
    if (AULA_DESFEITA.has(lessonStatus)) {
      // Neutra de propósito: a mesma linha aparece para o aluno e na agenda do
      // professor.
      return `Cupom ${coupon.code} devolvido: a aula não vai acontecer, e o cupom volta a valer`;
    }
    const onde = Number(coupon.lessons_count) > 1 ? ' na 1ª aula' : '';
    if (coupon.discount_value == null) {
      return `Cupom ${coupon.code} aplicado${onde}: ${coupon.benefit || 'desconto combinado na aula'}`;
    }
    const base = `Cupom ${coupon.code} aplicado${onde}: −${reais(coupon.discount_value)}`;
    const original = Number(coupon.original_price);
    if (coupon.original_price == null || !Number.isFinite(original) || original <= 0) return base;
    const final = Math.max(0, Math.round((original - Number(coupon.discount_value)) * 100) / 100);
    const rotulo = Number(coupon.lessons_count) > 1 ? 'série' : 'aula';
    return `${base} · ${rotulo} de ${reais(original)} por ${reais(final)}`;
  }
  if (coupon.status === LESSON_COUPON_STATUS.REJECTED) {
    return `Cupom ${coupon.code} não aplicado${coupon.reason ? `: ${coupon.reason}` : ''}`;
  }
  return `Cupom ${coupon.code} · ${coupon.benefit || 'desconto'} — aplicado quando o professor confirmar`;
}
