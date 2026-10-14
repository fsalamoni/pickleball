/**
 * MERCADO — o que só o SERVIDOR faz (flag `marketplace`).
 *
 * A regra do Firestore não deixa o navegador escrever pedido, oferta,
 * avaliação nem disputa (`allow write: if false`). Tudo passa por aqui, onde
 * dá para conferir o que o navegador não tem como provar:
 *
 *  - FECHAR O CARRINHO (`placeOrders`): um pedido por vendedor, cada um numa
 *    transação que RELÊ o anúncio, confere estoque e preço e tira a unidade
 *    do estoque. O preço é sempre o do banco, nunca o da tela;
 *  - A MÁQUINA DO PEDIDO (`orderAction`): quem pode o quê em cada estado. Ao
 *    aceitar, o Pix do vendedor é copiado para o pedido (o comprador não lê
 *    o documento privado do vendedor) e o endereço passa a ser visível para
 *    quem vende; cancelar ou expirar devolve o estoque;
 *  - A NEGOCIAÇÃO (`offerAction`): oferta, contraproposta e, no aceite, o
 *    pedido já aceito, pelo valor combinado, na mesma transação;
 *  - A AVALIAÇÃO CEGA (`submitReview`) e a reputação do vendedor;
 *  - A ROTINA (`housekeeping`): expira o que passou do prazo, conclui o que
 *    foi entregue e não confirmado, revela avaliações;
 *  - A MODERAÇÃO AUTOMÁTICA (`moderateListing`): termo proibido derruba o
 *    anúncio na hora.
 *
 * ⚠️ As tabelas de ação do pedido e da oferta são CÓPIAS de
 * `src/modules/marketplace/domain/orderStatus.js` e `offers.js` (o pacote de
 * Functions é publicado isolado e não importa `src/`).
 * `functions/marketplace.parity.test.js` exige o mesmo resultado nos dois.
 */

const promo = require('./marketPromo.js');

/* ------------------------------------------------------------ tabelas -- */

const S = Object.freeze({
  PLACED: 'placed', ACCEPTED: 'accepted', PAYMENT_REVIEW: 'payment_review', PAID: 'paid',
  SHIPPED: 'shipped', READY: 'ready', DELIVERED: 'delivered', COMPLETED: 'completed',
  CANCELLED: 'cancelled', EXPIRED: 'expired', DISPUTED: 'disputed',
});

const ORDER_ACTIONS = Object.freeze({
  accept: { from: [S.PLACED], to: S.ACCEPTED, roles: ['seller'] },
  decline: { from: [S.PLACED], to: S.CANCELLED, roles: ['seller'], needsReason: true },
  send_proof: { from: [S.ACCEPTED], to: S.PAYMENT_REVIEW, roles: ['buyer'] },
  confirm_payment: { from: [S.ACCEPTED, S.PAYMENT_REVIEW], to: S.PAID, roles: ['seller'] },
  reject_payment: { from: [S.PAYMENT_REVIEW], to: S.ACCEPTED, roles: ['seller'], needsReason: true },
  ship: { from: [S.PAID], to: S.SHIPPED, roles: ['seller'], fulfillment: ['shipping'] },
  ready: { from: [S.PAID], to: S.READY, roles: ['seller'], fulfillment: ['pickup', 'meetup'] },
  delivered: { from: [S.SHIPPED, S.READY], to: S.DELIVERED, roles: ['seller'] },
  confirm_received: { from: [S.SHIPPED, S.READY, S.DELIVERED], to: S.COMPLETED, roles: ['buyer'] },
  cancel: { from: [S.PLACED, S.ACCEPTED], to: S.CANCELLED, roles: ['buyer'], needsReason: true },
  seller_cancel: { from: [S.ACCEPTED, S.PAYMENT_REVIEW], to: S.CANCELLED, roles: ['seller'], needsReason: true },
  open_dispute: { from: [S.PAYMENT_REVIEW, S.PAID, S.SHIPPED, S.READY, S.DELIVERED], to: S.DISPUTED, roles: ['buyer'], needsReason: true },
  resolve_buyer: { from: [S.DISPUTED], to: S.CANCELLED, roles: ['admin'], needsReason: true },
  resolve_seller: { from: [S.DISPUTED], to: S.COMPLETED, roles: ['admin'], needsReason: true },
  admin_cancel: { from: [S.PLACED, S.ACCEPTED, S.PAYMENT_REVIEW, S.PAID, S.SHIPPED, S.READY, S.DELIVERED], to: S.CANCELLED, roles: ['admin'], needsReason: true },
  expire: { from: [S.PLACED, S.ACCEPTED], to: S.EXPIRED, roles: ['system'] },
  auto_complete: { from: [S.SHIPPED, S.READY, S.DELIVERED], to: S.COMPLETED, roles: ['system'] },
});

const RESTOCK_ON = Object.freeze([S.CANCELLED, S.EXPIRED]);
/** O produto já saiu das mãos de quem vende: cancelar NÃO devolve o estoque (a pessoa ajusta à mão se ele voltar). */
const GOODS_OUT = Object.freeze([S.SHIPPED, S.READY, S.DELIVERED]);
// Em disputa vale o estado de antes dela (`disputed_from`): disputa aberta
// com o pedido só pago ainda tem o produto com quem vende.
const devolveEstoque = (order, to) => RESTOCK_ON.includes(to)
  && !GOODS_OUT.includes(order.status === S.DISPUTED ? order.disputed_from : order.status);
/** O envio pelo correio demora: o pedido enviado só se conclui sozinho depois disto. */
const SHIPPED_AUTO_COMPLETE_DAYS = 30;

function checkOrderAction(order, action, role) {
  const a = ORDER_ACTIONS[action];
  if (!a) return { ok: false, error: 'Ação desconhecida.' };
  if (!order) return { ok: false, error: 'Pedido não encontrado.' };
  if (!a.roles.includes(role)) return { ok: false, error: 'Você não pode fazer isso neste pedido.' };
  if (!a.from.includes(order.status)) return { ok: false, error: 'O pedido já mudou de estado. Atualize a página.' };
  if (a.fulfillment && !a.fulfillment.includes(order.fulfillment)) {
    return { ok: false, error: 'Esta ação não vale para a entrega escolhida.' };
  }
  return { ok: true, to: a.to };
}

const O = Object.freeze({
  PENDING: 'pending', COUNTERED: 'countered', ACCEPTED: 'accepted', DECLINED: 'declined',
  WITHDRAWN: 'withdrawn', EXPIRED: 'expired', ORDERED: 'ordered',
});

const OFFER_RULES = Object.freeze({ maxRounds: 4, ttlHours: 72, minFractionOfPrice: 0.3 });

const OFFER_ACTIONS = Object.freeze({
  accept: { from: [O.PENDING], role: 'seller', to: O.ACCEPTED },
  decline: { from: [O.PENDING], role: 'seller', to: O.DECLINED },
  counter: { from: [O.PENDING], role: 'seller', to: O.COUNTERED },
  accept_counter: { from: [O.COUNTERED], role: 'buyer', to: O.ACCEPTED },
  counter_back: { from: [O.COUNTERED], role: 'buyer', to: O.PENDING },
  withdraw: { from: [O.PENDING, O.COUNTERED], role: 'buyer', to: O.WITHDRAWN },
});

function validateOfferAmount(listing, amountCents, { minFraction = OFFER_RULES.minFractionOfPrice } = {}) {
  const amount = Math.round(Number(amountCents));
  if (!listing || !listing.accepts_offers) return 'Este anúncio não aceita ofertas.';
  if (!(amount > 0)) return 'Diga quanto você oferece.';
  if (amount >= listing.price_cents) return 'A oferta precisa ser menor que o preço. Pelo preço, é só comprar.';
  if (amount < Math.ceil(listing.price_cents * minFraction)) return 'Oferta muito abaixo do preço anunciado.';
  return null;
}

function lastAmount(offer, by) {
  const h = [...(offer.history || [])].reverse().find((x) => x.by === by && x.amount_cents);
  return h ? h.amount_cents : (by === 'buyer' ? offer.amount_cents : null);
}

function applyOfferAction(offer, action, role, { amountCents, now = Date.now(), maxRounds = OFFER_RULES.maxRounds, ttlHours = OFFER_RULES.ttlHours } = {}) {
  const a = OFFER_ACTIONS[action];
  if (!a) return { error: 'Ação desconhecida.' };
  if (!offer) return { error: 'Oferta não encontrada.' };
  if (a.role !== role) return { error: 'Não é a sua vez nesta negociação.' };
  if (!a.from.includes(offer.status)) return { error: 'A oferta já mudou. Atualize a página.' };
  if (Number(offer.expires_at_ms) && now > Number(offer.expires_at_ms)) return { error: 'A oferta expirou.' };

  const next = { ...offer, status: a.to, history: [...(offer.history || [])] };
  if (action === 'counter' || action === 'counter_back') {
    if ((offer.round || 1) >= maxRounds) return { error: 'Chegou ao limite de rodadas: agora é aceitar ou recusar.' };
    const amount = Math.round(Number(amountCents));
    if (!(amount > 0)) return { error: 'Diga o valor.' };
    const lastBuyer = lastAmount(offer, 'buyer');
    const lastSeller = lastAmount(offer, 'seller') ?? offer.list_price_cents;
    if (role === 'seller' && !(amount > lastBuyer && amount < offer.list_price_cents)) {
      return { error: 'A contraproposta fica entre a oferta e o preço anunciado.' };
    }
    if (role === 'buyer' && !(amount > lastBuyer && amount < lastSeller)) {
      return { error: 'A nova oferta precisa ser maior que a anterior e menor que a contraproposta.' };
    }
    next.amount_cents = amount;
    next.round = (offer.round || 1) + 1;
    next.expires_at_ms = now + ttlHours * 3600000;
    next.history.push({ by: role, amount_cents: amount, at_ms: now });
  } else {
    next.history.push({ by: role, action, at_ms: now });
  }
  return { offer: next };
}

/* ------------------------------------------------------- configuração -- */

const DEFAULT_BANNED_TERMS = Object.freeze([
  'replica', 'réplica', 'falsificado', 'falsificada', 'copia primeira linha',
  'cópia primeira linha', 'paguem por fora', 'pix por fora',
]);

const clampInt = (v, min, max, d) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

/** O que o servidor usa de `platform_settings/marketplace` (mesmos limites do cliente). */
function serverSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    offers_enabled: typeof r.offers_enabled === 'boolean' ? r.offers_enabled : true,
    orders_enabled: typeof r.orders_enabled === 'boolean' ? r.orders_enabled : true,
    banned_terms: Array.isArray(r.banned_terms) ? r.banned_terms.map((s) => String(s).trim()).filter(Boolean).slice(0, 200) : [],
    seller_answer_hours: clampInt(r.seller_answer_hours, 12, 240, 72),
    payment_hours: clampInt(r.payment_hours, 6, 168, 48),
    auto_complete_days: clampInt(r.auto_complete_days, 2, 30, 7),
    dispute_window_days: clampInt(r.dispute_window_days, 2, 30, 7),
    offer_max_rounds: clampInt(r.offer_max_rounds, 1, 10, 4),
    offer_ttl_hours: clampInt(r.offer_ttl_hours, 6, 240, 72),
  };
}

