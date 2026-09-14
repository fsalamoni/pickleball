import { describe, it, expect } from 'vitest';
import {
  INTERNAL_TOURNAMENT_STATUS, PRIZE_TYPE,
  normalizeInternalTournamentInput, normalizePrizeInput, calculateLadderPosition,
} from './leagues.js';

describe('normalizeInternalTournamentInput', () => {
  it('aceita torneio válido', () => {
    const r = normalizeInternalTournamentInput({ name: 'Torneio', date: '2026-07-20', max_participants: 8 });
    expect(r.valid).toBe(true);
    expect(r.value.max_participants).toBe(8);
  });
  it('rejeita sem nome', () => {
    const r = normalizeInternalTournamentInput({ date: '2026-07-20', max_participants: 8 });
    expect(r.valid).toBe(false);
  });
  it('rejeita max_participants fora do range', () => {
    expect(normalizeInternalTournamentInput({ name: 'X', date: '2026-07-20', max_participants: 1 }).valid).toBe(false);
    expect(normalizeInternalTournamentInput({ name: 'X', date: '2026-07-20', max_participants: 100 }).valid).toBe(false);
  });
});

describe('normalizePrizeInput', () => {
  it('aceita prêmio válido', () => {
    const r = normalizePrizeInput({ position: 1, type: 'cash', value: 'R$ 500' });
    expect(r.valid).toBe(true);
  });
  it('rejeita position > 10', () => {
    const r = normalizePrizeInput({ position: 11, value: 'X' });
    expect(r.valid).toBe(false);
  });
});

describe('calculateLadderPosition', () => {
  it('ordena por pontos desc', () => {
    const list = [
      { id: 'u1', name: 'A', points: 5 },
      { id: 'u2', name: 'B', points: 10 },
      { id: 'u3', name: 'C', points: 3 },
    ];
    const r = calculateLadderPosition(list);
    expect(r[0].id).toBe('u2');
    expect(r[0].ladder_position).toBe(1);
    expect(r[2].id).toBe('u3');
    expect(r[2].ladder_position).toBe(3);
  });
  it('vazio para entrada vazia', () => {
    expect(calculateLadderPosition([])).toEqual([]);
  });
});

/* ================================================================== */
/*  Onda 5b — o torneio ocupa a quadra e alimenta o ladder            */
/* ================================================================== */

import {
  INTERNAL_TOURNAMENT_FORMAT, LADDER_MAX, LADDER_POINTS_PARTICIPATION,
  applyTournamentToLadder, isTournamentOpen, ladderPointsFor,
  mergeTournamentBlocks, tournamentBlocks, tournamentSeatsLeft,
} from './leagues.js';

const torneio = (over = {}) => ({
  id: 't1', arena_id: 'a1', name: 'Americano de sábado',
  date: '2026-10-03', start_time: '14:00', end_time: '18:00',
  court_ids: ['q1', 'q2'], status: 'scheduled', game_day_id: null, ...over,
});

describe('⭐ tournamentBlocks — o torneio OCUPA a quadra', () => {
  it('um bloqueio por quadra escolhida', () => {
    const b = tournamentBlocks([torneio()]);
    expect(b).toHaveLength(2);
    expect(b.map((x) => x.court_id)).toEqual(['q1', 'q2']);
    expect(b[0]).toMatchObject({
      arena_id: 'a1', date: '2026-10-03', start_time: '14:00', end_time: '18:00',
      source: 'internal_tournament', tournament_id: 't1',
    });
  });

  it('⭐ sem quadra escolhida, não bloqueia nada', () => {
    // A arena pode anunciar a data antes de decidir onde.
    expect(tournamentBlocks([torneio({ court_ids: [] })])).toEqual([]);
  });

  it('⭐ torneio que virou DIA DE JOGO não bloqueia por aqui', () => {
    // O dia de jogo já bloqueia; contar duas vezes mostraria dois bloqueios
    // para o mesmo horário na tela de gestão.
    expect(tournamentBlocks([torneio({ game_day_id: 'gd1' })])).toEqual([]);
  });

  it('cancelado e encerrado devolvem as quadras', () => {
    expect(tournamentBlocks([torneio({ status: 'cancelled' })])).toEqual([]);
    expect(tournamentBlocks([torneio({ status: 'finished' })])).toEqual([]);
  });

  it('sem horário não vira bloqueio pela metade', () => {
    expect(tournamentBlocks([torneio({ start_time: null })])).toEqual([]);
    expect(tournamentBlocks([torneio({ end_time: '13:00' })])).toEqual([]);
  });

  it('o nome do torneio explica o horário fechado', () => {
    expect(tournamentBlocks([torneio()])[0].notes).toBe('Torneio: Americano de sábado');
  });
});

