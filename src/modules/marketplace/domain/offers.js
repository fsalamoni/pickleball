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
import { t, tk } from '@/core/i18n';

export const OFFER_RULES = Object.freeze({
  maxRounds: 4,
  ttlHours: 72,
  minFractionOfPrice: 0.3,
});

/** O comprador pode oferecer este valor por este anúncio? */
export function validateOfferAmount(listing, amountCents, { minFraction = OFFER_RULES.minFractionOfPrice } = {}) {
  const amount = Math.round(Number(amountCents));
  if (!listing?.accepts_offers) return t('Este anúncio não aceita ofertas.');
  if (!(amount > 0)) return t('Diga quanto você oferece.');
  if (amount >= listing.price_cents) return t('A oferta precisa ser menor que o preço. Pelo preço, é só comprar.');
  if (amount < Math.ceil(listing.price_cents * minFraction)) return t('Oferta muito abaixo do preço anunciado.');
  return null;
}

/**
 * O vendedor pode responder sozinho: a partir de `offer_auto_accept_cents`
 * aceita na hora; abaixo de `offer_auto_decline_cents` recusa na hora; no meio,
 * espera a pessoa. Os limites nunca chegam ao comprador.
 * ⚠️ Cópia no servidor (paridade).
 */
export function autoOfferOutcome(listing, amountCents) {
  const amount = Math.round(Number(amountCents)) || 0;
  const aceita = Number(listing?.offer_auto_accept_cents) || 0;
  const recusa = Number(listing?.offer_auto_decline_cents) || 0;
  if (aceita > 0 && amount >= aceita) return 'accept';
  if (recusa > 0 && amount < recusa) return 'decline';
  return null;
}

/** Ações por papel e estado. `pending` = a vez é do vendedor; `countered` = do comprador. */
export const OFFER_ACTIONS = Object.freeze({
  accept: { from: [O.PENDING], role: 'seller', to: O.ACCEPTED, label: tk('Aceitar oferta') },
  decline: { from: [O.PENDING], role: 'seller', to: O.DECLINED, label: tk('Recusar') },
  counter: { from: [O.PENDING], role: 'seller', to: O.COUNTERED, label: tk('Contrapropor') },
  accept_counter: { from: [O.COUNTERED], role: 'buyer', to: O.ACCEPTED, label: tk('Aceitar contraproposta') },
  counter_back: { from: [O.COUNTERED], role: 'buyer', to: O.PENDING, label: tk('Fazer nova oferta') },
  withdraw: { from: [O.PENDING, O.COUNTERED], role: 'buyer', to: O.WITHDRAWN, label: tk('Desistir') },
});

/**
 * Aplica a ação. Devolve o novo estado da oferta (sem tocar no original) ou o
 * erro. `amountCents` só vale para as contrapropostas.
 */
export function applyOfferAction(offer, action, role, { amountCents, now = Date.now(), maxRounds = OFFER_RULES.maxRounds, ttlHours = OFFER_RULES.ttlHours } = {}) {
  const a = OFFER_ACTIONS[action];
  if (!a) return { error: t('Ação desconhecida.') };
  if (!offer) return { error: t('Oferta não encontrada.') };
  if (a.role !== role) return { error: t('Não é a sua vez nesta negociação.') };
  if (!a.from.includes(offer.status)) return { error: t('A oferta já mudou. Atualize a página.') };
  if (Number(offer.expires_at_ms) && now > Number(offer.expires_at_ms)) return { error: t('A oferta expirou.') };

  const next = { ...offer, status: a.to, history: [...(offer.history || [])] };
  if (action === 'counter' || action === 'counter_back') {
    if ((offer.round || 1) >= maxRounds) return { error: t('Chegou ao limite de rodadas: agora é aceitar ou recusar.') };
    const amount = Math.round(Number(amountCents));
    if (!(amount > 0)) return { error: t('Diga o valor.') };
    const lastBuyer = lastAmount(offer, 'buyer');
    const lastSeller = lastAmount(offer, 'seller') ?? offer.list_price_cents;
    if (role === 'seller' && !(amount > lastBuyer && amount < offer.list_price_cents)) {
      return { error: t('A contraproposta fica entre a oferta e o preço anunciado.') };
    }
    if (role === 'buyer' && !(amount > lastBuyer && amount < lastSeller)) {
      return { error: t('A nova oferta precisa ser maior que a anterior e menor que a contraproposta.') };
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

/**
 * O estado que a tela mostra: a oferta `pending`/`countered` cujo prazo passou
 * é "expirada" (o servidor ainda não marcou), e não "responder".
 */
export function offerDisplayStatus(offer, now = Date.now()) {
  if (!offer) return O.EXPIRED;
  const prazo = Number(offer.expires_at_ms);
  if ([O.PENDING, O.COUNTERED].includes(offer.status) && prazo && now > prazo) return O.EXPIRED;
  return offer.status;
}

/** Botões da negociação para quem vê. */
export function offerActionsFor(offer, role, { now = Date.now(), maxRounds = OFFER_RULES.maxRounds } = {}) {
  if (!offer || !role) return [];
  if (Number(offer.expires_at_ms) && now > Number(offer.expires_at_ms)) return [];
  return Object.entries(OFFER_ACTIONS)
    .filter(([, a]) => a.role === role && a.from.includes(offer.status))
    .filter(([id]) => !((id === 'counter' || id === 'counter_back') && (offer.round || 1) >= maxRounds))
    .map(([id, a]) => ({ id, label: t(a.label) }));
}

/** Uma oferta nova (o documento, sem os campos de servidor). */
export function newOffer(listing, buyer, amountCents, { fulfillment, message = '', now = Date.now(), ttlHours = OFFER_RULES.ttlHours, variantId = null } = {}) {
  const variant = (listing.variants || []).find((v) => v.id === variantId) || null;
  return {
    listing_id: listing.id,
    ...(variant ? { variant_id: variant.id, variant_label: variant.label } : {}),
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
