import { describe, it, expect } from 'vitest';
import {
  computeXp,
  levelFromXp,
  computeWeekStreak,
  normalizeGoalInput,
  goalProgress,
  GOAL_METRIC,
} from './progression.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('computeXp / levelFromXp', () => {
  it('soma XP por atividade', () => {
    expect(computeXp({ played: 1, wins: 1, titles: 1 })).toBe(10 + 20 + 120);
  });
  it('zerado fica no nível 1 com progresso 0', () => {
    const l = levelFromXp(0);
    expect(l.level).toBe(1);
    expect(l.progress).toBe(0);
  });
  it('sobe de nível ao passar do limiar (500 no nível 1)', () => {
    expect(levelFromXp(500).level).toBe(2);
    expect(levelFromXp(499).level).toBe(1);
  });
});

describe('computeWeekStreak', () => {
  it('conta semanas consecutivas terminando na mais recente', () => {
    const base = 1000 * WEEK_MS;
    const dates = [base, base + WEEK_MS, base + 2 * WEEK_MS]; // 3 semanas seguidas
    expect(computeWeekStreak(dates)).toBe(3);
  });
  it('quebra a sequência em lacuna', () => {
    const base = 1000 * WEEK_MS;
    const dates = [base, base + 2 * WEEK_MS]; // lacuna de 1 semana
    expect(computeWeekStreak(dates)).toBe(1);
  });
  it('retorna 0 sem datas', () => {
    expect(computeWeekStreak([])).toBe(0);
  });
});

describe('metas', () => {
  it('valida alvo positivo', () => {
    expect(normalizeGoalInput({ metric: 'wins', target: 0 }).valid).toBe(false);
    expect(normalizeGoalInput({ metric: 'wins', target: 5 }).valid).toBe(true);
  });
  it('usa métrica padrão quando inválida', () => {
    expect(normalizeGoalInput({ metric: 'zzz', target: 3 }).value.metric).toBe(GOAL_METRIC.GAMES);
  });
  it('calcula progresso e conclusão', () => {
    expect(goalProgress({ metric: 'wins', target: 10 }, { wins: 5 })).toMatchObject({ current: 5, ratio: 0.5, done: false });
    expect(goalProgress({ metric: 'wins', target: 10 }, { wins: 12 }).done).toBe(true);
  });
});