describe('mergeTournamentBlocks', () => {
  it('acrescenta sem duplicar o que já está gravado', () => {
    const gravado = {
      id: 'u1', tournament_id: 't1', court_id: 'q1', date: '2026-10-03',
      start_time: '14:00', end_time: '18:00',
    };
    expect(mergeTournamentBlocks([gravado], [torneio()])).toHaveLength(2);
  });

  it('sem torneios, devolve a mesma lista', () => {
    const base = [{ id: 'u1' }];
    expect(mergeTournamentBlocks(base, [])).toBe(base);
  });
});

describe('vagas e estado', () => {
  it('conta as vagas que sobram', () => {
    expect(tournamentSeatsLeft({ max_participants: 16, enrolled: 12 })).toBe(4);
  });
  it('sem teto, não há limite a mostrar', () => {
    expect(tournamentSeatsLeft({ enrolled: 12 })).toBeNull();
  });
  it('nunca negativo', () => {
    expect(tournamentSeatsLeft({ max_participants: 4, enrolled: 9 })).toBe(0);
  });
  it('torneio sem status aceita inscrição', () => {
    expect(isTournamentOpen({})).toBe(true);
  });
  it('em andamento não aceita mais', () => {
    expect(isTournamentOpen({ status: 'running' })).toBe(false);
  });
});

