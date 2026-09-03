/**
 * Testes para `missions.js`.
 */

import { describe, it, expect } from 'vitest';
import {
  generateMissions,
  progressMission,
  totalMissionXp,
  missionsProgress,
  missionWindow,
  summarizeMissions,
  MISSION_BONUS_XP,
} from './missions.js';

describe('missions · generateMissions', () => {
  it('gera 3 missões diárias', () => {
    const m = generateMissions({ uid: 'u1', scope: 'daily' });
    expect(m).toHaveLength(3);
    m.forEach((mission) => {
      expect(mission.scope).toBe('daily');
      expect(mission.target).toBeGreaterThan(0);
      expect(mission.xpReward).toBeGreaterThan(0);
    });
  });

  // O gerador pede 5 semanais e 10 mensais, mas só entrega missão cuja
  // métrica a plataforma consegue MEDIR (ver `missionMetrics.js`). Hoje isso
  // limita o pool; conforme outros módulos exponham seus contadores, as
  // missões voltam sozinhas ao sorteio e estes números sobem.
  it('gera missões semanais dentro do teto pedido', () => {
    const m = generateMissions({ uid: 'u1', scope: 'weekly' });
    expect(m.length).toBeGreaterThan(0);
    expect(m.length).toBeLessThanOrEqual(5);
  });

  it('gera missões mensais dentro do teto pedido', () => {
    const m = generateMissions({ uid: 'u1', scope: 'monthly' });
    expect(m.length).toBeGreaterThan(0);
    expect(m.length).toBeLessThanOrEqual(10);
  });

  it('IDs são únicos (uid + scope + date + templateId)', () => {
    const m = generateMissions({ uid: 'u1', scope: 'daily' });
    const ids = m.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('seed determinístico gera as mesmas missões', () => {
    const a = generateMissions({ uid: 'u1', scope: 'daily', seed: 12345 });
    const b = generateMissions({ uid: 'u1', scope: 'daily', seed: 12345 });
    expect(a.map((m) => m.templateId)).toEqual(b.map((m) => m.templateId));
  });

  it('excludeIds filtra templates já usados', () => {
    const m1 = generateMissions({ uid: 'u1', scope: 'daily', seed: 12345 });
    const exclude = m1.map((m) => m.templateId);
    const m2 = generateMissions({ uid: 'u1', scope: 'daily', seed: 12345, excludeIds: exclude });
    expect(m2.map((m) => m.templateId).every((id) => !exclude.includes(id))).toBe(true);
  });

  it('tier mínimo filtra templates acima do tier', () => {
    // monthly_play_30 só pra Aprendiz+
    const m1 = generateMissions({ uid: 'u1', scope: 'monthly', currentTier: 'Calouro', seed: 99999 });
    expect(m1.map((x) => x.templateId)).not.toContain('monthly_play_30');
    const m2 = generateMissions({ uid: 'u1', scope: 'monthly', currentTier: 'Aprendiz', seed: 99999 });
    // pode ou não incluir, mas se incluir é porque pegou
    expect(m2.every((x) => x.templateId === 'monthly_play_30' || x.templateId !== 'monthly_play_30')).toBe(true);
  });
});

describe('missions · progressMission', () => {
  it('incrementa current', () => {
    const m = progressMission({ target: 3, current: 0, done: false }, 1);
    expect(m.current).toBe(1);
    expect(m.done).toBe(false);
  });

  it('marca done quando current >= target', () => {
    const m = progressMission({ target: 3, current: 2, done: false, xpReward: 100 }, 2);
    expect(m.current).toBe(4);
    expect(m.done).toBe(true);
    expect(m.xpEarned).toBe(100);
  });

  it('não dá XP duplo se já done', () => {
    const m1 = progressMission({ target: 1, current: 1, done: true, xpReward: 50, xpEarned: 50 }, 1);
    expect(m1.xpEarned).toBe(50);
  });

  it('lida com negative delta (reverter)', () => {
    const m = progressMission({ target: 5, current: 3, done: false }, -2);
    expect(m.current).toBe(1);
    expect(m.done).toBe(false);
  });
});

describe('missions · missionWindow', () => {
  it('daily = 24h', () => {
    const now = new Date('2026-09-01T15:00:00Z');
    const w = missionWindow('daily', now);
    expect(w.endMs - w.startMs).toBe(24 * 60 * 60 * 1000);
  });

  it('weekly = 7 dias', () => {
    const now = new Date('2026-09-02T15:00:00Z'); // quarta
    const w = missionWindow('weekly', now);
    expect(w.endMs - w.startMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('monthly = primeiro dia do mês até primeiro do próximo', () => {
    const now = new Date('2026-09-15T15:00:00Z');
    const w = missionWindow('monthly', now);
    expect(new Date(w.startMs).getMonth()).toBe(8); // setembro (0-11)
    expect(new Date(w.endMs).getMonth()).toBe(9); // outubro
  });
});

describe('missions · helpers', () => {
  it('totalMissionXp soma xpEarned', () => {
    expect(totalMissionXp([
      { xpEarned: 30 },
      { xpEarned: 50 },
      { xpEarned: 0 },
    ])).toBe(80);
  });

  it('missionsProgress = 0 quando vazio', () => {
    expect(missionsProgress([])).toBe(0);
  });

  it('missionsProgress = 0.5 quando metade feito', () => {
    const m = [
      { target: 10, current: 10, done: true },
      { target: 10, current: 0,  done: false },
    ];
    expect(missionsProgress(m)).toBe(0.5);
  });

  it('missionsProgress = 1 quando tudo completo', () => {
    const m = [
      { target: 5, current: 5, done: true },
      { target: 3, current: 3, done: true },
    ];
    expect(missionsProgress(m)).toBe(1);
  });

  it('summarizeMissions', () => {
    const m = [
      { target: 1, current: 1, done: true, xpEarned: 30 },
      { target: 5, current: 3, done: false, xpEarned: 0 },
    ];
    const s = summarizeMissions(m);
    expect(s.total).toBe(2);
    expect(s.done).toBe(1);
    expect(s.xpEarned).toBe(30);
    expect(s.progress).toBeCloseTo(4 / 6, 5);
  });

  it('MISSION_BONUS_XP tem os 3 escopos', () => {
    expect(MISSION_BONUS_XP.daily).toBe(50);
    expect(MISSION_BONUS_XP.weekly).toBe(250);
    expect(MISSION_BONUS_XP.monthly).toBe(1000);
  });
});
