import { describe, it, expect, vi } from 'vitest';
import {
  GAMIFICATION_EVENT,
  sanitizeGamificationParams,
  buildGamificationEvent,
  createTracker,
} from './gamificationEvents.js';

describe('gamificationEvents · constantes', () => {
  it('tem 25+ eventos', () => {
    expect(Object.keys(GAMIFICATION_EVENT).length).toBeGreaterThanOrEqual(25);
  });

  it('todos os nomes são snake_case', () => {
    Object.values(GAMIFICATION_EVENT).forEach((name) => {
      expect(name).toMatch(/^gamification_[a-z0-9_]+$/);
    });
  });

  it('nomes são únicos', () => {
    const names = Object.values(GAMIFICATION_EVENT);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('gamificationEvents · sanitizeGamificationParams', () => {
  it('mantém strings', () => {
    expect(sanitizeGamificationParams({ source: 'tournament' })).toEqual({ source: 'tournament' });
  });
  it('trunca string > 100 chars', () => {
    const long = 'a'.repeat(150);
    expect(sanitizeGamificationParams({ s: long }).s).toHaveLength(100);
  });
  it('remove NaN/Infinity', () => {
    expect(sanitizeGamificationParams({ n: NaN, i: Infinity, f: 3.14 })).toEqual({ f: 3.14 });
  });
  it('remove null/undefined/objetos', () => {
    expect(sanitizeGamificationParams({ n: null, u: undefined, o: { a: 1 } })).toEqual({});
  });
  it('mantém booleans', () => {
    expect(sanitizeGamificationParams({ t: true, f: false })).toEqual({ t: true, f: false });
  });
});

describe('gamificationEvents · buildGamificationEvent', () => {
  it('constrói evento válido', () => {
    const e = buildGamificationEvent(GAMIFICATION_EVENT.XP_GAINED, { source: 'tournament', amount: 30 });
    expect(e.name).toBe('gamification_xp_gained');
    expect(e.params.source).toBe('tournament');
    expect(e.params.amount).toBe(30);
    expect(typeof e.ts).toBe('number');
  });
  it('rejeita evento desconhecido', () => {
    expect(() => buildGamificationEvent('fake', {})).toThrow(/desconhecido/);
  });
});

describe('gamificationEvents · createTracker', () => {
  it('chama tracker.track com params sanitizados', () => {
    const tracker = { track: vi.fn() };
    const t = createTracker(tracker);
    t(GAMIFICATION_EVENT.KUDOS_GIVEN, { to: 'u2', source: 'profile' });
    expect(tracker.track).toHaveBeenCalledWith(
      'gamification_kudos_given',
      { to: 'u2', source: 'profile' },
    );
  });

  it('ignora evento desconhecido', () => {
    const tracker = { track: vi.fn() };
    const t = createTracker(tracker);
    t('fake', {});
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('tracker inválido → noop', () => {
    const t = createTracker(null);
    expect(typeof t).toBe('function');
    t(GAMIFICATION_EVENT.XP_GAINED, {}); // não deve crashar
  });
});
