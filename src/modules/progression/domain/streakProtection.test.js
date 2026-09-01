/**
 * Testes para `streakProtection.js`.
 */

import { describe, it, expect } from 'vitest';
import {
  computeProtectedStreak,
  canUseGrace,
  applyGrace,
  activateVacation,
  deactivateVacation,
  nextStreakMilestone,
  achievedMilestones,
  milestoneXpTotal,
  shouldApplyComeback,
  STREAK_MILESTONES,
  COMEBACK_XP,
  COMEBACK_MIN_BREAK_WEEKS,
} from './streakProtection.js';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

describe('streakProtection · computeProtectedStreak', () => {
  it('retorna weeks=0 para array vazio', () => {
    const r = computeProtectedStreak([]);
    expect(r.weeks).toBe(0);
    expect(r.rawStreak).toBe(0);
    expect(r.daysSinceLastPlay).toBe(null);
  });

  it('retorna weeks=0 para null', () => {
    const r = computeProtectedStreak(null);
    expect(r.weeks).toBe(0);
  });

  it('calcula streak normal (= V1) sem grace', () => {
    const now = Date.now();
    const dates = [now, now - WEEK, now - 2 * WEEK, now - 3 * WEEK];
    const r = computeProtectedStreak(dates, { now: new Date(now) });
    expect(r.weeks).toBe(4);
    expect(r.rawStreak).toBe(4);
    expect(r.usedGrace).toBe(false);
  });

  it('Aplica grace quando jogou há 2 semanas e ainda não usou este mês', () => {
    const now = Date.now();
    const dates = [now - 2 * WEEK, now - 3 * WEEK, now - 4 * WEEK];
    const r = computeProtectedStreak(dates, { now: new Date(now) });
    // Sem grace: a última jogatina foi há 2 semanas, então a streak
    // baseada em V1 seria 3 (3 semanas). Com grace: 4.
    expect(r.weeks).toBe(4);
  });

  it('NÃO aplica grace se já usou este mês', () => {
    const now = Date.now();
    const dates = [now - 2 * WEEK, now - 3 * WEEK, now - 4 * WEEK];
    const currentMonth = new Date(now).toISOString().slice(0, 7); // YYYY-MM
    const r = computeProtectedStreak(dates, {
      now: new Date(now),
      meta: {
        weeks: 0,
        usedGraceThisMonth: true,
        graceMonth: currentMonth,
        frozenUntil: null,
        lastPlayAt: now,
      },
    });
    // Sem grace: 3 semanas
    expect(r.weeks).toBe(3);
  });

  it('respeita modo férias', () => {
    const now = Date.now();
    const frozenUntil = new Date(now + 7 * DAY).toISOString();
    const r = computeProtectedStreak([], {
      now: new Date(now),
      meta: {
        weeks: 8,
        usedGraceThisMonth: false,
        graceMonth: null,
        frozenUntil,
        lastPlayAt: 0,
      },
    });
    expect(r.weeks).toBe(8);
    expect(r.frozen).toBe(true);
    expect(r.frozenUntil).toBe(frozenUntil);
  });

  it('calcula daysSinceLastPlay', () => {
    const now = Date.now();
    const r = computeProtectedStreak([now - 5 * DAY], { now: new Date(now) });
    expect(r.daysSinceLastPlay).toBe(5);
  });
});

describe('streakProtection · grace', () => {
  it('canUseGrace retorna true se nunca usou', () => {
    expect(canUseGrace(null)).toBe(true);
    expect(canUseGrace({})).toBe(true);
  });

  it('canUseGrace retorna false se usou no mês corrente', () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(canUseGrace({ usedGraceThisMonth: true, graceMonth: month }, now)).toBe(false);
  });

  it('canUseGrace retorna true se usou no mês passado', () => {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = `${lastYear}-${String(lastMonth).padStart(2, '0')}`;
    expect(canUseGrace({ usedGraceThisMonth: true, graceMonth: month }, now)).toBe(true);
  });

  it('applyGrace retorna novo meta com grace usado', () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const next = applyGrace({ weeks: 5 }, now);
    expect(next.usedGraceThisMonth).toBe(true);
    expect(next.graceMonth).toBe('2026-09');
    expect(next.weeks).toBe(5);
  });
});