const normalizeText = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function findBannedTerm(text, extra = []) {
  const norm = ` ${normalizeText(text)} `;
  for (const term of [...DEFAULT_BANNED_TERMS, ...(extra || [])]) {
    const t = normalizeText(term);
    if (t && norm.includes(` ${t} `)) return term;
  }
  return null;
}

/* ------------------------------------------------------------- apoio --- */

class MarketError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new MarketError(code, message); };
const texto = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);

async function loadContext(db) {
  const [global, cfg] = await Promise.all([
    db.collection('platform_settings').doc('global').get(),
    db.collection('platform_settings').doc('marketplace').get(),
  ]);
  const flags = (global.exists && global.data().feature_flags) || {};
  return { enabled: flags.marketplace === true, settings: serverSettings(cfg.exists ? cfg.data() : null) };
}

function parseSellerKey(key) {
  const m = /^(athlete|coach|arena|store)_(.+)$/.exec(String(key || ''));
  return m ? { type: m[1], id: m[2] } : null;
}

/** Quem opera a chave: o dono do uid, ou quem gere a arena. */
async function operatorUids(db, sellerKey) {
  const p = parseSellerKey(sellerKey);
  if (!p) return [];
  if (p.type !== 'arena') return [p.id];
  const snap = await db.collection('arena_managers').where('arena_id', '==', p.id).get();
  return [...new Set(snap.docs.map((d) => d.data().user_id).filter(Boolean))];
}

function displayName(user = {}) {
  return texto(user.platform_name, 80) || texto(user.full_name, 80) || texto(user.name, 80) || 'Comprador';
}

async function buyerName(db, uid) {
  const snap = await db.collection('users').doc(uid).get();
  return displayName(snap.exists ? snap.data() : {});
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function orderCode(random = Math.random) {
  let s = '';
  for (let i = 0; i < 5; i += 1) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return `MC-${s}`;
}

function coverUrl(listing) {
  const media = Array.isArray(listing.media) ? listing.media : [];
  const c = media.find((m) => m && m.is_cover) || media.find((m) => m && m.kind !== 'video') || media[0];
  return c ? (c.thumb_url || c.url || '') : '';
}

/** Escreve avisos (fora da transação: aviso que falha não desfaz o pedido). */
async function notify(db, uids, { title, message, link }, now) {
  const alvos = [...new Set((uids || []).filter(Boolean))];
  const batch = db.batch();
  alvos.forEach((uid) => {
    batch.set(db.collection('notifications').doc(), {
      user_id: uid, title: texto(title, 120), message: texto(message, 300), type: 'market',
      link, read: false, archived: false, created_at: new Date(now), created_at_ms: now,
    });
  });
  if (alvos.length) await batch.commit();
}

const SHIPPING_FIELDS = ['name', 'street', 'number', 'complement', 'district', 'city', 'state', 'cep', 'phone'];
function cleanAddress(raw) {
  const a = {};
  SHIPPING_FIELDS.forEach((k) => { a[k] = texto(raw && raw[k], k === 'complement' ? 80 : 120); });
  a.state = a.state.toUpperCase().slice(0, 2);
  a.cep = a.cep.replace(/\D/g, '').slice(0, 8);
  const ok = a.name.length >= 3 && a.street && a.number && a.city && a.state.length === 2 && a.cep.length === 8;
  return ok ? a : null;
}

/** Entrega: o que TODOS os anúncios do grupo aceitam. */
function commonFulfillment(listings) {
  return listings.reduce((acc, l) => acc.filter((f) => (l.fulfillment || []).includes(f)),
    ['pickup', 'meetup', 'shipping']);
}

/** Frete do grupo: um pacote só → o maior frete; "a combinar" se algum for. */
function groupShipping(listings, fulfillment) {
  if (fulfillment !== 'shipping') return { shipping_cents: 0, shipping_to_agree: false };
  if (listings.some((l) => l.shipping_to_agree)) return { shipping_cents: 0, shipping_to_agree: true };
  return { shipping_cents: Math.max(0, ...listings.map((l) => Math.round(Number(l.shipping_cents) || 0))), shipping_to_agree: false };
}

/* ------------------------------------------------------- fechar compra -- */

function validatePlaceRequest(data = {}) {
  const groups = Array.isArray(data.groups) ? data.groups : [];
  if (!groups.length || groups.length > 10) return { error: 'Escolha de 1 a 10 vendedores.' };
  const out = [];
  for (const g of groups) {
    const items = Array.isArray(g && g.items) ? g.items : [];
    if (!g || !parseSellerKey(g.seller_key) || !items.length || items.length > 20) return { error: 'Carrinho inválido.' };
    if (!['pickup', 'meetup', 'shipping'].includes(g.fulfillment)) return { error: 'Escolha como vai receber.' };
    const seen = new Set();
    const its = [];
    for (const i of items) {
      const q = Math.floor(Number(i && i.quantity));
      if (!i || typeof i.listing_id !== 'string' || !i.listing_id || seen.has(i.listing_id) || !(q >= 1 && q <= 99)) {
        return { error: 'Item inválido no carrinho.' };
      }
      seen.add(i.listing_id);
      its.push({ listing_id: i.listing_id, quantity: q, expected_price_cents: Math.round(Number(i.expected_price_cents) || 0) });
    }
    const giftIds = [...new Set((Array.isArray(g.gift_card_ids) ? g.gift_card_ids : []).filter((x) => typeof x === 'string' && /^[\w-]{1,64}$/.test(x)))];
    if (giftIds.length > promo.GIFT_CARD_LIMITS.maxPerOrder) return { error: `Use até ${promo.GIFT_CARD_LIMITS.maxPerOrder} vales por loja.` };
    out.push({
      seller_key: g.seller_key, fulfillment: g.fulfillment, items: its, buyer_note: texto(g.buyer_note, 300),
      coupon_code: promo.normalizeCouponCode(g.coupon_code), gift_card_ids: giftIds,
    });
  }
  const needsAddress = out.some((g) => g.fulfillment === 'shipping');
  const address = needsAddress ? cleanAddress(data.shipping) : null;
  if (needsAddress && !address) return { error: 'Preencha o endereço de entrega.' };
  return { groups: out, address };
}

/** Já comprou desta loja (pedido que não foi cancelado nem expirou)? */
async function hasBoughtFrom(db, uid, sellerKey) {
  const snap = await db.collection('market_orders').where('buyer_uid', '==', uid).where('seller_key', '==', sellerKey).get();
  // Comprar vale-presente não é "já comprou na loja" (o vale ainda vai ser usado nela).
  return snap.docs.some((d) => d.data().source !== 'gift_card' && ![S.CANCELLED, S.EXPIRED].includes(d.data().status));
}

/**
 * Cupom e vales de UM pedido, dentro da transação (as leituras já vieram):
 * confere com a mesma conta do cliente (`marketPromo.js`), grava o uso e
 * devolve o preço. Cupom ou vale que não vale DERRUBA este pedido com o motivo
 * — nunca um pedido mais caro do que a pessoa viu na tela.
 */
function applyPromotions(tx, p) {
  const { uid, now, sellerKey, items, fulfillment, ship, jaComprou, couponRef, couponSnap, usesRef, usesSnap, giftSnaps, FieldValue } = p;
  const inc = (n) => (FieldValue ? FieldValue.increment(n) : n);
  let coupon = null;
  if (couponRef) {
    const c = couponSnap && couponSnap.exists ? { id: couponSnap.id, ...couponSnap.data() } : null;
    const problema = promo.couponProblem(c, {
      sellerKey, items, fulfillment, shippingToAgree: ship.shipping_to_agree, now,
      buyerUses: usesSnap && usesSnap.exists ? Number(usesSnap.data().count) || 0 : 0,
      hasBoughtBefore: jaComprou,
    });
    if (problema) fail('failed-precondition', `Cupom: ${problema}`);
    coupon = c;
  }
  const cards = [];
  giftSnaps.forEach((s) => {
    const card = s.exists ? { id: s.id, ...s.data() } : null;
    const problema = promo.giftCardProblem(card, { sellerKey, uid, now });
    if (problema) fail('failed-precondition', `Vale-presente: ${problema}`);
    cards.push(card);
  });
  const pricing = promo.orderPricing({
    items, shippingCents: ship.shipping_cents, coupon, giftCards: promo.sortGiftCardsForUse(cards),
  });
  if (coupon) {
    tx.update(couponRef, { uses_count: inc(1), last_used_at_ms: now });
    tx.set(usesRef, { buyer_uid: uid, count: inc(1), last_at_ms: now }, { merge: true });
  }
  pricing.gift_card_uses.forEach((u) => {
    const card = cards.find((c) => c.id === u.id);
    const saldo = (Number(card.balance_cents) || 0) - u.amount_cents;
    tx.update(giftSnaps.find((s) => s.id === u.id).ref, {
      balance_cents: saldo, status: saldo <= 0 ? promo.GIFT_CARD_STATUS.USED : promo.GIFT_CARD_STATUS.ACTIVE,
      last_used_at_ms: now, updated_at: new Date(now),
    });
  });
  return {
    pricing,
    coupon: coupon ? {
      id: coupon.id, code: coupon.code, kind: coupon.kind, value: coupon.value,
      discount_cents: pricing.discount_cents, shipping_discount_cents: pricing.shipping_discount_cents,
    } : null,
    gift_cards: pricing.gift_card_uses.map((u) => ({
      id: u.id, amount_cents: u.amount_cents, code_mask: promo.maskGiftCardCode(cards.find((c) => c.id === u.id).code),
    })),
  };
}

/**
 * Um pedido por vendedor. Cada grupo é uma transação própria: o problema de
 * um vendedor (esgotou, pausou) não derruba os outros — volta em `failures`.
 */
async function placeOrders(ctx, uid, data) {
  const { db, now = Date.now() } = ctx;
  const { enabled, settings } = await loadContext(db);
  if (!enabled || !settings.orders_enabled) fail('failed-precondition', 'As compras no Mercado estão fechadas no momento.');
  const req = validatePlaceRequest(data);
  if (req.error) fail('invalid-argument', req.error);
  const name = await buyerName(db, uid);

  const orders = [];
  const failures = [];
  for (const g of req.groups) {
    // eslint-disable-next-line no-await-in-loop
    const ops = await operatorUids(db, g.seller_key);
    if (ops.includes(uid)) { failures.push({ seller_key: g.seller_key, error: 'Você não pode comprar de você mesmo.' }); continue; }
    // eslint-disable-next-line no-await-in-loop
    const jaComprou = g.coupon_code ? await hasBoughtFrom(db, uid, g.seller_key) : false;
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await db.runTransaction(async (tx) => {
        const sellerRef = db.collection('market_sellers').doc(g.seller_key);
        const refs = g.items.map((i) => db.collection('market_listings').doc(i.listing_id));
        const couponRef = g.coupon_code ? db.collection('market_coupons').doc(promo.couponDocId(g.seller_key, g.coupon_code)) : null;
        const usesRef = couponRef ? couponRef.collection('market_coupon_uses').doc(uid) : null;
        const giftRefs = g.gift_card_ids.map((id) => db.collection('market_gift_cards').doc(id));
        const extra = [couponRef, usesRef, ...giftRefs].filter(Boolean);
        const [sellerSnap, ...rest] = await tx.getAll(sellerRef, ...refs, ...extra);
        const snaps = rest.slice(0, refs.length);
        const couponSnap = couponRef ? rest[refs.length] : null;
        const usesSnap = couponRef ? rest[refs.length + 1] : null;
        const giftSnaps = rest.slice(refs.length + (couponRef ? 2 : 0));
        if (!sellerSnap.exists || sellerSnap.data().status !== 'active') fail('failed-precondition', 'Este vendedor não está vendendo agora.');
        const seller = sellerSnap.data();
        const listings = snaps.map((s, k) => {
          const l = s.exists ? { id: s.id, ...s.data() } : null;
          const it = g.items[k];
          if (!l || l.seller_key !== g.seller_key) fail('failed-precondition', 'Um item não está mais à venda.');
          if (l.status !== 'active') fail('failed-precondition', `"${l.title}" não está à venda agora.`);
          if ((Number(l.quantity) || 0) < it.quantity) fail('failed-precondition', `"${l.title}": só há ${Number(l.quantity) || 0} disponível.`);
          if (it.expected_price_cents && it.expected_price_cents !== l.price_cents) {
            fail('aborted', `O preço de "${l.title}" mudou. Confira o carrinho.`);
          }
          return l;
        });
        if (!commonFulfillment(listings).includes(g.fulfillment)) fail('failed-precondition', 'Este vendedor não oferece essa forma de entrega para todos os itens.');

        const items = listings.map((l, k) => ({
          listing_id: l.id, title: l.title, cover_url: coverUrl(l), condition: l.condition || '',
          ...(g.fulfillment !== 'shipping' && l.pickup_note ? { pickup_note: texto(l.pickup_note, 140), city: texto(l.city, 60) } : {}),
          unit_price_cents: l.price_cents, quantity: g.items[k].quantity,
          ...(arenaProductIdOf(l) ? { arena_product_id: arenaProductIdOf(l) } : {}),
        }));
        const ship = groupShipping(listings, g.fulfillment);
        const desconto = applyPromotions(tx, {
          uid, now, sellerKey: g.seller_key, items, fulfillment: g.fulfillment, ship, jaComprou,
          couponRef, couponSnap, usesRef, usesSnap, giftSnaps, FieldValue: ctx.FieldValue,
        });
        const subtotal = desconto.pricing.subtotal_cents;
        const orderRef = db.collection('market_orders').doc();
        const order = {
          code: orderCode(), source: 'cart', status: S.PLACED,
          buyer_uid: uid, buyer_name: name,
          seller_key: g.seller_key, seller_name: seller.display_name || '', seller_type: seller.seller_type || '',
          seller_manager_uids: ops, items, item_count: items.reduce((n, i) => n + i.quantity, 0),
          listing_ids: items.map((i) => i.listing_id),
          fulfillment: g.fulfillment, buyer_note: g.buyer_note, ...ship,
          subtotal_cents: subtotal, total_cents: desconto.pricing.total_cents,
          discount_cents: desconto.pricing.discount_cents,
          shipping_discount_cents: desconto.pricing.shipping_discount_cents,
          gift_card_cents: desconto.pricing.gift_card_cents,
          coupon: desconto.coupon, gift_cards: desconto.gift_cards,
          platform_fee_cents: 0, shipping_visible: false,
          placed_at_ms: now, status_at_ms: now, deadline_at_ms: now + settings.seller_answer_hours * 3600000,
          created_at: new Date(now), updated_at: new Date(now),
        };
        listings.forEach((l, k) => {
          const left = (Number(l.quantity) || 0) - g.items[k].quantity;
          tx.update(refs[k], {
            quantity: left,
            quantity_sold: (Number(l.quantity_sold) || 0) + g.items[k].quantity,
            ...(left <= 0 ? { status: 'sold_out' } : {}),
            updated_at: new Date(now),
          });
        });
        tx.set(orderRef, order);
        if (req.address && g.fulfillment === 'shipping') tx.set(orderRef.collection('private').doc('shipping'), { address: req.address });
        tx.set(orderRef.collection('events').doc(), { action: 'placed', by_role: 'buyer', by_uid: uid, at_ms: now });
        return { id: orderRef.id, code: order.code, seller_name: order.seller_name, seller_key: g.seller_key, total_cents: order.total_cents, managers: ops };
      });
      orders.push(res);
    } catch (err) {
      if (!(err instanceof MarketError)) throw err;
      failures.push({ seller_key: g.seller_key, error: err.message });
    }
  }

  if (orders.length) {
    const comprados = new Set(req.groups.filter((g) => orders.some((o) => o.seller_key === g.seller_key))
      .flatMap((g) => g.items.map((i) => i.listing_id)));
    const cartRef = db.collection('market_carts').doc(uid);
    const cart = await cartRef.get();
    if (cart.exists) {
      const items = (cart.data().items || []).filter((i) => !comprados.has(i.listing_id));
      await cartRef.set({ items, updated_at: new Date(now) }, { merge: true });
    }
    for (const o of orders) {
      // eslint-disable-next-line no-await-in-loop
      await notify(db, o.managers, {
        title: `Novo pedido ${o.code}`,
        message: `${name} comprou no Mercado. Aceite ou recuse em até ${settings.seller_answer_hours} h.`,
        link: `/mercado/vendas/${o.id}`,
      }, now);
    }
  }
  return { orders: orders.map(({ managers, ...o }) => o), failures };
}

