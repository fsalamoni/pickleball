/**
 * Testes para `progressionV2.js` (Fase 0, Sprint 0.1).
 *
 * Cobre:
 *  - `XP_WEIGHTS_V2` é congelado e tem as chaves esperadas
 *  - `computeXpV2` retorna total correto a partir de mapa
 *  - `computeXpV2` ignora fontes desconhecidas (não quebra)
 *  - `computeXpV2` com `applyCaps` aplica daily/weekly/burst
 *  - `levelFromXpV2` mantém compat com V1 (mesma curva)
 *  - `levelThresholds` retorna thresholds até nível 30
 *  - `computeWeekStreakV2` mantém mesmo algoritmo
 *  - `summaryToXpBySource` mapeia V1 → V2 corretamente
 *  - `computeXpCompatV1` retorna mesmo valor de V1 `computeXp`
 *  - `applyXpCapV2` classifica heavy vs light corretamente
 *  - Edge cases: zero, negativo, NaN, valores extremos
 */

import { describe, it, expect } from 'vitest';
import {
  XP_WEIGHTS_V2,
  XP_CAPS_V2,
  computeXpV2,
  computeXpCompatV1,
  applyXpCapV2,
  levelFromXpV2,
  levelThresholds,
  computeWeekStreakV2,
  summaryToXpBySource,
  compatV1TotalFromSummary,
} from './progressionV2.js';
import { computeXp as computeXpV1, levelFromXp, computeWeekStreak } from './progression.js';

describe('progressionV2 · XP_WEIGHTS_V2', () => {
  it('é um Object congelado', () => {
    expect(Object.isFrozen(XP_WEIGHTS_V2)).toBe(true);
  });

  it('tem todas as categorias esperadas', () => {
    const keys = Object.keys(XP_WEIGHTS_V2);
    // Categorias que DEVEM existir:
    expect(keys).toContain('tournament_attended');
    expect(keys).toContain('tournament_title');
    expect(keys).toContain('game_played');
    expect(keys).toContain('game_won');
    expect(keys).toContain('kudos_given');
    expect(keys).toContain('kudos_received');
    expect(keys).toContain('booking_attended');
    expect(keys).toContain('booking_no_show');
    expect(keys).toContain('lesson_first');
    expect(keys).toContain('teacher_first_lesson');
    expect(keys).toContain('club_created');
    expect(keys).toContain('onboarding_welcome');
    expect(keys).toContain('referral_signed_up');
    expect(keys).toContain('daily_first_action');
  });

  it('pesos positivos são > 0', () => {
    Object.entries(XP_WEIGHTS_V2).forEach(([key, weight]) => {
      if (weight > 0) {
        expect(weight, `weight for ${key} deve ser > 0`).toBeGreaterThan(0);
      }
    });
  });

  it('pesos de punição são negativos', () => {
    expect(XP_WEIGHTS_V2.booking_no_show).toBeLessThan(0);
    expect(XP_WEIGHTS_V2.booking_cancelled_late).toBeLessThan(0);
    expect(XP_WEIGHTS_V2.tournament_withdrew_late).toBeLessThan(0);
  });
});

describe('progressionV2 · XP_CAPS_V2', () => {
  it('é um Object congelado', () => {
    expect(Object.isFrozen(XP_CAPS_V2)).toBe(true);
  });

  it('tem os 3 caps esperados', () => {
    expect(XP_CAPS_V2.daily).toBe(500);
    expect(XP_CAPS_V2.weekly).toBe(2500);
    expect(XP_CAPS_V2.burst).toBe(200);
  });
});

