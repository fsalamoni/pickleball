import { describe, it, expect } from 'vitest';
import { validateOfferAmount, applyOfferAction, offerActionsFor, newOffer } from './offers.js';

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
});
