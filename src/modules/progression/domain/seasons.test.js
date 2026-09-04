import { describe, it, expect } from 'vitest';
import {
  getSeason, seasonRange, monthlySeasonRange, daysRemainingInMonth,
  computeSeasonXp, topN, buildHallOfFame,
  SEASON, SEASON_MONTHS, MONTHLY_SEASON_PRIZES,
} from './seasons.js';

describe('seasons · getSeason', () => {
  it('janeiro = summer', () => {
    expect(getSeason(new Date(2026, 0, 15)).season).toBe(SEASON.SUMMER);
  });
  it('abril = autumn', () => {
    expect(getSeason(new Date(2026, 3, 15)).season).toBe(SEASON.AUTUMN);
  });
  it('julho = winter', () => {
    expect(getSeason(new Date(2026, 6, 15)).season).toBe(SEASON.WINTER);
  });
  it('novembro = spring', () => {
    expect(getSeason(new Date(2026, 10, 15)).season).toBe(SEASON.SPRING);
  });
  it('label = "summer-2026"', () => {
    expect(getSeason(new Date(2026, 0, 15)).label).toBe('summer-2026');
  });
});

describe('seasons · ranges', () => {
  it('seasonRange 3 meses', () => {
    const r = seasonRange(SEASON.SUMMER, 2026);
    expect(new Date(r.startMs).getMonth()).toBe(0); // jan
    expect(new Date(r.endMs).getMonth()).toBe(3); // abr
  });
  it('monthlySeasonRange = 1 mês', () => {
    const r = monthlySeasonRange(2026, 8); // setembro
    expect(new Date(r.startMs).getMonth()).toBe(8);
    expect(new Date(r.endMs).getMonth()).toBe(9);
  });
  it('daysRemainingInMonth', () => {
    const r = daysRemainingInMonth(new Date(2026, 8, 30, 12, 0, 0));
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(2);
  });
});

describe('seasons · topN', () => {
  it('ordena por xp_total desc', () => {
    const top = topN([
      { uid: 'a', xp_total: 100 },
      { uid: 'b', xp_total: 500 },
      { uid: 'c', xp_total: 200 },
    ], 3);
    expect(top[0].uid).toBe('b');
    expect(top[1].uid).toBe('c');
    expect(top[2].uid).toBe('a');
  });
  it('atribui position sequencial', () => {
    const top = topN([{ uid: 'a', xp_total: 100 }], 1);
    expect(top[0].position).toBe(1);
  });
  it('filtra xp=0', () => {
    const top = topN([{ uid: 'a', xp_total: 0 }, { uid: 'b', xp_total: 50 }], 5);
    expect(top).toHaveLength(1);
    expect(top[0].uid).toBe('b');
  });
});

describe('seasons · buildHallOfFame', () => {
  it('top 3 geral + top 3 por estado', () => {
    const users = [
      { uid: 'u1', xp_total: 1000, state: 'PR', display_name: 'A' },
      { uid: 'u2', xp_total: 900,  state: 'PR', display_name: 'B' },
      { uid: 'u3', xp_total: 800,  state: 'PR', display_name: 'C' },
      { uid: 'u4', xp_total: 700,  state: 'PR', display_name: 'D' },
      { uid: 'u5', xp_total: 600,  state: 'SP', display_name: 'E' },
      { uid: 'u6', xp_total: 500,  state: 'SP', display_name: 'F' },
    ];
    const hof = buildHallOfFame(users, 3, 3);
    expect(hof.geral).toHaveLength(3);
    expect(hof.geral[0].uid).toBe('u1');
    expect(hof.porEstado.PR).toHaveLength(3);
    expect(hof.porEstado.SP).toHaveLength(2);
  });

  it('lida com estados ausentes', () => {
    const hof = buildHallOfFame([{ uid: 'u1', xp_total: 100 }]);
    expect(hof.porEstado).toEqual({});
  });
});

describe('seasons · computeSeasonXp', () => {
  it('retorna tier baseado em xp', () => {
    const r = computeSeasonXp({ xp_total: 5000 });
    expect(r.xp).toBe(5000);
    expect(r.tier.name).toBe('Aprendiz');
  });
  it('xp 100000 = Imortal', () => {
    expect(computeSeasonXp({ xp_total: 100000 }).tier.name).toBe('Imortal');
  });
});

describe('seasons · constantes', () => {
  it('SEASON_MONTHS cobre 12 meses', () => {
    const total = Object.values(SEASON_MONTHS).reduce((s, arr) => s + arr.length, 0);
    expect(total).toBe(12);
  });
  it('MONTHLY_SEASON_PRIZES tem 3 prêmios', () => {
    expect(Object.keys(MONTHLY_SEASON_PRIZES)).toHaveLength(3);
  });
});