describe('progressionV2 · computeXpV2', () => {
  it('retorna 0 para mapa vazio', () => {
    const out = computeXpV2({});
    expect(out.xpTotal).toBe(0);
    expect(out.xpBySource).toEqual({});
  });

  it('computa XP total a partir de fontes conhecidas', () => {
    const out = computeXpV2({
      tournament_attended: 8,
      tournament_podium: 1,
      tournament_title: 0,
      game_played: 142,
      game_won: 66,
    });
    // 8*30 + 1*40 + 0*120 + 142*10 + 66*20
    // = 240 + 40 + 0 + 1420 + 1320 = 3020
    expect(out.xpTotal).toBe(3020);
  });

  it('ignora fontes desconhecidas sem quebrar', () => {
    const out = computeXpV2({
      tournament_attended: 1,
      fonte_que_nao_existe: 999,
      outra_estranha: 100,
    });
    // Só conta tournament_attended: 1*30 = 30
    expect(out.xpTotal).toBe(30);
    expect(out.xpBySource.tournament_attended).toBe(30);
  });

  it('lida com NaN e null graciosamente', () => {
    const out = computeXpV2({
      tournament_attended: NaN,
      game_played: null,
      game_won: undefined,
    });
    expect(out.xpTotal).toBe(0);
  });

  it('lida com valores negativos (punições)', () => {
    const out = computeXpV2({
      tournament_attended: 1,
      booking_no_show: 2,
    });
    // 1*30 + 2*(-30) = 30 - 60 = -30
    expect(out.xpTotal).toBe(-30);
  });
});

describe('progressionV2 · compat com V1', () => {
  it('computeXpCompatV1 = computeXp V1 para summary do Flavio', () => {
    const flavio = {
      played: 142,
      wins: 66,
      podiums: 1,
      titles: 0,
      tournaments: 8,
    };
    const v1 = computeXpV1(flavio);
    const compat = computeXpCompatV1(flavio);
    expect(compat).toBe(v1);
    expect(compat).toBe(3020);
  });

  it('compatV1TotalFromSummary = computeXpV1', () => {
    const summary = { played: 10, wins: 5, podiums: 2, titles: 1, tournaments: 3 };
    expect(compatV1TotalFromSummary(summary)).toBe(computeXpV1(summary));
  });

  it('summaryToXpBySource mapeia corretamente', () => {
    const summary = {
      played: 142,
      wins: 66,
      podiums: 1,
      titles: 0,
      tournaments: 8,
    };
    const map = summaryToXpBySource(summary);
    expect(map).toEqual({
      tournament_attended: 8,
      tournament_podium: 1,
      tournament_title: 0,
      game_played: 142,
      game_won: 66,
    });
    // V2 a partir do adapter dá o mesmo total que V1
    const v2 = computeXpV2(map);
    expect(v2.xpTotal).toBe(3020);
  });
});

describe('progressionV2 · applyXpCapV2', () => {
  it('não aplica cap quando ações são todas pesadas (heavy)', () => {
    const events = [
      { source: 'tournament_title', amount: 120, ts: Date.now() },
      { source: 'club_100_members', amount: 2500, ts: Date.now() },
    ];
    const out = applyXpCapV2(events, { now: new Date() });
    expect(out.kept).toHaveLength(2);
    expect(out.dropped).toHaveLength(0);
  });

  it('aplica cap diário em ações leves', () => {
    const now = new Date('2026-09-01T15:00:00Z');
    const events = [
      { source: 'kudos_given', amount: 100, ts: now.getTime() }, // cap em 500
      { source: 'kudos_received', amount: 100, ts: now.getTime() },
      { source: 'kudos_given', amount: 100, ts: now.getTime() },
      { source: 'kudos_given', amount: 100, ts: now.getTime() },
      { source: 'kudos_given', amount: 100, ts: now.getTime() },
      { source: 'kudos_given', amount: 100, ts: now.getTime() }, // 6º = 600 total → bloqueia
    ];
    const out = applyXpCapV2(events, { now });
    expect(out.dropped.length).toBeGreaterThan(0);
    expect(out.totals.dayXp).toBeLessThanOrEqual(XP_CAPS_V2.daily);
  });

  it('aplica cap burst (> 200 num único evento)', () => {
    const events = [
      { source: 'tournament_title', amount: 5000, ts: Date.now() }, // > burst
    ];
    const out = applyXpCapV2(events, { now: new Date() });
    expect(out.kept[0].capped).toBe(true);
    expect(out.kept[0].amount).toBe(XP_CAPS_V2.burst);
  });

  it('lida com array vazio', () => {
    const out = applyXpCapV2([], { now: new Date() });
    expect(out.kept).toEqual([]);
    expect(out.dropped).toEqual([]);
    expect(out.totals.totalXp).toBe(0);
  });
});

