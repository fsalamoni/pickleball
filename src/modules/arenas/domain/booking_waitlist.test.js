import { describe, it, expect } from 'vitest';
import {
  waitlistSlotKey, normalizeWaitlistEntry, waitlistDocId, groupWaitlistBySlot, isOnWaitlist,
} from './booking_waitlist.js';

const base = { arena_id: 'ar1', user_id: 'u1', date: '2026-08-01', start: '18:00', end: '19:00' };

describe('normalizeWaitlistEntry', () => {
  it('valida campos obrigatórios', () => {
    expect(normalizeWaitlistEntry({}).valid).toBe(false);
    expect(normalizeWaitlistEntry({ arena_id: 'a', user_id: 'u' }).valid).toBe(false);
  });
  it('normaliza e aplica defaults', () => {
    const { valid, value } = normalizeWaitlistEntry({ ...base, user_name: 'Ana', notes: 'x'.repeat(400) });
    expect(valid).toBe(true);
    expect(value.court_id).toBeNull();
    expect(value.user_name).toBe('Ana');
    expect(value.notes.length).toBe(300);
  });
});

describe('waitlistDocId / waitlistSlotKey', () => {
  it('id é determinístico por arena+user+data+início', () => {
    expect(waitlistDocId(base)).toBe('ar1_u1_2026-08-01_18:00');
  });
  it('slotKey inclui quadra (ou any)', () => {
    expect(waitlistSlotKey(base)).toBe('2026-08-01|18:00|19:00|any');
    expect(waitlistSlotKey({ ...base, court_id: 'c1' })).toBe('2026-08-01|18:00|19:00|c1');
  });
});

describe('groupWaitlistBySlot', () => {
  it('agrupa por horário e ordena', () => {
    const entries = [
      { ...base, start: '19:00', end: '20:00', user_id: 'u2' },
      { ...base, user_id: 'u1' },
      { ...base, user_id: 'u3' },
    ];
    const groups = groupWaitlistBySlot(entries);
    expect(groups[0].start).toBe('18:00');
    expect(groups[0].entries).toHaveLength(2); // u1 + u3 no mesmo horário
    expect(groups[1].start).toBe('19:00');
  });
});

describe('isOnWaitlist', () => {
  it('detecta se a pessoa já está no horário', () => {
    const entries = [{ ...base }];
    expect(isOnWaitlist(entries, 'u1', base)).toBe(true);
    expect(isOnWaitlist(entries, 'u2', base)).toBe(false);
    expect(isOnWaitlist(entries, 'u1', { ...base, start: '20:00' })).toBe(false);
  });
});
