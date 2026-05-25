import { describe, it, expect } from 'vitest';
import {
  buildDoubleEliminationBracket,
  doubleEliminationMaxMatches,
} from './doubleElimination.js';

describe('doubleElimination', () => {
  it('gera estrutura para 8 participantes', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const b = buildDoubleEliminationBracket(ids, { seed: 'x', seedCount: 2 });
    expect(b.size).toBe(8);
    expect(b.wbRounds).toBe(3);
    // WB: 4 + 2 + 1 = 7 jogos
    expect(b.wb.length).toBe(7);
    // LB para size=8: rodadas 1..5, contagens 2,2,1,1,1 = 7 jogos
    expect(b.lb.length).toBe(7);
    expect(b.gf.length).toBe(2);
    expect(b.gf[1].reset).toBe(true);
  });

  it('mantém cabeças-de-chave em posições não-adjacentes', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const b = buildDoubleEliminationBracket(ids, { seed: 'x', seedCount: 2 });
    const r1 = b.wb.filter((m) => m.round === 1);
    const seed1Match = r1.find((m) => m.side_a === 'p1' || m.side_b === 'p1');
    const seed2Match = r1.find((m) => m.side_a === 'p2' || m.side_b === 'p2');
    expect(seed1Match).toBeDefined();
    expect(seed2Match).toBeDefined();
    expect(seed1Match).not.toBe(seed2Match);
  });

  it('é determinístico para a mesma seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const a = buildDoubleEliminationBracket(ids, { seed: 's' });
    const b = buildDoubleEliminationBracket(ids, { seed: 's' });
    expect(a.wb).toEqual(b.wb);
  });

  it('contabiliza máximo de jogos em dupla eliminação', () => {
    expect(doubleEliminationMaxMatches(8)).toBe(14);
    expect(doubleEliminationMaxMatches(16)).toBe(30);
    expect(doubleEliminationMaxMatches(1)).toBe(0);
  });
});
