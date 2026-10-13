/**
 * MERCADO — carrinho com vários vendedores (lógica pura).
 *
 * Um documento por pessoa (`market_carts/{uid}`). O carrinho NÃO reserva
 * estoque: a unidade só é garantida quando o pedido é criado (no servidor,
 * relendo o anúncio). Ao fechar, cada vendedor vira um pedido próprio, com o
 * Pix dele e a entrega que ele oferece.
 */
import { availableQuantity, coverOf } from './listing.js';
import { LISTING_STATUS } from './constants.js';

export const CART_MAX_ITEMS = 50;

function clean(cart) {
  return {
    items: Array.isArray(cart?.items) ? cart.items.filter((i) => i && i.listing_id) : [],
    saved: Array.isArray(cart?.saved) ? cart.saved.filter((i) => i && i.listing_id) : [],
  };
}

/** Linha do carrinho a partir do anúncio (cópia do que se viu, para mostrar mesmo se o anúncio sumir). */
export function cartLine(listing, quantity = 1) {
  return {
    listing_id: listing.id,
    seller_key: listing.seller_key,
    seller_name: listing.seller_name || '',
    title: listing.title || '',
    cover_url: coverOf(listing)?.thumb_url || coverOf(listing)?.url || '',
    price_cents_at_add: listing.price_cents,
    quantity: Math.max(1, Math.floor(quantity) || 1),
  };
}

/** Acrescenta (ou soma, se já está). Nunca passa do estoque visto. */
export function addToCart(cart, listing, quantity = 1) {
  const c = clean(cart);
  const max = Math.max(1, availableQuantity(listing));
  const i = c.items.findIndex((x) => x.listing_id === listing.id);
  if (i >= 0) {
    const q = Math.min(max, c.items[i].quantity + Math.max(1, quantity));
    c.items[i] = { ...c.items[i], quantity: q };
  } else {
    if (c.items.length >= CART_MAX_ITEMS) return { cart: c, error: `O carrinho aceita até ${CART_MAX_ITEMS} itens.` };
    c.items.push(cartLine(listing, Math.min(max, quantity)));
  }
  c.saved = c.saved.filter((x) => x.listing_id !== listing.id);
  return { cart: c, error: null };
}

export function setCartQuantity(cart, listingId, quantity) {
  const c = clean(cart);
  const q = Math.floor(Number(quantity));
  if (!(q >= 1)) return removeFromCart(c, listingId);
  c.items = c.items.map((x) => (x.listing_id === listingId ? { ...x, quantity: Math.min(q, 999) } : x));
  return c;
}

export function removeFromCart(cart, listingId) {
  const c = clean(cart);
  c.items = c.items.filter((x) => x.listing_id !== listingId);
  return c;
}

/** "Salvar para depois": tira do carrinho sem perder. */
export function saveForLater(cart, listingId) {
  const c = clean(cart);
  const item = c.items.find((x) => x.listing_id === listingId);
  if (!item) return c;
  c.items = c.items.filter((x) => x.listing_id !== listingId);
  c.saved = [item, ...c.saved.filter((x) => x.listing_id !== listingId)].slice(0, CART_MAX_ITEMS);
  return c;
}

export function moveToCart(cart, listingId) {
  const c = clean(cart);
  const item = c.saved.find((x) => x.listing_id === listingId);
  if (!item) return c;
  c.saved = c.saved.filter((x) => x.listing_id !== listingId);
  if (!c.items.some((x) => x.listing_id === listingId)) c.items.push(item);
  return c;
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
  if (listing === undefined) return { ok: true, problem: null, unit_price_cents: line.price_cents_at_add, max: line.quantity, unknown: true };
  if (!listing || listing.status === LISTING_STATUS.REMOVED || listing.status === LISTING_STATUS.CLOSED) {
    return { ok: false, problem: 'Não está mais à venda.', unit_price_cents: line.price_cents_at_add, max: 0 };
  }
  if (listing.status !== LISTING_STATUS.ACTIVE || availableQuantity(listing) < 1) {
    return { ok: false, problem: listing.status === LISTING_STATUS.PAUSED ? 'O vendedor pausou este anúncio.' : 'Esgotado.', unit_price_cents: listing.price_cents, max: 0 };
  }
  const max = availableQuantity(listing);
  const problems = [];
  if (line.quantity > max) problems.push(`Só há ${max} disponível${max > 1 ? 'is' : ''}.`);
  if (listing.price_cents !== line.price_cents_at_add) {
    problems.push(listing.price_cents < line.price_cents_at_add ? 'O preço baixou.' : 'O preço mudou.');
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
      g = { seller_key: line.seller_key, seller_name: listing?.seller_name || line.seller_name, seller_type: listing?.seller_type || '', lines: [], subtotal_cents: 0, buyable: 0, fulfillment: null };
      index.set(line.seller_key, g);
      groups.push(g);
    }
    const qty = Math.min(line.quantity, check.max);
    const subtotal = check.ok ? check.unit_price_cents * line.quantity : 0;
    g.lines.push({ ...line, listing, check, subtotal_cents: subtotal, buy_quantity: qty });
    g.subtotal_cents += subtotal;
    if (check.ok) g.buyable += 1;
    // Entregas que TODOS os itens deste vendedor aceitam.
    const f = listing?.fulfillment || [];
    g.fulfillment = g.fulfillment == null ? [...f] : g.fulfillment.filter((x) => f.includes(x));
  }
  const total = groups.reduce((n, g) => n + g.subtotal_cents, 0);
  const units = c.items.reduce((n, i) => n + i.quantity, 0);
  return { groups, total_cents: total, units, sellers: groups.length };
}
