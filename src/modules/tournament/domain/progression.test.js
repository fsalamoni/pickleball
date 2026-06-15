import { describe, it, expect } from 'vitest';
import {
  matchWinnerIds,
  matchLoserIds,
  isMatchDecided,
  knockoutNextRound,
  swissNextRound,
  doubleEliminationPlan,
  doubleEliminationNextMatches,
  computeStageAdvance,
  stageSupportsAdvance,
} from './progression.js';
import { MATCH_STATUS } from './constants.js';
import { nextPowerOfTwo } from './draw.js';

/* Helpers para montar jogos de teste. */
let idSeq = 0;
function mkMatch(round, position, aId, bId, opts = {}) {
  idSeq += 1;
  return {
    id: `m${idSeq}`,
    round,
    position,
    side_a: aId,
    side_b: bId,
    side_a_ids: aId ? [aId] : [],
    side_b_ids: bId ? [bId] : [],
    status: opts.status || (bId ? MATCH_STATUS.SCHEDULED : MATCH_STATUS.WALKOVER),
    winner_side: opts.winner_side ?? null,
    bracket: opts.bracket,
  };
}
function decide(m, winnerSide) {
  return { ...m, status: MATCH_STATUS.FINISHED, winner_side: winnerSide };
}

describe('helpers de resultado', () => {
  it('matchWinnerIds/loserIds com winner_side', () => {
    const m = mkMatch(1, 1, 'a', 'b');
    expect(matchWinnerIds(decide(m, 'a'))).toEqual(['a']);
    expect(matchLoserIds(decide(m, 'a'))).toEqual(['b']);
    expect(matchWinnerIds(decide(m, 'b'))).toEqual(['b']);
  });
  it('bye: lado presente vence sem winner_side', () => {
    const m = mkMatch(1, 1, 'a', null);
    expect(isMatchDecided(m)).toBe(true);
    expect(matchWinnerIds(m)).toEqual(['a']);
    expect(matchLoserIds(m)).toEqual([]);
  });
  it('indefinido quando agendado sem vencedor', () => {
    const m = mkMatch(1, 1, 'a', 'b');
    expect(isMatchDecided(m)).toBe(false);
    expect(matchWinnerIds(m)).toBeNull();
  });
});

describe('knockoutNextRound', () => {
  it('pendente quando a rodada não terminou', () => {
    const matches = [mkMatch(1, 1, 'a', 'b'), mkMatch(1, 2, 'c', 'd')];
    expect(knockoutNextRound(matches)).toEqual({ pending: true });
  });

  it('gera a próxima rodada pareando vencedores', () => {
    const matches = [
      decide(mkMatch(1, 1, 'a', 'b'), 'a'),
      decide(mkMatch(1, 2, 'c', 'd'), 'b'),
    ];
    const res = knockoutNextRound(matches);
    expect(res.nextRound).toBe(2);
    expect(res.matches).toHaveLength(1);
    expect(res.matches[0].side_a).toBe('a');
    expect(res.matches[0].side_b).toBe('d');
  });

  it('detecta o campeão na final', () => {
    const matches = [decide(mkMatch(2, 1, 'a', 'd'), 'a')];
    expect(knockoutNextRound(matches)).toEqual({ complete: true, championIds: ['a'] });
  });

  it('joga uma chave completa de 8 até o campeão', () => {
    // Round 1
    let matches = [
      decide(mkMatch(1, 1, 'a', 'b'), 'a'),
      decide(mkMatch(1, 2, 'c', 'd'), 'a'),
      decide(mkMatch(1, 3, 'e', 'f'), 'a'),
      decide(mkMatch(1, 4, 'g', 'h'), 'a'),
    ];
    let res = knockoutNextRound(matches);
    expect(res.matches).toHaveLength(2);
    // Semis: a vs c, e vs g
    const semis = res.matches.map((m, i) => decide(mkMatch(2, i + 1, m.side_a, m.side_b), 'a'));
    matches = matches.concat(semis);
    res = knockoutNextRound(matches);
    expect(res.matches).toHaveLength(1);
    const final = [decide(mkMatch(3, 1, res.matches[0].side_a, res.matches[0].side_b), 'a')];
    matches = matches.concat(final);
    expect(knockoutNextRound(matches)).toEqual({ complete: true, championIds: ['a'] });
  });
});

