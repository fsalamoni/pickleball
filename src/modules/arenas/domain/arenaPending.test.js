/**
 * "Precisa de você" — as pendências da arena.
 *
 * O que protege:
 *  1. ⭐ fonte que não carregou (ou falhou) NÃO vira zero: o item some;
 *  2. reserva solicitada só conta enquanto ainda dá para confirmar;
 *  3. pedidos a entregar, faltas a marcar e mensalidades atrasadas com as
 *     MESMAS contas das abas;
 *  4. módulo desligado não gera item;
 *  5. nada pendente: lista vazia (a função não afirma "tudo em dia").
 */
import { describe, it, expect } from 'vitest';
import { arenaPendingItems } from './arenaPending.js';

const HOJE = '2026-09-25';
const MEIO_DIA = new Date(2026, 8, 25, 12, 0);
const TUDO = { loja: true, presenca: true, mensalidade: true };

const reserva = (over = {}) => ({ id: 'b1', status: 'requested', slots: [{ date: HOJE, start: '19:00', end: '20:00' }], ...over });

describe('arenaPendingItems', () => {
  it('⭐ reservas para confirmar — só as que ainda valem', () => {
    const r = arenaPendingItems({ bookings: [
      reserva(),
      reserva({ id: 'b2', slots: [{ date: '2026-09-30', start: '08:00', end: '09:00' }] }),
      reserva({ id: 'ontem', slots: [{ date: '2026-09-24', start: '19:00', end: '20:00' }] }),
      reserva({ id: 'ok', status: 'confirmed' }),
    ] }, TUDO, { hoje: HOJE, now: MEIO_DIA });
    expect(r).toEqual([{ id: 'reservas', count: 2, aba: 'reservas', label: 'reservas para confirmar' }]);
  });

  it('pedidos do app a entregar (a conta do balcão)', () => {
    const r = arenaPendingItems({ sales: [
      { id: 's1', status: 'pending', stock_applied: false },
      { id: 's2', status: 'paid', stock_applied: true },
      { id: 's3', status: 'cancelled', stock_applied: false },
    ] }, TUDO, { hoje: HOJE, now: MEIO_DIA });
    expect(r).toEqual([{ id: 'pedidos', count: 1, aba: 'pedidos', label: 'pedido do app para entregar' }]);
  });

  it('faltas para marcar hoje (janela já fechou e ninguém marcou)', () => {
    const cedo = { id: 'c1', status: 'confirmed', slots: [{ date: HOJE, start: '08:00', end: '09:00' }] };
    const marcada = { ...cedo, id: 'c2', no_show: true };
    const chegou = { ...cedo, id: 'c3', checked_in_at: 'sim' };
    const r = arenaPendingItems({ bookings: [cedo, marcada, chegou] }, TUDO, { hoje: HOJE, now: MEIO_DIA });
    expect(r).toEqual([{ id: 'faltas', count: 1, aba: 'presenca', label: 'falta para marcar hoje' }]);
  });

  it('mensalidades em atraso', () => {
    const r = arenaPendingItems({ subscriptions: [
      { status: 'active', started_on: '2026-01-01', billing_day: 5, paid_months: [] },
      { status: 'cancelled', started_on: '2026-01-01', billing_day: 5 },
    ] }, TUDO, { hoje: HOJE, now: MEIO_DIA });
    expect(r).toEqual([{ id: 'mensalidades', count: 1, aba: 'membros', label: 'mensalidade em atraso' }]);
  });

  it('⭐ fonte que não carregou ou falhou não vira zero — o item some', () => {
    const r = arenaPendingItems({ bookings: undefined, sales: undefined, subscriptions: undefined }, TUDO, { hoje: HOJE, now: MEIO_DIA });
    expect(r).toEqual([]);
  });

  it('módulo desligado não gera item', () => {
    const r = arenaPendingItems({
      sales: [{ id: 's1', status: 'pending', stock_applied: false }],
      subscriptions: [{ status: 'active', started_on: '2026-01-01', billing_day: 5, paid_months: [] }],
      bookings: [{ id: 'c1', status: 'confirmed', slots: [{ date: HOJE, start: '08:00', end: '09:00' }] }],
    }, {}, { hoje: HOJE, now: MEIO_DIA });
    expect(r).toEqual([]);
  });

  it('a ordem é a do dia: reservas, pedidos, faltas, mensalidades', () => {
    const r = arenaPendingItems({
      bookings: [reserva(), { id: 'c1', status: 'confirmed', slots: [{ date: HOJE, start: '08:00', end: '09:00' }] }],
      sales: [{ id: 's1', status: 'pending', stock_applied: false }],
      subscriptions: [{ status: 'active', started_on: '2026-01-01', billing_day: 5, paid_months: [] }],
    }, TUDO, { hoje: HOJE, now: MEIO_DIA });
    expect(r.map((i) => i.id)).toEqual(['reservas', 'pedidos', 'faltas', 'mensalidades']);
  });
});

describe('indicações das reservas para registrar (Onda BY)', () => {
  const reserva = (over) => ({ id: Math.random().toString(36), arena_id: 'a1', slots: [], ...over });
  it('conta a reserva confirmada com código pendente — só com o módulo ligado', () => {
    const bookings = [
      reserva({ status: 'confirmed', referral: { code: 'X1234567', status: 'pending' } }),
      reserva({ status: 'requested', referral: { code: 'X1234567', status: 'pending' } }),
    ];
    const com = arenaPendingItems({ bookings }, { indicacoes: true }, { hoje: '2026-09-25' });
    expect(com.find((i) => i.id === 'indicacoes')).toMatchObject({ count: 1, aba: 'indicacoes', label: 'indicação para registrar' });
    const sem = arenaPendingItems({ bookings }, {}, { hoje: '2026-09-25' });
    expect(sem.find((i) => i.id === 'indicacoes')).toBeUndefined();
  });
});
