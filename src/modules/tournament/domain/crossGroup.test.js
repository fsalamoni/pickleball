import { describe, it, expect } from 'vitest';
import {
  ratesOf, compareByRates, rankAcrossGroups, selectWildcards, bracketFit,
} from './crossGroup.js';

/** Entrada de classificação: colocação no grupo + estatísticas. */
const e = (id, rank, { wins, played, pf = 0, pa = 0 } = {}) => ({
  id, rank, stats: { wins, played, points_for: pf, points_against: pa },
});

describe('ratesOf', () => {
  it('converte para taxa por partida', () => {
    expect(ratesOf({ wins: 3, played: 4, points_for: 40, points_against: 32 }))
      .toEqual({ hasPlayed: true, played: 4, winRate: 0.75, balanceRate: 2, pointRate: 10 });
  });

  it('quem não jogou não tem taxa — e a tela precisa saber disso', () => {
    expect(ratesOf({ wins: 0, played: 0 }).hasPlayed).toBe(false);
    expect(ratesOf(null).hasPlayed).toBe(false);
  });
});

describe('⭐ grupos de tamanhos diferentes', () => {
  it('⭐ 3 vitórias em 3 passa à frente de 3 vitórias em 4', () => {
    // O defeito que isto corrige: comparar vitórias ABSOLUTAS empataria os
    // dois, e o desempate cairia no saldo — que também é maior para quem
    // jogou mais. Quem estava no grupo de 5 ganhava por ter tido mais jogo.
    const grupoDe5 = e('a', 1, { wins: 3, played: 4, pf: 44, pa: 36 });
    const grupoDe4 = e('b', 1, { wins: 3, played: 3, pf: 33, pa: 20 });
    expect(rankAcrossGroups([grupoDe5, grupoDe4]).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('⭐ a COLOCAÇÃO vem antes de tudo: um 2º nunca passa um 1º', () => {
    const primeiroFraco = e('p1', 1, { wins: 2, played: 4, pf: 40, pa: 39 });
    const segundoForte = e('s1', 2, { wins: 3, played: 4, pf: 44, pa: 20 });
    expect(rankAcrossGroups([segundoForte, primeiroFraco]).map((x) => x.id))
      .toEqual(['p1', 's1']);
  });

  it('desempata por saldo POR PARTIDA quando o aproveitamento empata', () => {
    const a = e('a', 1, { wins: 2, played: 4, pf: 40, pa: 36 }); // +1/jogo
    const b = e('b', 1, { wins: 3, played: 6, pf: 66, pa: 48 }); // +3/jogo
    expect(rankAcrossGroups([a, b]).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('depois, por pontos a favor por partida', () => {
    const a = e('a', 1, { wins: 2, played: 4, pf: 44, pa: 40 });
    const b = e('b', 1, { wins: 2, played: 4, pf: 36, pa: 32 });
    expect(rankAcrossGroups([a, b]).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('quem jogou vem antes de quem não entrou em quadra', () => {
    const jogou = e('a', 1, { wins: 0, played: 3, pf: 20, pa: 33 });
    const naoJogou = e('b', 1, { wins: 0, played: 0 });
    expect(rankAcrossGroups([naoJogou, jogou]).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('empate absoluto preserva a ordem de entrada', () => {
    const a = e('a', 1, { wins: 2, played: 3, pf: 30, pa: 20 });
    const b = e('b', 1, { wins: 2, played: 3, pf: 30, pa: 20 });
    expect(rankAcrossGroups([a, b]).map((x) => x.id)).toEqual(['a', 'b']);
    expect(rankAcrossGroups([b, a]).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('byPosition:false compara todos juntos (lista já de uma colocação só)', () => {
    const p = e('p', 1, { wins: 1, played: 4, pf: 30, pa: 40 });
    const s = e('s', 2, { wins: 4, played: 4, pf: 44, pa: 20 });
    expect(rankAcrossGroups([p, s], { byPosition: false }).map((x) => x.id)).toEqual(['s', 'p']);
  });

  it('compareByRates devolve 0 no empate absoluto', () => {
    const x = { stats: { wins: 1, played: 2, points_for: 20, points_against: 15 } };
    expect(compareByRates(x, { ...x })).toBe(0);
  });
});

describe('⭐ repescagem (melhores terceiros)', () => {
  const grupo = (index, ranked) => ({ index, ranked });
  // 4 grupos; passam 2 por grupo; faltam 2 vagas para fechar uma chave de 16?
  // Não — aqui o caso é 4 grupos × 2 = 8. Para testar a repescagem usamos
  // 3 grupos × 2 = 6 classificados, e 2 repescados fecham a chave de 8.
  const grupos = [
    grupo(0, [
      e('a1', 1, { wins: 3, played: 3 }), e('a2', 2, { wins: 2, played: 3 }),
      e('a3', 3, { wins: 1, played: 3, pf: 30, pa: 28 }),
    ]),
    grupo(1, [
      e('b1', 1, { wins: 3, played: 3 }), e('b2', 2, { wins: 2, played: 3 }),
      e('b3', 3, { wins: 1, played: 3, pf: 30, pa: 20 }), // melhor saldo
    ]),
    grupo(2, [
      e('c1', 1, { wins: 4, played: 4 }), e('c2', 2, { wins: 3, played: 4 }),
      e('c3', 3, { wins: 1, played: 4, pf: 40, pa: 40 }), // 25% de aproveitamento
    ]),
  ];

  it('⭐ escolhe os melhores da colocação seguinte ao corte', () => {
    const { chosen } = selectWildcards(grupos, { qualifiersPerGroup: 2, slots: 2 });
    // b3 e a3 têm 1/3 (33%); c3 tem 1/4 (25%) e fica de fora.
    // Entre b3 e a3, decide o saldo por partida: b3 (+3,33) × a3 (+0,67).
    expect(chosen.map((x) => x.id)).toEqual(['b3', 'a3']);
  });

  it('⭐ marca de que grupo veio cada repescado', () => {
    const { chosen } = selectWildcards(grupos, { qualifiersPerGroup: 2, slots: 1 });
    expect(chosen[0]._groupIndex).toBe(1);
    expect(chosen[0].rank).toBe(3);
  });

  it('sem vagas, ninguém é repescado', () => {
    expect(selectWildcards(grupos, { qualifiersPerGroup: 2, slots: 0 }).chosen).toEqual([]);
  });

  it('grupo sem alguém naquela colocação simplesmente não concorre', () => {
    const curtos = [grupo(0, [e('x1', 1, { wins: 1, played: 1 })])];
    expect(selectWildcards(curtos, { qualifiersPerGroup: 2, slots: 2 }).chosen).toEqual([]);
  });

  it('pedir mais vagas do que há candidatos devolve todos', () => {
    const { chosen } = selectWildcards(grupos, { qualifiersPerGroup: 2, slots: 99 });
    expect(chosen).toHaveLength(3);
  });

  it('⭐ um 4º colocado nunca entra na frente de um 3º', () => {
    // Regra deliberada: a repescagem compara IGUAIS. O 4º de um grupo forte
    // pode ter campanha melhor que o 3º de um grupo fraco, mas o torneio não
    // tem como provar isso.
    const comQuarto = [
      grupo(0, [
        e('a1', 1, {}), e('a2', 2, {}),
        e('a3', 3, { wins: 0, played: 3, pf: 10, pa: 33 }),
        e('a4', 4, { wins: 3, played: 3, pf: 33, pa: 10 }),
      ]),
    ];
    const { chosen } = selectWildcards(comQuarto, { qualifiersPerGroup: 2, slots: 1 });
    expect(chosen.map((x) => x.id)).toEqual(['a3']);
  });
});

describe('⭐ bracketFit: o que fazer quando os classificados não fecham a chave', () => {
  it('10 classificados → chave de 16 com 6 byes; 6 repescados enchem, 2 a menos caberiam em 8', () => {
    expect(bracketFit(10)).toEqual({
      size: 16, byes: 6, toFill: 6, downTo: 8, dropToFill: 2, perfect: false,
    });
  });

  it('potência de 2 é chave perfeita', () => {
    expect(bracketFit(8)).toMatchObject({ size: 8, byes: 0, toFill: 0, perfect: true });
    expect(bracketFit(16).perfect).toBe(true);
  });

  it('6 classificados → chave de 8 (2 byes) ou de 4 (tirando 2)', () => {
    expect(bracketFit(6)).toMatchObject({ size: 8, byes: 2, downTo: 4, dropToFill: 2 });
  });

  it('números degenerados não quebram', () => {
    expect(bracketFit(0).size).toBe(0);
    expect(bracketFit(1).perfect).toBe(true);
    expect(bracketFit(-5).size).toBe(0);
  });
});
