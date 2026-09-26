import { describe, it, expect } from 'vitest';
import { computeGameDayLeaderboard, computeGameDayLeaderboards } from './gameDayLeaderboard.js';

const P = (id, name) => ({ id, name });
const side = (...ids) => ids.map((id) => ({ id, name: id.toUpperCase() }));

describe('computeGameDayLeaderboard', () => {
  it('inclui todos os participantes, mesmo sem jogos', () => {
    const parts = [P('a', 'Ana'), P('b', 'Bia'), P('c', 'Caio'), P('d', 'Dan')];
    const rows = computeGameDayLeaderboard(parts, []);
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    rows.forEach((r) => {
      expect(r.games).toBe(0);
      expect(r.wins).toBe(0);
      expect(r.losses).toBe(0);
      expect(r.diff).toBe(0);
    });
  });

  it('conta jogos, vitórias, derrotas e pontos por participante', () => {
    const parts = [P('a', 'Ana'), P('b', 'Bia'), P('c', 'Caio'), P('d', 'Dan')];
    const games = [
      { side_a: side('a', 'b'), side_b: side('c', 'd'), score_a: 11, score_b: 6 },
    ];
    const rows = computeGameDayLeaderboard(parts, games);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.a).toMatchObject({ games: 1, wins: 1, losses: 0, pointsFor: 11, pointsAgainst: 6, diff: 5 });
    expect(byId.b).toMatchObject({ games: 1, wins: 1, losses: 0, diff: 5 });
    expect(byId.c).toMatchObject({ games: 1, wins: 0, losses: 1, pointsFor: 6, pointsAgainst: 11, diff: -5 });
    expect(byId.d).toMatchObject({ games: 1, wins: 0, losses: 1, diff: -5 });
  });

  it('ignora jogos sem resultado', () => {
    const parts = [P('a'), P('b'), P('c'), P('d')];
    const games = [
      { side_a: side('a', 'b'), side_b: side('c', 'd'), score_a: null, score_b: null },
      { side_a: side('a', 'b'), side_b: side('c', 'd'), score_a: 5, score_b: null },
    ];
    const rows = computeGameDayLeaderboard(parts, games);
    rows.forEach((r) => expect(r.games).toBe(0));
  });

  it('ordena por vitórias, depois derrotas, saldo e pontos sofridos', () => {
    const parts = [P('a', 'Ana'), P('b', 'Bia'), P('c', 'Caio'), P('d', 'Dan')];
    // a: 2V; b: 1V 1D; c: 1V 1D melhor saldo que b; d: 2D
    const games = [
      { side_a: side('a', 'c'), side_b: side('b', 'd'), score_a: 11, score_b: 3 }, // a,c vencem
      { side_a: side('a', 'b'), side_b: side('c', 'd'), score_a: 11, score_b: 9 }, // a,b vencem
    ];
    const rows = computeGameDayLeaderboard(parts, games);
    // a: 2V 0D
    expect(rows[0].id).toBe('a');
    // d: 0V 2D fica por último
    expect(rows[rows.length - 1].id).toBe('d');
    // b e c: 1V 1D — desempate por saldo. c: +8-9=-1... vamos calcular:
    // c: jogo1 (11-3) pró11 contra3; jogo2 (9-11) pró9 contra11 => 20 pró, 14 contra, saldo +6
    // b: jogo1 (3-11) pró3 contra11; jogo2 (11-9) pró11 contra9 => 14 pró, 20 contra, saldo -6
    const cRow = rows.find((r) => r.id === 'c');
    const bRow = rows.find((r) => r.id === 'b');
    expect(cRow.diff).toBe(6);
    expect(bRow.diff).toBe(-6);
    // c (saldo maior) vem antes de b
    expect(rows.indexOf(cRow)).toBeLessThan(rows.indexOf(bRow));
  });

  it('desempata por menor número de pontos sofridos', () => {
    // dois atletas com mesmas V/D/saldo, mas pontos sofridos diferentes
    const parts = [P('a', 'Ana'), P('b', 'Bia'), P('c', 'Caio'), P('d', 'Dan')];
    const games = [
      { side_a: side('a', 'x'), side_b: side('y', 'z'), score_a: 11, score_b: 5 },
      { side_a: side('b', 'x'), side_b: side('y', 'z'), score_a: 12, score_b: 6 },
    ];
    const rows = computeGameDayLeaderboard(parts, games);
    const a = rows.find((r) => r.id === 'a');
    const b = rows.find((r) => r.id === 'b');
    // ambos 1V 0D e mesmo saldo (+6); a sofreu 5, b sofreu 6 -> a antes de b
    expect(a.diff).toBe(6);
    expect(b.diff).toBe(6);
    expect(a.pointsAgainst).toBe(5);
    expect(b.pointsAgainst).toBe(6);
    expect(rows.indexOf(a)).toBeLessThan(rows.indexOf(b));
  });

  it('inclui jogadores presentes nos jogos mesmo se não estão mais na lista de participantes', () => {
    const parts = [P('a', 'Ana')];
    const games = [
      { side_a: side('a', 'ghost'), side_b: side('x', 'y'), score_a: 11, score_b: 4 },
    ];
    const rows = computeGameDayLeaderboard(parts, games);
    expect(rows.find((r) => r.id === 'ghost')).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/*  Onda CF — um ranking do dia por tipo de jogo                       */
/* ------------------------------------------------------------------ */

describe('⭐ computeGameDayLeaderboards — simples e duplas separados', () => {
  const parts = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => P(id, id.toUpperCase()));
  const duplas = { side_a: side('a', 'b'), side_b: side('c', 'd'), score_a: 11, score_b: 7 };
  const simples = { side_a: side('a'), side_b: side('e'), score_a: 4, score_b: 11 };

  it('⭐ só duplas: UMA tabela, idêntica à de sempre (todos os participantes)', () => {
    const r = computeGameDayLeaderboards(parts, [duplas]);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('doubles');
    expect(r[0].label).toBe('Duplas');
    expect(r[0].rows).toEqual(computeGameDayLeaderboard(parts, [duplas]));
  });

  it('sem jogo nenhum: uma tabela de duplas com todo mundo', () => {
    const r = computeGameDayLeaderboards(parts, []);
    expect(r).toHaveLength(1);
    expect(r[0].rows).toHaveLength(parts.length);
  });

  it('só simples: uma tabela de simples, também com todos', () => {
    const r = computeGameDayLeaderboards(parts, [simples]);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('singles');
    expect(r[0].rows).toHaveLength(parts.length);
  });

  it('⭐ os dois tipos: duas tabelas INDEPENDENTES', () => {
    const [d, s] = computeGameDayLeaderboards(parts, [duplas, simples]);
    expect(d.kind).toBe('doubles');
    expect(s.kind).toBe('singles');
    // `a` venceu nas duplas e perdeu no simples: cada tabela conta só o seu.
    const aD = d.rows.find((x) => x.id === 'a');
    const aS = s.rows.find((x) => x.id === 'a');
    expect([aD.games, aD.wins, aD.losses]).toEqual([1, 1, 0]);
    expect([aS.games, aS.wins, aS.losses]).toEqual([1, 0, 1]);
    expect(s.rows[0].id).toBe('e');
  });

  it('⭐ cada tabela traz quem jogou aquele tipo; quem não jogou nada fica na de duplas', () => {
    const [d, s] = computeGameDayLeaderboards(parts, [duplas, simples]);
    expect(s.rows.map((x) => x.id).sort()).toEqual(['a', 'e']);
    // f e g não jogaram nada: aparecem uma vez só, na de duplas.
    expect(d.rows.map((x) => x.id).sort()).toEqual(['a', 'b', 'c', 'd', 'f', 'g']);
  });

  it('jogo sem placar define o tipo, mas não conta ponto', () => {
    const [, s] = computeGameDayLeaderboards(parts, [duplas, { side_a: side('f'), side_b: side('g') }]);
    expect(s.rows.every((x) => x.games === 0)).toBe(true);
    expect(s.rows.map((x) => x.id).sort()).toEqual(['f', 'g']);
  });

  it('tolera jogo nulo na lista', () => {
    expect(() => computeGameDayLeaderboards(parts, [duplas, null, simples])).not.toThrow();
  });
});
