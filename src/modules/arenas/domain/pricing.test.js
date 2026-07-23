import { describe, it, expect } from 'vitest';
import { resolveArenaPrice, timeToMinutes, normalizePriceRule, normalizePriceOverride, formatPrice } from './pricing.js';

describe('timeToMinutes', () => {
  it('converte horários válidos', () => {
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('00:00')).toBe(0);
  });
  it('rejeita inválidos', () => {
    expect(timeToMinutes('25:00')).toBeNull();
    expect(timeToMinutes('abc')).toBeNull();
    expect(timeToMinutes('')).toBeNull();
  });
});

describe('normalizePriceRule', () => {
  it('valida uma regra correta', () => {
    const { valid, value } = normalizePriceRule({ weekdays: [1, 3], start: '18:00', end: '22:00', price: 120 });
    expect(valid).toBe(true);
    expect(value.weekdays).toEqual([1, 3]);
    expect(value.id).toBeTruthy();
  });
  it('rejeita fim antes do início', () => {
    expect(normalizePriceRule({ weekdays: [1], start: '22:00', end: '18:00', price: 10 }).valid).toBe(false);
  });
  it('rejeita sem dias', () => {
    expect(normalizePriceRule({ weekdays: [], start: '08:00', end: '09:00', price: 10 }).valid).toBe(false);
  });
  it('preserva court_id quando informado (ARE-05)', () => {
    const { value } = normalizePriceRule({ weekdays: [1], start: '08:00', end: '12:00', price: 80, court_id: 'c1' });
    expect(value.court_id).toBe('c1');
  });
  it('court_id null quando vazio', () => {
    const { value } = normalizePriceRule({ weekdays: [1], start: '08:00', end: '12:00', price: 80 });
    expect(value.court_id).toBeNull();
  });
});

describe('normalizePriceOverride', () => {
  it('valida exceção por data', () => {
    expect(normalizePriceOverride({ date: '2026-01-01', price: 200 }).valid).toBe(true);
  });
  it('rejeita data malformada', () => {
    expect(normalizePriceOverride({ date: '01/01/2026', price: 200 }).valid).toBe(false);
  });
  it('exige preço', () => {
    expect(normalizePriceOverride({ label: 'Feriado' }).valid).toBe(false);
  });
});

describe('resolveArenaPrice', () => {
  const arena = {
    base_price: 80,
    price_rules: [
      { weekdays: [1, 2, 3, 4, 5], start: '06:00', end: '17:00', price: 100, label: 'Comercial' },
      { weekdays: [1, 2, 3, 4, 5], start: '17:00', end: '23:00', price: 150, label: 'Nobre' },
    ],
    price_overrides: [
      { date: '2026-12-25', price: 0, label: 'Natal fechado' },
      { client_id: 'vip1', price: 60, label: 'Cliente VIP' },
    ],
  };

  it('usa exceção por data', () => {
    const r = resolveArenaPrice(arena, { date: '2026-12-25', weekday: 5, time: '19:00' });
    expect(r.source).toBe('override');
    expect(r.price).toBe(0);
  });
  it('usa exceção por cliente', () => {
    const r = resolveArenaPrice(arena, { date: '2026-06-01', weekday: 1, time: '19:00', clientId: 'vip1' });
    expect(r.source).toBe('override');
    expect(r.price).toBe(60);
  });
  it('usa regra por horário nobre', () => {
    const r = resolveArenaPrice(arena, { date: '2026-06-01', weekday: 1, time: '19:00' });
    expect(r.source).toBe('rule');
    expect(r.price).toBe(150);
  });
  it('usa regra comercial', () => {
    const r = resolveArenaPrice(arena, { date: '2026-06-01', weekday: 1, time: '09:00' });
    expect(r.price).toBe(100);
  });
  it('cai no preço base quando nenhuma regra casa (fim de semana)', () => {
    const r = resolveArenaPrice(arena, { date: '2026-06-06', weekday: 6, time: '09:00' });
    expect(r.source).toBe('base');
    expect(r.price).toBe(80);
  });
  it('retorna sob consulta sem base nem regra', () => {
    const r = resolveArenaPrice({}, { date: '2026-06-06', weekday: 6, time: '09:00' });
    expect(r.source).toBe('none');
    expect(r.price).toBeNull();
  });
  // ARE-05: court_id
  it('ARE-05: usa regra com court_id matching quando slot tem courtId', () => {
    const a = {
      base_price: 80,
      price_rules: [
        { weekdays: [1], start: '08:00', end: '22:00', price: 100, label: 'Todas' },
        { weekdays: [1], start: '08:00', end: '22:00', price: 150, court_id: 'c1', label: 'Coberta' },
      ],
    };
    const r1 = resolveArenaPrice(a, { weekday: 1, time: '10:00', courtId: 'c1' });
    expect(r1.price).toBe(150);
    expect(r1.label).toBe('Coberta');
    const r2 = resolveArenaPrice(a, { weekday: 1, time: '10:00', courtId: 'c2' });
    expect(r2.price).toBe(100);
    expect(r2.label).toBe('Todas');
  });
  it('ARE-05: sem courtId no slot, usa regra sem court_id', () => {
    const a = {
      base_price: 80,
      price_rules: [
        { weekdays: [1], start: '08:00', end: '22:00', price: 100, label: 'Todas' },
        { weekdays: [1], start: '08:00', end: '22:00', price: 150, court_id: 'c1', label: 'Coberta' },
      ],
    };
    const r = resolveArenaPrice(a, { weekday: 1, time: '10:00' });
    expect(r.price).toBe(100);
  });
  it('ARE-05: override com court_id tem prioridade sobre sem court_id', () => {
    const a = {
      base_price: 80,
      price_overrides: [
        { date: '2026-12-25', price: 0, label: 'Natal (todas)' },
        { date: '2026-12-25', court_id: 'c1', price: 200, label: 'Natal coberta' },
      ],
    };
    const r1 = resolveArenaPrice(a, { date: '2026-12-25', weekday: 5, time: '10:00', courtId: 'c1' });
    expect(r1.price).toBe(200);
    const r2 = resolveArenaPrice(a, { date: '2026-12-25', weekday: 5, time: '10:00', courtId: 'c2' });
    expect(r2.price).toBe(0);
  });
});

describe('formatPrice', () => {
  it('formata BRL', () => {
    expect(formatPrice(100)).toContain('100');
  });
  it('sob consulta para nulo', () => {
    expect(formatPrice(null)).toBe('Sob consulta');
  });
});
