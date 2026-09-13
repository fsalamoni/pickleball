import { describe, it, expect } from 'vitest';
import {
  resolveArenaPrice, timeToMinutes, normalizePriceRule, normalizePriceOverride, formatPrice,
  totalBookingPrice, priceWithDurationText, bookingPriceInfo,
} from './pricing.js';

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

/* ==================== o preço TOTAL (o bug da reserva de uma hora) ======== */

describe('totalBookingPrice', () => {
  // 2026-10-02 é sexta (5); 2026-10-03, sábado (6).
  const arena = {
    price_rules: [
      { weekdays: [5], start: '06:00', end: '18:00', price: 60, label: 'Sexta dia' },
      { weekdays: [5], start: '18:00', end: '23:00', price: 100, label: 'Sexta nobre' },
      { weekdays: [6], start: '06:00', end: '23:00', price: 80, label: 'Sábado' },
    ],
  };
  const slot = (start, end, date = '2026-10-02') => ({ date, start, end });

  it('uma hora: o total é a hora', () => {
    const r = totalBookingPrice(arena, { slots: [slot('19:00', '20:00')] });
    expect(r.total).toBe(100);
    expect(r.hours).toBe(1);
  });

  it('⭐ TRÊS horas somam três horas (era o bug: gravava uma)', () => {
    const r = totalBookingPrice(arena, {
      slots: [slot('19:00', '20:00'), slot('20:00', '21:00'), slot('21:00', '22:00')],
    });
    expect(r.total).toBe(300);
    expect(r.hours).toBe(3);
  });

  it('⭐ cada horário é cobrado pela SUA faixa', () => {
    // 17h–18h na faixa de 60, 18h–19h na de 100.
    const r = totalBookingPrice(arena, { slots: [slot('17:00', '18:00'), slot('18:00', '19:00')] });
    expect(r.total).toBe(160);
    expect(r.hourlyRates.sort((a, b) => a - b)).toEqual([60, 100]);
  });

  it('meia hora custa meia hora', () => {
    expect(totalBookingPrice(arena, { slots: [slot('19:00', '19:30')] }).total).toBe(50);
  });

  it('atravessa dias com tabelas diferentes', () => {
    const r = totalBookingPrice(arena, {
      slots: [slot('19:00', '20:00'), slot('19:00', '20:00', '2026-10-03')],
    });
    expect(r.total).toBe(180); // 100 (sexta nobre) + 80 (sábado)
  });

  it('devolve o detalhamento de cada horário', () => {
    const r = totalBookingPrice(arena, { slots: [slot('17:00', '18:00'), slot('19:00', '20:00')] });
    expect(r.breakdown).toHaveLength(2);
    expect(r.breakdown[0]).toMatchObject({ hourlyRate: 60, price: 60, minutes: 60 });
    expect(r.breakdown[1]).toMatchObject({ hourlyRate: 100, price: 100 });
  });

  it('arena sem tabela devolve zero, não NaN', () => {
    const r = totalBookingPrice({}, { slots: [slot('19:00', '20:00')] });
    expect(r.total).toBe(0);
    expect(Number.isNaN(r.total)).toBe(false);
  });

  it('ignora horário inválido em vez de somar lixo', () => {
    const r = totalBookingPrice(arena, {
      slots: [slot('19:00', '20:00'), { date: 'x', start: 'y', end: 'z' }, slot('20:00', '19:00')],
    });
    expect(r.total).toBe(100);
    expect(r.hours).toBe(1);
  });

  it('sem slots, sem arena: neutro', () => {
    expect(totalBookingPrice(arena, { slots: [] }).total).toBe(0);
    expect(totalBookingPrice(null, { slots: [slot('19:00', '20:00')] }).total).toBe(0);
    expect(totalBookingPrice(arena).total).toBe(0);
  });

  it('respeita a tabela POR QUADRA quando existe', () => {
    const comQuadra = {
      price_rules: [
        { weekdays: [5], start: '06:00', end: '23:00', price: 100 },
        { weekdays: [5], start: '06:00', end: '23:00', price: 150, court_id: 'coberta' },
      ],
    };
    expect(totalBookingPrice(comQuadra, { slots: [slot('19:00', '20:00')] }).total).toBe(100);
    expect(totalBookingPrice(comQuadra, { courtId: 'coberta', slots: [slot('19:00', '20:00')] }).total).toBe(150);
  });
});

describe('priceWithDurationText', () => {
  it('⭐ diz o total E a duração — "R$ 240" sozinho é ambíguo', () => {
    expect(priceWithDurationText(240, 3, [80])).toContain('3h');
    expect(priceWithDurationText(240, 3, [80])).toContain('80');
  });

  it('com uma hora não repete o valor por hora', () => {
    const t = priceWithDurationText(100, 1, [100]);
    expect(t).not.toContain('/h');
  });

  it('com faixas diferentes, não inventa um valor por hora', () => {
    expect(priceWithDurationText(160, 2, [60, 100])).not.toContain('/h');
  });

  it('sem duração, é só o valor', () => {
    expect(priceWithDurationText(100, 0, [])).toBe(formatPrice(100));
  });
});

describe('bookingPriceInfo — qual número é qual', () => {
  const arena = {
    price_rules: [{ weekdays: [5], start: '06:00', end: '23:00', price: 80 }],
  };
  const reserva = (over = {}) => ({
    court_id: 'c1',
    slots: [
      { date: '2026-10-02', start: '19:00', end: '20:00' },
      { date: '2026-10-02', start: '20:00', end: '21:00' },
      { date: '2026-10-02', start: '21:00', end: '22:00' },
    ],
    proposed_price: 80, // ← legado: gravado com o valor de UMA hora
    agreed_price: null,
    ...over,
  });

  it('⭐ com a arena, RECALCULA e corrige a reserva antiga', () => {
    const r = bookingPriceInfo(reserva(), { arena });
    expect(r.value).toBe(240);
    expect(r.hours).toBe(3);
    expect(r.recalculado).toBe(true);
    expect(r.text).toContain('3h');
  });

  it('o valor ACORDADO manda em tudo', () => {
    const r = bookingPriceInfo(reserva({ agreed_price: 200 }), { arena });
    expect(r.value).toBe(200);
    expect(r.agreed).toBe(true);
    expect(r.recalculado).toBe(false);
  });

  it('⭐ sem a arena, mostra o gravado — mas nunca sem a duração ao lado', () => {
    const r = bookingPriceInfo(reserva());
    expect(r.value).toBe(80);
    expect(r.recalculado).toBe(false);
    expect(r.text).toContain('3h');
  });

  it('arena sem tabela cai no gravado, em vez de mostrar zero', () => {
    const r = bookingPriceInfo(reserva(), { arena: {} });
    expect(r.value).toBe(80);
    expect(r.recalculado).toBe(false);
  });

  it('sem preço nenhum, diz "sob consulta"', () => {
    const r = bookingPriceInfo(reserva({ proposed_price: null }), { arena: {} });
    expect(r.value).toBeNull();
    expect(r.text).toBe('Sob consulta');
  });

  it('reserva sem horários não quebra', () => {
    const r = bookingPriceInfo({ proposed_price: 50 }, { arena });
    expect(r.hours).toBe(0);
    expect(r.value).toBe(50);
  });

  it('aguenta entrada nula', () => {
    const r = bookingPriceInfo(null);
    expect(r.value).toBeNull();
    expect(r.hours).toBe(0);
  });
});
