import { describe, it, expect } from 'vitest';
import {
  buildGameDayBoard, currentRoundOf, sideNames, scoreText, winnerSide,
  isDecided, isFinishedPlayGame,
} from './gameDayBoard.js';

/** Jogo de grade (Americano/Mexicano/Rei da Quadra). */
const jogo = (round, court, order, a = null, b = null) => ({
  id: `r${round}c${court}`,
  round, court, order,
  side_a: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bia' }],
  side_b: [{ id: 'p3', name: 'Caio' }, { id: 'p4', name: 'Davi' }],
  score_a: a, score_b: b,
});

/** Jogo do Play. */
const play = (id, court, order, status, a = null, b = null) => ({
  id, court, order, status, round: null, format: 'play',
  side_a: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bia' }],
  side_b: [{ id: 'p3', name: 'Caio' }, { id: 'p4', name: 'Davi' }],
  score_a: a, score_b: b,
});

describe('utilidades', () => {
  it('só considera decidido com os DOIS placares', () => {
    expect(isDecided({ score_a: 11, score_b: 7 })).toBe(true);
    expect(isDecided({ score_a: 11, score_b: null })).toBe(false);
    expect(isDecided({ score_a: null, score_b: 7 })).toBe(false);
    expect(isDecided({})).toBe(false);
    expect(isDecided(null)).toBe(false);
  });

  it('0 × 0 é um placar decidido (não é "sem placar")', () => {
    expect(isDecided({ score_a: 0, score_b: 0 })).toBe(true);
  });

  it('lê os nomes do lado nos dois formatos gravados', () => {
    expect(sideNames([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }])).toEqual(['Ana', 'Bia']);
    expect(sideNames(['Ana', 'Bia'])).toEqual(['Ana', 'Bia']);
    expect(sideNames([{ id: 'a' }, null, { id: 'b', name: 'Bia' }])).toEqual(['Bia']);
    expect(sideNames(null)).toEqual([]);
    expect(sideNames([])).toEqual([]);
  });

  it('placar em texto só quando existe', () => {
    expect(scoreText({ score_a: 11, score_b: 7 })).toBe('11 × 7');
    expect(scoreText({ score_a: 11, score_b: null })).toBeNull();
  });

  it('vencedor, com empate valendo null', () => {
    expect(winnerSide({ score_a: 11, score_b: 7 })).toBe('a');
    expect(winnerSide({ score_a: 7, score_b: 11 })).toBe('b');
    expect(winnerSide({ score_a: 9, score_b: 9 })).toBeNull();
    expect(winnerSide({ score_a: 9, score_b: null })).toBeNull();
  });

  it('só o Play tem status de conclusão', () => {
    expect(isFinishedPlayGame({ status: 'finished' })).toBe(true);
    expect(isFinishedPlayGame({ status: 'open' })).toBe(false);
    expect(isFinishedPlayGame({})).toBe(false);
  });
});

describe('currentRoundOf', () => {
  it('é a primeira rodada com jogo pendente', () => {
    const games = [jogo(1, 1, 1, 11, 7), jogo(1, 2, 2, 11, 9), jogo(2, 1, 3), jogo(3, 1, 4)];
    expect(currentRoundOf(games)).toBe(2);
  });

  it('com tudo decidido, é a ÚLTIMA rodada (o dia acabou, não some da tela)', () => {
    const games = [jogo(1, 1, 1, 11, 7), jogo(2, 1, 2, 11, 9)];
    expect(currentRoundOf(games)).toBe(2);
  });

  it('sem rodadas, é null', () => {
    expect(currentRoundOf([{ id: 'x', round: null }])).toBeNull();
    expect(currentRoundOf([])).toBeNull();
  });

  it('ignora rodada inválida', () => {
    expect(currentRoundOf([{ round: 0 }, { round: 'abc' }, { round: 2 }])).toBe(2);
  });
});

