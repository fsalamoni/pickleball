import { describe, it, expect } from 'vitest';
import { coachToday, coachActivation } from './coachToday';

const aula = (id, status, date, extra = {}) => ({ id, status, slots: [{ date, start: extra.start || '18:00', end: '19:00' }], ...extra });

describe('coachToday', () => {
  it('separa aulas de hoje, pedidos, pagamentos pendentes e dúvidas abertas', () => {
    const r = coachToday([
      aula('a', 'confirmed', '2026-10-11', { start: '19:00' }),
      aula('b', 'confirmed', '2026-10-11', { start: '08:00', payment_status: 'pending', price: 120 }),
      aula('c', 'confirmed', '2026-10-12'),
      aula('d', 'requested', '2026-10-20'),
      aula('e', 'completed', '2026-10-01', { payment_status: 'pending', price: 0 }),
      aula('f', 'cancelled', '2026-10-11'),
    ], { hoje: '2026-10-11', questions: [{ status: 'aberta' }, { status: 'respondida' }] });
    expect(r.aulasHoje.map((l) => l.id)).toEqual(['b', 'a']);
    expect(r.pedidos.map((l) => l.id)).toEqual(['d']);
    expect(r.pagamentos.map((l) => l.id)).toEqual(['b']);
    expect(r.duvidas).toBe(1);
  });

  it('dúvidas sem resposta da consulta viram null, nunca zero', () => {
    expect(coachToday([], { hoje: '2026-10-11' }).duvidas).toBeNull();
    expect(coachToday([], { hoje: '2026-10-11', questions: [] }).duvidas).toBe(0);
  });
});

describe('coachActivation', () => {
  it('fonte que não respondeu é null; completo só com tudo feito', () => {
    const r = coachActivation({ coach: { bio: 'x', hourly_rate: 100 }, availability: undefined, students: [], lessons: [aula('a', 'requested', '2026-10-11')] });
    expect(r.items.map((i) => i.done)).toEqual([true, null, false, true]);
    expect(r.completo).toBe(false);
    expect(r.feitos).toBe(2);
  });

  it('tudo feito', () => {
    const r = coachActivation({ coach: { bio: 'x', hourly_rate: 100 }, availability: { windows: [{}] }, students: [{ status: 'active' }], lessons: [{}] });
    expect(r.completo).toBe(true);
  });

  it('disponibilidade confirmada vazia é false (não null)', () => {
    expect(coachActivation({ availability: null }).items[1].done).toBe(false);
  });
});
