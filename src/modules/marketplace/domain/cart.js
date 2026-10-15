/**
 * MERCADO — carrinho com vários vendedores (lógica pura).
 *
 * Um documento por pessoa (`market_carts/{uid}`). O carrinho NÃO reserva
 * estoque: a unidade só é garantida quando o pedido é criado (no servidor,
 * relendo o anúncio). Ao fechar, cada vendedor vira um pedido próprio, com o
 * Pix dele e a entrega que ele oferece.
 */
import { availableQuantity, coverOf, variantQuantity, variantsOf } from './listing.js';
import { LISTING_STATUS } from './constants.js';
import { t, tn } from '@/core/i18n';

export const CART_MAX_ITEMS = 50;
/** Teto de unidades por item (o servidor recusa acima disso). */
export const CART_MAX_QTY = 99;

function clean(cart) {
  return {
    items: Array.isArray(cart?.items) ? cart.items.filter((i) => i && i.listing_id) : [],
    saved: Array.isArray(cart?.saved) ? cart.saved.filter((i) => i && i.listing_id) : [],
  };
}

/** A chave de uma linha: o anúncio, ou anúncio + variação (`id#variação`). */
export const lineKey = (line) => (line?.variant_id ? `${line.listing_id}#${line.variant_id}` : line?.listing_id);
const same = (line, key) => lineKey(line) === key;

/** Linha do carrinho a partir do anúncio (cópia do que se viu, para mostrar mesmo se o anúncio sumir). */
export function cartLine(listing, quantity = 1, variantId = null) {
  const variant = variantsOf(listing).find((v) => v.id === variantId) || null;
  return {
    listing_id: listing.id,
    ...(variant ? { variant_id: variant.id, variant_label: variant.label } : {}),
    seller_key: listing.seller_key,
    seller_name: listing.seller_name || '',
    title: listing.title || '',
    cover_url: coverOf(listing)?.thumb_url || coverOf(listing)?.url || '',
    ...(coverOf(listing)?.aspect ? { cover_aspect: coverOf(listing).aspect, cover_frame: coverOf(listing).frame || null } : {}),
    price_cents_at_add: listing.price_cents,
    quantity: Math.max(1, Math.floor(quantity) || 1),
  };
}

/** Acrescenta (ou soma, se já está). Nunca passa do estoque visto. */
export function addToCart(cart, listing, quantity = 1, variantId = null) {
  const c = clean(cart);
  if (variantsOf(listing).length && !variantsOf(listing).some((v) => v.id === variantId)) return { cart: c, error: t('Escolha a variação.') };
  const max = Math.max(1, Math.min(CART_MAX_QTY, variantQuantity(listing, variantId)));
  const key = lineKey({ listing_id: listing.id, variant_id: variantId });
  const i = c.items.findIndex((x) => same(x, key));
  if (i >= 0) {
    const q = Math.min(max, c.items[i].quantity + Math.max(1, quantity));
    c.items[i] = { ...c.items[i], quantity: q };
  } else {
    if (c.items.length >= CART_MAX_ITEMS) return { cart: c, error: t('O carrinho aceita até {n} itens.', { n: CART_MAX_ITEMS }) };
    c.items.push(cartLine(listing, Math.min(max, quantity), variantId));
  }
  c.saved = c.saved.filter((x) => !same(x, key));
  return { cart: c, error: null };
}

/* As funções abaixo recebem a CHAVE da linha (`lineKey`): o id do anúncio, ou `id#variação`. */
export function setCartQuantity(cart, key, quantity) {
  const c = clean(cart);
  const q = Math.floor(Number(quantity));
  if (!(q >= 1)) return removeFromCart(c, key);
  c.items = c.items.map((x) => (same(x, key) ? { ...x, quantity: Math.min(q, CART_MAX_QTY) } : x));
  return c;
}

export function removeFromCart(cart, key) {
  const c = clean(cart);
  c.items = c.items.filter((x) => !same(x, key));
  return c;
}

/** "Salvar para depois": tira do carrinho sem perder. */
export function saveForLater(cart, key) {
  const c = clean(cart);
  const item = c.items.find((x) => same(x, key));
  if (!item) return c;
  c.items = c.items.filter((x) => !same(x, key));
  c.saved = [item, ...c.saved.filter((x) => !same(x, key))].slice(0, CART_MAX_ITEMS);
  return c;
}

export function moveToCart(cart, key) {
  const c = clean(cart);
  const item = c.saved.find((x) => same(x, key));
  if (!item) return c;
  c.saved = c.saved.filter((x) => !same(x, key));
  if (!c.items.some((x) => same(x, key))) c.items.push(item);
  return c;
}

/**
 * "Comprar agora" fecha SÓ um item: o carrinho que vai ao fechamento tem só
 * aquela linha, e o resto fica intacto no documento. Se o item não está no
 * carrinho (a gravação falhou), vale o carrinho inteiro.
 */
export function cartOnlyListing(cart, key) {
  const c = clean(cart);
  const line = c.items.find((x) => same(x, key));
  return line ? { items: [line], saved: [] } : c;
}

