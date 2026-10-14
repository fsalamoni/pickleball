import { describe, it, expect } from 'vitest';
import {
  ORDER_ACTIONS, checkOrderAction, nextActionsFor, computeOrderTotals, orderCode, orderRoleOf, orderTimeline, orderWaitingOn,
} from './orderStatus.js';
import { ORDER_STATUS } from './constants.js';

describe('pedido', () => {
  it('toda ação aponta para estados conhecidos', () => {
    const st = new Set(Object.values(ORDER_STATUS));
    Object.values(ORDER_ACTIONS).forEach((a) => {
      expect(st.has(a.to)).toBe(true);
      a.from.forEach((f) => expect(st.has(f)).toBe(true));
    });
  });
  it('caminho feliz com envio', () => {
    let o = { status: 'placed', fulfillment: 'shipping' };
    const step = (action, role) => {
      const r = checkOrderAction(o, action, role);
      expect(r.ok, `${action}/${role} em ${o.status}`).toBe(true);
      o = { ...o, status: r.to };
    };
    step('accept', 'seller');
    step('send_proof', 'buyer');
    step('confirm_payment', 'seller');
    expect(checkOrderAction(o, 'ready', 'seller').ok).toBe(false);
    step('ship', 'seller');
    step('confirm_received', 'buyer');
    expect(o.status).toBe('completed');
  });
  it('papel errado e estado velho são recusados com motivo', () => {
    expect(checkOrderAction({ status: 'placed' }, 'accept', 'buyer').error).toMatch(/não pode/);
    expect(checkOrderAction({ status: 'paid' }, 'accept', 'seller').error).toMatch(/mudou/);
    expect(checkOrderAction({ status: 'paid' }, 'xyz', 'seller').ok).toBe(false);
  });
  it('a tela só recebe as ações permitidas', () => {
    expect(nextActionsFor({ status: 'placed' }, 'seller').map((a) => a.id)).toEqual(['accept', 'decline']);
    expect(nextActionsFor({ status: 'placed' }, 'buyer').map((a) => a.id)).toEqual(['cancel']);
    expect(nextActionsFor({ status: 'completed' }, 'buyer')).toEqual([]);
    expect(nextActionsFor({ status: 'disputed' }, 'admin').map((a) => a.id)).toEqual(['resolve_buyer', 'resolve_seller']);
  });
  it('disputa só dentro do prazo', () => {
    const now = Date.UTC(2026, 9, 20);
    const o = { status: 'delivered', delivered_at_ms: now - 10 * 86400000 };
    expect(nextActionsFor(o, 'buyer', { now }).map((a) => a.id)).not.toContain('open_dispute');
    expect(nextActionsFor({ ...o, delivered_at_ms: now - 86400000 }, 'buyer', { now }).map((a) => a.id)).toContain('open_dispute');
  });
  it('totais em centavos', () => {
    expect(computeOrderTotals([{ unit_price_cents: 5000, quantity: 2 }, { unit_price_cents: 300, quantity: 1 }], { shippingCents: 2500 }))
      .toEqual({ subtotal_cents: 10300, shipping_cents: 2500, total_cents: 12800, platform_fee_cents: 0, seller_net_cents: 12800 });
    expect(computeOrderTotals([{ unit_price_cents: 10000, quantity: 1 }], { feePercent: 10 }).seller_net_cents).toBe(9000);
  });
  it('código legível e papel de quem vê', () => {
    expect(orderCode(() => 0)).toBe('MC-AAAAA');
    expect(orderCode()).toMatch(/^MC-[A-Z2-9]{5}$/);
    const o = { buyer_uid: 'c', seller_uid: 'v', seller_manager_uids: ['g'] };
    expect(orderRoleOf(o, 'c')).toBe('buyer');
    expect(orderRoleOf(o, 'g')).toBe('seller');
    expect(orderRoleOf(o, 'x', { isAdmin: true })).toBe('admin');
    expect(orderRoleOf(o, 'x')).toBeNull();
  });
  it('linha do tempo e o que falta', () => {
    const t = orderTimeline({ status: 'payment_review', fulfillment: 'pickup' });
    expect(t.find((s) => s.current).id).toBe('accepted');
    expect(t[3].label).toBe('Pronto');
    expect(orderWaitingOn({ status: 'accepted' }, 'buyer')).toMatch(/Pix/);
  });
});
