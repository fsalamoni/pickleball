import { describe, it, expect } from 'vitest';
import {
  mirrorGameToMyGame, sourceGameToMyGame, foldGameDayGamesIntoStats,
  gameDayMirrorId, MY_GAME_SOURCE,
  OUT_OF_RANKING_REASON, summarizeRankingCoverage, gameDayGamesToH2HRecords,
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

  it('inclui o parceiro da minha dupla (meu lado, menos eu)', () => {
    const g = mirrorGameToMyGame('u1', base, new Map([['u2', 'Bia'], ['u3', 'Caio'], ['u4', 'Duda']]));
    expect(g.partner).toBe('Bia');
    expect(g.opponent).toBe('Caio / Duda');
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
    expect(g.partner).toBe('Bia');
    expect(g.kind).toBe('doubles');
  });

  it('jogo de duplas com parceiro AVULSO (sem conta) continua duplas', () => {
    // p_guest não tem user_id (convidado avulso). O jogo é em duplas mesmo assim.
    const parts = new Map([
      ['p1', { user_id: 'u1' }], ['pg', { name: 'Convidado' }],
      ['p3', { user_id: 'u3' }], ['p4', { user_id: 'u4' }],
    ]);
    const gameGuest = {
      id: 'g9',
      side_a: [{ id: 'p1', name: 'Ana' }, { id: 'pg', name: 'Convidado' }],
      side_b: [{ id: 'p3', name: 'Caio' }, { id: 'p4', name: 'Duda' }],
      score_a: 11, score_b: 9, created_at: '2026-07-30',
    };
    const g = sourceGameToMyGame('u1', 'gd1', 'x', gameGuest, parts);
    expect(g.kind).toBe('doubles'); // NÃO vira individual por causa do avulso
    expect(g.partner).toBe('Convidado');
    expect(g.won).toBe(true);
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

describe('cobertura do ranking (por que um jogo não conta)', () => {
  const partById = new Map([
    ['p1', { user_id: 'u1', name: 'Ana' }], ['p2', { user_id: 'u2', name: 'Bia' }],
    ['p3', { user_id: 'u3', name: 'Caio' }], ['pg', { name: 'Convidado' }],
  ]);
  const jogo = {
    id: 'g1', side_a: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bia' }],
    side_b: [{ id: 'p3', name: 'Caio' }, { id: 'pg', name: 'Convidado' }],
    score_a: 11, score_b: 6,
  };

  it('dia NÃO publicado: o jogo conta no desempenho e diz por que não está no ranking', () => {
    const g = sourceGameToMyGame('u1', 'gd1', 'Sábado', jogo, partById);
    expect(g.ranked).toBe(false);
    expect(g.outReason).toBe(OUT_OF_RANKING_REASON.NOT_PUBLISHED);
  });

  it('dia publicado com convidado sem conta: o motivo é o convidado', () => {
    const g = sourceGameToMyGame('u1', 'gd1', 'Sábado', jogo, partById, { published: true });
    expect(g.outReason).toBe(OUT_OF_RANKING_REASON.GUEST);
  });

  it('🐞 atleta que SAIU do dia depois de jogar (uid selado no slot) continua no próprio desempenho', () => {
    const semEle = new Map([...partById].filter(([id]) => id !== 'p1'));
    const selado = { ...jogo, side_a: [{ id: 'p1', name: 'Ana', user_id: 'u1' }, jogo.side_a[1]] };
    const g = sourceGameToMyGame('u1', 'gd1', 'Sábado', selado, semEle);
    expect(g).not.toBeNull();
    expect(g.won).toBe(true);
    expect(g.partner).toBe('Bia');
  });

  it('o espelho publicado é o que o ranking conta', () => {
    const g = mirrorGameToMyGame('u1', {
      id: 'm', side_a_ids: ['u1', 'u2'], side_b_ids: ['u3', 'u4'], score_a: 11, score_b: 3, winner_side: 'a',
    }, new Map([['u3', 'Caio'], ['u4', 'Duda']]));
    expect(g.ranked).toBe(true);
    expect(g.opponents).toEqual(['Caio', 'Duda']);
  });

  it('summarizeRankingCoverage separa o que entra do que fica de fora, por motivo', () => {
    const r = summarizeRankingCoverage([
      { ranked: true }, { ranked: true },
      { ranked: false, outReason: OUT_OF_RANKING_REASON.NOT_PUBLISHED },
      { ranked: false, outReason: OUT_OF_RANKING_REASON.GUEST },
      { ranked: false, outReason: OUT_OF_RANKING_REASON.GUEST },
    ]);
    expect(r).toEqual({
      total: 5, ranked: 2, out: 3,
      byReason: { [OUT_OF_RANKING_REASON.NOT_PUBLISHED]: 1, [OUT_OF_RANKING_REASON.GUEST]: 2 },
    });
    expect(summarizeRankingCoverage(undefined).total).toBe(0);
  });

  it('confronto direto é por PESSOA e ignora quem não tem nome', () => {
    const recs = gameDayGamesToH2HRecords([
      { opponents: ['Caio', 'Duda'], won: true, at: 1 },
      { opponents: ['Caio', 'Atleta'], won: false, at: 2 },
      { opponent: 'Eva', won: true, at: 3 },
    ]);
    expect(recs).toEqual([
      { opponent: 'Caio', won: true, at: 1 },
      { opponent: 'Duda', won: true, at: 1 },
      { opponent: 'Caio', won: false, at: 2 },
      { opponent: 'Eva', won: true, at: 3 },
    ]);
  });
});
