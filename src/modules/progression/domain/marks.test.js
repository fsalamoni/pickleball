import { describe, it, expect } from 'vitest';
import { reachedMarks, pendingMarks, planCelebrations } from './marks.js';

describe('marcos alcançados', () => {
  it('Calouro não comemora; Aprendiz traz o marco do tier', () => {
    expect(reachedMarks({ tier: 'Calouro' }).filter((m) => m.family === 'tier')).toEqual([]);
    const aprendiz = reachedMarks({ tier: 'Aprendiz' }).filter((m) => m.family === 'tier');
    expect(aprendiz.map((m) => m.key)).toEqual(['tier_Aprendiz']);
    expect(aprendiz[0].title).toBe('Você subiu para Aprendiz!');
  });

  it('contagens cruzam as linhas certas', () => {
    const chaves = reachedMarks({ games: 30, wins: 11, streakWeeks: 4, level: 5 }).map((m) => m.key);
    expect(chaves).toEqual(expect.arrayContaining(['games_10', 'games_25', 'wins_10', 'streak_4', 'level_5']));
    expect(chaves).not.toContain('games_50');
  });

  it('primeiro título e primeiro pódio', () => {
    const k = reachedMarks({ titles: 2, podiums: 3 }).map((m) => m.key);
    expect(k).toEqual(expect.arrayContaining(['first_title', 'first_podium']));
  });
});

describe('o que comemorar', () => {
  it('veterano não leva uma chuva de confete: só o mais alto de cada família', () => {
    const reached = reachedMarks({ tier: 'Veterano', games: 120, wins: 30, streakWeeks: 12 });
    const { celebrate, silent } = pendingMarks(reached, {});
    const fam = celebrate.map((m) => m.family).sort();
    expect(new Set(fam).size).toBe(fam.length); // uma por família
    expect(celebrate.find((m) => m.family === 'games').key).toBe('games_100');
    expect(celebrate.find((m) => m.family === 'tier').key).toBe('tier_Veterano');
    expect(silent).toEqual(expect.arrayContaining(['games_10', 'games_25', 'games_50', 'tier_Aprendiz']));
  });

  it('o que já foi comemorado não volta', () => {
    const reached = reachedMarks({ games: 30 });
    const { celebrate } = pendingMarks(reached, { games_25: 1, games_10: 1 });
    expect(celebrate).toEqual([]);
  });

  it('comemoração desligada: nada aparece, mas tudo fica registrado', () => {
    const reached = reachedMarks({ games: 30, tier: 'Aprendiz' });
    const off = planCelebrations(reached, {}, { enabled: false, now: 5 });
    expect(off.show).toEqual([]);
    expect(Object.keys(off.record).sort()).toEqual(['games_10', 'games_25', 'tier_Aprendiz']);
    const on = planCelebrations(reached, {}, { enabled: true, now: 5 });
    expect(on.show.length).toBe(2);
  });
});
