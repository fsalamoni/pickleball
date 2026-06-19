import { describe, it, expect } from 'vitest';
import {
  mexicanoCourtPairing,
  buildMexicanoFirstRound,
  mexicanoStandings,
  mexicanoNextRound,
  recommendedMexicanoRounds,
} from './mexicano.js';
import { knockoutNextRound } from './progression.js';

const ids = (n, p = 'p') => Array.from({ length: n }, (_, i) => `${p}${i + 1}`);

function finishedMatch(round, a, b, ptsA, ptsB) {
  return {
    round,
    side_a_ids: a,
    side_b_ids: b,
    games: [{ a: ptsA, b: ptsB }],
    status: 'finished',
  };
}

describe('mexicanoCourtPairing', () => {
  it('pareia 1º+4º × 2º+3º', () => {
    expect(mexicanoCourtPairing(['a', 'b', 'c', 'd'])).toEqual({
      side_a: ['a', 'd'],
      side_b: ['b', 'c'],
    });
  });
});

describe('buildMexicanoFirstRound', () => {
  it('8 jogadores → 2 quadras (2 jogos), todos jogam', () => {
    const { matches } = buildMexicanoFirstRound(ids(8), { seed: 's', seedCount: 8 });
    expect(matches).toHaveLength(2);
    const players = matches.flatMap((m) => [...m.side_a, ...m.side_b]);
    expect(new Set(players).size).toBe(8);
  });

  it('6 jogadores → 1 quadra (2 folgam)', () => {
    const { matches } = buildMexicanoFirstRound(ids(6), { seed: 's', seedCount: 6 });
    expect(matches).toHaveLength(1);
    const playing = matches.flatMap((m) => [...m.side_a, ...m.side_b]);
    expect(playing).toHaveLength(4);
  });

  it('rejeita menos de 4 jogadores', () => {
    expect(() => buildMexicanoFirstRound(ids(3))).toThrow();
  });
});

describe('mexicanoStandings', () => {
  it('soma os pontos marcados por jogador', () => {
    const matches = [finishedMatch(1, ['a', 'd'], ['b', 'c'], 11, 7)];
    const st = mexicanoStandings(matches, ['a', 'b', 'c', 'd']);
    const byId = Object.fromEntries(st.map((s) => [s.id, s.points]));
    expect(byId.a).toBe(11);
    expect(byId.d).toBe(11);
    expect(byId.b).toBe(7);
    expect(byId.c).toBe(7);
  });
});

describe('mexicanoNextRound', () => {
  it('reordena por pontos e gera a próxima rodada (1º+4º × 2º+3º)', () => {
    const players = ids(4);
    const r1 = [finishedMatch(1, ['p1', 'p4'], ['p2', 'p3'], 11, 5)];
    const res = mexicanoNextRound(r1, players, { totalRounds: 3 });
    expect(res.matches).toBeTruthy();
    expect(res.nextRound).toBe(2);
    // ranking por pontos: p1=11,p4=11,p2=5,p3=5 → ordem [p1,p4,p2,p3]
    // pareamento 1º+4º × 2º+3º → p1+p3 × p4+p2
    const m = res.matches[0];
    expect([...m.side_a, ...m.side_b].sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('encerra ao atingir o total de rodadas', () => {
    const players = ids(4);
    const r1 = [finishedMatch(1, ['p1', 'p4'], ['p2', 'p3'], 11, 5)];
    expect(mexicanoNextRound(r1, players, { totalRounds: 1 })).toEqual({ complete: true });
  });

  it('espera os jogos da rodada terminarem', () => {
    const players = ids(4);
    const pending = [{ round: 1, side_a_ids: ['p1', 'p4'], side_b_ids: ['p2', 'p3'], status: 'scheduled' }];
    expect(mexicanoNextRound(pending, players, { totalRounds: 3 })).toEqual({ pending: true });
  });
});

describe('recommendedMexicanoRounds', () => {
  it('entre 3 e 8', () => {
    expect(recommendedMexicanoRounds(4)).toBe(3);
    expect(recommendedMexicanoRounds(40)).toBe(8);
    expect(recommendedMexicanoRounds(2)).toBe(0);
  });
});

describe('knockoutNextRound — disputa de 3º lugar', () => {
  function semi(winnerSide) {
    return {
      round: 1,
      position: 0,
      side_a_ids: ['A1'],
      side_b_ids: ['B1'],
      winner_side: winnerSide,
      status: 'finished',
    };
  }

  it('gera final + disputa de 3º lugar quando ligado', () => {
    const semis = [
      { round: 1, position: 1, side_a_ids: ['A'], side_b_ids: ['B'], winner_side: 'a', status: 'finished' },
      { round: 1, position: 2, side_a_ids: ['C'], side_b_ids: ['D'], winner_side: 'a', status: 'finished' },
    ];
    const res = knockoutNextRound(semis, { thirdPlace: true });
    expect(res.matches).toHaveLength(2);
    const final = res.matches.find((m) => !m.third_place);
    const bronze = res.matches.find((m) => m.third_place);
    expect(final.side_a).toBe('A');
    expect(final.side_b).toBe('C');
    expect([bronze.side_a, bronze.side_b].sort()).toEqual(['B', 'D']);
  });

  it('sem a opção, gera só a final', () => {
    const semis = [
      { round: 1, position: 1, side_a_ids: ['A'], side_b_ids: ['B'], winner_side: 'a', status: 'finished' },
      { round: 1, position: 2, side_a_ids: ['C'], side_b_ids: ['D'], winner_side: 'a', status: 'finished' },
    ];
    const res = knockoutNextRound(semis);
    expect(res.matches).toHaveLength(1);
  });
});