describe('painel dos formatos de GRADE', () => {
  const games = [
    jogo(1, 1, 1, 11, 7),
    jogo(1, 2, 2, 9, 11),
    jogo(2, 1, 3),
    jogo(2, 2, 4),
    jogo(3, 1, 5),
  ];

  it('agora = rodada corrente pendente; a seguir = rodadas posteriores', () => {
    const b = buildGameDayBoard(games);
    expect(b.isPlay).toBe(false);
    expect(b.currentRound).toBe(2);
    expect(b.live.map((g) => g.id)).toEqual(['r2c1', 'r2c2']);
    expect(b.upcoming.map((g) => g.id)).toEqual(['r3c1']);
  });

  it('resultados recentes vêm do mais novo para o mais antigo', () => {
    const b = buildGameDayBoard(games);
    expect(b.recent.map((g) => g.id)).toEqual(['r1c2', 'r1c1']);
  });

  it('conta o total, o decidido e o pendente', () => {
    expect(buildGameDayBoard(games).totals).toEqual({ total: 5, decided: 2, pending: 3 });
  });

  it('ordena os jogos de agora por quadra', () => {
    const b = buildGameDayBoard([jogo(1, 3, 1), jogo(1, 1, 2), jogo(1, 2, 3)]);
    expect(b.live.map((g) => g.court)).toEqual([1, 2, 3]);
  });

  it('jogo sem quadra vai para o fim, não para o começo', () => {
    const semQuadra = { ...jogo(1, null, 9), id: 'sem-quadra', court: null };
    const b = buildGameDayBoard([semQuadra, jogo(1, 1, 1)]);
    expect(b.live.map((g) => g.id)).toEqual(['r1c1', 'sem-quadra']);
  });

  it('partidas avulsas (sem rodada): tudo que falta jogar é "agora"', () => {
    const avulso = (id, a = null, b = null) => ({ id, round: null, court: null, order: 1, score_a: a, score_b: b });
    const board = buildGameDayBoard([avulso('x'), avulso('y'), avulso('z', 11, 5)]);
    expect(board.currentRound).toBeNull();
    expect(board.live.map((g) => g.id).sort()).toEqual(['x', 'y']);
    expect(board.upcoming).toEqual([]);
    expect(board.recent.map((g) => g.id)).toEqual(['z']);
  });

  it('dia inteiro decidido: nada em "agora", tudo em recentes', () => {
    const b = buildGameDayBoard([jogo(1, 1, 1, 11, 7), jogo(2, 1, 2, 11, 9)]);
    expect(b.live).toEqual([]);
    expect(b.upcoming).toEqual([]);
    expect(b.recent).toHaveLength(2);
    expect(b.currentRound).toBe(2);
  });

  it('respeita os limites de recentes e de próximos', () => {
    const muitos = Array.from({ length: 20 }, (_, i) => jogo(1, i + 1, i, 11, 7));
    const futuros = Array.from({ length: 20 }, (_, i) => jogo(i + 2, 1, 100 + i));
    const b = buildGameDayBoard([...muitos, ...futuros], { recentLimit: 3, upcomingLimit: 2 });
    expect(b.recent).toHaveLength(3);
    expect(b.upcoming).toHaveLength(2);
  });
});

describe('painel do formato PLAY', () => {
  const games = [
    play('g1', 1, 1, 'finished', 11, 7),
    play('g2', 2, 2, 'finished', 8, 11),
    play('g3', 1, 3, 'open'),
    play('g4', 2, 4, 'open'),
  ];

  it('reconhece o Play pelo status, sem precisar do formato', () => {
    expect(buildGameDayBoard(games).isPlay).toBe(true);
  });

  it('agora = quem está em quadra, ordenado por quadra', () => {
    const b = buildGameDayBoard(games);
    expect(b.live.map((g) => g.id)).toEqual(['g3', 'g4']);
  });

  it('no Play não existem jogos futuros gravados', () => {
    expect(buildGameDayBoard(games).upcoming).toEqual([]);
    expect(buildGameDayBoard(games).currentRound).toBeNull();
  });

  it('concluídos vêm do mais recente para o mais antigo', () => {
    expect(buildGameDayBoard(games).recent.map((g) => g.id)).toEqual(['g2', 'g1']);
  });

  it('jogo do Play sem placar ainda conta como concluído se o status disser', () => {
    const b = buildGameDayBoard([play('g9', 1, 1, 'finished')]);
    expect(b.recent.map((g) => g.id)).toEqual(['g9']);
    expect(b.live).toEqual([]);
  });
});