/** Quantas unidades no carrinho (o número do selo). */
export function cartCount(cart) {
  return clean(cart).items.reduce((n, i) => n + i.quantity, 0);
}

/**
 * Confere cada linha contra o anúncio ATUAL. `listings` é um mapa id → anúncio
 * (ou `undefined` quando a leitura ainda não veio / `null` quando o anúncio
 * não existe mais).
 * @returns {{ ok: boolean, problem: string|null, unit_price_cents: number, max: number }}
 */
export function checkLine(line, listing) {
  // Não deu para ler o anúncio agora: não se compra às cegas (nem se diz que acabou).
  if (listing === undefined) return { ok: false, problem: t('Não conseguimos conferir este item agora. Tente de novo.'), unit_price_cents: line.price_cents_at_add, max: line.quantity, unknown: true };
  if (!listing || listing.status === LISTING_STATUS.REMOVED || listing.status === LISTING_STATUS.CLOSED) {
    return { ok: false, problem: t('Não está mais à venda.'), unit_price_cents: line.price_cents_at_add, max: 0 };
  }
  if (listing.status !== LISTING_STATUS.ACTIVE || availableQuantity(listing) < 1) {
    return { ok: false, problem: listing.status === LISTING_STATUS.PAUSED ? t('O vendedor pausou este anúncio.') : t('Esgotado.'), unit_price_cents: listing.price_cents, max: 0 };
  }
  if (line.variant_id && !variantsOf(listing).some((v) => v.id === line.variant_id)) {
    return { ok: false, problem: t('Essa variação não existe mais.'), unit_price_cents: listing.price_cents, max: 0 };
  }
  const max = line.variant_id ? variantQuantity(listing, line.variant_id) : availableQuantity(listing);
  if (max < 1) return { ok: false, problem: t('Esgotado.'), unit_price_cents: listing.price_cents, max: 0 };
  const problems = [];
  if (line.quantity > max) problems.push(tn(max, 'Só há {n} disponível.', 'Só há {n} disponíveis.'));
  if (listing.price_cents !== line.price_cents_at_add) {
    problems.push(listing.price_cents < line.price_cents_at_add ? t('O preço baixou.') : t('O preço mudou.'));
  }
  return {
    ok: line.quantity <= max,
    problem: problems.join(' ') || null,
    unit_price_cents: listing.price_cents,
    max,
    priceChanged: listing.price_cents !== line.price_cents_at_add,
  };
}

/**
 * Agrupa por vendedor, na ordem em que entraram no carrinho, com o subtotal
 * de cada vendedor e o total do que dá para comprar.
 */
export function groupCartBySeller(cart, listings = {}) {
  const c = clean(cart);
  const groups = [];
  const index = new Map();
  for (const line of c.items) {
    const listing = listings[line.listing_id];
    const check = checkLine(line, listing);
    let g = index.get(line.seller_key);
    if (!g) {
      g = { seller_key: line.seller_key, seller_name: listing?.seller_name || line.seller_name, seller_type: listing?.seller_type || '', lines: [], subtotal_cents: 0, savings_cents: 0, buyable: 0, fulfillment: null };
      index.set(line.seller_key, g);
      groups.push(g);
    }
    const qty = Math.min(line.quantity, check.max);
    const subtotal = check.ok ? check.unit_price_cents * line.quantity : 0;
    g.lines.push({ ...line, listing, check, subtotal_cents: subtotal, buy_quantity: qty });
    g.subtotal_cents += subtotal;
    // O "de/por" do anúncio de agora: quanto se economiza nesta linha.
    const de = Number(listing?.compare_at_cents) || 0;
    if (check.ok && de > check.unit_price_cents) g.savings_cents += (de - check.unit_price_cents) * line.quantity;
    if (check.ok) g.buyable += 1;
    // Entregas que TODOS os itens deste vendedor aceitam.
    const f = listing?.fulfillment || [];
    g.fulfillment = g.fulfillment == null ? [...f] : g.fulfillment.filter((x) => f.includes(x));
  }
  const total = groups.reduce((n, g) => n + g.subtotal_cents, 0);
  const units = c.items.reduce((n, i) => n + i.quantity, 0);
  return { groups, total_cents: total, units, sellers: groups.length };
}

/**
 * Frete de um vendedor para a entrega escolhida — a MESMA conta do servidor
 * (`groupShipping` em `functions/marketplace.js`): um pacote só, vale o maior
 * frete; se algum item é "a combinar", o frete do pedido é a combinar.
 * @returns {{ shipping_cents: number, shipping_to_agree: boolean }}
 */
export function groupShippingCost(listings = [], fulfillment) {
  if (fulfillment !== 'shipping') return { shipping_cents: 0, shipping_to_agree: false };
  const ls = listings.filter(Boolean);
  if (ls.some((l) => l.shipping_to_agree)) return { shipping_cents: 0, shipping_to_agree: true };
  return { shipping_cents: Math.max(0, ...ls.map((l) => Math.round(Number(l.shipping_cents) || 0))), shipping_to_agree: false };
}
