import { describe, it, expect } from 'vitest';
import {
  splitAchievements, calcProgressionFields, progressionIsCurrent, nextProgressionDoc, countUniqueOpponents,
  statsToXpSources, TRACKED_ACHIEVEMENT_COUNT,
} from './gamificationSnapshot.js';
import { computeAchievementsV2, ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2.js';
import { validateProgressionV2 } from './progressionV2Schema.js';

describe('splitAchievements', () => {
  it('tira as "em breve" da conta e mantém as medidas', () => {
    const r = splitAchievements(computeAchievementsV2({ uid: 'u', stats: {} }));
    expect(r.soon.length).toBeGreaterThan(0);
    expect(r.soon.every((a) => a.soonReason)).toBe(true);
    expect(r.total).toBe(TRACKED_ACHIEVEMENT_COUNT);
    expect(r.total).toBeLessThan(ACHIEVEMENTS_V2.length);
    expect(r.total).toBe(r.locked.length + r.unlocked.length);
  });
  it('byFamily conta só as medidas', () => {
    const r = splitAchievements(computeAchievementsV2({ uid: 'u', stats: {} }));
    const soma = Object.values(r.byFamily).reduce((s, f) => s + f.total, 0);
    expect(soma).toBe(r.total);
  });
  it('aceita entrada vazia', () => {
    expect(splitAchievements(null).total).toBe(0);
  });
});

describe('progressão materializada', () => {
  const stats = { tournaments: 2, podiums: 1, titles: 0, played: 10, wins: 6 };
  const calc = calcProgressionFields({
    xpTotal: 900, breakdown: { activity: 700, achievements: 100, missions: 60, onboarding: 40, grants: 0 },
    stats, unlockedCount: 5,
  });
  it('monta campos válidos no schema', () => {
    const doc = nextProgressionDoc('u1', null, calc, 1000);
    expect(validateProgressionV2(doc).success).toBe(true);
    expect(doc.source).toBe('seed');
    expect(doc.xpBreakdown.activity).toBe(700);
  });
  it('mantém createdAt e marca recomputed', () => {
    const a = nextProgressionDoc('u1', null, calc, 1000);
    const b = nextProgressionDoc('u1', a, { ...calc, xpTotal: 950 }, 2000);
    expect(b.createdAt).toBe(1000);
    expect(b.source).toBe('recomputed');
  });
  it('detecta documento em dia', () => {
    const doc = nextProgressionDoc('u1', null, calc, 1000);
    expect(progressionIsCurrent(doc, calc)).toBe(true);
    expect(progressionIsCurrent(doc, { ...calc, xpTotal: 901 })).toBe(false);
    expect(progressionIsCurrent(doc, { ...calc, grantsXp: 50, xpBreakdown: { ...calc.xpBreakdown, grants: 50 } })).toBe(false);
    expect(progressionIsCurrent(null, calc)).toBe(false);
  });
  it('fontes de XP', () => {
    expect(statsToXpSources(stats).game_played).toBe(10);
  });
});

describe('countUniqueOpponents', () => {
  it('junta torneio por nome e dia de jogo por uid', () => {
    const n = countUniqueOpponents({
      h2hRecords: [{ opponent: 'Ana' }, { opponent: 'ana ' }, { opponent: 'Bia' }],
      gameDayGames: [{ opponentUids: ['x', 'y'] }, { opponentUids: ['x'] }, { opponentUids: [], opponents: ['Caio', 'Atleta'] }],
    });
    expect(n).toBe(5);
  });
});