/* -------------------------------------------------- a máquina do pedido -- */

function validateActionRequest(data = {}) {
  const orderId = texto(data.orderId, 64);
  const action = texto(data.action, 32);
  if (!orderId || !ORDER_ACTIONS[action] || ORDER_ACTIONS[action].roles.includes('system')) return { error: 'Pedido inválido.' };
  return {
    orderId, action,
    reason: texto(data.reason, 500),
    proof_path: texto(data.proof_path, 200),
    tracking_code: texto(data.tracking_code, 60),
    carrier: texto(data.carrier, 40),
    admin: data.as_admin === true,
  };
}

/** Itens que vieram de um anúncio (o vale-presente não tem anúncio nem estoque). */
const itensComAnuncio = (order) => (order.items || []).filter((i) => i && i.listing_id);

function restockUpdates(order, snaps, now) {
  const itens = itensComAnuncio(order);
  return snaps.map((s, k) => {
    if (!s || !s.exists) return null;
    const l = s.data();
    const q = itens[k].quantity;
    return {
      ref: s.ref,
      data: {
        quantity: (Number(l.quantity) || 0) + q,
        quantity_sold: Math.max(0, (Number(l.quantity_sold) || 0) - q),
        ...(l.status === 'sold_out' ? { status: 'active' } : {}),
        updated_at: new Date(now),
      },
    };
  }).filter(Boolean);
}

const OTHER_SIDE_MSG = {
  accept: (o) => ['Pedido aceito', `${o.seller_name} aceitou o pedido ${o.code}. Pague pelo Pix e avise.`, 'buyer'],
  decline: (o) => ['Pedido recusado', `${o.seller_name} recusou o pedido ${o.code}.`, 'buyer'],
  send_proof: (o) => ['Pagamento informado', `${o.buyer_name} avisou que pagou o pedido ${o.code}. Confira o Pix.`, 'seller'],
  confirm_payment: (o) => ['Pagamento confirmado', (o.issued_gift_card_ids || []).length
    ? `${o.seller_name} confirmou o pagamento do pedido ${o.code}. O vale-presente já está em Mercado → Vales.`
    : `${o.seller_name} confirmou o pagamento do pedido ${o.code}.`, 'buyer'],
  reject_payment: (o) => ['Pagamento não encontrado', `${o.seller_name} não encontrou o Pix do pedido ${o.code}.`, 'buyer'],
  ship: (o) => ['Pedido enviado', `O pedido ${o.code} saiu para entrega.`, 'buyer'],
  ready: (o) => ['Pedido pronto', `O pedido ${o.code} está pronto para entregar.`, 'buyer'],
  delivered: (o) => ['Pedido entregue', `${o.seller_name} marcou o pedido ${o.code} como entregue. Confirme o recebimento.`, 'buyer'],
  confirm_received: (o) => ['Pedido concluído', `${o.buyer_name} confirmou o recebimento do pedido ${o.code}.`, 'seller'],
  cancel: (o) => ['Pedido cancelado', `${o.buyer_name} cancelou o pedido ${o.code}.`, 'seller'],
  seller_cancel: (o) => ['Pedido cancelado', `${o.seller_name} cancelou o pedido ${o.code}.`, 'buyer'],
  open_dispute: (o) => ['Problema no pedido', `${o.buyer_name} relatou um problema no pedido ${o.code}. A moderação vai analisar.`, 'seller'],
  resolve_buyer: (o) => ['Disputa encerrada', `A moderação encerrou a disputa do pedido ${o.code} a favor do comprador.`, 'both'],
  resolve_seller: (o) => ['Disputa encerrada', `A moderação encerrou a disputa do pedido ${o.code} a favor do vendedor.`, 'both'],
  admin_cancel: (o) => ['Pedido cancelado', `A moderação cancelou o pedido ${o.code}.`, 'both'],
  expire: (o) => ['Pedido expirado', `O pedido ${o.code} passou do prazo e foi cancelado. O estoque voltou ao anúncio.`, 'both'],
  auto_complete: (o) => ['Pedido concluído', `O pedido ${o.code} foi concluído automaticamente.`, 'both'],
};

/**
 * Pagamento confirmado: cada vale-presente do pedido vira um vale de verdade,
 * com código, na conta de quem comprou (que pode dar o código a outra pessoa).
 */
