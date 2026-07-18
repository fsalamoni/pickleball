import { describe, it, expect } from 'vitest';
import { buildRanking } from './ranking.js';

describe('ranking engine', () => {
  const cfg = {
    target_score: 11,
    sets_per_match: 1,
    points: { match_win: 1, match_draw: 0, match_loss: 0, walkover_win: 1, walkover_loss: 0, per_set_won: 0 },
  };

  it('classifica corretamente um mini round-robin pelo número de vitórias', () => {
    const matches = [
      { side_a: 'a', side_b: 'b', side_a_ids: ['a'], side_b_ids: ['b'], games: [{ a: 11, b: 5 }] },
      { side_a: 'a', side_b: 'c', side_a_ids: ['a'], side_b_ids: ['c'], games: [{ a: 11, b: 9 }] },
      { side_a: 'b', side_b: 'c', side_a_ids: ['b'], side_b_ids: ['c'], games: [{ a: 11, b: 7 }] },
    ];
    const r = buildRanking(matches, ['a', 'b', 'c'], cfg);
    expect(r[0].participant_id).toBe('a'); // 2 vitórias
    expect(r[0].wins).toBe(2);
    expect(r[1].participant_id).toBe('b'); // 1 vitória
    expect(r[2].participant_id).toBe('c'); // 0 vitória
  });

  it('aplica saldo de pontos como primeiro critério de desempate', () => {
    // Todos com 1 vitória cada. Critério: saldo de pontos.
    const matches = [
      { side_a: 'a', side_b: 'b', side_a_ids: ['a'], side_b_ids: ['b'], games: [{ a: 11, b: 4 }] },
      { side_a: 'b', side_b: 'c', side_a_ids: ['b'], side_b_ids: ['c'], games: [{ a: 11, b: 6 }] },
      { side_a: 'c', side_b: 'a', side_a_ids: ['c'], side_b_ids: ['a'], games: [{ a: 11, b: 9 }] },
    ];
    const r = buildRanking(matches, ['a', 'b', 'c'], cfg);
    // a: 11+9=20 pf / 4+11=15 pc → saldo +5
    // b: 4+11=15 pf / 11+6=17 pc → saldo -2
    // c: 6+11=17 pf / 11+9=20 pc → saldo -3
    expect(r[0].participant_id).toBe('a');
    expect(r[1].participant_id).toBe('b');
    expect(r[2].participant_id).toBe('c');
  });

  it('usa maior pontos a favor como segundo critério de desempate', () => {
    // Dois jogadores empatados em vitórias e saldo; vence quem fez mais pontos.
    const matches = [
      // a vence b 11-3 (saldo +8)
      { side_a: 'a', side_b: 'b', side_a_ids: ['a'], side_b_ids: ['b'], games: [{ a: 11, b: 3 }] },
      // c vence d 11-3 (saldo +8)
      { side_a: 'c', side_b: 'd', side_a_ids: ['c'], side_b_ids: ['d'], games: [{ a: 11, b: 3 }] },
      // c vence b 13-11 (mais pontos a favor para c em geral)
      { side_a: 'c', side_b: 'b', side_a_ids: ['c'], side_b_ids: ['b'], games: [{ a: 13, b: 11 }] },
      // a vence d 13-11
      { side_a: 'a', side_b: 'd', side_a_ids: ['a'], side_b_ids: ['d'], games: [{ a: 13, b: 11 }] },
    ];
    const r = buildRanking(matches, ['a', 'b', 'c', 'd'], cfg);
    // a: 2v / pf 24 / pc 14 → saldo +10
    // c: 2v / pf 24 / pc 14 → saldo +10
    // mesmo wins, mesmo saldo, mesmo pf → fica a ordem estável
    expect(r[0].wins).toBe(2);
    expect(r[1].wins).toBe(2);
    expect(r[2].wins).toBe(0);
    expect(r[3].wins).toBe(0);
  });

  it('credita corretamente jogadores individuais em jogos de americana', () => {
    // 4 jogadores na americana: a+b vs c+d; a+c vs b+d; a+d vs b+c
    const matches = [
      { side_a: 'a+b', side_b: 'c+d', side_a_ids: ['a', 'b'], side_b_ids: ['c', 'd'], games: [{ a: 11, b: 5 }] },
      { side_a: 'a+c', side_b: 'b+d', side_a_ids: ['a', 'c'], side_b_ids: ['b', 'd'], games: [{ a: 11, b: 4 }] },
      { side_a: 'a+d', side_b: 'b+c', side_a_ids: ['a', 'd'], side_b_ids: ['b', 'c'], games: [{ a: 7, b: 11 }] },
    ];
    const r = buildRanking(matches, ['a', 'b', 'c', 'd'], cfg);
    const byId = Object.fromEntries(r.map((s) => [s.participant_id, s]));
    // a: jogou 3 — venceu 1 (a+b), 2 (a+c), perdeu 3 → 2 vitórias
    expect(byId.a.played).toBe(3);
    expect(byId.a.wins).toBe(2);
    // b: jogou 3 — venceu 1 (a+b), 3 (b+c), perdeu 2 → 2 vitórias
    expect(byId.b.wins).toBe(2);
    // c: jogou 3 — venceu 2 (a+c) e 3 (b+c), perdeu 1 → 2 vitórias
    expect(byId.c.wins).toBe(2);
    // d: jogou 3 — perdeu todos os três → 0 vitórias
    expect(byId.d.wins).toBe(0);
  });

  it('ignora jogos não finalizados', () => {
    const r = buildRanking(
      [
        { side_a: 'a', side_b: 'b', side_a_ids: ['a'], side_b_ids: ['b'], games: [{ a: 5, b: 4 }] },
      ],
      ['a', 'b'],
      cfg,
    );
    expect(r.every((s) => s.played === 0)).toBe(true);
  });

  it('mantém quem ainda não jogou (sem resultado lançado) abaixo de quem já jogou, mesmo perdendo', () => {
    // Grupo com 3: só o jogo a×b foi lançado (a venceu). c ainda não jogou nada.
    // c (saldo 0, sem jogos) NÃO pode ficar à frente de b, que jogou e perdeu.
    const matches = [
      { side_a: 'a', side_b: 'b', side_a_ids: ['a'], side_b_ids: ['b'], games: [{ a: 11, b: 4 }] },
      { side_a: 'a', side_b: 'c', side_a_ids: ['a'], side_b_ids: ['c'], games: [] },
      { side_a: 'b', side_b: 'c', side_a_ids: ['b'], side_b_ids: ['c'], games: [] },
    ];
    const r = buildRanking(matches, ['a', 'b', 'c'], cfg);
    expect(r.map((s) => s.participant_id)).toEqual(['a', 'b', 'c']);
    expect(r[2].participant_id).toBe('c'); // sem jogo lançado → por último
    expect(r[2].played).toBe(0);
  });
});
