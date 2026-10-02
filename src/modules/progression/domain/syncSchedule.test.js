import { describe, it, expect } from 'vitest';
import { syncIsDue, BACKGROUND_SYNC_MS } from './syncSchedule.js';

const NOW = 1_800_000_000_000;

describe('syncIsDue', () => {
  it('nunca rodou: vencida', () => {
    expect(syncIsDue(null, NOW)).toBe(true);
    expect(syncIsDue(undefined, NOW)).toBe(true);
    expect(syncIsDue('', NOW)).toBe(true);
    expect(syncIsDue('lixo', NOW)).toBe(true);
    expect(syncIsDue(0, NOW)).toBe(true);
  });
  it('rodou há pouco: em dia', () => {
    expect(syncIsDue(String(NOW - 3_600_000), NOW)).toBe(false);
    expect(syncIsDue(NOW - BACKGROUND_SYNC_MS + 1, NOW)).toBe(false);
  });
  it('passou o intervalo: vencida (a borda vence)', () => {
    expect(syncIsDue(NOW - BACKGROUND_SYNC_MS, NOW)).toBe(true);
    expect(syncIsDue(NOW - 3 * BACKGROUND_SYNC_MS, NOW)).toBe(true);
  });
  it('registro no futuro (relógio mexido): vencida, não trava para sempre', () => {
    expect(syncIsDue(NOW + 86_400_000, NOW)).toBe(true);
  });
  it('o intervalo é de 12 horas', () => {
    expect(BACKGROUND_SYNC_MS).toBe(12 * 3_600_000);
  });
});
