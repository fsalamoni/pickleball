import { describe, it, expect } from 'vitest';
import {
  OPEN_SLOT_STATUS,
  OPEN_SLOT_FORMATS,
  isSlotOpenForJoin,
  slotStartMs,
  getAvailableSpots,
  getSlotFillPct,
  canJoinOpenSlot,
  normalizeOpenSlotInput,
  computeSlotStatus,
  isSlotFinished,
} from './openMatch.js';

const now = new Date('2026-07-15T10:00:00Z');

describe('OPEN_SLOT_FORMATS', () => {
  it('inclui os formatos principais', () => {
    expect(OPEN_SLOT_FORMATS).toContain('simples');
    expect(OPEN_SLOT_FORMATS).toContain('duplas');
    expect(OPEN_SLOT_FORMATS).toContain('mistas');
    expect(OPEN_SLOT_FORMATS).toContain('open');
    expect(OPEN_SLOT_FORMATS).toContain('treino');
  });
});

describe('slotStartMs', () => {
  it('extrai de date+start', () => {
    const ms = slotStartMs({ date: '2026-07-20', start: '19:00' });
    expect(ms).toBe(new Date('2026-07-20T19:00:00').getTime());
  });
  it('usa start_at se fornecido', () => {
    const dt = new Date('2026-07-20T19:00:00Z');
    const ms = slotStartMs({ start_at: dt });
    expect(ms).toBe(dt.getTime());
  });
  it('usa start_ms se fornecido', () => {
    const ms = slotStartMs({ start_ms: 1234567890 });
    expect(ms).toBe(1234567890);
  });
  it('retorna NaN para slot inválido', () => {
    expect(slotStartMs({})).toBeNaN();
    expect(slotStartMs(null)).toBeNaN();
  });
});

describe('isSlotOpenForJoin', () => {
  it('slot futuro com status open é aberto', () => {
    const slot = { date: '2026-07-20', start: '19:00', end: '21:00', status: 'open', total_spots: 4 };
    expect(isSlotOpenForJoin(slot, now)).toBe(true);
  });
  it('slot cancelado não é aberto', () => {
    const slot = { date: '2026-07-20', start: '19:00', end: '21:00', status: 'cancelled', total_spots: 4 };
    expect(isSlotOpenForJoin(slot, now)).toBe(false);
  });
  it('slot no passado não é aberto', () => {
    const slot = { date: '2026-07-14', start: '10:00', end: '12:00', status: 'open', total_spots: 4 };
    expect(isSlotOpenForJoin(slot, now)).toBe(false);
  });
  it('slot sem data não é aberto', () => {
    expect(isSlotOpenForJoin({}, now)).toBe(false);
    expect(isSlotOpenForJoin(null, now)).toBe(false);
  });
});

describe('getAvailableSpots', () => {
  it('calcula corretamente com array de participants', () => {
    const slot = { total_spots: 4, participants: ['u1', 'u2'] };
    expect(getAvailableSpots(slot)).toBe(2);
  });
  it('calcula corretamente com filled_spots', () => {
    const slot = { total_spots: 4, filled_spots: 3 };
    expect(getAvailableSpots(slot)).toBe(1);
  });
  it('retorna 0 se lotado', () => {
    const slot = { total_spots: 4, participants: ['u1', 'u2', 'u3', 'u4'] };
    expect(getAvailableSpots(slot)).toBe(0);
  });
  it('retorna 0 se slot inválido', () => {
    expect(getAvailableSpots(null)).toBe(0);
  });
});

describe('getSlotFillPct', () => {
  it('calcula % corretamente', () => {
    const slot = { total_spots: 4, participants: ['u1'] };
    expect(getSlotFillPct(slot)).toBe(25);
  });
  it('retorna 100 se lotado', () => {
    const slot = { total_spots: 4, participants: ['u1', 'u2', 'u3', 'u4'] };
    expect(getSlotFillPct(slot)).toBe(100);
  });
  it('retorna 0 se total é 0', () => {
    expect(getSlotFillPct({ total_spots: 0 })).toBe(0);
  });
});