function issueGiftCardsForOrder(db, tx, orderId, order, { now, actorUid }) {
  const ids = [];
  (order.items || []).filter((i) => i && i.kind === 'gift_card').forEach((i) => {
    for (let n = 0; n < Math.max(1, Number(i.quantity) || 1); n += 1) {
      const ref = db.collection('market_gift_cards').doc();
      const valor = Math.round(Number(i.unit_price_cents) || 0);
      tx.set(ref, {
        code: promo.giftCardCode(), seller_key: order.seller_key, seller_name: order.seller_name || '',
        initial_cents: valor, balance_cents: valor, status: promo.GIFT_CARD_STATUS.ACTIVE,
        buyer_uid: order.buyer_uid, holder_uid: order.buyer_uid,
        recipient_name: texto(i.gift && i.gift.recipient_name, promo.GIFT_CARD_LIMITS.name),
        from_name: texto(i.gift && i.gift.from_name, promo.GIFT_CARD_LIMITS.name),
        message: texto(i.gift && i.gift.message, promo.GIFT_CARD_LIMITS.message),
        source: 'order', order_id: orderId, issued_by: actorUid || null,
        issued_at_ms: now, expires_at_ms: promo.giftCardExpiry(now, Number(i.gift && i.gift.validity_months) || 0),
        created_at: new Date(now), updated_at: new Date(now),
      });
      ids.push(ref.id);
    }
  });
  return ids;
}

/**
 * Pedido cancelado ou expirado: o cupom volta a ter o uso, o saldo dos vales
 * usados volta, e o vale que o pedido EMITIU (comprado e depois cancelado pela
 * moderação) é cancelado — o dinheiro dele volta por fora, com o vendedor.
 */
function restorePromotions(db, tx, order, { valesUsados, valesEmitidos, valeSnaps, now, FieldValue, reason }) {
  const inc = (n) => (FieldValue ? FieldValue.increment(n) : n);
  if (order.coupon && order.coupon.id) {
    const ref = db.collection('market_coupons').doc(order.coupon.id);
    tx.set(ref, { uses_count: inc(-1) }, { merge: true });
    tx.set(ref.collection('market_coupon_uses').doc(order.buyer_uid), { count: inc(-1) }, { merge: true });
  }
  valesUsados.forEach((g, k) => {
    const s = valeSnaps[k];
    if (!s || !s.exists) return;
    const card = s.data();
    if (card.status === promo.GIFT_CARD_STATUS.CANCELLED) return;
    tx.update(s.ref, {
      balance_cents: (Number(card.balance_cents) || 0) + Math.round(Number(g.amount_cents) || 0),
      status: promo.GIFT_CARD_STATUS.ACTIVE, updated_at: new Date(now),
    });
  });
  valeSnaps.slice(valesUsados.length).forEach((s) => {
    if (!s || !s.exists || s.data().status === promo.GIFT_CARD_STATUS.CANCELLED) return;
    tx.update(s.ref, { status: promo.GIFT_CARD_STATUS.CANCELLED, cancel_reason: texto(reason, 200) || 'Pedido cancelado.', updated_at: new Date(now) });
  });
}

/**
 * Aplica uma ação ao pedido, numa transação. `role` já decidido por quem
 * chama (`orderAction` para pessoas, `housekeeping` para o sistema).
 */
async function applyOrderAction(ctx, orderId, action, role, actorUid, extra = {}) {
  const { db, now = Date.now(), settings } = ctx;
  const orderRef = db.collection('market_orders').doc(orderId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(orderRef);
    if (!snap.exists) fail('not-found', 'Pedido não encontrado.');
    const order = snap.data();
    const chk = checkOrderAction(order, action, role);
    if (!chk.ok) fail('failed-precondition', chk.error);
    const a = ORDER_ACTIONS[action];
    if (a.needsReason && role !== 'system' && texto(extra.reason).length < 3) fail('invalid-argument', 'Conte o motivo em poucas palavras.');

    // Só vale-presente (sem nada a entregar): pago = entregue.
    const to = action === 'confirm_payment' && order.fulfillment === 'digital' ? S.DELIVERED : chk.to;
    const upd = { status: to, status_at_ms: now, updated_at: new Date(now) };
    // Leituras antes de qualquer escrita (regra da transação).
    const comAnuncio = itensComAnuncio(order);
    const listingSnaps = devolveEstoque(order, to) && comAnuncio.length
      ? await tx.getAll(...comAnuncio.map((i) => db.collection('market_listings').doc(i.listing_id)))
      : [];
    const valesUsados = RESTOCK_ON.includes(to) ? (order.gift_cards || []).filter((g) => g && g.id) : [];
    const valesEmitidos = RESTOCK_ON.includes(to) ? (order.issued_gift_card_ids || []) : [];
    const valeSnaps = valesUsados.length || valesEmitidos.length
      ? await tx.getAll(...[...valesUsados.map((g) => g.id), ...valesEmitidos].map((id) => db.collection('market_gift_cards').doc(id)))
      : [];
    const estoqueArena = await arenaStockReads(db, tx, orderId, order, to);
    let privSnap = null;
    let sellerAtivo = true;
    if (action === 'accept') {
      const sRef = db.collection('market_sellers').doc(order.seller_key);
      const [ss, ps] = await tx.getAll(sRef, sRef.collection('private').doc('data'));
      privSnap = ps;
      sellerAtivo = ss.exists && ss.data().status === 'active';
    }

    if (action === 'accept') {
      if (!sellerAtivo) fail('failed-precondition', 'Sua loja está suspensa ou em análise: não dá para aceitar pedidos agora.');
      const p = privSnap && privSnap.exists ? privSnap.data() : {};
      if (!p.pix_key || !p.pix_key_type) fail('failed-precondition', 'Cadastre a sua chave Pix (Vender → Recebimento) antes de aceitar.');
      upd.payment = {
        pix_key_type: p.pix_key_type, pix_key: p.pix_key,
        receiver_name: p.receiver_name || '', instructions: p.instructions || '',
      };
      upd.shipping_visible = true;
      upd.accepted_at_ms = now;
      upd.deadline_at_ms = now + settings.payment_hours * 3600000;
    } else if (action === 'send_proof') {
      if (extra.proof_path && !new RegExp(`^mercado/${actorUid}/[\\w.-]+$`).test(extra.proof_path)) {
        fail('invalid-argument', 'Comprovante inválido.');
      }
      upd.payment_proof_path = extra.proof_path || '';
      upd.payment_informed_at_ms = now;
      upd.deadline_at_ms = null;
    } else if (action === 'reject_payment') {
      upd.deadline_at_ms = now + settings.payment_hours * 3600000;
    } else if (action === 'confirm_payment') {
      upd.paid_at_ms = now;
      upd.deadline_at_ms = null;
      const emitidos = issueGiftCardsForOrder(db, tx, orderId, order, { now, actorUid });
      if (emitidos.length) upd.issued_gift_card_ids = emitidos;
      if (to === S.DELIVERED) upd.delivered_at_ms = now;
    } else if (action === 'ship') {
      upd.shipped_at_ms = now;
      upd.tracking = { code: extra.tracking_code || '', carrier: extra.carrier || '' };
    } else if (action === 'ready') {
      upd.ready_at_ms = now;
    } else if (action === 'delivered') {
      upd.delivered_at_ms = now;
    } else if (action === 'open_dispute') {
      // Pago e nunca enviado (ou pagamento sem conferência): o prazo não corre.
      const since = [S.PAID, S.PAYMENT_REVIEW].includes(order.status) ? 0
        : Number(order.delivered_at_ms || order.shipped_at_ms || order.ready_at_ms || 0);
      if (since && now - since > settings.dispute_window_days * 86400000) fail('failed-precondition', 'O prazo para relatar problema neste pedido acabou.');
      const dRef = db.collection('market_disputes').doc(orderId);
      tx.set(dRef, {
        order_id: orderId, order_code: order.code, buyer_uid: order.buyer_uid, seller_key: order.seller_key,
        reason: extra.reason, status: 'open', previous_status: order.status, created_at: new Date(now), created_at_ms: now,
      });
      upd.dispute_id = orderId;
      upd.disputed_from = order.status;
    }
    if (action === 'resolve_buyer' || action === 'resolve_seller') {
      tx.set(db.collection('market_disputes').doc(orderId), {
        status: 'resolved', resolution: action === 'resolve_buyer' ? 'buyer' : 'seller',
        resolution_note: extra.reason, resolved_by: actorUid, resolved_at_ms: now,
      }, { merge: true });
    }
    if (RESTOCK_ON.includes(to)) {
      upd.cancelled_at_ms = now;
      upd.cancel_reason = extra.reason || (action === 'expire' ? 'Passou do prazo.' : '');
      upd.deadline_at_ms = null;
      if (devolveEstoque(order, to)) restockUpdates(order, listingSnaps, now).forEach((r) => tx.update(r.ref, r.data));
      restorePromotions(db, tx, order, { valesUsados, valesEmitidos, valeSnaps, now, FieldValue: ctx.FieldValue, reason: upd.cancel_reason });
    }
    Object.assign(upd, arenaStockWrites(db, tx, order, orderId, estoqueArena, { now, actorUid }));
    if (to === S.COMPLETED) {
      upd.completed_at_ms = now;
      upd.review_open = true;
      tx.set(db.collection('market_sellers').doc(order.seller_key), {
        sales_count: (ctx.FieldValue ? ctx.FieldValue.increment(1) : 1),
      }, { merge: true });
    }
    tx.update(orderRef, upd);
    tx.set(orderRef.collection('events').doc(), {
      action, from: order.status, to, by_role: role, by_uid: actorUid || null,
      reason: extra.reason || '', at_ms: now,
    });
    return { order: { ...order, ...upd }, to };
  });

  const msg = OTHER_SIDE_MSG[action] && OTHER_SIDE_MSG[action](result.order);
  if (msg) {
    const [title, message, quem] = msg;
    const o = result.order;
    const sellerUids = await operatorUids(db, o.seller_key);
    if (quem === 'buyer' || quem === 'both') await notify(db, [o.buyer_uid], { title, message, link: `/mercado/pedidos/${orderId}` }, now);
    if (quem === 'seller' || quem === 'both') await notify(db, sellerUids, { title, message, link: `/mercado/vendas/${orderId}` }, now);
  }
  return { status: result.to };
}

async function orderAction(ctx, actor, data) {
  const { db } = ctx;
  const req = validateActionRequest(data);
  if (req.error) fail('invalid-argument', req.error);
  const { settings } = await loadContext(db);
  const snap = await db.collection('market_orders').doc(req.orderId).get();
  if (!snap.exists) fail('not-found', 'Pedido não encontrado.');
  const order = snap.data();
  let role = null;
  const roles = ORDER_ACTIONS[req.action].roles;
  if (roles.includes('admin')) role = actor.isPlatformAdmin ? 'admin' : null;
  else if (roles.includes('buyer') && order.buyer_uid === actor.uid) role = 'buyer';
  else if (roles.includes('seller') && (await operatorUids(db, order.seller_key)).includes(actor.uid)) role = 'seller';
  if (!role) fail('permission-denied', 'Você não pode fazer isso neste pedido.');
  return applyOrderAction({ ...ctx, settings }, req.orderId, req.action, role, actor.uid, req);
}

