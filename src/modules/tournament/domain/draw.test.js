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

  it('buildGroupMatches organiza cada grupo em rodadas equilibradas (método do círculo)', () => {
    const groups = [
      { name: 'A', participants: ['a1', 'a2', 'a3', 'a4'] },
      { name: 'B', participants: ['b1', 'b2', 'b3', 'b4'] },
    ];
    const m = buildGroupMatches(groups);
    expect(m).toHaveLength(12); // 2 grupos × C(4,2)=6 jogos
    // cada grupo de 4 se organiza em 3 rodadas (não tudo na rodada 1)
    const roundsA = new Set(m.filter((x) => x.group === 'A').map((x) => x.round));
    expect(roundsA).toEqual(new Set([1, 2, 3]));
    // dentro de uma rodada, nenhum jogador joga duas vezes (rotação justa)
    const r1 = m.filter((x) => x.round === 1 && x.group === 'A');
    const seen = new Set();
    r1.forEach((x) => [x.side_a, x.side_b].forEach((p) => { expect(seen.has(p)).toBe(false); seen.add(p); }));
  });

  it('buildGroupMatches distribui o bye de forma justa em grupo ímpar (cada um joga todos)', () => {
    const groups = [{ name: 'A', participants: ['a', 'b', 'c', 'd', 'e'] }];
    const m = buildGroupMatches(groups);
    expect(m).toHaveLength(10); // C(5,2)
    const plays = new Map();
    m.forEach((x) => [x.side_a, x.side_b].forEach((p) => plays.set(p, (plays.get(p) || 0) + 1)));
    // todos jogam contra todos do grupo exatamente uma vez → 4 jogos cada
    expect([...new Set(plays.values())]).toEqual([4]);
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
    it('contagem: ⌊N(N−1)/4⌋ jogos; exato para N ≡ 0 ou 1 (mod 4)', () => {
      expect(americanoMatchCount(4)).toEqual({ totalMatches: 3, exact: true });
      expect(americanoMatchCount(5)).toEqual({ totalMatches: 5, exact: true });
      expect(americanoMatchCount(8)).toEqual({ totalMatches: 14, exact: true });
      expect(americanoMatchCount(9)).toEqual({ totalMatches: 18, exact: true });
      expect(americanoMatchCount(12)).toEqual({ totalMatches: 33, exact: true });
      expect(americanoMatchCount(16)).toEqual({ totalMatches: 60, exact: true });
    });

    it('N ≡ 2 ou 3 (mod 4): inválido (exact=false com reason bloqueante)', () => {
      [6, 7, 10, 11].forEach((n) => {
        const check = americanoMatchCount(n);
        expect(check.exact).toBe(false);
        expect(check.reason).toMatch(/não é condizente/i);
        expect(check.totalMatches).toBe(Math.floor((n * (n - 1)) / 4));
      });
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

    it('N=5 (≡1 mod 4): exatamente 5 jogos cobrindo todas as 10 parcerias', () => {
      const players = ['a', 'b', 'c', 'd', 'e'];
      const matches = buildAmericanoRotation(players, { seed: 'fixed' });
      expect(matches).toHaveLength(5);
      const pairs = new Set();
      matches.forEach((m) => {
        pairs.add([...m.side_a].sort().join('|'));
        pairs.add([...m.side_b].sort().join('|'));
      });
      expect(pairs.size).toBe(10); // C(5,2)
      expect(pairs.size).toBe(matches.length * 2); // nenhuma dupla repetida
    });

    it('N=9 (≡1 mod 4): exatamente 18 jogos cobrindo todas as 36 parcerias', () => {
      const players = Array.from({ length: 9 }, (_, i) => `p${i}`);
      const matches = buildAmericanoRotation(players, { seed: 'fixed' });
      expect(matches).toHaveLength(18);
      const pairs = new Set();
      matches.forEach((m) => {
        pairs.add([...m.side_a].sort().join('|'));
        pairs.add([...m.side_b].sort().join('|'));
      });
      expect(pairs.size).toBe(36); // C(9,2)
    });

    it('N=13 (≡1 mod 4): exatamente 39 jogos cobrindo todas as 78 parcerias sem repetição', () => {
      const players = Array.from({ length: 13 }, (_, i) => `p${i}`);
      const matches = buildAmericanoRotation(players, { seed: 'fixed' });
      expect(matches).toHaveLength(39);
      const pairs = new Set();
      matches.forEach((m) => {
        const keyA = [...m.side_a].sort().join('|');
        const keyB = [...m.side_b].sort().join('|');
        expect(pairs.has(keyA)).toBe(false);
        expect(pairs.has(keyB)).toBe(false);
        pairs.add(keyA);
        pairs.add(keyB);
      });
      expect(pairs.size).toBe(78); // C(13,2) = 78 parcerias únicas
    });

    // Helper: estatísticas de adversários e parcerias de uma escala.
    const americanoStats = (matches, n) => {
      const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
      const partner = new Map();
      const opp = new Map();
      const plays = new Map();
      matches.forEach((m) => {
        partner.set(key(...m.side_a), (partner.get(key(...m.side_a)) || 0) + 1);
        partner.set(key(...m.side_b), (partner.get(key(...m.side_b)) || 0) + 1);
        [...m.side_a, ...m.side_b].forEach((p) => plays.set(p, (plays.get(p) || 0) + 1));
        for (const a of m.side_a) for (const b of m.side_b) {
          opp.set(key(a, b), (opp.get(key(a, b)) || 0) + 1);
        }
      });
      const oppCounts = [];
      for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
        oppCounts.push(opp.get(key(`p${i}`, `p${j}`)) || 0);
      }
      const rounds = new Map();
      matches.forEach((m) => {
        const list = rounds.get(m.round) || [];
        list.push(m);
        rounds.set(m.round, list);
      });
      let dupInRound = 0;
      rounds.forEach((list) => {
        const seen = new Set();
        list.forEach((m) => [...m.side_a, ...m.side_b].forEach((p) => {
          if (seen.has(p)) dupInRound += 1;
          seen.add(p);
        }));
      });
      return {
        partnerMax: Math.max(...partner.values()),
        partnerCount: partner.size,
        oppMin: Math.min(...oppCounts),
        oppMax: Math.max(...oppCounts),
        playsValues: [...new Set(plays.values())],
        roundCount: rounds.size,
        dupInRound,
      };
    };

    it('regras absolutas EXATAS para todo N (sem limite): parceria 1×, adversário 2×, resolúvel', { timeout: 30000 }, () => {
      // cobre tabelas (4..32) e construção cíclica em runtime para primos (37, 41)
      [4, 5, 8, 9, 12, 13, 16, 17, 20, 21, 24, 25, 28, 29, 32, 37, 41].forEach((n) => {
        const players = Array.from({ length: n }, (_, i) => `p${i}`);
        const matches = buildAmericanoRotation(players, { seed: 'fixed' });
        const s = americanoStats(matches, n);
        // regra absoluta 1: parceria única (cada dupla possível exatamente 1×)
        expect(s.partnerMax).toBe(1);
        expect(s.partnerCount).toBe((n * (n - 1)) / 2);
        // regra absoluta 2: adversários perfeitamente equilibrados (todos = 2×)
        expect(s.oppMin).toBe(2);
        expect(s.oppMax).toBe(2);
        // cada jogador disputa N−1 jogos
        expect(s.playsValues).toEqual([n - 1]);
        // RESOLÚVEL: N−1 rodadas (par) ou N (ímpar), sem jogador repetido por rodada
        expect(s.roundCount).toBe(n % 2 === 0 ? n - 1 : n);
        expect(s.dupInRound).toBe(0);
      });
    });

    it('é determinística: a mesma seed gera exatamente a mesma escala', () => {
      const players = Array.from({ length: 8 }, (_, i) => `p${i}`);
      const a = buildAmericanoRotation(players, { seed: 'repro' });
      const b = buildAmericanoRotation(players, { seed: 'repro' });
      expect(a).toEqual(b);
    });

    it('metadados de gênero/nível não violam as regras absolutas de equilíbrio', { timeout: 30000 }, () => {
      const n = 12;
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const playerMeta = {};
      players.forEach((id, i) => {
        playerMeta[id] = { gender: i < n / 2 ? 1 : 0, level: (i % 4) + 1 };
      });
      const matches = buildAmericanoRotation(players, { seed: 'fixed', playerMeta });
      const s = americanoStats(matches, n);
      // mesmo com a preferência de gênero/nível, parceria única e equilíbrio
      // perfeito de adversários permanecem garantidos.
      expect(s.partnerMax).toBe(1);
      expect(s.partnerCount).toBe((n * (n - 1)) / 2);
      expect(s.oppMin).toBe(2);
      expect(s.oppMax).toBe(2);
    });

    it('preferência de gênero: campo homogêneo não cria desequilíbrio', () => {
      const n = 8;
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const playerMeta = {};
      players.forEach((id) => { playerMeta[id] = { gender: 1, level: 3 }; }); // todos iguais
      const matches = buildAmericanoRotation(players, { seed: 'fixed', playerMeta });
      const s = americanoStats(matches, n);
      expect(s.oppMin).toBe(2);
      expect(s.oppMax).toBe(2);
    });

    it('N ≡ 2 ou 3 (mod 4): recusa gerar a chave (precisão perfeita ou erro)', () => {
      [6, 7, 10, 11, 14, 15].forEach((n) => {
        const players = Array.from({ length: n }, (_, i) => `p${i}`);
        expect(() => buildAmericanoRotation(players, { seed: 'fixed' })).toThrow(/não é condizente/i);
      });
    });

    it('N < 4: recusa gerar a chave', () => {
      expect(() => buildAmericanoRotation(['a', 'b', 'c'])).toThrow(/no mínimo 4/i);
    });
  });

  it('distributeGroups tiered cria grupos homogêneos por ordem (sem sortear)', () => {
    const ordered = ['s1', 's2', 's3', 's4', 's5'];
    const groups = distributeGroups(ordered, { groupCount: 2, strategy: 'tiered' });
    // 5 em 2 grupos → 3 + 2, em blocos contíguos
    expect(groups[0].participants).toEqual(['s1', 's2', 's3']);
    expect(groups[1].participants).toEqual(['s4', 's5']);
  });

  it('generateDraw aceita groupStrategy tiered', () => {
    const draw = generateDraw({
      format: 'singles',
      stageType: 'groups',
      participants: ['a', 'b', 'c', 'd'],
      groupCount: 2,
      groupStrategy: 'tiered',
    });
    expect(draw.groups[0].participants).toEqual(['a', 'b']);
    expect(draw.groups[1].participants).toEqual(['c', 'd']);
  });

  it('generateDraw entrega estrutura conforme stageType', () => {
    const groupsDraw = generateDraw({ format: 'singles', stageType: 'groups', participants: ['a', 'b', 'c', 'd'], groupCount: 2 });
    expect(groupsDraw.groups).toHaveLength(2);
    expect(groupsDraw.matches.length).toBeGreaterThan(0);

    const koDraw = generateDraw({ format: 'singles', stageType: 'knockout', participants: ['a', 'b', 'c', 'd'] });
    expect(koDraw.bracket).toBeDefined();
    expect(koDraw.matches).toHaveLength(2);

    // Americano só com inscrição Simples; com Duplas deve recusar.
    expect(() =>
      generateDraw({ format: 'doubles', stageType: 'americano', participants: ['a', 'b', 'c', 'd'] }),
    ).toThrow(/Americano/i);

    // Americano com Simples e N exato gera todos os jogos.
    const amDraw = generateDraw({ format: 'singles', stageType: 'americano', participants: ['a', 'b', 'c', 'd'] });
    expect(amDraw.stageType).toBe('americano');
    expect(amDraw.matches).toHaveLength(3);
  });

  it('generateDraw: sistema suíço gera a 1ª rodada (N/2 jogos, sem repetir jogador)', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f'];
    const draw = generateDraw({ format: 'singles', stageType: 'swiss', participants: players, seed: 'fixed' });
    expect(draw.stageType).toBe('swiss');
    expect(draw.matches).toHaveLength(3); // 6 jogadores → 3 jogos
    const seen = new Set();
    draw.matches.forEach((m) => {
      [m.side_a, m.side_b].filter(Boolean).forEach((p) => {
        expect(seen.has(p)).toBe(false);
        seen.add(p);
      });
    });
    expect(seen.size).toBe(6);
  });

  it('generateDraw: suíço com N ímpar gera um BYE', () => {
    const draw = generateDraw({ format: 'singles', stageType: 'swiss', participants: ['a', 'b', 'c'], seed: 'fixed' });
    const byes = draw.matches.filter((m) => m.bye);
    expect(byes).toHaveLength(1);
    expect(byes[0].side_b).toBeNull();
  });

  it('generateDraw: dupla eliminação gera a 1ª rodada da chave de vencedores', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const draw = generateDraw({ format: 'singles', stageType: 'double_knockout', participants: players, seed: 'fixed' });
    expect(draw.stageType).toBe('double_knockout');
    expect(draw.matches).toHaveLength(4); // 8 jogadores → 4 jogos na 1ª rodada
    expect(draw.bracket.size).toBe(8);
    const flat = draw.matches.flatMap((m) => [m.side_a, m.side_b]).filter(Boolean).sort();
    expect(flat).toEqual(players.slice().sort());
  });

  it('generateDraw: dupla eliminação com N não-potência-de-2 marca byes', () => {
    const draw = generateDraw({ format: 'doubles', stageType: 'double_knockout', participants: ['a', 'b', 'c', 'd', 'e'], seed: 'fixed' });
    expect(draw.bracket.size).toBe(8);
    expect(draw.matches.some((m) => m.bye)).toBe(true);
  });
});
