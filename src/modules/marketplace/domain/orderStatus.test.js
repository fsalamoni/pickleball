import { describe, it, expect } from 'vitest';
import {
  ORDER_ACTIONS, checkOrderAction, nextActionsFor, computeOrderTotals, orderCode, orderRoleOf, orderTimeline, orderWaitingOn, timelineSteps,
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
    expect(orderWaitingOn({ status: 'disputed' }, 'admin')).toMatch(/decida/);
    expect(orderWaitingOn({ status: 'paid' }, 'admin')).toBe('');
  });
  it('🐞 prazo da disputa conta do envio, como no servidor, e segue a configuração', () => {
    const now = Date.UTC(2026, 9, 20);
    const o = { status: 'shipped', paid_at_ms: now - 9 * 86400000, shipped_at_ms: now - 3 * 86400000 };
    expect(nextActionsFor(o, 'buyer', { now }).map((a) => a.id)).toContain('open_dispute');
    expect(nextActionsFor(o, 'buyer', { now, disputeWindowDays: 2 }).map((a) => a.id)).not.toContain('open_dispute');
  });
});

describe('linha do tempo do pedido que parou', () => {
  it('pedido vivo: a mesma linha, sem marcador', () => {
    const r = timelineSteps({ status: 'paid', fulfillment: 'shipping' });
    expect(r.stopped).toBeNull();
    expect(r.steps.find((s) => s.current).id).toBe('paid');
  });
  it('cancelado depois de pago: passos até "Pago" feitos, marcador em seguida', () => {
    const r = timelineSteps({ status: 'cancelled', fulfillment: 'shipping', accepted_at_ms: 1, paid_at_ms: 2, cancelled_at_ms: 3 });
    expect(r.steps.map((s) => s.done)).toEqual([true, true, true, false, false]);
    expect(r.steps.some((s) => s.current)).toBe(false);
    expect(r.stopped).toMatchObject({ status: 'cancelled', tone: 'danger', at_ms: 3, afterIndex: 2 });
  });
  it('expirado sem aceite: só "Pedido feito"', () => {
    const r = timelineSteps({ status: 'expired', fulfillment: 'pickup', cancelled_at_ms: 9 });
    expect(r.steps.map((s) => s.done)).toEqual([true, false, false, false, false]);
    expect(r.stopped.afterIndex).toBe(0);
    expect(r.stopped.label).toBe('Expirado');
  });
  it('em disputa depois do envio: âmbar, data do estado', () => {
    const r = timelineSteps({ status: 'disputed', fulfillment: 'shipping', accepted_at_ms: 1, paid_at_ms: 2, shipped_at_ms: 3, status_at_ms: 4 });
    expect(r.steps.map((s) => s.done)).toEqual([true, true, true, true, false]);
    expect(r.stopped).toMatchObject({ tone: 'warning', at_ms: 4, afterIndex: 3 });
  });
  it('vale-presente cancelado antes de pagar', () => {
    const r = timelineSteps({ status: 'cancelled', fulfillment: 'digital', accepted_at_ms: 1 });
    expect(r.steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(r.stopped.afterIndex).toBe(0);
  });
});
