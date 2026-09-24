import { describe, it, expect } from 'vitest';
import { moduleRevenue } from './moduleRevenue.js';

const MES = { year: 2026, month: 9 };

describe('moduleRevenue — o dinheiro dos módulos no mês', () => {
  it('⭐ aula: só a parte da ARENA das matrículas pagas entra no recebido', () => {
    const r = moduleRevenue({
      ...MES,
      classes: [
        { id: 'k1', date: '2026-09-10', status: 'completed' },
        { id: 'k2', date: '2026-08-30' },
        { id: 'k3', date: '2026-09-12', status: 'cancelled' },
      ],
      classBookings: [
        { class_id: 'k1', paid: true, amount: 100, arena_amount: 20 },
        { class_id: 'k1', paid: false, amount: 100, arena_amount: 20 },
        { class_id: 'k2', paid: true, amount: 100, arena_amount: 20 },
        { class_id: 'k3', paid: true, amount: 100, arena_amount: 20 },
      ],
    });
    expect(r.aulas).toEqual({ recebido: 100, arena: 20, aReceber: 100, alunos: 2 });
    expect(r.recebido).toBe(20);
  });

  it('pacote: pela data da VENDA, em qualquer formato de data', () => {
    const r = moduleRevenue({
      ...MES,
      wallets: [{
        transactions: [
          { type: 'package_purchase', amount: 500, at: new Date(2026, 8, 5) },
          { type: 'package_purchase', amount: 300, at: { seconds: Date.UTC(2026, 8, 20, 15) / 1000 } },
          { type: 'package_purchase', amount: 999, at: new Date(2026, 7, 31) },
          { type: 'credit', amount: 50, at: new Date(2026, 8, 6) },
          { type: 'package_purchase', amount: 10, at: 'agora' },
        ],
      }],
    });
    expect(r.pacotes).toEqual({ valor: 800, vendidos: 2 });
  });

  it('mensalidade: o mês marcado como pago × o valor do plano', () => {
    const r = moduleRevenue({
      ...MES,
      subscriptions: [
        { price: 150, paid_months: ['2026-08', '2026-09'] },
        { price: 200, paid_months: ['2026-08'] },
      ],
    });
    expect(r.mensalidades).toEqual({ recebido: 150, pagantes: 1 });
  });

  it('⭐ torneio: PREVISTO, e nunca somado ao recebido', () => {
    const r = moduleRevenue({
      ...MES,
      tournaments: [
        { date: '2026-09-13', enrolled: 12, entry_fee: 40 },
        { date: '2026-09-20', enrolled: 8, entry_fee: 40, status: 'cancelled' },
        { date: '2026-10-01', enrolled: 8, entry_fee: 40 },
      ],
    });
    expect(r.torneios).toEqual({ previsto: 480, inscritos: 12, quantos: 1 });
    expect(r.recebido).toBe(0);
  });

  it('o recebido soma aula (parte da arena) + pacote + mensalidade', () => {
    const r = moduleRevenue({
      ...MES,
      classes: [{ id: 'k1', date: '2026-09-10' }],
      classBookings: [{ class_id: 'k1', paid: true, amount: 80, arena_amount: 16 }],
      wallets: [{ transactions: [{ type: 'package_purchase', amount: 500, at: new Date(2026, 8, 5) }] }],
      subscriptions: [{ price: 150, paid_months: ['2026-09'] }],
    });
    expect(r.recebido).toBe(666);
  });

  it('sem nada, tudo zero (sem NaN)', () => {
    expect(moduleRevenue(MES).recebido).toBe(0);
  });
});
