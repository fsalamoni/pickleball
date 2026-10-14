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
  open_dispute: { from: [S.PAID, S.SHIPPED, S.READY, S.DELIVERED], to: S.DISPUTED, roles: ['buyer'], needsReason: true },
  resolve_buyer: { from: [S.DISPUTED], to: S.CANCELLED, roles: ['admin'], needsReason: true },
  resolve_seller: { from: [S.DISPUTED], to: S.COMPLETED, roles: ['admin'], needsReason: true },
  admin_cancel: { from: [S.PLACED, S.ACCEPTED, S.PAYMENT_REVIEW, S.PAID, S.SHIPPED, S.READY, S.DELIVERED], to: S.CANCELLED, roles: ['admin'], needsReason: true },
  expire: { from: [S.PLACED, S.ACCEPTED], to: S.EXPIRED, roles: ['system'] },
  auto_complete: { from: [S.SHIPPED, S.READY, S.DELIVERED], to: S.COMPLETED, roles: ['system'] },
});

const RESTOCK_ON = Object.freeze([S.CANCELLED, S.EXPIRED]);

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
    out.push({ seller_key: g.seller_key, fulfillment: g.fulfillment, items: its, buyer_note: texto(g.buyer_note, 300) });
  }
  const needsAddress = out.some((g) => g.fulfillment === 'shipping');
  const address = needsAddress ? cleanAddress(data.shipping) : null;
  if (needsAddress && !address) return { error: 'Preencha o endereço de entrega.' };
  return { groups: out, address };
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
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await db.runTransaction(async (tx) => {
        const sellerRef = db.collection('market_sellers').doc(g.seller_key);
        const refs = g.items.map((i) => db.collection('market_listings').doc(i.listing_id));
        const [sellerSnap, ...snaps] = await tx.getAll(sellerRef, ...refs);
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
          unit_price_cents: l.price_cents, quantity: g.items[k].quantity,
        }));
        const subtotal = items.reduce((n, i) => n + i.unit_price_cents * i.quantity, 0);
        const ship = groupShipping(listings, g.fulfillment);
        const orderRef = db.collection('market_orders').doc();
        const order = {
          code: orderCode(), source: 'cart', status: S.PLACED,
          buyer_uid: uid, buyer_name: name,
          seller_key: g.seller_key, seller_name: seller.display_name || '', seller_type: seller.seller_type || '',
          seller_manager_uids: ops, items, item_count: items.reduce((n, i) => n + i.quantity, 0),
          listing_ids: items.map((i) => i.listing_id),
          fulfillment: g.fulfillment, buyer_note: g.buyer_note, ...ship,
          subtotal_cents: subtotal, total_cents: subtotal + ship.shipping_cents,
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

function restockUpdates(order, snaps, now) {
  return snaps.map((s, k) => {
    if (!s.exists) return null;
    const l = s.data();
    const q = order.items[k].quantity;
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
  confirm_payment: (o) => ['Pagamento confirmado', `${o.seller_name} confirmou o pagamento do pedido ${o.code}.`, 'buyer'],
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

    const to = chk.to;
    const upd = { status: to, status_at_ms: now, updated_at: new Date(now) };
    // Leituras antes de qualquer escrita (regra da transação).
    const listingSnaps = RESTOCK_ON.includes(to)
      ? await tx.getAll(...order.items.map((i) => db.collection('market_listings').doc(i.listing_id)))
      : [];
    let privSnap = null;
    if (action === 'accept') privSnap = await tx.get(db.collection('market_sellers').doc(order.seller_key).collection('private').doc('data'));

    if (action === 'accept') {
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
    } else if (action === 'ship') {
      upd.shipped_at_ms = now;
      upd.tracking = { code: extra.tracking_code || '', carrier: extra.carrier || '' };
    } else if (action === 'ready') {
      upd.ready_at_ms = now;
    } else if (action === 'delivered') {
      upd.delivered_at_ms = now;
    } else if (action === 'open_dispute') {
      const since = Number(order.delivered_at_ms || order.shipped_at_ms || order.ready_at_ms || order.paid_at_ms || 0);
      if (since && now - since > settings.dispute_window_days * 86400000) fail('failed-precondition', 'O prazo para relatar problema neste pedido acabou.');
      const dRef = db.collection('market_disputes').doc(orderId);
      tx.set(dRef, {
        order_id: orderId, order_code: order.code, buyer_uid: order.buyer_uid, seller_key: order.seller_key,
        reason: extra.reason, status: 'open', previous_status: order.status, created_at: new Date(now), created_at_ms: now,
      });
      upd.dispute_id = orderId;
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
      restockUpdates(order, listingSnaps, now).forEach((r) => tx.update(r.ref, r.data));
    }
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
    const sellerUids = o.seller_manager_uids || [];
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

async function createOrderFromOffer(ctx, tx, offer, listingSnap, privSnap, sellerSnap) {
  const { db, now, settings } = ctx;
  const l = listingSnap.data();
  if (l.status !== 'active' || (Number(l.quantity) || 0) < 1) fail('failed-precondition', 'O produto esgotou. A oferta foi encerrada.');
  const p = privSnap.exists ? privSnap.data() : {};
  if (!p.pix_key) fail('failed-precondition', 'O vendedor ainda não cadastrou o Pix. Ele foi avisado.');
  const seller = sellerSnap.exists ? sellerSnap.data() : {};
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
    items: [{ listing_id: listingSnap.id, title: l.title, cover_url: coverUrl(l), condition: l.condition || '', unit_price_cents: offer.amount_cents, quantity: 1 }],
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
  await notify(db, toBuyer ? [o.buyer_uid] : (o.seller_manager_uids || []), { title, message, link }, now);
  if (res.orderId && !toBuyer) {
    await notify(db, o.seller_manager_uids || [], { title: 'Venda combinada', message: `Pedido criado pelo valor combinado de "${o.listing_title}".`, link: `/mercado/vendas/${res.orderId}` }, now);
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
      // eslint-disable-next-line no-await-in-loop
      if (at && now - at > settings.auto_complete_days * 86400000 && await run(d.id, 'auto_complete')) feitos.completed += 1;
    }
  }
  for (const st of [O.PENDING, O.COUNTERED]) {
    // eslint-disable-next-line no-await-in-loop
    const snap = await db.collection('market_offers').where('status', '==', st).get();
    const vencidas = snap.docs.filter((d) => (Number(d.data().expires_at_ms) || 0) < now);
    for (const d of vencidas) {
      // eslint-disable-next-line no-await-in-loop
      await d.ref.update({ status: O.EXPIRED, updated_at: new Date(now) });
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
  if (!termo) return null;
  await db.collection('market_listings').doc(listingId).update({
    status: 'paused',
    moderation: { status: 'flagged', reason: `Termo não permitido: "${termo}"`, auto: true, at_ms: now },
  });
  await notify(db, [listing.created_by], {
    title: 'Anúncio pausado',
    message: `"${String(listing.title || '').slice(0, 60)}" tem um termo não permitido ("${termo}"). Edite e publique de novo.`,
    link: '/mercado/vender',
  }, now);
  return termo;
}

module.exports = {
  ORDER_ACTIONS, OFFER_ACTIONS, OFFER_RULES, RESTOCK_ON, DEFAULT_BANNED_TERMS,
  checkOrderAction, applyOfferAction, validateOfferAmount, validateReview, findBannedTerm,
  serverSettings, commonFulfillment, groupShipping, validatePlaceRequest, cleanAddress,
  MarketError, placeOrders, orderAction, applyOrderAction, offerAction, submitReview,
  housekeeping, moderateListing, recomputeSellerRating, operatorUids,
};
