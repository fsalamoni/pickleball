/**
 * O controle de uso dos cupons.
 *
 * O que protege:
 *  1. ⭐ desconto na reserva: custo e receita saem das reservas CONFIRMADAS ou
 *     CONCLUÍDAS — pedido recusado não custou nem trouxe nada;
 *  2. ⭐ vale sem custo informado tem custo DESCONHECIDO (null), nunca zero —
 *     e um desconhecido torna desconhecido o total do tipo;
 *  3. ⭐ o programa de indicação conta UMA vez, no cupom vigente;
 *  4. o estado do cupom (ativo, desligado, esgotado, vencido);
 *  5. o retorno por real dado.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { bookingPaid, couponStatus, couponUsageReport, returnPerReal } from './couponUsage.js';

const agora = Date.UTC(2026, 8, 25, 12);
const reserva = (over = {}) => ({
  id: Math.random().toString(36).slice(2), status: 'confirmed', proposed_price: 90,
  member_benefit: { coupon_id: 'desc', coupon_value: 10 }, ...over,
});

describe('bookingPaid', () => {
  it('o acordado vence o proposto; sem nenhum, zero', () => {
    expect(bookingPaid({ agreed_price: 70, proposed_price: 90 })).toBe(70);
    expect(bookingPaid({ proposed_price: 90 })).toBe(90);
    expect(bookingPaid({})).toBe(0);
  });
});

describe('couponStatus', () => {
  it('desligado, vencido, esgotado, ativo — nessa precedência', () => {
    expect(couponStatus({ active: false }, agora)).toBe('desligado');
    expect(couponStatus({ active: true, expires_at: Timestamp.fromMillis(agora - 1) }, agora)).toBe('vencido');
    expect(couponStatus({ active: true, max_uses: 3, used_count: 3 }, agora)).toBe('esgotado');
    expect(couponStatus({ active: true, max_uses: 3, used_count: 2 }, agora)).toBe('ativo');
  });
});

describe('⭐ desconto na reserva', () => {
  const cupons = [{ id: 'desc', code: 'DEZ', type: 'percent', value: 10, active: true, used_count: 2 }];
  it('custo e receita das reservas que contam; recusada e cancelada ficam de fora', () => {
    const { rows } = couponUsageReport({
      coupons: cupons,
      bookings: [
        reserva(),
        reserva({ status: 'completed', agreed_price: 180, member_benefit: { coupon_id: 'desc', coupon_value: 20 } }),
        reserva({ status: 'declined' }),
        reserva({ status: 'cancelled' }),
        reserva({ status: 'requested' }),
      ],
      now: agora,
    });
    expect(rows[0]).toMatchObject({ uses: 2, cost: 30, revenue: 270, kindLabel: 'Desconto', status: 'ativo' });
  });

  it('usa a maior contagem entre o cupom e as reservas (reserva antiga pode ter saído da lista)', () => {
    const { rows } = couponUsageReport({ coupons: [{ ...cupons[0], used_count: 5 }], bookings: [reserva()], now: agora });
    expect(rows[0].uses).toBe(5);
  });
});

describe('⭐ vale', () => {
  const vale = { id: 'coco', kind: 'drink', code: 'COCO', benefit: '1 água de coco', active: true, used_count: 4, face_value: 8 };
  it('custo = usos × custo unitário informado', () => {
    const { rows } = couponUsageReport({ coupons: [vale], costs: { coco: 3.5 }, now: agora });
    expect(rows[0]).toMatchObject({ uses: 4, cost: 14, unitCost: 3.5, revenue: null, faceValue: 8, benefit: '1 água de coco' });
  });

  it('⭐ sem custo informado, o custo é desconhecido — e o total do tipo também', () => {
    const outro = { ...vale, id: 'coco2', code: 'COCO2' };
    const { rows, byKind, totals } = couponUsageReport({ coupons: [vale, outro], costs: { coco: 3.5 }, now: agora });
    expect(rows.find((r) => r.id === 'coco2').cost).toBeNull();
    expect(byKind.find((k) => k.kind === 'drink')).toMatchObject({ coupons: 2, uses: 8, cost: null });
    expect(totals.costKnown).toBe(false);
  });
});

describe('⭐ indicação', () => {
  const programa = (over = {}) => ({
    id: 'ind', kind: 'referral', code: 'INDICACAO', active: true, referrer_reward: 20,
    created_at: Timestamp.fromMillis(agora - 1000), ...over,
  });
  const referrals = [
    { id: 'r1', redeemed_count: 2, reward_total: 80 },
    { id: 'r2', redeemed_count: 1, reward_total: 40 },
    { id: 'r3', redeemed_count: 0 },
  ];
  const comIndicacao = reserva({ member_benefit: null, proposed_price: 150, referral: { code: 'ANA123', discount_value: 15 } });

  it('usos = indicações resgatadas; custo = créditos + descontos; receita = reservas que chegaram por indicação', () => {
    const { rows } = couponUsageReport({ coupons: [programa()], referrals, bookings: [comIndicacao], now: agora });
    expect(rows[0]).toMatchObject({ uses: 3, newCustomers: 3, cost: 135, revenue: 150 });
  });

  it('⭐ com as regras refeitas (dois cupons de indicação), o programa conta UMA vez — no vigente', () => {
    const velho = programa({ id: 'velho', active: false, created_at: Timestamp.fromMillis(agora - 99999) });
    const { rows, totals } = couponUsageReport({ coupons: [velho, programa()], referrals, bookings: [comIndicacao], now: agora });
    expect(rows.find((r) => r.id === 'ind').uses).toBe(3);
    expect(rows.find((r) => r.id === 'velho')).toMatchObject({ uses: 0, cost: 0, revenue: 0 });
    expect(totals.uses).toBe(3);
  });

  it('resgate antigo sem o valor creditado gravado: custo desconhecido, não inventado', () => {
    const { rows } = couponUsageReport({ coupons: [programa()], referrals: [{ id: 'x', redeemed_count: 2 }], now: agora });
    expect(rows[0].cost).toBeNull();
  });
});

describe('totais por tipo', () => {
  it('só os tipos que a arena usa, na ordem do catálogo', () => {
    const { byKind, totals } = couponUsageReport({
      coupons: [
        { id: 'coco', kind: 'drink', code: 'COCO', benefit: 'água', active: true, used_count: 1 },
        { id: 'desc', code: 'DEZ', type: 'percent', value: 10, active: true, used_count: 1 },
      ],
      bookings: [reserva()],
      costs: { coco: 2 },
      now: agora,
    });
    expect(byKind.map((k) => k.kind)).toEqual(['discount', 'drink']);
    expect(totals).toEqual({ coupons: 2, uses: 2, cost: 12, costKnown: true, revenue: 90 });
  });
});

describe('returnPerReal', () => {
  it('receita por real dado; sem custo, ou desconhecido, não há conta', () => {
    expect(returnPerReal(270, 30)).toBe(9);
    expect(returnPerReal(100, 0)).toBeNull();
    expect(returnPerReal(null, 10)).toBeNull();
    expect(returnPerReal(100, null)).toBeNull();
  });
});
