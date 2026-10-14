/**
 * MERCADO — cupons da loja e vale-presente (lógica pura).
 *
 * O preço do pedido é decidido no SERVIDOR (`functions/marketPromo.js`, cópia
 * desta conta com teste de paridade): a tela só ESTIMA. Cupom e vale entram
 * por vendedor — cada vendedor dá o próprio desconto e aceita o próprio vale,
 * porque o Pix vai direto para ele e a plataforma não guarda dinheiro.
 *
 * Valores gravados no banco: nunca renomeie, só acrescente.
 */
import { formatBRL } from './money.js';
import { t, tk, tn } from '@/core/i18n';

/* ------------------------------------------------------------- cupons -- */

export const COUPON_KIND = Object.freeze({
  PERCENT: 'percent',
  AMOUNT: 'amount',
  FREE_SHIPPING: 'free_shipping',
});

export const COUPON_KIND_LABELS = Object.freeze({
  percent: tk('Porcentagem de desconto'),
  amount: tk('Valor de desconto'),
  free_shipping: tk('Frete grátis'),
});

export const COUPON_LIMITS = Object.freeze({
  maxPercent: 90,
  maxAmountCents: 10_000_000,
  maxListings: 30,
  description: 140,
  maxUses: 100000,
});

const CODE_RE = /^[A-Z0-9]{3,20}$/;

/** " promo-10 " → "PROMO10" (o que se digita vira o código gravado). */
export function normalizeCouponCode(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

/** O id do cupom: um código por vendedor, e a tela acha pelo código. */
export function couponDocId(sellerKey, code) {
  return `${sellerKey}_${normalizeCouponCode(code)}`;
}

const intOr = (v, d = null) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Math.round(Number(v)));

/** Valida o formulário do cupom. @returns {{ value, errors, ok }} */
export function validateCouponInput(input = {}) {
  const errors = {};
  const code = normalizeCouponCode(input.code);
  if (!CODE_RE.test(code)) errors.code = t('Use de 3 a 20 letras e números.');
  const kind = Object.values(COUPON_KIND).includes(input.kind) ? input.kind : null;
  if (!kind) errors.kind = t('Escolha o tipo do cupom.');
  let value = 0;
  if (kind === COUPON_KIND.PERCENT) {
    value = intOr(input.value, 0);
    if (!(value >= 1 && value <= COUPON_LIMITS.maxPercent)) errors.value = t('De 1% a {max}%.', { max: COUPON_LIMITS.maxPercent });
  } else if (kind === COUPON_KIND.AMOUNT) {
    value = intOr(input.value, 0);
    if (!(value >= 100 && value <= COUPON_LIMITS.maxAmountCents)) errors.value = t('Informe o valor do desconto (mínimo R$ 1,00).');
  }
  const min = Math.max(0, intOr(input.min_subtotal_cents, 0));
  if (kind === COUPON_KIND.AMOUNT && min && value >= min) errors.min_subtotal_cents = t('O pedido mínimo precisa ser maior que o desconto.');
  const starts = intOr(input.starts_at_ms);
  const ends = intOr(input.ends_at_ms);
  if (starts && ends && ends <= starts) errors.ends_at_ms = t('O fim precisa ser depois do começo.');
  const maxUses = intOr(input.max_uses);
  if (maxUses != null && !(maxUses >= 1 && maxUses <= COUPON_LIMITS.maxUses)) errors.max_uses = t('Entre 1 e 100.000 usos, ou sem limite.');
  const listingIds = [...new Set((Array.isArray(input.listing_ids) ? input.listing_ids : []).filter((x) => typeof x === 'string' && x))];
  if (listingIds.length > COUPON_LIMITS.maxListings) errors.listing_ids = t('Até {n} anúncios.', { n: COUPON_LIMITS.maxListings });
  const out = {
    code,
    kind: kind || COUPON_KIND.PERCENT,
    value: kind === COUPON_KIND.FREE_SHIPPING ? 0 : value,
    min_subtotal_cents: min,
    starts_at_ms: starts || null,
    ends_at_ms: ends || null,
    max_uses: maxUses ?? null,
    once_per_buyer: Boolean(input.once_per_buyer),
    first_purchase_only: Boolean(input.first_purchase_only),
    listing_ids: listingIds.slice(0, COUPON_LIMITS.maxListings),
    public: Boolean(input.public),
    active: input.active !== false,
    description: String(input.description || '').trim().slice(0, COUPON_LIMITS.description),
  };
  return { value: out, errors, ok: Object.keys(errors).length === 0 };
}

