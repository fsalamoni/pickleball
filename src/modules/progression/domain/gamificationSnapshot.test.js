import { describe, it, expect } from 'vitest';
import {
  splitAchievements, calcProgressionFields, progressionIsCurrent, nextProgressionDoc, countUniqueOpponents,
  statsToXpSources, skillTreeSources, TRACKED_ACHIEVEMENT_COUNT,
} from './gamificationSnapshot.js';
import { buildSkillTrees } from './skillTrees.js';
import { XP_WEIGHTS_V2 } from './progressionV2.js';
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

describe('skillTreeSources — as quatro trilhas que ficavam zeradas', () => {
  const stats = { tournaments: 1, podiums: 0, titles: 0, played: 4, wins: 2 };
  const facts = (counts, desconhecidas = []) => ({
    counts: {
      follows: 0, followers: 0, bookingsPlayed: 0, arenasVisited: 0, arenaReviews: 0, lessonsCompleted: 0,
      packages: 0, clinics: 0, clubsJoined: 0, clubsCreated: 0, clubEventsCreated: 0, gameDaysCreated: 0,
      kudosGiven: 0, kudosReceived: 0, ...counts,
    },
    known: (n) => !desconhecidas.includes(n),
  });

  it('sem fatos, só os jogos e torneios (como antes)', () => {
    expect(skillTreeSources(stats, null)).toEqual(statsToXpSources(stats));
  });

  it('com fatos, cada área ganha o que a pessoa fez', () => {
    const f = skillTreeSources(stats, facts({ follows: 2, kudosGiven: 7, bookingsPlayed: 3, arenasVisited: 3, lessonsCompleted: 2, clubsJoined: 2 }));
    const { trees } = buildSkillTrees(f, XP_WEIGHTS_V2);
    expect(trees.social.xp).toBe(XP_WEIGHTS_V2.follow_first + 7 * XP_WEIGHTS_V2.kudos_given);
    expect(trees.arena.xp).toBe(XP_WEIGHTS_V2.booking_first + 3 * XP_WEIGHTS_V2.booking_attended + XP_WEIGHTS_V2.arena_visited_3_different);
    expect(trees.coach.xp).toBe(XP_WEIGHTS_V2.lesson_first + 2 * XP_WEIGHTS_V2.lesson_attended);
    expect(trees.club.xp).toBe(2 * XP_WEIGHTS_V2.club_joined);
    expect(trees.tournament.xp).toBeGreaterThan(0);
  });

  it('as trilhas NÃO mudam o XP total (que vem de computeTotalXpV2)', () => {
    const so = statsToXpSources(stats);
    expect(Object.keys(so).sort()).toEqual(['game_played', 'game_won', 'tournament_attended', 'tournament_podium', 'tournament_title']);
  });

  it('🐞 fonte que não carregou NÃO é contada (nada de "não fez" por falha)', () => {
    const f = skillTreeSources(stats, facts({ bookingsPlayed: 5 }, ['bookings', 'lessons']));
    expect(f.booking_attended).toBeUndefined();
    expect(f.lesson_attended).toBeUndefined();
  });

  it('o documento materializado leva as trilhas dos fatos', () => {
    const calc = calcProgressionFields({
      xpTotal: 100, breakdown: {}, stats, unlockedCount: 0, facts: facts({ clubsJoined: 1 }),
    });
    expect(calc.skillTrees.find((t) => t.tree === 'club').xp).toBe(XP_WEIGHTS_V2.club_joined);
  });
});