describe('⭐ o ladder — a classificação que era lida e nunca escrita', () => {
  it('pontua por posição', () => {
    expect(ladderPointsFor(1)).toBe(100);
    expect(ladderPointsFor(2)).toBe(70);
    expect(ladderPointsFor(3)).toBe(50);
    expect(ladderPointsFor(4)).toBe(35);
  });

  it('⭐ quem participou e não pontuou leva os pontos de presença', () => {
    // Um ladder em que só os quatro primeiros somam faz todo mundo desistir
    // na segunda semana.
    expect(ladderPointsFor(9)).toBe(LADDER_POINTS_PARTICIPATION);
    expect(ladderPointsFor(0)).toBe(LADDER_POINTS_PARTICIPATION);
    expect(ladderPointsFor(null)).toBe(LADDER_POINTS_PARTICIPATION);
  });

  it('ladder vazio + um torneio = a primeira classificação', () => {
    const r = applyTournamentToLadder([], [
      { user_id: 'u1', name: 'Ana', position: 1, won: 4 },
      { user_id: 'u2', name: 'Beto', position: 2, won: 3 },
    ]);
    expect(r[0]).toMatchObject({ user_id: 'u1', points: 100, played: 1, wins: 4, titles: 1, ladder_position: 1 });
    expect(r[1]).toMatchObject({ user_id: 'u2', points: 70, titles: 0, ladder_position: 2 });
  });

  it('⭐ ACUMULA entre torneios — é o que faz a classificação ter graça', () => {
    const semana1 = applyTournamentToLadder([], [
      { user_id: 'u1', name: 'Ana', position: 2, won: 3 },
      { user_id: 'u2', name: 'Beto', position: 1, won: 4 },
    ]);
    const semana2 = applyTournamentToLadder(semana1, [
      { user_id: 'u1', name: 'Ana', position: 1, won: 5 },
      { user_id: 'u2', name: 'Beto', position: 3, won: 2 },
    ]);
    const ana = semana2.find((l) => l.user_id === 'u1');
    const beto = semana2.find((l) => l.user_id === 'u2');
    expect(ana.points).toBe(170);   // 70 + 100
    expect(ana.played).toBe(2);
    expect(ana.wins).toBe(8);
    expect(ana.titles).toBe(1);
    expect(beto.points).toBe(150);  // 100 + 50
    // Ana passou o Beto e a ordem reflete isso.
    expect(semana2[0].user_id).toBe('u1');
  });

  it('⭐ o nome mais recente vence — quem trocou de nome não fica com o antigo', () => {
    const antes = applyTournamentToLadder([], [{ user_id: 'u1', name: 'Ana', position: 1 }]);
    const depois = applyTournamentToLadder(antes, [{ user_id: 'u1', name: 'Ana Silva', position: 3 }]);
    expect(depois[0].name).toBe('Ana Silva');
  });

  it('quem não jogou o torneio novo mantém a pontuação', () => {
    const antes = applyTournamentToLadder([], [
      { user_id: 'u1', name: 'Ana', position: 1 },
      { user_id: 'u2', name: 'Beto', position: 2 },
    ]);
    const depois = applyTournamentToLadder(antes, [{ user_id: 'u1', name: 'Ana', position: 1 }]);
    expect(depois.find((l) => l.user_id === 'u2')).toMatchObject({ points: 70, played: 1 });
  });

  it('linha sem user_id é ignorada em vez de virar uma linha fantasma', () => {
    expect(applyTournamentToLadder([], [{ name: 'Sem conta', position: 1 }])).toEqual([]);
  });

  it(`o ladder para em ${LADDER_MAX} linhas`, () => {
    const muitos = Array.from({ length: LADDER_MAX + 20 }, (_, i) => ({
      user_id: `u${i}`, name: `Atleta ${i}`, position: i + 1,
    }));
    expect(applyTournamentToLadder([], muitos)).toHaveLength(LADDER_MAX);
  });
});

describe('normalizeInternalTournamentInput — o que faltava', () => {
  const base = { name: 'Sábado', date: '2026-10-03', max_participants: 16 };

  it('⭐ o formato tem de ser um que o dia de jogo saiba conduzir', () => {
    // `single_elimination` era guardado e nada no projeto o executava.
    const { value } = normalizeInternalTournamentInput({ ...base, format: 'single_elimination' });
    expect(value.format).toBe(INTERNAL_TOURNAMENT_FORMAT.AMERICANO);
  });

  it('aceita os formatos do dia de jogo', () => {
    const { value } = normalizeInternalTournamentInput({ ...base, format: 'americano_live' });
    expect(value.format).toBe('americano_live');
  });

  it('⭐ escolher quadra sem dizer quando é ERRO', () => {
    const r = normalizeInternalTournamentInput({ ...base, court_ids: ['q1'] });
    expect(r.valid).toBe(false);
    expect(r.errors.start_time).toBeTruthy();
  });

  it('recusa janela invertida', () => {
    const r = normalizeInternalTournamentInput({
      ...base, court_ids: ['q1'], start_time: '18:00', end_time: '14:00',
    });
    expect(r.valid).toBe(false);
  });

  it('torneio sem quadra continua valendo — a arena anuncia a data antes', () => {
    const r = normalizeInternalTournamentInput(base);
    expect(r.valid).toBe(true);
    expect(r.value.court_ids).toEqual([]);
  });

  it('descarta quadra vazia da lista', () => {
    const { value } = normalizeInternalTournamentInput({
      ...base, court_ids: ['q1', '', '  ', 'q2'], start_time: '14:00', end_time: '18:00',
    });
    expect(value.court_ids).toEqual(['q1', 'q2']);
  });
});