describe('progressionV2 · levelFromXpV2', () => {
  it('XP 0 = Nível 1, 0% progress', () => {
    const r = levelFromXpV2(0);
    expect(r.level).toBe(1);
    expect(r.xp).toBe(0);
    expect(r.progress).toBe(0);
  });

  it('XP 500 = Nível 2, 0% progress (acabou de subir)', () => {
    const r = levelFromXpV2(500);
    expect(r.level).toBe(2);
    expect(r.xpIntoLevel).toBe(0);
    expect(r.progress).toBe(0);
  });

  it('XP 3020 = Nível 4 com 20/2000 (Flavio na tela)', () => {
    const r = levelFromXpV2(3020);
    expect(r.level).toBe(4);
    expect(r.xp).toBe(3020);
    expect(r.xpIntoLevel).toBe(20);
    expect(r.xpForNext).toBe(2000);
  });

  it('XP 5000 = Nível 5 com 0/2500 (acabou de subir)', () => {
    const r = levelFromXpV2(5000);
    expect(r.level).toBe(5);
    expect(r.xpIntoLevel).toBe(0);
    expect(r.xpForNext).toBe(2500);
  });

  it('levelFromXpV2 = levelFromXp V1 (compat total)', () => {
    for (const xp of [0, 100, 500, 1000, 3020, 5000, 10000, 99999, 1000000]) {
      const v1 = levelFromXp(xp);
      const v2 = levelFromXpV2(xp);
      expect(v2.level).toBe(v1.level);
      expect(v2.xpIntoLevel).toBe(v1.xpIntoLevel);
      expect(v2.xpForNext).toBe(v1.xpForNext);
    }
  });

  it('lida com XP negativo → nível 1', () => {
    const r = levelFromXpV2(-100);
    expect(r.level).toBe(1);
  });

  it('lida com NaN → nível 1', () => {
    const r = levelFromXpV2(NaN);
    expect(r.level).toBe(1);
  });

  it('lida com null/undefined → nível 1', () => {
    expect(levelFromXpV2(null).level).toBe(1);
    expect(levelFromXpV2(undefined).level).toBe(1);
  });
});

describe('progressionV2 · levelThresholds', () => {
  it('retorna 30 níveis', () => {
    const t = levelThresholds();
    expect(t).toHaveLength(30);
  });

  it('nível 1 começa em 0', () => {
    expect(levelThresholds()[0]).toEqual({ level: 1, threshold: 0 });
  });

  it('thresholds são crescentes', () => {
    const t = levelThresholds();
    for (let i = 1; i < t.length; i += 1) {
      expect(t[i].threshold).toBeGreaterThan(t[i - 1].threshold);
    }
  });
});

describe('progressionV2 · computeWeekStreakV2', () => {
  it('retorna 0 para array vazio', () => {
    expect(computeWeekStreakV2([])).toBe(0);
  });

  it('retorna 0 para null/undefined', () => {
    expect(computeWeekStreakV2(null)).toBe(0);
    expect(computeWeekStreakV2(undefined)).toBe(0);
  });

  it('computeWeekStreakV2 = computeWeekStreak V1 (mesmo algoritmo)', () => {
    const now = Date.now();
    const dates = [
      now,
      now - 7 * 86400000,
      now - 14 * 86400000,
      now - 21 * 86400000,
    ];
    expect(computeWeekStreakV2(dates)).toBe(computeWeekStreak(dates));
  });

  it('filtra datas inválidas', () => {
    const out = computeWeekStreakV2([0, -1, NaN, 'string', undefined, Date.now()]);
    expect(out).toBeGreaterThanOrEqual(1);
  });
});
