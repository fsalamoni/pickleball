import { describe, it, expect } from 'vitest';
import { grantId, isValidGrant, sumGrants, MAX_GRANT_XP } from './xpGrants.js';

describe('xpGrants', () => {
  it('o id é determinístico e seguro', () => {
    expect(grantId('u1', 'season', '2026-09')).toBe('u1_season_2026-09');
    expect(grantId('u1', 'duel', '2026-W40/ab c')).toBe('u1_duel_2026-W40-ab-c');
  });

  it('só conta concessão válida: tipo conhecido, XP positivo e dentro do teto', () => {
    expect(isValidGrant({ uid: 'u', kind: 'season', xp: 500 })).toBe(true);
    expect(isValidGrant({ uid: 'u', kind: 'inventado', xp: 500 })).toBe(false);
    expect(isValidGrant({ uid: 'u', kind: 'season', xp: -5 })).toBe(false);
    expect(isValidGrant({ uid: 'u', kind: 'season', xp: MAX_GRANT_XP + 1 })).toBe(false);
    expect(isValidGrant({ uid: 'x', kind: 'season', xp: 5 }, 'u')).toBe(false);
  });

  it('soma uma vez por id (mesma concessão repetida não infla) e separa por tipo', () => {
    const r = sumGrants([
      { id: 'u_season_2026-09', uid: 'u', kind: 'season', xp: 500 },
      { id: 'u_season_2026-09', uid: 'u', kind: 'season', xp: 500 },
      { id: 'u_duel_w40', uid: 'u', kind: 'duel', xp: 200 },
      { id: 'lixo', uid: 'u', kind: 'duel', xp: 999999 },
    ], 'u');
    expect(r).toEqual({ total: 700, byKind: { season: 500, duel: 200 }, count: 2 });
  });

  it('entrada ruim não quebra', () => {
    expect(sumGrants(undefined)).toEqual({ total: 0, byKind: {}, count: 0 });
    expect(sumGrants([null, 5, 'x'])).toEqual({ total: 0, byKind: {}, count: 0 });
  });
});