describe('swissNextRound', () => {
  const players = ['a', 'b', 'c', 'd'];
  it('gera a 2ª rodada sem repetir confrontos e respeitando o total', () => {
    const r1 = [
      decide(mkMatch(1, 1, 'a', 'b'), 'a'),
      decide(mkMatch(1, 2, 'c', 'd'), 'a'),
    ];
    const res = swissNextRound(r1, players, { seed: 'fixed', totalRounds: 2 });
    expect(res.nextRound).toBe(2);
    expect(res.matches).toHaveLength(2);
    // ninguém repete confronto da rodada 1
    res.matches.forEach((m) => {
      const pair = [m.side_a, m.side_b].sort().join('|');
      expect(pair).not.toBe('a|b');
      expect(pair).not.toBe('c|d');
    });
  });

  it('completa quando atinge o total de rodadas', () => {
    const r1 = [decide(mkMatch(1, 1, 'a', 'b'), 'a'), decide(mkMatch(1, 2, 'c', 'd'), 'a')];
    expect(swissNextRound(r1, players, { totalRounds: 1 })).toEqual({ complete: true });
  });

  it('pendente quando a rodada atual não terminou', () => {
    const r1 = [mkMatch(1, 1, 'a', 'b'), decide(mkMatch(1, 2, 'c', 'd'), 'a')];
    expect(swissNextRound(r1, players, { totalRounds: 3 })).toEqual({ pending: true });
  });
});

describe('doubleEliminationPlan', () => {
  it('dimensiona WB/LB corretamente para size 8', () => {
    const plan = doubleEliminationPlan(8);
    const wb = plan.nodes.filter((n) => n.bracket === 'wb');
    const lb = plan.nodes.filter((n) => n.bracket === 'lb');
    const gf = plan.nodes.filter((n) => n.bracket === 'gf');
    expect(wb).toHaveLength(7); // 4+2+1
    expect(lb).toHaveLength(6); // 2+2+1+1  → 2M-2 = 4 rodadas
    expect(gf).toHaveLength(2);
    expect(plan.lbRounds).toBe(4);
  });

  it('dimensiona para size 16 (total = 2n-2 + reset)', () => {
    const plan = doubleEliminationPlan(16);
    const wb = plan.nodes.filter((n) => n.bracket === 'wb').length;
    const lb = plan.nodes.filter((n) => n.bracket === 'lb').length;
    expect(wb).toBe(15);
    expect(lb).toBe(14);
    expect(wb + lb).toBe(29); // 2*16-2 - 1(gf) ... gf adiciona o jogo final
  });
});

/**
 * Simula uma chave de dupla eliminação inteira aplicando avanços sucessivos.
 * `winnerPicker(a,b)` decide o vencedor de cada confronto.
 */
function simulateDoubleElimination(participants, winnerPicker) {
  const size = nextPowerOfTwo(participants.length);
  // sorteio inicial: WB rodada 1 (com byes p/ não-potência de 2)
  const slots = participants.slice();
  while (slots.length < size) slots.push(null);
  let matches = [];
  let seq = 0;
  for (let i = 0; i < size; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    seq += 1;
    matches.push({
      id: `wb1_${seq}`,
      bracket: 'wb',
      round: 1,
      position: i / 2 + 1,
      side_a: a,
      side_b: b,
      side_a_ids: a ? [a] : [],
      side_b_ids: b ? [b] : [],
      status: a && b ? MATCH_STATUS.SCHEDULED : MATCH_STATUS.WALKOVER,
      winner_side: null,
    });
  }

  let guard = 0;
  while (guard < 200) {
    guard += 1;
    // resolve resultados de todos os jogos jogáveis ainda pendentes
    matches = matches.map((m) => {
      if (isMatchDecided(m)) return m;
      if (!(m.side_a_ids.length && m.side_b_ids.length)) return m; // bye já decidido
      const w = winnerPicker(m.side_a_ids[0], m.side_b_ids[0]);
      return { ...m, status: MATCH_STATUS.FINISHED, winner_side: w === m.side_a_ids[0] ? 'a' : 'b' };
    });

    const res = doubleEliminationNextMatches(matches, participants.length);
    if (res.complete) return { championIds: res.championIds, matches };
    if (res.pending) {
      // nada novo e nenhum campeão → precisa decidir jogos pendentes (loop tenta de novo)
      const anyPending = matches.some((m) => !isMatchDecided(m) && m.side_a_ids.length && m.side_b_ids.length);
      if (!anyPending) return { championIds: null, matches, stuck: true };
      continue;
    }
    // adiciona novos jogos
    res.matches.forEach((nm) => {
      seq += 1;
      matches.push({
        id: `g_${seq}`,
        bracket: nm.bracket,
        round: nm.round,
        position: nm.position,
        side_a: nm.side_a,
        side_b: nm.side_b,
        side_a_ids: nm.side_a ? (Array.isArray(nm.side_a) ? nm.side_a : [nm.side_a]) : [],
        side_b_ids: nm.side_b ? (Array.isArray(nm.side_b) ? nm.side_b : [nm.side_b]) : [],
        status: nm.bye ? MATCH_STATUS.WALKOVER : MATCH_STATUS.SCHEDULED,
        winner_side: null,
      });
    });
  }
  return { championIds: null, matches, stuck: true };
}

