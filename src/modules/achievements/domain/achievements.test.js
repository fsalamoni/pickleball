import { describe, it, expect } from 'vitest';
import { computeAchievements, ACHIEVEMENTS } from './achievements.js';

describe('computeAchievements', () => {
  it('não desbloqueia nada para um jogador zerado', () => {
    const r = computeAchievements({});
    expect(r.unlockedCount).toBe(0);
    expect(r.total).toBe(ACHIEVEMENTS.length);
    expect(r.locked).toHaveLength(ACHIEVEMENTS.length);
  });

  it('desbloqueia marcos básicos a partir do resumo', () => {
    const r = computeAchievements({ tournaments: 2, played: 5, wins: 3, podiums: 1, titles: 1 });
    const ids = r.unlocked.map((a) => a.id);
    expect(ids).toContain('first_tournament');
    expect(ids).toContain('first_win');
    expect(ids).toContain('first_podium');
    expect(ids).toContain('champion');
    expect(ids).not.toContain('wins_10');
  });

  it('considera o rating quando informado', () => {
    expect(computeAchievements({ rating: 1300 }).unlocked.map((a) => a.id)).toEqual(
      expect.arrayContaining(['rating_1100', 'rating_1300']),
    );
    expect(computeAchievements({ rating: 1000 }).unlocked.map((a) => a.id)).not.toContain('rating_1100');
  });

  it('unlocked + locked cobrem o catálogo sem sobreposição', () => {
    const r = computeAchievements({ wins: 60, titles: 6, played: 120, tournaments: 12, podiums: 4, rating: 1400 });
    expect(r.unlocked.length + r.locked.length).toBe(ACHIEVEMENTS.length);
  });
});
