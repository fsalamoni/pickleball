import { describe, it, expect } from 'vitest';
import {
  seededRng,
  shuffle,
  distributeGroups,
  buildGroupMatches,
  buildRoundRobinMatches,
  buildKnockoutBracket,
  nextPowerOfTwo,
  buildAmericanoRotation,
  americanoMatchCount,
  americanoFour,
  americanoCrossBlocks,
  generateDraw,
} from './draw.js';

describe('draw engine', () => {
  it('seededRng é determinístico', () => {
    const r1 = seededRng('abc');
    const r2 = seededRng('abc');
    expect(r1()).toBe(r2());
    expect(r1()).toBe(r2());
  });

  it('shuffle preserva todos os elementos', () => {
    const out = shuffle([1, 2, 3, 4, 5], seededRng('s'));
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('distributeGroups balanceia tamanhos', () => {
    const groups = distributeGroups(['a', 'b', 'c', 'd', 'e', 'f', 'g'], { groupCount: 3, seed: 't' });
    const sizes = groups.map((g) => g.participants.length).sort();
    expect(sizes).toEqual([2, 2, 3]);
  });

  it('buildGroupMatches gera todos contra todos', () => {
    const groups = [{ name: 'A', participants: ['p1', 'p2', 'p3'] }];
    const m = buildGroupMatches(groups);
    expect(m).toHaveLength(3);
  });

  it('round-robin com 4 jogadores → 3 rodadas, 6 jogos', () => {
    const m = buildRoundRobinMatches(['a', 'b', 'c', 'd']);
    expect(m).toHaveLength(6);
    const rounds = new Set(m.map((g) => g.round));
    expect(rounds.size).toBe(3);
  });

  it('round-robin com nº ímpar respeita BYE', () => {
    const m = buildRoundRobinMatches(['a', 'b', 'c']);
    expect(m.every((g) => g.side_a !== '__BYE__' && g.side_b !== '__BYE__')).toBe(true);
    // 3 rodadas; em cada rodada um descansa → 1 jogo por rodada → 3 jogos totais
    expect(m).toHaveLength(3);
  });

  it('nextPowerOfTwo', () => {
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(nextPowerOfTwo(1)).toBe(1);
  });

  it('buildKnockoutBracket preenche todos slots e gera matches', () => {
    const { slots, matches, totalRounds } = buildKnockoutBracket(['a', 'b', 'c', 'd', 'e'], { seed: 't', seedCount: 2 });
    expect(slots.length).toBe(8);
    expect(matches.length).toBe(4);
    expect(totalRounds).toBe(3);
    const flat = slots.filter(Boolean).sort();
    expect(flat).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  describe('americano (rotação aberta)', () => {
    it('contagem exata: N(N−1)/4 jogos para N ≡ 0 ou 1 (mod 4)', () => {
      expect(americanoMatchCount(4)).toEqual({ totalMatches: 3, exact: true });
      expect(americanoMatchCount(5)).toEqual({ totalMatches: 5, exact: true });
      expect(americanoMatchCount(8)).toEqual({ totalMatches: 14, exact: true });
      expect(americanoMatchCount(9)).toEqual({ totalMatches: 18, exact: true });
      expect(americanoMatchCount(12)).toEqual({ totalMatches: 33, exact: true });
      expect(americanoMatchCount(16)).toEqual({ totalMatches: 60, exact: true });
    });

    it('rejeita N que não fecham matematicamente (N ≡ 2 ou 3 mod 4)', () => {
      expect(americanoMatchCount(6).exact).toBe(false);
      expect(americanoMatchCount(7).exact).toBe(false);
      expect(americanoMatchCount(10).exact).toBe(false);
      expect(americanoMatchCount(11).exact).toBe(false);
    });

    it('N=4: exatamente 3 jogos com cada parceria possível uma vez', () => {
      const matches = buildAmericanoRotation(['a', 'b', 'c', 'd'], { seed: 'fixed' });
      expect(matches).toHaveLength(3);
      const pairs = new Set();
      matches.forEach((m) => {
        pairs.add([...m.side_a].sort().join('|'));
        pairs.add([...m.side_b].sort().join('|'));
      });
      expect(pairs.size).toBe(6);
      // 3 rodadas distintas (1 jogo por rodada com 4 jogadores)
      const rounds = new Set(matches.map((m) => m.round));
      expect(rounds.size).toBe(3);
    });

    it('N=4: ordem fixa de partidas (a+b vs c+d; a+c vs b+d; a+d vs b+c)', () => {
      // helper americanoFour é determinístico — testamos diretamente.
      const m = americanoFour(['a', 'b', 'c', 'd']);
      expect(m[0]).toEqual({ side_a: ['a', 'b'], side_b: ['c', 'd'] });
      expect(m[1]).toEqual({ side_a: ['a', 'c'], side_b: ['b', 'd'] });
      expect(m[2]).toEqual({ side_a: ['a', 'd'], side_b: ['b', 'c'] });
    });

    it('N=8: exatamente 14 jogos, cada parceria única', () => {
      const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const matches = buildAmericanoRotation(players, { seed: 'fixed' });
      expect(matches).toHaveLength(14);
      const pairs = new Set();
      matches.forEach((m) => {
        pairs.add([...m.side_a].sort().join('|'));
        pairs.add([...m.side_b].sort().join('|'));
      });
      // C(8,2) = 28 parcerias únicas → 14 jogos cobrem todas (28 = 14 × 2)
      expect(pairs.size).toBe(28);
    });

    it('N=8: cada jogador participa exatamente em 7 jogos', () => {
      const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const matches = buildAmericanoRotation(players, { seed: 'fixed' });
      const counts = new Map();
      matches.forEach((m) => {
        [...m.side_a, ...m.side_b].forEach((p) => counts.set(p, (counts.get(p) || 0) + 1));
      });
      players.forEach((p) => expect(counts.get(p)).toBe(7));
    });

    it('N=8: nenhum jogador joga duas vezes na mesma rodada', () => {
      const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const matches = buildAmericanoRotation(players, { seed: 'fixed' });
      const byRound = new Map();
      matches.forEach((m) => {
        const list = byRound.get(m.round) || [];
        list.push(m);
        byRound.set(m.round, list);
      });
      byRound.forEach((list) => {
        const seen = new Set();
        list.forEach((m) => {
          [...m.side_a, ...m.side_b].forEach((p) => {
            expect(seen.has(p)).toBe(false);
            seen.add(p);
          });
        });
      });
    });

    it('cruzamento entre dois blocos cobre as 16 parcerias cruzadas em 8 jogos', () => {
      const crossMatches = americanoCrossBlocks(['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']);
      expect(crossMatches).toHaveLength(8);
      const block1 = new Set(['a', 'b', 'c', 'd']);
      const block2 = new Set(['e', 'f', 'g', 'h']);
      const pairs = new Set();
      crossMatches.forEach((m) => {
        [m.side_a, m.side_b].forEach((side) => {
          const [x, y] = side;
          // toda parceria deve ter um jogador de cada bloco
          const fromB1 = (block1.has(x) ? 1 : 0) + (block1.has(y) ? 1 : 0);
          expect(fromB1).toBe(1);
          pairs.add([x, y].sort().join('|'));
        });
      });
      expect(pairs.size).toBe(16); // 4 × 4 parcerias cruzadas distintas
    });

    it('N=12: exatamente 33 jogos cobrindo todas as parcerias', () => {
      const players = Array.from({ length: 12 }, (_, i) => `p${i}`);
      const matches = buildAmericanoRotation(players, { seed: 'fixed' });
      expect(matches).toHaveLength(33);
      const pairs = new Set();
      matches.forEach((m) => {
        pairs.add([...m.side_a].sort().join('|'));
        pairs.add([...m.side_b].sort().join('|'));
      });
      expect(pairs.size).toBe(66); // C(12,2)
    });

    it('lança erro para N que não fecha (ex.: 6)', () => {
      expect(() => buildAmericanoRotation(['a', 'b', 'c', 'd', 'e', 'f'])).toThrow(/Americana aberta/);
    });
  });

  it('generateDraw entrega estrutura conforme stageType', () => {
    const groupsDraw = generateDraw({ format: 'singles', stageType: 'groups', participants: ['a', 'b', 'c', 'd'], groupCount: 2 });
    expect(groupsDraw.groups).toHaveLength(2);
    expect(groupsDraw.matches.length).toBeGreaterThan(0);

    const koDraw = generateDraw({ format: 'singles', stageType: 'knockout', participants: ['a', 'b', 'c', 'd'] });
    expect(koDraw.bracket).toBeDefined();
    expect(koDraw.matches).toHaveLength(2);
  });
});