describe('doubleEliminationNextMatches (simulação completa)', () => {
  it('size 8: produz um único campeão; o "melhor" vence sempre', () => {
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const rank = new Map(players.map((p, i) => [p, i])); // menor índice = mais forte
    const { championIds, stuck } = simulateDoubleElimination(players, (a, b) =>
      rank.get(a) < rank.get(b) ? a : b,
    );
    expect(stuck).toBeFalsy();
    expect(championIds).toEqual(['p1']);
  });

  it('size 8: cada não-campeão tem exatamente 2 derrotas', () => {
    const players = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const rank = new Map(players.map((p, i) => [p, i]));
    const { championIds, matches } = simulateDoubleElimination(players, (a, b) =>
      rank.get(a) < rank.get(b) ? a : b,
    );
    const losses = new Map(players.map((p) => [p, 0]));
    matches.forEach((m) => {
      if (!isMatchDecided(m)) return;
      const loser = (matchLoserIds(m) || [])[0];
      if (loser) losses.set(loser, losses.get(loser) + 1);
    });
    players.forEach((p) => {
      if (p === championIds[0]) return;
      expect(losses.get(p)).toBe(2);
    });
  });

  it('size 4: campeão único', () => {
    const players = ['a', 'b', 'c', 'd'];
    const rank = new Map(players.map((p, i) => [p, i]));
    const { championIds, stuck } = simulateDoubleElimination(players, (x, y) =>
      rank.get(x) < rank.get(y) ? x : y,
    );
    expect(stuck).toBeFalsy();
    expect(championIds).toEqual(['a']);
  });

  it('size 16: campeão único', () => {
    const players = Array.from({ length: 16 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`);
    const rank = new Map(players.map((p, i) => [p, i]));
    const { championIds, stuck } = simulateDoubleElimination(players, (x, y) =>
      rank.get(x) < rank.get(y) ? x : y,
    );
    expect(stuck).toBeFalsy();
    expect(championIds).toEqual(['p01']);
  });

  it('reset da grand final: campeão da LB vence as duas finais', () => {
    // 4 jogadores; forçamos o campeão da WB a perder ambas as GFs.
    const players = ['a', 'b', 'c', 'd'];
    // "a" domina até a GF; depois sempre perde → exige reset e LB vence.
    let gfSeen = 0;
    const picker = (x, y) => {
      // identifica GF pelo fato de 'a' reaparecer contra o finalista da LB
      const pair = [x, y];
      if (pair.includes('a')) {
        // nas duas finais, o adversário de 'a' vence
        const opp = x === 'a' ? y : x;
        gfSeen += 1;
        if (gfSeen >= 5) return opp; // após a fase de chave, derrota 'a' nas finais
      }
      return x; // antes disso, o primeiro argumento (ordem estável) vence
    };
    const { championIds, stuck } = simulateDoubleElimination(players, picker);
    expect(stuck).toBeFalsy();
    expect(championIds).not.toBeNull();
  });

  it('non-power-of-2 (6): completa com campeão único', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f'];
    const rank = new Map(players.map((p, i) => [p, i]));
    const { championIds, stuck } = simulateDoubleElimination(players, (x, y) =>
      rank.get(x) < rank.get(y) ? x : y,
    );
    expect(stuck).toBeFalsy();
    expect(championIds).toEqual(['a']);
  });
});

describe('computeStageAdvance / stageSupportsAdvance', () => {
  it('despacha por tipo', () => {
    expect(stageSupportsAdvance('knockout')).toBe(true);
    expect(stageSupportsAdvance('swiss')).toBe(true);
    expect(stageSupportsAdvance('double_knockout')).toBe(true);
    expect(stageSupportsAdvance('round_robin')).toBe(false);
    expect(stageSupportsAdvance('groups')).toBe(false);
    expect(stageSupportsAdvance('americano')).toBe(false);
  });
  it('formatos completos não avançam', () => {
    expect(computeStageAdvance('round_robin', [], {})).toEqual({ notApplicable: true });
  });
});
