/**
 * O cupom que chegou por LINK (`/mercado/vendedor/:loja?cupom=CODIGO`): a
 * página da loja guarda o código e o carrinho daquela loja o aplica sozinho
 * uma vez. Fica só nesta aba (`sessionStorage`) — não é preferência, é o
 * caminho entre duas telas. Armazenamento indisponível = cupom digitado à mão.
 */
import { normalizeCouponCode } from '@/modules/marketplace/domain/promotions';

const chave = (sellerKey) => `mercado:cupom:${sellerKey}`;

export function savePendingCoupon(sellerKey, code) {
  const c = normalizeCouponCode(code);
  if (!sellerKey || c.length < 3) return;
  try { window.sessionStorage.setItem(chave(sellerKey), c); } catch { /* sem armazenamento */ }
}

/** Lê e APAGA (aplica uma vez só: tirar o cupom do carrinho não o traz de volta). */
export function takePendingCoupon(sellerKey) {
  try {
    const c = window.sessionStorage.getItem(chave(sellerKey)) || '';
    window.sessionStorage.removeItem(chave(sellerKey));
    return normalizeCouponCode(c);
  } catch {
    return '';
  }
}

/** O link que leva à loja com o cupom já guardado. */
export function couponShareUrl(origin, sellerKey, code) {
  return `${origin}/mercado/vendedor/${encodeURIComponent(sellerKey)}?cupom=${encodeURIComponent(normalizeCouponCode(code))}`;
}