/* ------------------------------------------------------- a negociação -- */

async function createOrderFromOffer(ctx, tx, offerIn, listingSnap, privSnap, sellerSnap) {
  let offer = offerIn;
  const { db, now, settings } = ctx;
  const l = listingSnap.data();
  if (l.status !== 'active' || (Number(l.quantity) || 0) < 1) fail('failed-precondition', 'O produto esgotou. A oferta foi encerrada.');
  const p = privSnap.exists ? privSnap.data() : {};
  if (!p.pix_key) fail('failed-precondition', 'O vendedor ainda não cadastrou o Pix. Ele foi avisado.');
  const seller = sellerSnap.exists ? sellerSnap.data() : {};
  if (seller.status !== 'active') fail('failed-precondition', 'Este vendedor não está vendendo agora.');
  // Se o preço caiu abaixo do combinado, vale o preço de agora.
  offer = { ...offer, amount_cents: Math.min(Math.round(Number(offer.amount_cents) || 0), Math.round(Number(l.price_cents) || Infinity)) };
  const orderRef = db.collection('market_orders').doc();
  const left = (Number(l.quantity) || 0) - 1;
  tx.update(listingSnap.ref, {
    quantity: left, quantity_sold: (Number(l.quantity_sold) || 0) + 1,
    ...(left <= 0 ? { status: 'sold_out' } : {}), updated_at: new Date(now),
  });
  const fulfillment = (l.fulfillment || []).includes(offer.fulfillment) ? offer.fulfillment : (l.fulfillment || [])[0] || 'meetup';
  const ship = groupShipping([l], fulfillment);
  const order = {
    code: orderCode(), source: 'offer', offer_id: offer.id, status: S.ACCEPTED,
    buyer_uid: offer.buyer_uid, buyer_name: offer.buyer_name || '',
    seller_key: offer.seller_key, seller_name: seller.display_name || l.seller_name || '', seller_type: seller.seller_type || l.seller_type || '',
    seller_manager_uids: offer.seller_manager_uids || [],
    items: [{
      listing_id: listingSnap.id, title: l.title, cover_url: coverUrl(l), condition: l.condition || '', unit_price_cents: offer.amount_cents, quantity: 1,
      ...(arenaProductIdOf(l) ? { arena_product_id: arenaProductIdOf(l) } : {}),
    }],
    item_count: 1, listing_ids: [listingSnap.id],
    fulfillment, buyer_note: '', ...ship,
    subtotal_cents: offer.amount_cents, total_cents: offer.amount_cents + ship.shipping_cents, platform_fee_cents: 0,
    payment: { pix_key_type: p.pix_key_type, pix_key: p.pix_key, receiver_name: p.receiver_name || '', instructions: p.instructions || '' },
    shipping_visible: true, placed_at_ms: now, accepted_at_ms: now, status_at_ms: now,
    deadline_at_ms: now + settings.payment_hours * 3600000,
    created_at: new Date(now), updated_at: new Date(now),
  };
  tx.set(orderRef, order);
  tx.set(orderRef.collection('events').doc(), { action: 'offer_accepted', by_role: 'system', at_ms: now, amount_cents: offer.amount_cents });
  return orderRef.id;
}

async function offerAction(ctx, actor, data = {}) {
  const { db, now = Date.now() } = ctx;
  const { enabled, settings } = await loadContext(db);
  const action = texto(data.action, 32);
  const c = { ...ctx, now, settings };

  if (action === 'create') {
    if (!enabled || !settings.offers_enabled) fail('failed-precondition', 'As ofertas estão fechadas no momento.');
    const listingId = texto(data.listingId, 64);
    const snap = await db.collection('market_listings').doc(listingId).get();
    if (!snap.exists) fail('not-found', 'Anúncio não encontrado.');
    const l = { id: snap.id, ...snap.data() };
    if (l.status !== 'active') fail('failed-precondition', 'Este anúncio não está à venda agora.');
    const ops = await operatorUids(db, l.seller_key);
    if (ops.includes(actor.uid)) fail('failed-precondition', 'O anúncio é seu.');
    const err = validateOfferAmount(l, data.amount_cents);
    if (err) fail('invalid-argument', err);
    const mine = await db.collection('market_offers').where('buyer_uid', '==', actor.uid).get();
    if (mine.docs.some((d) => d.data().listing_id === listingId && [O.PENDING, O.COUNTERED].includes(d.data().status))) {
      fail('already-exists', 'Você já tem uma negociação aberta neste anúncio.');
    }
    const amount = Math.round(Number(data.amount_cents));
    const ref = db.collection('market_offers').doc();
    const name = await buyerName(db, actor.uid);
    await ref.set({
      listing_id: listingId, listing_title: l.title, cover_url: coverUrl(l),
      seller_key: l.seller_key, seller_name: l.seller_name || '', seller_manager_uids: ops,
      buyer_uid: actor.uid, buyer_name: name, list_price_cents: l.price_cents, amount_cents: amount,
      fulfillment: (l.fulfillment || []).includes(data.fulfillment) ? data.fulfillment : (l.fulfillment || [])[0] || 'meetup',
      message: texto(data.message, 300), status: O.PENDING, round: 1,
      history: [{ by: 'buyer', amount_cents: amount, at_ms: now }],
      expires_at_ms: now + settings.offer_ttl_hours * 3600000,
      created_at: new Date(now), updated_at: new Date(now),
    });
    await notify(db, ops, { title: 'Nova oferta', message: `${name} ofereceu por "${l.title}".`, link: `/mercado/ofertas/${ref.id}` }, now);
    return { id: ref.id, status: O.PENDING };
  }

  if (['accept', 'accept_counter'].includes(action) && (!enabled || !settings.orders_enabled)) {
    fail('failed-precondition', 'As compras no Mercado estão fechadas no momento. A oferta continua aberta.');
  }
  const offerId = texto(data.offerId, 64);
  const pre = await db.collection('market_offers').doc(offerId).get();
  if (!pre.exists) fail('not-found', 'Oferta não encontrada.');
  const offer0 = pre.data();
  const role = offer0.buyer_uid === actor.uid ? 'buyer'
    : (await operatorUids(db, offer0.seller_key)).includes(actor.uid) ? 'seller' : null;
  if (!role) fail('permission-denied', 'Esta negociação não é sua.');

  const res = await db.runTransaction(async (tx) => {
    const offerRef = db.collection('market_offers').doc(offerId);
    const s = await tx.get(offerRef);
    const offer = { id: s.id, ...s.data() };
    const r = applyOfferAction(offer, action, role, {
      amountCents: data.amount_cents, now, maxRounds: settings.offer_max_rounds, ttlHours: settings.offer_ttl_hours,
    });
    if (r.error) fail('failed-precondition', r.error);
    const next = r.offer;
    let orderId = null;
    if (next.status === O.ACCEPTED) {
      const [lSnap, privSnap, sellerSnap] = await tx.getAll(
        db.collection('market_listings').doc(offer.listing_id),
        db.collection('market_sellers').doc(offer.seller_key).collection('private').doc('data'),
        db.collection('market_sellers').doc(offer.seller_key),
      );
      if (!lSnap.exists) fail('failed-precondition', 'O anúncio não existe mais.');
      orderId = await createOrderFromOffer(c, tx, next, lSnap, privSnap, sellerSnap);
      next.status = O.ORDERED;
      next.order_id = orderId;
    }
    const { id, ...save } = next;
    tx.set(offerRef, { ...save, updated_at: new Date(now) });
    return { offer: next, orderId };
  });

  const o = res.offer;
  const toBuyer = role === 'seller';
  const msgs = {
    accept: ['Oferta aceita', `Sua oferta por "${o.listing_title}" foi aceita. Pague pelo Pix no pedido.`],
    accept_counter: ['Contraproposta aceita', `${o.buyer_name} aceitou o valor por "${o.listing_title}".`],
    decline: ['Oferta recusada', `A oferta por "${o.listing_title}" foi recusada.`],
    counter: ['Contraproposta', `O vendedor fez uma contraproposta por "${o.listing_title}".`],
    counter_back: ['Nova oferta', `${o.buyer_name} fez uma nova oferta por "${o.listing_title}".`],
    withdraw: ['Oferta retirada', `${o.buyer_name} desistiu da oferta por "${o.listing_title}".`],
  };
  const [title, message] = msgs[action] || ['Oferta', ''];
  const link = res.orderId ? (toBuyer ? `/mercado/pedidos/${res.orderId}` : `/mercado/vendas/${res.orderId}`) : `/mercado/ofertas/${offerId}`;
  const opsAgora = await operatorUids(db, o.seller_key);
  await notify(db, toBuyer ? [o.buyer_uid] : opsAgora, { title, message, link }, now);
  if (res.orderId && !toBuyer) {
    await notify(db, opsAgora, { title: 'Venda combinada', message: `Pedido criado pelo valor combinado de "${o.listing_title}".`, link: `/mercado/vendas/${res.orderId}` }, now);
  }
  return { status: o.status, orderId: res.orderId };
}

/* -------------------------------------------------------- reputação ----- */

const REVIEW_REVEAL_DAYS = 14;

function validateReview({ rating, comment } = {}) {
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) return { error: 'Escolha de 1 a 5 estrelas.' };
  const c = String(comment || '').trim().slice(0, 1000);
  if (r <= 2 && c.length < 10) return { error: 'Conte em poucas palavras o que deu errado.' };
  return { value: { rating: r, comment: c } };
}

async function recomputeSellerRating(db, sellerKey, now) {
  const snap = await db.collection('market_reviews')
    .where('seller_key', '==', sellerKey).where('visible', '==', true).get();
  const notas = snap.docs.map((d) => d.data()).filter((r) => r.author_role === 'buyer').map((r) => r.rating);
  const count = notas.length;
  const avg = count ? Math.round((notas.reduce((n, x) => n + x, 0) / count) * 10) / 10 : 0;
  await db.collection('market_sellers').doc(sellerKey).set({ rating_avg: avg, rating_count: count, updated_at: new Date(now) }, { merge: true });
  const listings = await db.collection('market_listings').where('seller_key', '==', sellerKey).get();
  for (let i = 0; i < listings.docs.length; i += 400) {
    const b = db.batch();
    listings.docs.slice(i, i + 400).forEach((d) => b.update(d.ref, { seller_rating_avg: avg, seller_rating_count: count }));
    // eslint-disable-next-line no-await-in-loop
    await b.commit();
  }
  return { avg, count };
}

