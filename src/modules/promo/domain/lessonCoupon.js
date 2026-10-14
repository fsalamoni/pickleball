/**
 * O cupom no PEDIDO DE AULA — a parte LEVE (Onda CG).
 *
 * Arquivo próprio e sem dependências: o domínio de aulas (`coaches/domain/
 * lesson.js`) o importa para sanear o campo, e ele não pode puxar junto o
 * marketing inteiro das arenas para toda tela que mostra uma aula. A conta do
 * desconto e a conferência do cupom moram em `promo.js`.
 */
import { t, tk } from '@/core/i18n';

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
 * @param {{ lessonStatus?: string, traduzir?: boolean }} [ctx] o status da aula, para dizer que o
 *   uso voltou quando ela foi desfeita; `traduzir` só na TELA — o aviso gravado fica em português
 */
export function lessonCouponLine(coupon, { lessonStatus, traduzir = false } = {}) {
  if (!coupon?.code) return '';
  const tx = traduzir ? t : (k, p) => k.replace(/\{(\w+)\}/g, (m, n) => (p?.[n] ?? m));
  const codigo = coupon.code;
  if (coupon.status === LESSON_COUPON_STATUS.APPLIED) {
    if (AULA_DESFEITA.has(lessonStatus)) {
      // Neutra de propósito: a mesma linha aparece para o aluno e na agenda do
      // professor.
      return tx(tk('Cupom {codigo} devolvido: a aula não vai acontecer, e o cupom volta a valer'), { codigo });
    }
    const serie = Number(coupon.lessons_count) > 1;
    const aplicado = serie ? tx(tk('Cupom {codigo} aplicado na 1ª aula'), { codigo }) : tx(tk('Cupom {codigo} aplicado'), { codigo });
    if (coupon.discount_value == null) {
      return `${aplicado}: ${coupon.benefit || tx(tk('desconto combinado na aula'))}`;
    }
    const base = `${aplicado}: −${reais(coupon.discount_value)}`;
    const original = Number(coupon.original_price);
    if (coupon.original_price == null || !Number.isFinite(original) || original <= 0) return base;
    const final = Math.max(0, Math.round((original - Number(coupon.discount_value)) * 100) / 100);
    const valores = { de: reais(original), por: reais(final) };
    return `${base} · ${serie ? tx(tk('série de {de} por {por}'), valores) : tx(tk('aula de {de} por {por}'), valores)}`;
  }
  if (coupon.status === LESSON_COUPON_STATUS.REJECTED) {
    return coupon.reason
      ? tx(tk('Cupom {codigo} não aplicado: {motivo}'), { codigo, motivo: traduzir ? t(coupon.reason) : coupon.reason })
      : tx(tk('Cupom {codigo} não aplicado'), { codigo });
  }
  return tx(tk('Cupom {codigo} · {beneficio} — aplicado quando o professor confirmar'), { codigo, beneficio: coupon.benefit || tx(tk('desconto')) });
}
