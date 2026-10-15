import { describe, it, expect } from 'vitest';
import { validateOfferAmount, applyOfferAction, offerActionsFor, newOffer, offerDisplayStatus, autoOfferOutcome } from './offers.js';

const listing = { id: 'l', title: 'Raquete', price_cents: 100000, accepts_offers: true, seller_key: 'athlete_v', seller_uid: 'v', fulfillment: ['meetup'] };
const now = 1_000_000;

describe('ofertas', () => {
  it('valida o valor', () => {
    expect(validateOfferAmount({ ...listing, accepts_offers: false }, 50000)).toMatch(/não aceita/);
    expect(validateOfferAmount(listing, 100000)).toMatch(/menor/);
    expect(validateOfferAmount(listing, 10000)).toMatch(/abaixo/);
    expect(validateOfferAmount(listing, 80000)).toBeNull();
  });
  it('negociação até aceitar', () => {
    let o = newOffer(listing, { uid: 'c', name: 'Ana' }, 70000, { now });
    expect(o.status).toBe('pending');
    let r = applyOfferAction(o, 'counter', 'seller', { amountCents: 90000, now });
    expect(r.offer.status).toBe('countered');
    o = r.offer;
    expect(applyOfferAction(o, 'counter_back', 'buyer', { amountCents: 80000, now }).error).toBeFalsy();
    expect(applyOfferAction(o, 'counter_back', 'buyer', { amountCents: 60000, now }).error).toMatch(/maior/);
    r = applyOfferAction(o, 'accept_counter', 'buyer', { now });
    expect(r.offer.status).toBe('accepted');
  });
  it('vez errada, rodadas e expiração', () => {
    const o = newOffer(listing, { uid: 'c' }, 70000, { now });
    expect(applyOfferAction(o, 'accept', 'buyer', { now }).error).toMatch(/vez/);
    expect(applyOfferAction({ ...o, round: 4 }, 'counter', 'seller', { amountCents: 90000, now }).error).toMatch(/limite/);
    expect(applyOfferAction(o, 'accept', 'seller', { now: o.expires_at_ms + 1 }).error).toMatch(/expirou/);
    expect(applyOfferAction(o, 'counter', 'seller', { amountCents: 110000, now }).error).toMatch(/entre/);
  });
  it('botões por papel', () => {
    const o = newOffer(listing, { uid: 'c' }, 70000, { now });
    expect(offerActionsFor(o, 'seller', { now }).map((a) => a.id)).toEqual(['accept', 'decline', 'counter']);
    expect(offerActionsFor(o, 'buyer', { now }).map((a) => a.id)).toEqual(['withdraw']);
    expect(offerActionsFor({ ...o, round: 4 }, 'seller', { now }).map((a) => a.id)).toEqual(['accept', 'decline']);
  });
  it('estado mostrado: pendente vencida vira expirada, as outras ficam', () => {
    const o = newOffer(listing, { uid: 'c', name: 'Ana' }, 70000, { now });
    expect(offerDisplayStatus(o, now + 1000)).toBe('pending');
    expect(offerDisplayStatus(o, o.expires_at_ms + 1)).toBe('expired');
    expect(offerDisplayStatus({ ...o, status: 'countered' }, o.expires_at_ms + 1)).toBe('expired');
    expect(offerDisplayStatus({ ...o, status: 'ordered' }, o.expires_at_ms + 1)).toBe('ordered');
    expect(offerDisplayStatus({ ...o, expires_at_ms: null }, now + 1e12)).toBe('pending');
    expect(offerDisplayStatus(null)).toBe('expired');
  });
  it('resposta automática: aceita a partir de X, recusa abaixo de Y, senão espera o vendedor', () => {
    const l = { ...listing, offer_auto_accept_cents: 80000, offer_auto_decline_cents: 50000 };
    expect(autoOfferOutcome(l, 80000)).toBe('accept');
    expect(autoOfferOutcome(l, 49999)).toBe('decline');
    expect(autoOfferOutcome(l, 60000)).toBeNull();
    expect(autoOfferOutcome(listing, 1)).toBeNull();
    expect(autoOfferOutcome({ ...listing, offer_auto_decline_cents: 50000 }, 90000)).toBeNull();
    const o = newOffer({ ...listing, variants: [{ id: 'g', label: 'G', quantity: 1 }] }, { uid: 'c' }, 70000, { now, variantId: 'g' });
    expect(o.variant_label).toBe('G');
    expect(newOffer(listing, { uid: 'c' }, 70000, { now, variantId: 'g' }).variant_id).toBeUndefined();
  });
});
