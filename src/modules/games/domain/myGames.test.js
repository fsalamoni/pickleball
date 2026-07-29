import { describe, it, expect } from 'vitest';
import {
  mirrorGameToMyGame, sourceGameToMyGame, foldGameDayGamesIntoStats,
  gameDayMirrorId, MY_GAME_SOURCE,
} from './myGames.js';

describe('mirrorGameToMyGame', () => {
  const base = {
    id: 'gd_g1_x', side_a_ids: ['u1', 'u2'], side_b_ids: ['u3', 'u4'],
    score_a: 11, score_b: 7, winner_side: 'a', kind: 'doubles',
    event_title: 'Sábado', source: 'athlete_game_day', created_at: '2026-07-30',
  };
  const names = new Map([['u3', { name: 'Caio' }], ['u4', { name: 'Duda' }]]);

  it('normaliza jogo do lado vencedor', () => {
    const g = mirrorGameToMyGame('u1', base, new Map([['u3', 'Caio']]));
    expect(g.won).toBe(true);
    expect(g.myScore).toBe(11);
    expect(g.oppScore).toBe(7);
    expect(g.kind).toBe('doubles');
    expect(g.source).toBe(MY_GAME_SOURCE.GAME_DAY);
  });

  it('normaliza jogo do lado perdedor e resolve nomes', () => {
    const g = mirrorGameToMyGame('u1', base, new Map());
    // usa fallback quando não há nome
    expect(g.opponent).toContain('Atleta');
    const g2 = mirrorGameToMyGame('u3', base, new Map([['u1', 'Ana'], ['u2', 'Bia']]));
    expect(g2.won).toBe(false);
    expect(g2.myScore).toBe(7);
  });

  it('marca clube quando source é club_event_game', () => {
    const g = mirrorGameToMyGame('u1', { ...base, source: 'club_event_game' });
    expect(g.source).toBe(MY_GAME_SOURCE.CLUB_GAME_DAY);
  });

  it('retorna null se o atleta não participa ou jogo indefinido', () => {
    expect(mirrorGameToMyGame('zzz', base)).toBeNull();
    expect(mirrorGameToMyGame('u1', { ...base, winner_side: null })).toBeNull();
  });
});

describe('sourceGameToMyGame', () => {
  const partById = new Map([
    ['p1', { user_id: 'u1' }], ['p2', { user_id: 'u2' }],
    ['p3', { user_id: 'u3' }], ['p4', { user_id: 'u4' }],
  ]);
  const game = {
    id: 'g1', side_a: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bia' }],
    side_b: [{ id: 'p3', name: 'Caio' }, { id: 'p4', name: 'Duda' }],
    score_a: 9, score_b: 11, created_at: '2026-07-30',
  };

  it('resolve uid via participantes e monta o jogo', () => {
    const g = sourceGameToMyGame('u1', 'gd1', 'Sábado', game, partById);
    expect(g.id).toBe(gameDayMirrorId('gd1', 'g1'));
    expect(g.won).toBe(false);
    expect(g.opponent).toBe('Caio / Duda');
    expect(g.kind).toBe('doubles');
  });

  it('pula jogo não decidido', () => {
    expect(sourceGameToMyGame('u1', 'gd1', 'x', { ...game, score_a: null }, partById)).toBeNull();
    expect(sourceGameToMyGame('u1', 'gd1', 'x', { ...game, score_a: 5, score_b: 5 }, partById)).toBeNull();
  });

  it('retorna null quando o atleta é membro mas não jogou', () => {
    expect(sourceGameToMyGame('zzz', 'gd1', 'x', game, partById)).toBeNull();
  });
});

describe('foldGameDayGamesIntoStats', () => {
  it('soma jogos/vitórias/derrotas e por formato', () => {
    const base = { played: 2, wins: 1, losses: 1, byFormat: { doubles: { played: 2, wins: 1, losses: 1, winRate: 0.5 } } };
    const games = [
      { kind: 'doubles', won: true },
      { kind: 'singles', won: false },
    ];
    const out = foldGameDayGamesIntoStats(base, games);
    expect(out.played).toBe(4);
    expect(out.wins).toBe(2);
    expect(out.losses).toBe(2);
    expect(out.winRate).toBe(0.5);
    expect(out.byFormat.doubles.played).toBe(3);
    expect(out.byFormat.doubles.wins).toBe(2);
    expect(out.byFormat.singles.played).toBe(1);
    expect(out.byFormat.singles.losses).toBe(1);
  });

  it('não muda torneios/títulos/pódios', () => {
    const base = { played: 0, wins: 0, losses: 0, tournaments: 3, titles: 1, podiums: 2, byFormat: {} };
    const out = foldGameDayGamesIntoStats(base, [{ kind: 'doubles', won: true }]);
    expect(out.tournaments).toBe(3);
    expect(out.titles).toBe(1);
    expect(out.podiums).toBe(2);
    expect(out.played).toBe(1);
  });
});