async function submitReview(ctx, actor, data = {}) {
  const { db, now = Date.now() } = ctx;
  const orderId = texto(data.orderId, 64);
  const snap = await db.collection('market_orders').doc(orderId).get();
  if (!snap.exists) fail('not-found', 'Pedido não encontrado.');
  const order = snap.data();
  if (order.status !== S.COMPLETED) fail('failed-precondition', 'Avalie depois de o pedido ser concluído.');
  const role = order.buyer_uid === actor.uid ? 'buyer'
    : (await operatorUids(db, order.seller_key)).includes(actor.uid) ? 'seller' : null;
  if (!role) fail('permission-denied', 'Este pedido não é seu.');
  const v = validateReview(data);
  if (v.error) fail('invalid-argument', v.error);

  const mineRef = db.collection('market_reviews').doc(`${orderId}_${role}`);
  const otherRef = db.collection('market_reviews').doc(`${orderId}_${role === 'buyer' ? 'seller' : 'buyer'}`);
  const revealed = await db.runTransaction(async (tx) => {
    const [mine, other] = await tx.getAll(mineRef, otherRef);
    if (mine.exists) fail('already-exists', 'Você já avaliou este pedido.');
    const visible = other.exists;
    tx.set(mineRef, {
      order_id: orderId, order_code: order.code, author_uid: actor.uid, author_role: role,
      author_name: role === 'buyer' ? order.buyer_name : order.seller_name,
      seller_key: order.seller_key, target_uid: role === 'seller' ? order.buyer_uid : null,
      listing_title: (order.items && order.items[0] && order.items[0].title) || '',
      rating: v.value.rating, comment: v.value.comment, visible, created_at_ms: now, created_at: new Date(now),
    });
    if (visible) tx.update(otherRef, { visible: true });
    tx.update(snap.ref, { [`reviewed_by_${role}`]: true, updated_at: new Date(now) });
    return visible;
  });
  if (revealed) await recomputeSellerRating(db, order.seller_key, now);
  return { visible: revealed };
}

/* ----------------------------------------------------------- rotina ----- */

async function housekeeping(ctx) {
  const { db, now = Date.now(), logger } = ctx;
  const { settings } = await loadContext(db);
  const c = { ...ctx, now, settings };
  const feitos = { expired: 0, completed: 0, offers: 0, reviews: 0 };
  const run = async (orderId, action) => {
    try {
      await applyOrderAction(c, orderId, action, 'system', null, {});
      return true;
    } catch (err) {
      if (!(err instanceof MarketError)) throw err;
      return false;
    }
  };
  for (const st of [S.PLACED, S.ACCEPTED]) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('market_orders').where('status', '==', st).get();
    for (const d of snap.docs) {
      const dl = Number(d.data().deadline_at_ms) || 0;
      // eslint-disable-next-line no-await-in-loop
      if (dl && dl < now && await run(d.id, 'expire')) feitos.expired += 1;
    }
  }
  for (const st of [S.SHIPPED, S.READY, S.DELIVERED]) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('market_orders').where('status', '==', st).get();
    for (const d of snap.docs) {
      const at = Number(d.data().status_at_ms) || 0;
      const dias = st === S.SHIPPED ? Math.max(SHIPPED_AUTO_COMPLETE_DAYS, settings.auto_complete_days) : settings.auto_complete_days;
      // eslint-disable-next-line no-await-in-loop
      if (at && now - at > dias * 86400000 && await run(d.id, 'auto_complete')) feitos.completed += 1;
    }
  }
  for (const st of [O.PENDING, O.COUNTERED]) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('market_offers').where('status', '==', st).get();
    const vencidas = snap.docs.filter((d) => (Number(d.data().expires_at_ms) || 0) < now);
    for (const d of vencidas) {
      // eslint-disable-next-line no-await-in-loop
      await d.ref.update({ status: O.EXPIRED, updated_at: new Date(now) });
      const of = d.data();
      // eslint-disable-next-line no-await-in-loop
      await notify(db, [of.buyer_uid], {
        title: 'Oferta expirou',
        message: `A negociação por "${of.listing_title || 'um anúncio'}" passou do prazo sem resposta. Você pode fazer outra oferta.`,
        link: `/mercado/ofertas/${d.id}`,
      }, now);
      feitos.offers += 1;
    }
  }
  const ocultas = await db.collection('market_reviews').where('visible', '==', false).get();
  const sellers = new Set();
  for (const d of ocultas.docs) {
    if (now - (Number(d.data().created_at_ms) || now) >= REVIEW_REVEAL_DAYS * 86400000) {
      // eslint-disable-next-line no-await-in-loop
      await d.ref.update({ visible: true });
      sellers.add(d.data().seller_key);
      feitos.reviews += 1;
    }
  }
  for (const k of sellers) {
    // eslint-disable-next-line no-await-in-loop
    await recomputeSellerRating(db, k, now);
  }
  if (logger && (feitos.expired || feitos.completed || feitos.offers || feitos.reviews)) logger.info('Mercado: rotina.', feitos);
  return feitos;
}

/* -------------------------------------------------------- moderação ----- */

/** Termo proibido no anúncio que está no ar → sai do ar com o motivo. */
async function moderateListing(ctx, listingId, listing) {
  const { db, now = Date.now() } = ctx;
  if (!listing || !['active', 'sold_out'].includes(listing.status)) return null;
  const { settings } = await loadContext(db);
  const termo = findBannedTerm(`${listing.title || ''} ${listing.description || ''}`, settings.banned_terms);
  if (!termo) {
    // Texto corrigido e de volta ao ar: a marca da moderação automática sai.
    if (listing.moderation && listing.moderation.auto && listing.moderation.status === 'flagged') {
      await db.collection('market_listings').doc(listingId).update({ moderation: null });
    }
    return null;
  }
  await db.collection('market_listings').doc(listingId).update({
    status: 'paused',
    moderation: { status: 'flagged', reason: `Termo não permitido: "${termo}"`, auto: true, at_ms: now },
  });
  await notify(db, [...new Set([listing.created_by, ...(await operatorUids(db, listing.seller_key))])], {
    title: 'Anúncio pausado',
    message: `"${String(listing.title || '').slice(0, 60)}" tem um termo não permitido ("${termo}"). Edite e publique de novo.`,
    link: `/mercado/vender?aba=anuncios&como=${encodeURIComponent(listing.seller_key || '')}`,
  }, now);
  return termo;
}


/* ------------------------------------------------------ perguntas ----- */

/**
 * Pergunta nova → avisa quem vende; resposta → avisa quem perguntou. O
 * navegador não escreve aviso para outra pessoa sobre o Mercado.
 */
async function notifyQuestion(ctx, questionId, before, after) {
  const { db, now = Date.now() } = ctx;
  if (!after) return null;
  const link = `/mercado/anuncio/${after.listing_id}?ancora=perguntas`;
  const titulo = texto(after.listing_title, 80);
  if (!before && after.status === 'open') {
    const ops = await operatorUids(db, after.seller_key);
    const alvos = ops.filter((u) => u !== after.asker_uid);
    await notify(db, alvos, { title: 'Nova pergunta no Mercado', message: `Perguntaram sobre "${titulo}": ${texto(after.text, 140)}`, link }, now);
    return 'seller';
  }
  if (before && before.status !== 'answered' && after.status === 'answered' && after.asker_uid) {
    await notify(db, [after.asker_uid], { title: 'O vendedor respondeu', message: `Sua pergunta sobre "${titulo}" tem resposta.`, link }, now);
    return 'asker';
  }
  return null;
}

/* ------------------------------------------ alertas de quem compra ---- */

const { savedSearchMatches, savedSearchSince } = require('./marketSearch.js');

const ALERT_GAP_MS = 20 * 3600 * 1000;
const ALERT_SEARCHES_MAX = 2000;

/**
 * Buscas salvas com aviso ligado → UM aviso por dia por busca, só quando
 * chegou anúncio novo que bate com ela desde a última visita (ou o último
 * aviso). A conta é a mesma da tela (`marketSearch.js`, com paridade).
 */
async function savedSearchAlerts(ctx) {
  const { db, now = Date.now(), logger } = ctx;
  const { enabled } = await loadContext(db);
  if (!enabled) return { sent: 0 };
  const [lsSnap, bsSnap] = await Promise.all([
    db.collection('market_listings').where('status', '==', 'active').get(),
    db.collection('market_saved_searches').where('notify', '==', true).limit(ALERT_SEARCHES_MAX).get(),
  ]);
  const listings = lsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  let sent = 0;
  for (const d of bsSnap.docs) {
    const b = d.data();
    const ultimo = Number(b.last_alert_ms) || 0;
    if (!b.uid || now - ultimo < ALERT_GAP_MS) continue;
    const since = Math.max(savedSearchSince(b), ultimo);
    const novos = savedSearchMatches(listings, b.params || '', { since, uid: b.uid });
    if (!novos.length) continue;
    const n = novos.length;
    const primeiro = texto(novos[0].title, 60);
    // eslint-disable-next-line no-await-in-loop
    await notify(db, [b.uid], {
      title: `Novidade na sua busca "${texto(b.label, 40)}"`,
      message: n === 1 ? `Chegou "${primeiro}".` : `${n} anúncios novos, como "${primeiro}".`,
      link: `/mercado/buscas?abrir=${d.id}`,
    }, now);
    // eslint-disable-next-line no-await-in-loop
    await d.ref.update({ last_alert_ms: now });
    sent += 1;
  }
  if (logger && sent) logger.info('Mercado: avisos de buscas salvas.', { sent });
  return { sent };
}

/**
 * O preço baixou → avisa quem favoritou. Só quando fica abaixo do menor preço
 * já avisado (`price_alert_cents`): subir e descer de novo não vira spam.
 */
async function notifyPriceDrop(ctx, listingId, before, after) {
  const { db, now = Date.now() } = ctx;
  if (!before || !after || after.status !== 'active') return 0;
  const antes = Number(before.price_cents) || 0;
  const depois = Number(after.price_cents) || 0;
  if (!(depois > 0 && depois < antes)) return 0;
  const piso = Number(after.price_alert_cents) || 0;
  if (piso && depois >= piso) return 0;
  const { enabled } = await loadContext(db);
  if (!enabled) return 0;
  const [favs, ops] = await Promise.all([
    db.collection('market_favorites').where('listing_id', '==', listingId).get(),
    operatorUids(db, after.seller_key),
  ]);
  const alvos = favs.docs.map((f) => f.data().uid).filter((u) => u && !ops.includes(u));
  await db.collection('market_listings').doc(listingId).update({ price_alert_cents: depois });
  if (!alvos.length) return 0;
  const pct = Math.round(((antes - depois) / antes) * 100);
  const brl = (c) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
  await notify(db, alvos, {
    title: `Baixou ${pct}%: ${texto(after.title, 60)}`,
    message: `O anúncio que você favoritou foi de ${brl(antes)} para ${brl(depois)}.`,
    link: `/mercado/anuncio/${listingId}`,
  }, now);
  return alvos.length;
}