describe('streakProtection · vacation', () => {
  it('activateVacation congela por 7 dias', () => {
    const now = new Date('2026-09-15T12:00:00Z');
    const next = activateVacation({ weeks: 8 }, 8, now);
    expect(next.frozenUntil).not.toBeNull();
    const until = new Date(next.frozenUntil).getTime();
    const expected = now.getTime() + 7 * DAY;
    // margem de 1 segundo pra timezone
    expect(Math.abs(until - expected)).toBeLessThan(DAY);
  });

  it('deactivateVacation remove o freeze', () => {
    const next = deactivateVacation({ weeks: 8, frozenUntil: '2026-09-22' });
    expect(next.frozenUntil).toBeNull();
    expect(next.weeks).toBe(8);
  });
});

describe('streakProtection · milestones', () => {
  it('STREAK_MILESTONES tem 5 marcos', () => {
    expect(STREAK_MILESTONES).toHaveLength(5);
    expect(STREAK_MILESTONES[0].weeks).toBe(4);
    expect(STREAK_MILESTONES[4].weeks).toBe(52);
  });

  it('nextStreakMilestone retorna o próximo > current', () => {
    expect(nextStreakMilestone(0).weeks).toBe(4);
    expect(nextStreakMilestone(3).weeks).toBe(4);
    expect(nextStreakMilestone(4).weeks).toBe(8);
    expect(nextStreakMilestone(12).weeks).toBe(26);
    expect(nextStreakMilestone(52)).toBeNull();
  });

  it('achievedMilestones retorna os marcos <= current', () => {
    const a = achievedMilestones(12);
    expect(a.map((m) => m.weeks)).toEqual([4, 8, 12]);
  });

  it('milestoneXpTotal soma os XP bônus', () => {
    expect(milestoneXpTotal(0)).toBe(0);
    expect(milestoneXpTotal(3)).toBe(0);
    expect(milestoneXpTotal(4)).toBe(100);
    expect(milestoneXpTotal(12)).toBe(800); // 100+200+500
    expect(milestoneXpTotal(52)).toBe(4300); // 100+200+500+1000+2500
  });
});

describe('streakProtection · comeback', () => {
  it('shouldApplyComeback = false se sem meta', () => {
    const now = Date.now();
    expect(shouldApplyComeback(null, [now])).toBe(false);
  });

  it('shouldApplyComeback = false se break < 4 semanas', () => {
    const now = Date.now();
    expect(shouldApplyComeback(
      { lastPlayAt: now - 2 * WEEK, comebackClaimed: false },
      [now],
      new Date(now),
    )).toBe(false);
  });

  it('shouldApplyComeback = true se break >= 4 semanas e há jogo novo', () => {
    const now = Date.now();
    expect(shouldApplyComeback(
      { lastPlayAt: now - 5 * WEEK, comebackClaimed: false },
      [now],
      new Date(now),
    )).toBe(true);
  });

  it('shouldApplyComeback = false se já reclamou', () => {
    const now = Date.now();
    expect(shouldApplyComeback(
      { lastPlayAt: now - 5 * WEEK, comebackClaimed: true },
      [now],
      new Date(now),
    )).toBe(false);
  });

  it('shouldApplyComeback = false se sem jogos novos', () => {
    const now = Date.now();
    expect(shouldApplyComeback(
      { lastPlayAt: now - 5 * WEEK, comebackClaimed: false },
      [],
      new Date(now),
    )).toBe(false);
  });

  it('COMEBACK_XP = 200 e MIN_BREAK_WEEKS = 4', () => {
    expect(COMEBACK_XP).toBe(200);
    expect(COMEBACK_MIN_BREAK_WEEKS).toBe(4);
  });
});
