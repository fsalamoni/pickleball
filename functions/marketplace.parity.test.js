/**
 * PARIDADE cliente × servidor do MERCADO.
 *
 * A tela decide quais botões mostrar (`nextActionsFor`, `offerActionsFor`) e
 * o servidor decide o que de fato acontece (`functions/marketplace.js`). São
 * cópias — o pacote de Functions não importa `src/` — e cópia que diverge
 * mostra um botão que o servidor recusa, ou esconde um que valeria.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { ORDER_ACTIONS, checkOrderAction, RESTOCK_ON } from '@/modules/marketplace/domain/orderStatus.js';
import { OFFER_ACTIONS, OFFER_RULES, applyOfferAction, validateOfferAmount } from '@/modules/marketplace/domain/offers.js';
import { validateReview } from '@/modules/marketplace/domain/reputation.js';
import { DEFAULT_BANNED_TERMS, findBannedTerm, normalizeMarketSettings } from '@/modules/marketplace/domain/settings.js';
import { ORDER_STATUS, OFFER_STATUS } from '@/modules/marketplace/domain/constants.js';

const require = createRequire(import.meta.url);
const servidor = require('./marketplace.js');

describe('paridade: o pedido', () => {
  it('as mesmas ações, estados e papéis', () => {
    expect(Object.keys(servidor.ORDER_ACTIONS).sort()).toEqual(Object.keys(ORDER_ACTIONS).sort());
    Object.entries(ORDER_ACTIONS).forEach(([id, a]) => {
      const s = servidor.ORDER_ACTIONS[id];
      expect(s.from, id).toEqual(a.from);
      expect(s.to, id).toBe(a.to);
      expect(s.roles, id).toEqual(a.roles);
      expect(Boolean(s.needsReason), id).toBe(Boolean(a.needsReason));
      expect(s.fulfillment, id).toEqual(a.fulfillment);
    });
    expect([...servidor.RESTOCK_ON]).toEqual([...RESTOCK_ON]);
  });

  it('⭐ a mesma resposta em todo estado × ação × papel × entrega', () => {
    let casos = 0;
    Object.values(ORDER_STATUS).forEach((status) => ['pickup', 'meetup', 'shipping'].forEach((fulfillment) => {
      Object.keys(ORDER_ACTIONS).forEach((action) => ['buyer', 'seller', 'admin', 'system', 'outro'].forEach((role) => {
        casos += 1;
        const order = { status, fulfillment };
        expect(servidor.checkOrderAction(order, action, role), `${status}/${action}/${role}/${fulfillment}`)
          .toEqual(checkOrderAction(order, action, role));
      }));
    }));
    expect(casos).toBeGreaterThan(2000);
  });
});

describe('paridade: a oferta', () => {
  it('as mesmas regras e ações', () => {
    expect(servidor.OFFER_RULES).toEqual(OFFER_RULES);
    expect(Object.keys(servidor.OFFER_ACTIONS).sort()).toEqual(Object.keys(OFFER_ACTIONS).sort());
    Object.entries(OFFER_ACTIONS).forEach(([id, a]) => {
      expect(servidor.OFFER_ACTIONS[id].from).toEqual(a.from);
      expect(servidor.OFFER_ACTIONS[id].role).toBe(a.role);
      expect(servidor.OFFER_ACTIONS[id].to).toBe(a.to);
    });
  });

  it('⭐ o mesmo resultado em toda ação, papel, rodada e valor', () => {
    const now = 1_000_000;
    const base = {
      status: 'pending', round: 1, list_price_cents: 100000, amount_cents: 60000,
      history: [{ by: 'buyer', amount_cents: 60000 }], expires_at_ms: now + 1000,
    };
    const ofertas = [
      base,
      { ...base, status: 'countered', round: 2, history: [...base.history, { by: 'seller', amount_cents: 90000 }] },
      { ...base, round: 4 },
      { ...base, expires_at_ms: now - 1 },
      ...Object.values(OFFER_STATUS).map((status) => ({ ...base, status })),
    ];
    const valores = [undefined, 0, 50000, 60000, 70000, 85000, 90000, 95000, 100000, 120000];
    ofertas.forEach((o) => Object.keys(OFFER_ACTIONS).forEach((action) => ['buyer', 'seller'].forEach((role) => {
      valores.forEach((amountCents) => {
        expect(servidor.applyOfferAction(o, action, role, { amountCents, now }), `${o.status}/${action}/${role}/${amountCents}`)
          .toEqual(applyOfferAction(o, action, role, { amountCents, now }));
      });
    })));
  });

  it('o mesmo veredito sobre o valor oferecido', () => {
    const l = { price_cents: 100000, accepts_offers: true };
    [0, 1, 29999, 30000, 50000, 99999, 100000, 150000, 'x'].forEach((v) => {
      expect(servidor.validateOfferAmount(l, v)).toBe(validateOfferAmount(l, v));
      expect(servidor.validateOfferAmount({ ...l, accepts_offers: false }, v)).toBe(validateOfferAmount({ ...l, accepts_offers: false }, v));
    });
  });
});

describe('paridade: avaliação, moderação e configuração', () => {
  it('a mesma validação da avaliação', () => {
    [[5, ''], [1, ''], [1, 'Não chegou nunca'], [0, ''], [6, ''], [3.4, 'ok'], ['x', '']].forEach(([rating, comment]) => {
      expect(servidor.validateReview({ rating, comment })).toEqual(validateReview({ rating, comment }));
    });
  });

  it('⭐ o mesmo termo proibido nos dois lados', () => {
    expect([...servidor.DEFAULT_BANNED_TERMS]).toEqual([...DEFAULT_BANNED_TERMS]);
    const textos = ['Raquete Joola réplica perfeita', 'RÉPLICA', 'replicante', 'Paguem por fora, desconto', 'Raquete nova', 'cópia primeira linha'];
    textos.forEach((t) => {
      expect(servidor.findBannedTerm(t), t).toBe(findBannedTerm(t));
      expect(servidor.findBannedTerm(t, ['joola']), t).toBe(findBannedTerm(t, ['joola']));
    });
  });

  it('o servidor lê os prazos com os mesmos limites do cliente', () => {
    const brutos = [undefined, {}, { payment_hours: 1, seller_answer_hours: 999, auto_complete_days: 'x', offer_max_rounds: 20, offer_ttl_hours: 10, dispute_window_days: 3, offers_enabled: false }];
    brutos.forEach((raw) => {
      const c = normalizeMarketSettings(raw);
      const s = servidor.serverSettings(raw);
      ['offers_enabled', 'orders_enabled', 'banned_terms', 'seller_answer_hours', 'payment_hours', 'auto_complete_days',
        'dispute_window_days', 'offer_max_rounds', 'offer_ttl_hours'].forEach((k) => expect(s[k], k).toEqual(c[k]));
    });
  });
});

describe('servidor: o que fecha a compra', () => {
  it('valida o pedido do carrinho', () => {
    expect(servidor.validatePlaceRequest({}).error).toBeTruthy();
    expect(servidor.validatePlaceRequest({ groups: [{ seller_key: 'athlete_a', fulfillment: 'meetup', items: [{ listing_id: 'l', quantity: 0 }] }] }).error).toBeTruthy();
    expect(servidor.validatePlaceRequest({ groups: [{ seller_key: 'xx', fulfillment: 'meetup', items: [{ listing_id: 'l', quantity: 1 }] }] }).error).toBeTruthy();
    const dup = { seller_key: 'athlete_a', fulfillment: 'meetup', items: [{ listing_id: 'l', quantity: 1 }, { listing_id: 'l', quantity: 1 }] };
    expect(servidor.validatePlaceRequest({ groups: [dup] }).error).toBeTruthy();
    const envio = { seller_key: 'athlete_a', fulfillment: 'shipping', items: [{ listing_id: 'l', quantity: 2 }] };
    expect(servidor.validatePlaceRequest({ groups: [envio] }).error).toMatch(/endereço/);
    const ok = servidor.validatePlaceRequest({
      groups: [envio],
      shipping: { name: 'Ana Souza', street: 'Rua A', number: '10', city: 'Porto Alegre', state: 'rs', cep: '90000-000' },
    });
    expect(ok.error).toBeUndefined();
    expect(ok.address.state).toBe('RS');
    expect(ok.address.cep).toBe('90000000');
  });

  it('entrega comum e frete do grupo', () => {
    const a = { fulfillment: ['pickup', 'shipping'], shipping_cents: 2000 };
    const b = { fulfillment: ['shipping', 'meetup'], shipping_cents: 3500 };
    expect(servidor.commonFulfillment([a, b])).toEqual(['shipping']);
    expect(servidor.groupShipping([a, b], 'shipping')).toEqual({ shipping_cents: 3500, shipping_to_agree: false });
    expect(servidor.groupShipping([a, { ...b, shipping_to_agree: true }], 'shipping')).toEqual({ shipping_cents: 0, shipping_to_agree: true });
    expect(servidor.groupShipping([a], 'pickup').shipping_cents).toBe(0);
  });
});