/* ------------------------------------------ o estoque único da arena -- */
//
// Um anúncio de ARENA pode apontar para um produto do estoque dela
// (`listing.source = { kind: 'arena_product', id }`, gravado só pelo servidor
// via `linkArenaProduct`). A partir daí o estoque é UM:
//  - o anúncio mostra `stock_qty − reservado` (pedidos abertos ainda não
//    pagos), refeito a cada mudança do produto (`syncArenaListing`);
//  - a SAÍDA no estoque da arena nasce quando o pagamento é confirmado
//    (venda de verdade, não intenção) e é desfeita se o pedido for cancelado.
// Produto sem controle de estoque (`stock_qty` vazio) não mexe na quantidade
// do anúncio: quem vende ajusta à mão, como antes.

const ARENA_SOURCE = 'arena_product';
const RESERVED_STATUSES = Object.freeze([S.PLACED, S.ACCEPTED, S.PAYMENT_REVIEW]);
const COL_INV_PRODUCTS = 'arena_inventory_products';
const COL_INV_EXITS = 'arena_inventory_exits';

function arenaProductIdOf(listing) {
  return listing && listing.source && listing.source.kind === ARENA_SOURCE ? listing.source.id || null : null;
}

/** "AAAA-MM-DD" no fuso de Brasília (a data que o estoque da arena usa). */
function diaEmBrasilia(ms) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** Unidades do produto presas em pedidos abertos e ainda não pagos. */
function reservedFor(orders, productId) {
  return (orders || [])
    .filter((o) => RESERVED_STATUSES.includes(o.status) && !o.arena_stock_applied)
    .reduce((n, o) => n + (o.items || [])
      .filter((i) => i.arena_product_id === productId)
      .reduce((m, i) => m + (Number(i.quantity) || 0), 0), 0);
}

/** O que o anúncio ligado precisa mudar para refletir o produto. `{}` = nada. */
function linkedListingPatch(listing, product, reserved = 0) {
  if (!product) {
    return ['active', 'sold_out'].includes(listing.status) ? { status: 'paused', source: null } : { source: null };
  }
  const stock = product.stock_qty == null || product.stock_qty === '' ? NaN : Number(product.stock_qty);
  const tracked = Number.isFinite(stock);
  // `source.tracked` diz à tela se a quantidade é do estoque (só leitura) ou de quem vende.
  const patch = Boolean(listing.source && listing.source.tracked) === tracked ? {} : { source: { ...listing.source, tracked } };
  if (!tracked) return patch;
  const q = Math.max(0, Math.floor(stock - reserved));
  if (q !== Number(listing.quantity)) patch.quantity = q;
  if (listing.status === 'active' && q <= 0) patch.status = 'sold_out';
  if (listing.status === 'sold_out' && q > 0) patch.status = 'active';
  return patch;
}

/** Leituras da transação do pedido (antes de qualquer escrita). */
async function arenaStockReads(db, tx, orderId, order, to) {
  const arena = parseSellerKey(order.seller_key);
  if (!arena || arena.type !== 'arena') return null;
  if (to === S.PAID && !order.arena_stock_applied) {
    const linhas = (order.items || []).filter((i) => i.arena_product_id);
    if (!linhas.length) return null;
    const ids = [...new Set(linhas.map((i) => i.arena_product_id))];
    const snaps = await tx.getAll(...ids.map((id) => db.collection(COL_INV_PRODUCTS).doc(id)));
    const produtos = new Map(snaps.filter((s) => s.exists && s.data().arena_id === arena.id).map((s) => [s.id, s.data()]));
    return { tipo: 'saida', arenaId: arena.id, linhas, produtos };
  }
  if (devolveEstoque(order, to) && order.arena_stock_applied) {
    const saidas = await tx.get(db.collection(COL_INV_EXITS).where('market_order_id', '==', orderId));
    const doc = saidas.docs.filter((d) => d.data().arena_id === arena.id);
    const ids = [...new Set(doc.map((d) => d.data().product_id))];
    const snaps = ids.length ? await tx.getAll(...ids.map((id) => db.collection(COL_INV_PRODUCTS).doc(id))) : [];
    const produtos = new Map(snaps.filter((s) => s.exists).map((s) => [s.id, s.data()]));
    return { tipo: 'devolve', arenaId: arena.id, saidas: doc, produtos };
  }
  return null;
}

/** Escritas no estoque da arena; devolve os campos a somar no pedido. */
function arenaStockWrites(db, tx, order, orderId, leitura, { now, actorUid }) {
  if (!leitura) return {};
  const porProduto = new Map();
  if (leitura.tipo === 'saida') {
    leitura.linhas.forEach((i) => {
      if (!leitura.produtos.has(i.arena_product_id)) return; // produto saiu do estoque: nada a baixar
      const q = Number(i.quantity) || 0;
      const unit = Math.round(Number(i.unit_price_cents) || 0) / 100;
      tx.set(db.collection(COL_INV_EXITS).doc(), {
        product_id: i.arena_product_id, arena_id: leitura.arenaId, date: diaEmBrasilia(now),
        quantity: q, exit_type: 'sale', unit_price: unit, total_price: Math.round(q * unit * 100) / 100,
        reason: `Pedido do Mercado ${order.code || ''}`.trim(), market_order_id: orderId, channel: 'mercado',
        created_by: actorUid || null, created_at: new Date(now),
      });
      porProduto.set(i.arena_product_id, (porProduto.get(i.arena_product_id) || 0) - q);
    });
    if (!porProduto.size) return {};
  } else {
    leitura.saidas.forEach((d) => {
      const x = d.data();
      tx.delete(d.ref);
      porProduto.set(x.product_id, (porProduto.get(x.product_id) || 0) + (Number(x.quantity) || 0));
    });
  }
  porProduto.forEach((delta, pid) => {
    const p = leitura.produtos.get(pid);
    if (!p || p.stock_qty == null) return;
    tx.update(db.collection(COL_INV_PRODUCTS).doc(pid), { stock_qty: Number(p.stock_qty) + delta, updated_at: new Date(now) });
  });
  return { arena_stock_applied: leitura.tipo === 'saida' };
}

/**
 * Gatilho do produto do estoque: refaz a quantidade do anúncio ligado.
 * Confere os DOIS lados do vínculo — o campo no produto é escrito pela arena
 * e, sozinho, não prova nada.
 */
async function syncArenaListing(ctx, productId, before, after) {
  const { db, now = Date.now() } = ctx;
  const base = after || before;
  const listingId = base && base.market_listing_id;
  if (!listingId) return null;
  const ref = db.collection('market_listings').doc(listingId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const l = snap.data();
    if (arenaProductIdOf(l) !== productId || l.seller_key !== `arena_${base.arena_id}`) return null;
    let reserved = 0;
    if (after) {
      const os = await tx.get(db.collection('market_orders').where('listing_ids', 'array-contains', listingId));
      reserved = reservedFor(os.docs.map((d) => d.data()), productId);
    }
    const patch = linkedListingPatch(l, after, reserved);
    if (!Object.keys(patch).length) return null;
    tx.update(ref, { ...patch, updated_at: new Date(now) });
    return patch;
  });
}

/** Liga (ou desliga, com `productId` vazio) o anúncio da arena a um produto do estoque. */
async function linkArenaProduct(ctx, actor, data = {}) {
  const { db, now = Date.now() } = ctx;
  const { enabled } = await loadContext(db);
  if (!enabled) fail('failed-precondition', 'O Mercado está fechado no momento.');
  const listingId = texto(data.listingId, 64);
  const productId = data.productId ? texto(data.productId, 64) : null;
  if (!listingId) fail('invalid-argument', 'Anúncio inválido.');
  const lRef = db.collection('market_listings').doc(listingId);
  const lSnap = await lRef.get();
  if (!lSnap.exists) fail('not-found', 'Anúncio não encontrado.');
  const arena = parseSellerKey(lSnap.data().seller_key);
  if (!arena || arena.type !== 'arena') fail('failed-precondition', 'Só anúncio de arena se liga ao estoque da arena.');
  if (!(await operatorUids(db, lSnap.data().seller_key)).includes(actor.uid)) fail('permission-denied', 'Só quem gere a arena pode fazer isso.');

  await db.runTransaction(async (tx) => {
    const l = (await tx.get(lRef)).data();
    const anterior = arenaProductIdOf(l);
    const prodRef = productId ? db.collection(COL_INV_PRODUCTS).doc(productId) : null;
    const antRef = anterior && anterior !== productId ? db.collection(COL_INV_PRODUCTS).doc(anterior) : null;
    const prodSnap = prodRef ? await tx.get(prodRef) : null;
    const antSnap = antRef ? await tx.get(antRef) : null;
    if (prodRef) {
      if (!prodSnap.exists || prodSnap.data().arena_id !== arena.id) fail('failed-precondition', 'Este produto não é do estoque desta arena.');
      const outro = prodSnap.data().market_listing_id;
      if (outro && outro !== listingId) {
        const outroSnap = await tx.get(db.collection('market_listings').doc(outro));
        if (outroSnap.exists && arenaProductIdOf(outroSnap.data()) === productId && outroSnap.data().status !== 'closed') {
          fail('already-exists', 'Este produto já está ligado a outro anúncio do Mercado.');
        }
      }
      tx.update(prodRef, { market_listing_id: listingId, updated_at: new Date(now) });
    }
    if (antSnap && antSnap.exists && antSnap.data().market_listing_id === listingId) {
      tx.update(antRef, { market_listing_id: null, updated_at: new Date(now) });
    }
    tx.update(lRef, { source: productId ? { kind: ARENA_SOURCE, id: productId } : null, updated_at: new Date(now) });
  });
  if (productId) {
    const p = await db.collection(COL_INV_PRODUCTS).doc(productId).get();
    await syncArenaListing(ctx, productId, null, p.data());
  }
  return { ok: true };
}

/* ------------------------------------------------------ vale-presente -- */

/**
 * O vale-presente da loja: COMPRAR (vira um pedido já aceito, pago pelo Pix
 * do vendedor; o vale nasce quando o vendedor confirma o pagamento), RESGATAR
 * (o código passa para a conta de quem digitou), EMITIR (a loja dá um vale de
 * prêmio ou cortesia) e CANCELAR (a loja desfaz um vale emitido por engano).
 */
async function giftCardAction(ctx, actor, data = {}) {
  const { db, now = Date.now() } = ctx;
  const { enabled, settings } = await loadContext(db);
  if (!enabled) fail('failed-precondition', 'O Mercado está fechado no momento.');
  const action = texto(data.action, 16);
  if (action === 'buy') return buyGiftCard({ ...ctx, now, settings }, actor, data);
  if (action === 'claim') return claimGiftCard({ ...ctx, now }, actor, data);
  if (action === 'issue') return issueGiftCard({ ...ctx, now }, actor, data);
  if (action === 'cancel') return cancelGiftCard({ ...ctx, now }, actor, data);
  fail('invalid-argument', 'Ação desconhecida.');
  return null;
}

