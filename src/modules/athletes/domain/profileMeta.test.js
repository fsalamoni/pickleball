import { describe, it, expect } from 'vitest';
import {
  COURT_SIDE, courtSideLabel, normalizeCourtSide,
  PLATFORM_INTEREST, PLATFORM_INTEREST_META, interestLabel, interestMeta, sanitizeInterests,
} from './profileMeta.js';

describe('court side', () => {
  it('rótulos e normalização', () => {
    expect(courtSideLabel(COURT_SIDE.LEFT)).toBe('Esquerda');
    expect(normalizeCourtSide('right')).toBe('right');
    expect(normalizeCourtSide('xyz')).toBe(COURT_SIDE.ANY);
    expect(normalizeCourtSide(undefined)).toBe(COURT_SIDE.ANY);
  });
});

describe('interesses', () => {
  it('meta cobre todos os interesses do enum, com rota e ícone', () => {
    const metaValues = PLATFORM_INTEREST_META.map((m) => m.value).sort();
    const enumValues = Object.values(PLATFORM_INTEREST).sort();
    expect(metaValues).toEqual(enumValues);
    PLATFORM_INTEREST_META.forEach((m) => {
      expect(m.label).toBeTruthy();
      expect(m.icon).toBeTruthy();
      expect(m.route).toBeTruthy();
    });
  });

  it('interestLabel/interestMeta', () => {
    expect(interestLabel(PLATFORM_INTEREST.PLAY_TOURNAMENTS)).toBe('Participar de torneios');
    expect(interestMeta(PLATFORM_INTEREST.RANKING).route).toBe('/ranking');
    expect(interestLabel('zzz')).toBeNull();
  });

  it('sanitizeInterests mantém só válidos e deduplica', () => {
    const out = sanitizeInterests([
      PLATFORM_INTEREST.CLUBS, 'invalido', PLATFORM_INTEREST.CLUBS, PLATFORM_INTEREST.RANKING,
    ]);
    expect(out).toEqual([PLATFORM_INTEREST.CLUBS, PLATFORM_INTEREST.RANKING]);
    expect(sanitizeInterests(null)).toEqual([]);
  });
});
