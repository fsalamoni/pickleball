/**
 * Testes para `skillTrees.js`.
 */

import { describe, it, expect } from 'vitest';
import {
  SKILL_TREE_KEYS,
  SKILL_TREE_META,
  buildSkillTrees,
  dominantTree,
  listSkillTrees,
} from './skillTrees.js';
import { XP_WEIGHTS_V2 } from './progressionV2.js';

describe('skillTrees · constantes', () => {
  it('SKILL_TREE_KEYS tem 5 trilhas', () => {
    expect(SKILL_TREE_KEYS).toHaveLength(5);
    expect(SKILL_TREE_KEYS).toEqual(['tournament', 'social', 'arena', 'coach', 'club']);
  });

  it('SKILL_TREE_META tem meta para cada chave', () => {
    for (const key of SKILL_TREE_KEYS) {
      const meta = SKILL_TREE_META[key];
      expect(meta).toBeTruthy();
      expect(meta.name).toBeTruthy();
      expect(meta.icon).toBeTruthy();
      expect(meta.color).toBeTruthy();
      expect(meta.description).toBeTruthy();
    }
  });
});

describe('skillTrees · buildSkillTrees', () => {
  it('retorna 5 trees zeradas para xpBySource vazio', () => {
    const out = buildSkillTrees({}, XP_WEIGHTS_V2);
    expect(Object.keys(out.trees)).toHaveLength(5);
    for (const key of SKILL_TREE_KEYS) {
      expect(out.trees[key].xp).toBe(0);
      expect(out.trees[key].level).toBe(1);
    }
    expect(out.unassignedSources).toEqual([]);
  });

  it('mapeia fontes para a árvore correta', () => {
    const out = buildSkillTrees({
      tournament_attended: 8,    // tournament: 8*30 = 240
      tournament_title: 1,        // tournament: 1*120 = 120
      kudos_given: 50,            // social: 50*1 = 50
      booking_attended: 10,       // arena: 10*30 = 300
      club_created: 1,            // club: 1*200 = 200
      lesson_first: 1,            // coach: 1*80 = 80
    }, XP_WEIGHTS_V2);

    expect(out.trees.tournament.xp).toBe(360);
    expect(out.trees.social.xp).toBe(50);
    expect(out.trees.arena.xp).toBe(300);
    expect(out.trees.coach.xp).toBe(80);
    expect(out.trees.club.xp).toBe(200);

    // Verifica nível (mesma curva 500*L)
    // tournament: 360 → nível 1
    expect(out.trees.tournament.level).toBe(1);
    // arena: 300 → nível 1
    expect(out.trees.arena.level).toBe(1);
    // club: 200 → nível 1
    expect(out.trees.club.level).toBe(1);
  });

  it('atribui nível correto com muito XP numa trilha', () => {
    // 50 títulos = 50*120 = 6.000 XP em tournament
    const out = buildSkillTrees({ tournament_title: 50 }, XP_WEIGHTS_V2);
    expect(out.trees.tournament.xp).toBe(6000);
    // Curva: N1=0, N2=500, N3=1500, N4=3000, N5=5000, N6=7500
    // 6000 está entre 5000 (entra N5) e 7500 (entra N6) → N5
    expect(out.trees.tournament.level).toBe(5);
  });

  it('xpBySourceInTree separa corretamente', () => {
    const out = buildSkillTrees({
      tournament_attended: 1,
      tournament_title: 1,
      kudos_given: 5,
    }, XP_WEIGHTS_V2);
    expect(out.xpBySourceInTree.tournament.tournament_attended).toBe(30);
    expect(out.xpBySourceInTree.tournament.tournament_title).toBe(120);
    expect(out.xpBySourceInTree.social.kudos_given).toBe(5);
    expect(out.xpBySourceInTree.arena).toEqual({});
  });

  it('fontes não mapeadas vão para unassignedSources', () => {
    const out = buildSkillTrees({
      tournament_attended: 1,
      daily_first_action: 1,        // não tem árvore
      weekly_all_missions_complete: 1, // não tem árvore
    }, XP_WEIGHTS_V2);
    expect(out.unassignedSources).toContain('daily_first_action');
    expect(out.unassignedSources).toContain('weekly_all_missions_complete');
    expect(out.unassignedSources).not.toContain('tournament_attended');
  });

  it('lida com count negativo (punições)', () => {
    const out = buildSkillTrees({
      booking_no_show: 2, // 2 * -30 = -60 em arena
    }, XP_WEIGHTS_V2);
    expect(out.trees.arena.xp).toBe(-60);
  });

  it('lida com null/undefined', () => {
    const out = buildSkillTrees(null, XP_WEIGHTS_V2);
    expect(out.trees.tournament.xp).toBe(0);
  });
});

describe('skillTrees · dominantTree', () => {
  it('retorna a tree com mais XP', () => {
    const trees = {
      tournament: { xp: 1000, level: 2 },
      social: { xp: 5000, level: 3 },
      arena: { xp: 200, level: 1 },
      coach: { xp: 0, level: 1 },
      club: { xp: 100, level: 1 },
    };
    expect(dominantTree(trees)).toBe('social');
  });

  it('retorna null para trees vazias', () => {
    expect(dominantTree({})).toBeNull();
  });

  it('se duas trees empatam, retorna a primeira', () => {
    const trees = {
      tournament: { xp: 100, level: 1 },
      social: { xp: 100, level: 1 },
    };
    expect(dominantTree(trees)).toBe('tournament');
  });
});

describe('skillTrees · listSkillTrees', () => {
  it('retorna 5 items ordenados', () => {
    const list = listSkillTrees({});
    expect(list).toHaveLength(5);
    expect(list[0].key).toBe('tournament');
    expect(list[4].key).toBe('club');
  });

  it('cada item tem meta + stats', () => {
    const list = listSkillTrees({
      tournament: { xp: 1000, level: 2 },
    });
    const tournament = list.find((t) => t.key === 'tournament');
    expect(tournament.name).toBe('Torneiro');
    expect(tournament.icon).toBe('🏆');
    expect(tournament.xp).toBe(1000);
    expect(tournament.level).toBe(2);
  });
});
