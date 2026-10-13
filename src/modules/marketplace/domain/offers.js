/**
 * MERCADO — ofertas e contrapropostas (lógica pura).
 *
 * O comprador oferece um valor; o vendedor aceita, recusa ou contrapropõe; e
 * assim por até `max_rounds` rodadas. Quando um lado aceita o valor do outro,
 * o SERVIDOR cria o pedido já aceito, com aquele preço (não há um segundo
 * passo em que a unidade poderia ser vendida a outra pessoa).
 *
 * ⚠️ Cópia no servidor (`functions/marketplace.js`), com teste de paridade.
 */
import { OFFER_STATUS as O } from './constants.js';

export const OFFER_RULES = Object.freeze({
  maxRounds: 4,
  ttlHours: 72,
  minFractionOfPrice: 0.3,
});

/** O comprador pode oferecer este valor por este anúncio? */
export function validateOfferAmount(listing, amountCents, { minFraction = OFFER_RULES.minFractionOfPrice } = {}) {
  const amount = Math.round(Number(amountCents));
  if (!listing?.accepts_offers) return 'Este anúncio não aceita ofertas.';
  if (!(amount > 0)) return 'Diga quanto você oferece.';
  if (amount >= listing.price_cents) return 'A oferta precisa ser menor que o preço. Pelo preço, é só comprar.';
  if (amount < Math.ceil(listing.price_cents * minFraction)) return 'Oferta muito abaixo do preço anunciado.';
  return null;
}

/** Ações por papel e estado. `pending` = a vez é do vendedor; `countered` = do comprador. */
export const OFFER_ACTIONS = Object.freeze({
  accept: { from: [O.PENDING], role: 'seller', to: O.ACCEPTED, label: 'Aceitar oferta' },
  decline: { from: [O.PENDING], role: 'seller', to: O.DECLINED, label: 'Recusar' },
  counter: { from: [O.PENDING], role: 'seller', to: O.COUNTERED, label: 'Contrapropor' },
  accept_counter: { from: [O.COUNTERED], role: 'buyer', to: O.ACCEPTED, label: 'Aceitar contraproposta' },
  counter_back: { from: [O.COUNTERED], role: 'buyer', to: O.PENDING, label: 'Fazer nova oferta' },
  withdraw: { from: [O.PENDING, O.COUNTERED], role: 'buyer', to: O.WITHDRAWN, label: 'Desistir' },
});

/**
 * Aplica a ação. Devolve o novo estado da oferta (sem tocar no original) ou o
 * erro. `amountCents` só vale para as contrapropostas.
 */
export function applyOfferAction(offer, action, role, { amountCents, now = Date.now(), maxRounds = OFFER_RULES.maxRounds, ttlHours = OFFER_RULES.ttlHours } = {}) {
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

function lastAmount(offer, by) {
  const h = [...(offer.history || [])].reverse().find((x) => x.by === by && x.amount_cents);
  return h ? h.amount_cents : (by === 'buyer' ? offer.amount_cents : null);
}

/** Botões da negociação para quem vê. */
export function offerActionsFor(offer, role, { now = Date.now(), maxRounds = OFFER_RULES.maxRounds } = {}) {
  if (!offer || !role) return [];
  if (Number(offer.expires_at_ms) && now > Number(offer.expires_at_ms)) return [];
  return Object.entries(OFFER_ACTIONS)
    .filter(([, a]) => a.role === role && a.from.includes(offer.status))
    .filter(([id]) => !((id === 'counter' || id === 'counter_back') && (offer.round || 1) >= maxRounds))
    .map(([id, a]) => ({ id, label: a.label }));
}

/** Uma oferta nova (o documento, sem os campos de servidor). */
export function newOffer(listing, buyer, amountCents, { fulfillment, message = '', now = Date.now(), ttlHours = OFFER_RULES.ttlHours } = {}) {
  return {
    listing_id: listing.id,
    listing_title: listing.title,
    seller_key: listing.seller_key,
    seller_uid: listing.seller_uid,
    buyer_uid: buyer.uid,
    buyer_name: buyer.name || '',
    list_price_cents: listing.price_cents,
    amount_cents: Math.round(amountCents),
    fulfillment: fulfillment || (listing.fulfillment || [])[0] || 'meetup',
    message: String(message || '').slice(0, 300),
    status: O.PENDING,
    round: 1,
    history: [{ by: 'buyer', amount_cents: Math.round(amountCents), at_ms: now }],
    expires_at_ms: now + ttlHours * 3600000,
  };
}
