import { describe, expect, it } from 'vitest';
import {
  countOccupiedRegistrations,
  DEFAULT_MAX_ENTRIES,
  getCapacityProgress,
  hasUnlimitedEntries,
  isRegistrationCapacityReached,
  normalizeMaxEntries,
} from './capacity.js';

describe('capacity helpers', () => {
  it('aceita vagas abertas com valor nulo', () => {
    expect(hasUnlimitedEntries(null)).toBe(true);
    expect(normalizeMaxEntries(null)).toBeNull();
  });

  it('normaliza e limita vagas numéricas', () => {
    expect(normalizeMaxEntries('9')).toBe(9);
    expect(normalizeMaxEntries(1)).toBe(2);
    expect(normalizeMaxEntries(999)).toBe(500);
    expect(normalizeMaxEntries('')).toBeNull();
    expect(normalizeMaxEntries(undefined, { allowUnlimited: false })).toBe(DEFAULT_MAX_ENTRIES);
  });

  it('detecta lotação apenas quando há limite fechado', () => {
    expect(isRegistrationCapacityReached(10, null)).toBe(false);
    expect(isRegistrationCapacityReached(10, 10)).toBe(true);
  });

  it('retorna progresso somente para limites fechados', () => {
    expect(getCapacityProgress(10, null)).toBeNull();
    expect(getCapacityProgress(5, 10)).toBe(50);
  });

  it('conta apenas inscrições que ocupam vagas', () => {
    expect(countOccupiedRegistrations([
      { status: 'confirmed' },
      { status: 'pending_payment' },
      { status: 'cancelled' },
      { status: 'waitlist' },
    ])).toBe(2);
  });
});