describe('canJoinOpenSlot', () => {
  const baseSlot = { date: '2026-07-20', start: '19:00', end: '21:00', status: 'open', total_spots: 4, participants: [] };
  const baseUser = { uid: 'u1' };

  it('permite entrar com user válido', () => {
    const r = canJoinOpenSlot(baseSlot, baseUser, { level: 3 }, now);
    expect(r.ok).toBe(true);
  });
  it('rejeita sem user', () => {
    const r = canJoinOpenSlot(baseSlot, null, null, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('login');
  });
  it('rejeita se já inscrito', () => {
    const r = canJoinOpenSlot({ ...baseSlot, participants: ['u1'] }, baseUser, null, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('já está inscrito');
  });
  it('rejeita se lotado', () => {
    const slot = { ...baseSlot, participants: ['a', 'b', 'c', 'd'] };
    const r = canJoinOpenSlot(slot, baseUser, null, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('vagas');
  });
  it('rejeita se cancelado', () => {
    const slot = { ...baseSlot, status: 'cancelled' };
    const r = canJoinOpenSlot(slot, baseUser, null, now);
    expect(r.ok).toBe(false);
  });
  it('rejeita se nível abaixo do mínimo', () => {
    const slot = { ...baseSlot, min_level: 4 };
    const r = canJoinOpenSlot(slot, baseUser, { level: 2 }, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('mínimo');
  });
  it('rejeita se nível acima do máximo', () => {
    const slot = { ...baseSlot, max_level: 2 };
    const r = canJoinOpenSlot(slot, baseUser, { level: 4 }, now);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('máximo');
  });
  it('aceita se nível dentro da faixa', () => {
    const slot = { ...baseSlot, min_level: 2, max_level: 4 };
    const r = canJoinOpenSlot(slot, baseUser, { level: 3 }, now);
    expect(r.ok).toBe(true);
  });
});

describe('normalizeOpenSlotInput', () => {
  it('aceita input válido', () => {
    const r = normalizeOpenSlotInput({
      date: '2026-07-20',
      start: '19:00',
      end: '21:00',
      total_spots: 4,
      format: 'duplas',
    });
    expect(r.valid).toBe(true);
    expect(r.value.date).toBe('2026-07-20');
    expect(r.value.total_spots).toBe(4);
  });
  it('rejeita data inválida', () => {
    const r = normalizeOpenSlotInput({ date: 'xx', start: '19:00', end: '21:00', total_spots: 4 });
    expect(r.valid).toBe(false);
    expect(r.errors.date).toBeTruthy();
  });
  it('rejeita end <= start', () => {
    const r = normalizeOpenSlotInput({ date: '2026-07-20', start: '21:00', end: '19:00', total_spots: 4 });
    expect(r.valid).toBe(false);
  });
  it('rejeita total_spots fora de 2-20', () => {
    const r1 = normalizeOpenSlotInput({ date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 1 });
    const r2 = normalizeOpenSlotInput({ date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 25 });
    expect(r1.valid).toBe(false);
    expect(r2.valid).toBe(false);
  });
  it('rejeita formato desconhecido', () => {
    const r = normalizeOpenSlotInput({ date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4, format: 'foo' });
    expect(r.valid).toBe(false);
  });
  it('aceita min/max level opcionais', () => {
    const r = normalizeOpenSlotInput({
      date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4,
      min_level: 2, max_level: 4,
    });
    expect(r.valid).toBe(true);
    expect(r.value.min_level).toBe(2);
    expect(r.value.max_level).toBe(4);
  });
  it('rejeita max_level < min_level', () => {
    const r = normalizeOpenSlotInput({
      date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4,
      min_level: 4, max_level: 2,
    });
    expect(r.valid).toBe(false);
  });
  it('rejeita level > 7', () => {
    const r = normalizeOpenSlotInput({
      date: '2026-07-20', start: '19:00', end: '21:00', total_spots: 4,
      min_level: 10,
    });
    expect(r.valid).toBe(false);
  });
});

describe('computeSlotStatus', () => {
  it('retorna open se tem vagas', () => {
    expect(computeSlotStatus({ total_spots: 4, participants: [], status: 'open' })).toBe('open');
  });
  it('retorna full se lotado', () => {
    expect(computeSlotStatus({ total_spots: 2, participants: ['a', 'b'], status: 'open' })).toBe('full');
  });
  it('respeita cancelled', () => {
    expect(computeSlotStatus({ status: 'cancelled' })).toBe('cancelled');
  });
});

describe('isSlotFinished', () => {
  it('true se end_ms < now', () => {
    expect(isSlotFinished({ date: '2026-07-14', end: '21:00' }, now)).toBe(true);
  });
  it('false se end_ms > now', () => {
    expect(isSlotFinished({ date: '2026-07-20', end: '21:00' }, now)).toBe(false);
  });
  it('false se slot inválido', () => {
    expect(isSlotFinished(null, now)).toBe(false);
  });
});