/** "10% de desconto" · "R$ 20,00 de desconto" · "Frete grátis". */
export function couponBenefitLabel(c) {
  if (!c) return '';
  if (c.kind === COUPON_KIND.PERCENT) return t('{pct}% de desconto', { pct: c.value });
  if (c.kind === COUPON_KIND.AMOUNT) return t('{valor} de desconto', { valor: formatBRL(c.value) });
  return t('Frete grátis');
}

// Dia em Brasília (sem horário de verão desde 2019): igual no navegador e no servidor.
const dataBR = (ms) => {
  const d = new Date(Number(ms) - 3 * 3600000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** As condições em uma linha: "acima de R$ 100,00 · até 31/12 · 1 por pessoa". */
export function couponConditionsLabel(c) {
  if (!c) return '';
  const p = [];
  if (c.min_subtotal_cents > 0) p.push(t('acima de {valor}', { valor: formatBRL(c.min_subtotal_cents) }));
  if ((c.listing_ids || []).length) p.push(tn(c.listing_ids.length, 'em {n} anúncio', 'em {n} anúncios'));
  if (c.ends_at_ms) p.push(t('até {data}', { data: dataBR(c.ends_at_ms) }));
  if (c.once_per_buyer) p.push(t('1 por pessoa'));
  if (c.first_purchase_only) p.push(t('na 1ª compra na loja'));
  if (c.max_uses) {
    const resta = Math.max(0, c.max_uses - (Number(c.uses_count) || 0));
    p.push(resta <= 20 ? t('restam {n}', { n: resta }) : tn(c.max_uses, '{n} uso', '{n} usos'));
  }
  return p.join(' · ');
}

/** O cupom está no ar (sem olhar o carrinho)? */
export function couponLive(c, now = Date.now()) {
  if (!c || c.active === false) return false;
  if (c.starts_at_ms && now < c.starts_at_ms) return false;
  if (c.ends_at_ms && now > c.ends_at_ms) return false;
  if (c.max_uses && (Number(c.uses_count) || 0) >= c.max_uses) return false;
  return true;
}

/** Subtotal dos itens em que o cupom vale (todos, se o cupom não escolheu anúncios). */
export function couponEligibleSubtotal(c, items = []) {
  const ids = c?.listing_ids || [];
  return items
    .filter((i) => !ids.length || ids.includes(i.listing_id))
    .reduce((n, i) => n + Math.round(Number(i.unit_price_cents) || 0) * Math.max(0, Math.floor(Number(i.quantity) || 0)), 0);
}

/**
 * Por que o cupom NÃO vale neste pedido (ou `null`). A frase vai para a tela
 * — "venceu", "vale a partir de R$ 100" — em vez de um "cupom inválido" mudo.
 * @param {object} c o cupom
 * @param {{ sellerKey, items, fulfillment, shippingToAgree, now, buyerUses, hasBoughtBefore }} ctx
 */
export function couponProblem(c, ctx = {}) {
  const { sellerKey, items = [], fulfillment, shippingToAgree = false, now = Date.now(), buyerUses = 0, hasBoughtBefore = false } = ctx;
  if (!c || c.seller_key !== sellerKey) return t('Este cupom não existe nesta loja.');
  if (c.active === false) return t('Este cupom foi desativado pela loja.');
  if (c.starts_at_ms && now < c.starts_at_ms) return t('Este cupom começa a valer em {data}.', { data: dataBR(c.starts_at_ms) });
  if (c.ends_at_ms && now > c.ends_at_ms) return t('Este cupom venceu.');
  if (c.max_uses && (Number(c.uses_count) || 0) >= c.max_uses) return t('Os usos deste cupom acabaram.');
  if (c.once_per_buyer && buyerUses > 0) return t('Você já usou este cupom.');
  if (c.first_purchase_only && hasBoughtBefore) return t('Este cupom é só para a primeira compra na loja.');
  const subtotal = couponEligibleSubtotal({ listing_ids: [] }, items);
  if (c.min_subtotal_cents && subtotal < c.min_subtotal_cents) return t('Vale a partir de {valor} nesta loja.', { valor: formatBRL(c.min_subtotal_cents) });
  if ((c.listing_ids || []).length && couponEligibleSubtotal(c, items) <= 0) return t('Este cupom vale para outros anúncios da loja.');
  if (c.kind === COUPON_KIND.FREE_SHIPPING) {
    if (fulfillment !== 'shipping') return t('Este cupom é de frete grátis: escolha receber por envio.');
    if (shippingToAgree) return t('O frete deste pedido é a combinar: o cupom de frete grátis não se aplica.');
  }
  return null;
}

/** Quanto o cupom desconta. Nunca mais do que os itens em que ele vale. */
export function couponDiscount(c, { items = [], shippingCents = 0 } = {}) {
  if (!c) return { discount_cents: 0, shipping_discount_cents: 0 };
  const base = couponEligibleSubtotal(c, items);
  if (c.kind === COUPON_KIND.PERCENT) return { discount_cents: Math.floor((base * c.value) / 100), shipping_discount_cents: 0 };
  if (c.kind === COUPON_KIND.AMOUNT) return { discount_cents: Math.min(base, Math.round(c.value)), shipping_discount_cents: 0 };
  return { discount_cents: 0, shipping_discount_cents: Math.max(0, Math.round(Number(shippingCents) || 0)) };
}

/* ------------------------------------------------------- vale-presente -- */

export const GIFT_CARD_STATUS = Object.freeze({
  ACTIVE: 'active',
  USED: 'used',
  CANCELLED: 'cancelled',
});

export const GIFT_CARD_LIMITS = Object.freeze({
  minCents: 1000,
  maxCents: 500_000,
  maxAmounts: 6,
  defaultAmounts: Object.freeze([5000, 10000, 20000]),
  defaultValidityMonths: 12,
  message: 200,
  name: 60,
  maxPerOrder: 5,
});

const VALIDITY_OPTIONS = [6, 12, 24];

/** A configuração do vale-presente da loja, com os padrões preenchidos. */
export function giftCardConfig(seller) {
  const g = seller?.gift_cards || {};
  const amounts = [...new Set((Array.isArray(g.amounts_cents) ? g.amounts_cents : GIFT_CARD_LIMITS.defaultAmounts)
    .map((v) => Math.round(Number(v)))
    .filter((v) => v >= GIFT_CARD_LIMITS.minCents && v <= GIFT_CARD_LIMITS.maxCents))]
    .sort((a, b) => a - b)
    .slice(0, GIFT_CARD_LIMITS.maxAmounts);
  return {
    enabled: g.enabled === true,
    amounts_cents: amounts.length ? amounts : [...GIFT_CARD_LIMITS.defaultAmounts],
    allow_custom: g.allow_custom === true,
    validity_months: VALIDITY_OPTIONS.includes(Number(g.validity_months)) ? Number(g.validity_months) : GIFT_CARD_LIMITS.defaultValidityMonths,
    note: String(g.note || '').slice(0, 140),
  };
}

export const GIFT_CARD_VALIDITY_OPTIONS = Object.freeze(VALIDITY_OPTIONS);

/** O valor escolhido pode ser vendido? (`null` = pode) */
export function giftCardAmountProblem(config, cents) {
  const v = Math.round(Number(cents));
  if (!config?.enabled) return t('Esta loja não vende vale-presente.');
  if (config.amounts_cents.includes(v)) return null;
  if (!config.allow_custom) return t('Escolha um dos valores da loja.');
  if (!(v >= GIFT_CARD_LIMITS.minCents && v <= GIFT_CARD_LIMITS.maxCents)) {
    return t('Escolha um valor entre {min} e {max}.', { min: formatBRL(GIFT_CARD_LIMITS.minCents), max: formatBRL(GIFT_CARD_LIMITS.maxCents) });
  }
  return null;
}

/** Quando vence um vale emitido agora. */
export function giftCardExpiry(nowMs, months) {
  const d = new Date(nowMs);
  d.setMonth(d.getMonth() + (Number(months) || GIFT_CARD_LIMITS.defaultValidityMonths));
  return d.getTime();
}

/** O vale serve para esta compra, nesta loja, desta pessoa? (`null` = serve) */
export function giftCardProblem(card, { sellerKey, uid, now = Date.now() } = {}) {
  if (!card) return t('Vale não encontrado.');
  if (card.seller_key !== sellerKey) return t('Este vale é de outra loja.');
  if (card.holder_uid !== uid) return t('Resgate o vale na sua conta antes de usar.');
  if (card.status === GIFT_CARD_STATUS.CANCELLED) return t('Este vale foi cancelado pela loja.');
  if (card.expires_at_ms && now > card.expires_at_ms) return t('Este vale venceu.');
  if (!((Number(card.balance_cents) || 0) > 0)) return t('Este vale não tem mais saldo.');
  return null;
}

/** Usa os vales na ordem dada (o que vence antes, primeiro) até cobrir o devido. */
export function allocateGiftCards(cards = [], dueCents = 0) {
  let resta = Math.max(0, Math.round(Number(dueCents) || 0));
  const uses = [];
  for (const c of cards) {
    if (resta <= 0) break;
    const usar = Math.min(resta, Math.max(0, Math.round(Number(c.balance_cents) || 0)));
    if (usar > 0) { uses.push({ id: c.id, amount_cents: usar }); resta -= usar; }
  }
  return { uses, total_cents: uses.reduce((n, u) => n + u.amount_cents, 0) };
}

/** Ordem de uso: o que vence antes primeiro (sem validade, por último). */
export function sortGiftCardsForUse(cards = []) {
  return [...cards].sort((a, b) => (a.expires_at_ms || Infinity) - (b.expires_at_ms || Infinity));
}

/**
 * O preço do pedido de um vendedor: subtotal − cupom + frete − vales.
 * @returns {{ subtotal_cents, discount_cents, shipping_cents, shipping_discount_cents, gift_card_cents, gift_card_uses, total_cents }}
 */
export function orderPricing({ items = [], shippingCents = 0, coupon = null, giftCards = [] } = {}) {
  const subtotal = couponEligibleSubtotal({ listing_ids: [] }, items);
  const ship = Math.max(0, Math.round(Number(shippingCents) || 0));
  const { discount_cents: desc, shipping_discount_cents: shipDesc } = couponDiscount(coupon, { items, shippingCents: ship });
  const devido = Math.max(0, subtotal - desc) + Math.max(0, ship - shipDesc);
  const { uses, total_cents: vale } = allocateGiftCards(giftCards, devido);
  return {
    subtotal_cents: subtotal,
    discount_cents: desc,
    shipping_cents: ship,
    shipping_discount_cents: shipDesc,
    gift_card_cents: vale,
    gift_card_uses: uses,
    total_cents: devido - vale,
  };
}

/** "PRK-7K2M-9QXA" — sem letras que se confundem (0/O, 1/I). */
export function giftCardCode(random = Math.random) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bloco = () => Array.from({ length: 4 }, () => A[Math.floor(random() * A.length)]).join('');
  return `PRK-${bloco()}-${bloco()}-${bloco()}`;
}

/** O código digitado com ou sem traço, maiúsculo ou não → o código gravado. */
export function normalizeGiftCardCode(text) {
  const s = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const corpo = s.startsWith('PRK') ? s.slice(3) : s;
  if (corpo.length !== 12) return '';
  return `PRK-${corpo.slice(0, 4)}-${corpo.slice(4, 8)}-${corpo.slice(8, 12)}`;
}

/** Só o fim do código, para mostrar em lista e em pedido ("···9QXA"). */
export function maskGiftCardCode(code) {
  const s = String(code || '');
  return s ? `···${s.slice(-4)}` : '';
}