describe('entradas degeneradas', () => {
  it('sem jogos, devolve tudo vazio sem quebrar', () => {
    const b = buildGameDayBoard([]);
    expect(b).toEqual({
      live: [], upcoming: [], recent: [],
      currentRound: null, isPlay: false, isCourtByCourt: false,
      hasScores: true, format: null,
      totals: { total: 0, decided: 0, pending: 0 },
    });
  });

  it('aceita undefined e nulos na lista', () => {
    expect(() => buildGameDayBoard(undefined)).not.toThrow();
    expect(buildGameDayBoard([null, undefined]).totals.total).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
 * O formato como fonte da verdade (opcional)
 *
 * O AMERICANO APRIMORADO grava `status` como o Play E placar como a grade.
 * Só olhando os dados, o painel o confundiria com o Play e esconderia placar
 * e ranking. Informar o `format` desfaz o empate — e omiti-lo tem de continuar
 * se comportando EXATAMENTE como antes, porque é assim que todo o resto chama.
 * ------------------------------------------------------------------------- */
describe('buildGameDayBoard com formato informado', () => {
  const aoVivo = (order, a = null, b = null) => ({
    id: `al${order}`,
    court: 1, order,
    status: a == null ? 'open' : 'finished',
    score_a: a, score_b: b,
    side_a: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bia' }],
    side_b: [{ id: 'p3', name: 'Caio' }, { id: 'p4', name: 'Davi' }],
  });

  it('americano aprimorado agrupa quadra a quadra E tem placar', () => {
    const b = buildGameDayBoard([aoVivo(1, 11, 7), aoVivo(2)], { format: 'americano_live' });
    expect(b.isCourtByCourt).toBe(true);
    expect(b.hasScores).toBe(true);
    expect(b.live.map((g) => g.id)).toEqual(['al2']);
    expect(b.recent.map((g) => g.id)).toEqual(['al1']);
    expect(b.totals.decided).toBe(1);
  });

  it('play informado agrupa quadra a quadra e NÃO tem placar', () => {
    const b = buildGameDayBoard([aoVivo(1, 11, 7), aoVivo(2)], { format: 'play' });
    expect(b.isCourtByCourt).toBe(true);
    expect(b.hasScores).toBe(false);
  });

  it('grade informada continua sendo grade, mesmo com placar', () => {
    const b = buildGameDayBoard([jogo(1, 1, 1, 11, 7)], { format: 'americano' });
    expect(b.isCourtByCourt).toBe(false);
    expect(b.hasScores).toBe(true);
    expect(b.currentRound).toBe(1);
  });

  it('sem formato, o resultado é bit a bit o de antes (Play inferido)', () => {
    const jogos = [aoVivo(1, 11, 7), aoVivo(2)];
    const semFormato = buildGameDayBoard(jogos);
    expect(semFormato.isPlay).toBe(true);
    expect(semFormato.hasScores).toBe(false);
    expect(semFormato.live.map((g) => g.id)).toEqual(['al2']);
    expect(semFormato.recent.map((g) => g.id)).toEqual(['al1']);
  });

  it('formato desconhecido não é tratado como quadra a quadra', () => {
    // `isCourtByCourtFormat` responde `false` a qualquer coisa que não seja um
    // dos dois formatos conhecidos — inclusive `undefined` vindo de um dia de
    // jogo antigo, que cai no caminho da inferência por não ser informado.
    const b = buildGameDayBoard([jogo(1, 1, 1)], { format: 'mexicano' });
    expect(b.isCourtByCourt).toBe(false);
    expect(b.hasScores).toBe(true);
  });
});