async function buyGiftCard(ctx, actor, data) {
  const { db, now, settings } = ctx;
  if (!settings.orders_enabled) fail('failed-precondition', 'As compras no Mercado estão fechadas no momento.');
  const sellerKey = texto(data.seller_key, 120);
  if (!parseSellerKey(sellerKey)) fail('invalid-argument', 'Loja inválida.');
  const ops = await operatorUids(db, sellerKey);
  if (ops.includes(actor.uid)) fail('failed-precondition', 'Você não pode comprar de você mesmo.');
  const valor = Math.round(Number(data.amount_cents));
  const gift = {
    recipient_name: texto(data.recipient_name, promo.GIFT_CARD_LIMITS.name),
    from_name: texto(data.from_name, promo.GIFT_CARD_LIMITS.name),
    message: texto(data.message, promo.GIFT_CARD_LIMITS.message),
  };
  const nome = await buyerName(db, actor.uid);
  const sellerRef = db.collection('market_sellers').doc(sellerKey);
  const res = await db.runTransaction(async (tx) => {
    const [sellerSnap, privSnap] = await tx.getAll(sellerRef, sellerRef.collection('private').doc('data'));
    if (!sellerSnap.exists || sellerSnap.data().status !== 'active') fail('failed-precondition', 'Esta loja não está vendendo agora.');
    const seller = sellerSnap.data();
    const cfg = promo.giftCardConfig(seller);
    const problema = promo.giftCardAmountProblem(cfg, valor);
    if (problema) fail('failed-precondition', problema);
    const p = privSnap.exists ? privSnap.data() : {};
    if (!p.pix_key || !p.pix_key_type) fail('failed-precondition', 'A loja ainda não cadastrou o Pix. Tente mais tarde.');
    const orderRef = db.collection('market_orders').doc();
    const order = {
      code: orderCode(), source: 'gift_card', status: S.ACCEPTED,
      buyer_uid: actor.uid, buyer_name: nome,
      seller_key: sellerKey, seller_name: seller.display_name || '', seller_type: seller.seller_type || '',
      seller_manager_uids: ops,
      items: [{
        kind: 'gift_card', listing_id: '', title: `Vale-presente ${promo.formatBRL(valor)}`, cover_url: seller.logo_url || '',
        condition: '', unit_price_cents: valor, quantity: 1, gift: { ...gift, validity_months: cfg.validity_months },
      }],
      item_count: 1, listing_ids: [],
      fulfillment: 'digital', buyer_note: '', shipping_cents: 0, shipping_to_agree: false,
      subtotal_cents: valor, total_cents: valor, discount_cents: 0, gift_card_cents: 0, platform_fee_cents: 0,
      payment: { pix_key_type: p.pix_key_type, pix_key: p.pix_key, receiver_name: p.receiver_name || '', instructions: p.instructions || '' },
      shipping_visible: false, placed_at_ms: now, accepted_at_ms: now, status_at_ms: now,
      deadline_at_ms: now + settings.payment_hours * 3600000,
      created_at: new Date(now), updated_at: new Date(now),
    };
    tx.set(orderRef, order);
    tx.set(orderRef.collection('events').doc(), { action: 'gift_card_bought', by_role: 'buyer', by_uid: actor.uid, at_ms: now });
    return { id: orderRef.id, code: order.code, seller_name: order.seller_name };
  });
  await notify(db, ops, {
    title: `Vale-presente vendido · ${res.code}`,
    message: `${nome} comprou um vale-presente de ${promo.formatBRL(valor)}. Confira o Pix e confirme o pagamento.`,
    link: `/mercado/vendas/${res.id}`,
  }, now);
  return res;
}

/** Auditoria no formato do cliente (`createAuditLog`). */
async function audit(db, actor, now, action, label, details) {
  await db.collection('audit_logs').add({
    log_number: Number(`${now}${Math.floor(Math.random() * 900 + 100)}`),
    action, action_label: label, actor_id: actor.uid, actor_name: actor.name || actor.uid, actor_email: '',
    tournament_id: null, details, created_at: new Date(now),
  });
}

async function findGiftCardByCode(db, codigo) {
  const code = promo.normalizeGiftCardCode(codigo);
  if (!code) fail('invalid-argument', 'Confira o código: são 12 letras e números depois de PRK.');
  const snap = await db.collection('market_gift_cards').where('code', '==', code).limit(1).get();
  if (snap.empty) fail('not-found', 'Não achamos um vale com este código. Confira as letras e os números.');
  return snap.docs[0].ref;
}

async function claimGiftCard(ctx, actor, data) {
  const { db, now } = ctx;
  const ref = await findGiftCardByCode(db, data.code);
  const res = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const card = snap.data();
    if (card.status === promo.GIFT_CARD_STATUS.CANCELLED) fail('failed-precondition', 'Este vale foi cancelado pela loja.');
    if (card.expires_at_ms && now > card.expires_at_ms) fail('failed-precondition', 'Este vale venceu.');
    if (card.holder_uid === actor.uid && card.claimed_at_ms) return { id: ref.id, already: true, card };
    if (card.claimed_at_ms && card.holder_uid && card.holder_uid !== actor.uid) fail('failed-precondition', 'Este vale já foi resgatado por outra conta.');
    tx.update(ref, { holder_uid: actor.uid, claimed_at_ms: now, updated_at: new Date(now) });
    return { id: ref.id, already: false, card };
  });
  const { card } = res;
  if (!res.already && card.buyer_uid && card.buyer_uid !== actor.uid) {
    const nome = await buyerName(db, actor.uid);
    await notify(db, [card.buyer_uid], {
      title: 'Seu presente chegou',
      message: `${nome} resgatou o vale-presente de ${promo.formatBRL(card.initial_cents)} de ${card.seller_name || 'uma loja'}.`,
      link: '/mercado/vales',
    }, now);
  }
  return { id: res.id, already: res.already, seller_key: card.seller_key, seller_name: card.seller_name || '', balance_cents: Number(card.balance_cents) || 0 };
}

async function issueGiftCard(ctx, actor, data) {
  const { db, now } = ctx;
  const sellerKey = texto(data.seller_key, 120);
  const ops = await operatorUids(db, sellerKey);
  if (!ops.includes(actor.uid)) fail('permission-denied', 'Só quem vende por esta loja emite vale.');
  const sellerSnap = await db.collection('market_sellers').doc(sellerKey).get();
  if (!sellerSnap.exists || sellerSnap.data().status !== 'active') fail('failed-precondition', 'A loja precisa estar ativa para emitir vale.');
  const valor = Math.round(Number(data.amount_cents));
  if (!(valor >= promo.GIFT_CARD_LIMITS.minCents && valor <= promo.GIFT_CARD_LIMITS.maxCents)) {
    fail('invalid-argument', `Escolha um valor entre ${promo.formatBRL(promo.GIFT_CARD_LIMITS.minCents)} e ${promo.formatBRL(promo.GIFT_CARD_LIMITS.maxCents)}.`);
  }
  const cfg = promo.giftCardConfig(sellerSnap.data());
  const ref = db.collection('market_gift_cards').doc();
  const card = {
    code: promo.giftCardCode(), seller_key: sellerKey, seller_name: sellerSnap.data().display_name || '',
    initial_cents: valor, balance_cents: valor, status: promo.GIFT_CARD_STATUS.ACTIVE,
    buyer_uid: null, holder_uid: null,
    recipient_name: texto(data.recipient_name, promo.GIFT_CARD_LIMITS.name),
    from_name: texto(data.from_name, promo.GIFT_CARD_LIMITS.name) || sellerSnap.data().display_name || '',
    message: texto(data.message, promo.GIFT_CARD_LIMITS.message),
    note: texto(data.note, 140),
    source: 'issued', order_id: null, issued_by: actor.uid,
    issued_at_ms: now, expires_at_ms: promo.giftCardExpiry(now, cfg.validity_months),
    created_at: new Date(now), updated_at: new Date(now),
  };
  await ref.set(card);
  await audit(db, actor, now, 'market_gift_card_issued', 'Vale-presente emitido pela loja', {
    gift_card_id: ref.id, seller_key: sellerKey, amount_cents: valor, note: card.note,
  });
  return { id: ref.id, code: card.code, expires_at_ms: card.expires_at_ms };
}

async function cancelGiftCard(ctx, actor, data) {
  const { db, now } = ctx;
  const ref = db.collection('market_gift_cards').doc(texto(data.id, 64) || 'x');
  const snap = await ref.get();
  if (!snap.exists) fail('not-found', 'Vale não encontrado.');
  const card = snap.data();
  const ops = await operatorUids(db, card.seller_key);
  if (!ops.includes(actor.uid)) fail('permission-denied', 'Só a loja que emitiu cancela o vale.');
  if (card.source === 'order') fail('failed-precondition', 'Vale comprado pelo Mercado só é desfeito cancelando o pedido.');
  if (card.status === promo.GIFT_CARD_STATUS.CANCELLED) return { ok: true };
  const motivo = texto(data.reason, 200);
  if (motivo.length < 3) fail('invalid-argument', 'Conte o motivo em poucas palavras.');
  await ref.update({ status: promo.GIFT_CARD_STATUS.CANCELLED, cancel_reason: motivo, updated_at: new Date(now) });
  await audit(db, actor, now, 'market_gift_card_cancelled', 'Vale-presente cancelado pela loja', {
    gift_card_id: ref.id, seller_key: card.seller_key, reason: motivo, balance_cents: card.balance_cents,
  });
  if (card.holder_uid) {
    await notify(db, [card.holder_uid], {
      title: 'Vale-presente cancelado',
      message: `${card.seller_name || 'A loja'} cancelou o vale ${promo.maskGiftCardCode(card.code)}: ${motivo}`,
      link: '/mercado/vales',
    }, now);
  }
  return { ok: true };
}

module.exports = {
  ORDER_ACTIONS, OFFER_ACTIONS, OFFER_RULES, RESTOCK_ON, DEFAULT_BANNED_TERMS,
  checkOrderAction, applyOfferAction, validateOfferAmount, validateReview, findBannedTerm,
  serverSettings, commonFulfillment, groupShipping, validatePlaceRequest, cleanAddress,
  MarketError, placeOrders, orderAction, applyOrderAction, offerAction, submitReview,
  housekeeping, moderateListing, recomputeSellerRating, operatorUids, notifyQuestion,
  reservedFor, linkedListingPatch, syncArenaListing, linkArenaProduct,
  savedSearchAlerts, notifyPriceDrop,
  hasBoughtFrom, applyPromotions, giftCardAction,
};
