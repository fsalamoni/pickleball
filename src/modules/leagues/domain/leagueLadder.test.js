/**
 * A escada no cliente: ordem inicial pelo DUPR, quadras pela posição, o 1º
 * sobe e o último desce, quem entra depois começa embaixo, quem falta fica no
 * lugar, e o estado da próxima sessão (gerar, refazer ou travada).
 */
import { describe, it, expect } from 'vitest';
import {
  buildSessionGroups, computeLadder, isLadderFormat, ladderGroupSizes, ladderNearestFits, ladderTiebreakOrder, nextSessionState,
} from './leagueLadder';
import { americanoCourtMatches } from '@/core/domain/americanoGroups';

const ms = (s) => ({ seconds: s, nanoseconds: 0 });
const entry = (id, dupr, s = 1) => ({ id, name: id, status: 'active', players: dupr == null ? [{}] : [{ dupr }], created_at: ms(s) });
const oito = () => ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((id, i) => entry(id, 5 - i * 0.1));

function sessao(n, quadras, venceA, t0) {
  return quadras.flatMap((ids, q) => americanoCourtMatches(ids).map((m, k) => ({
    id: `s${n}q${q}j${k}`, phase: 'ladder', session: n, group: q, round: m.round, team_a: m.team_a, team_b: m.team_b,
    games: venceA ? [{ a: 11, b: 5 }] : [], wo_winner: null, status: venceA ? 'done' : 'scheduled', created_at: ms(t0),
  })));
}

describe('escada da liga', () => {
  it('reconhece os formatos e as quadras que fecham', () => {
    expect(isLadderFormat('ladder_individual')).toBe(true);
    expect(isLadderFormat('round_robin')).toBe(false);
    expect(ladderGroupSizes('ladder_individual', 9)).toEqual([5, 4]);
    expect(ladderGroupSizes('ladder_individual', 6)).toBeNull();
    expect(ladderNearestFits('ladder_individual', 6)).toEqual({ below: 5, above: 8 });
    expect(ladderNearestFits('ladder_individual', 3)).toEqual({ below: null, above: 4 });
  });

  it('desempate da quadra só com critérios simples', () => {
    expect(ladderTiebreakOrder(['head_to_head', 'balance'])).toEqual(['balance']);
    expect(ladderTiebreakOrder([])).toEqual(['wins', 'balance', 'points_for']);
  });

  it('quem tem DUPR maior começa acima; sem DUPR, no fim', () => {
    const l = computeLadder([entry('X', 3), entry('W', null), entry('Y', 5)], []);
    expect(l.order).toEqual(['Y', 'X', 'W']);
  });

  it('ordem inicial pelo DUPR e quadras pela posição', () => {
    const l = computeLadder(oito(), []);
    expect(l.order).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const g = buildSessionGroups('ladder_individual', l.order);
    expect(g.ok).toBe(true);
    expect(g.groups).toEqual([['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H']]);
    expect(nextSessionState(l)).toEqual({ number: 1, redo: false, blocked: false });
  });

  it('sessão sem placar pode ser refeita; com um placar, trava', () => {
    const jogos = sessao(1, [['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H']], false, 10);
    expect(nextSessionState(computeLadder(oito(), jogos))).toEqual({ number: 1, redo: true, blocked: false });
    jogos[0] = { ...jogos[0], games: [{ a: 11, b: 3 }], status: 'done' };
    expect(nextSessionState(computeLadder(oito(), jogos))).toEqual({ number: 1, redo: false, blocked: true });
  });

  it('fechada: o último da quadra de cima troca com o 1º da de baixo; quem entrou depois começa embaixo', () => {
    // Em cada quadra, quem está no lado A ganha: conta por jogador.
    const jogos = sessao(1, [['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H']], true, 10);
    const entradas = [...oito(), entry('Z', 9.9, 20)];
    const l = computeLadder(entradas, jogos);
    expect(l.sessions[0].complete).toBe(true);
    const [q1, q2] = l.sessions[0].groups;
    expect(q1.down).toBe(q1.ranking[3]);
    expect(q2.up).toBe(q2.ranking[0]);
    const pos = l.order.indexOf(q2.up);
    expect(pos).toBe(3);
    expect(l.order[4]).toBe(q1.down);
    // Z tem o melhor DUPR, mas entrou depois da sessão: fica no fim.
    expect(l.order[l.order.length - 1]).toBe('Z');
    const sobe = l.rows.find((r) => r.entry_id === q2.up);
    expect(sobe.movement).toBe('up');
    expect(sobe.change).toBe(1);
    expect(nextSessionState(l)).toEqual({ number: 2, redo: false, blocked: false });
  });

  it('quem falta fica no lugar', () => {
    // Só a primeira quadra jogou (E…H faltaram): a de baixo não se mexe.
    const jogos = sessao(1, [['A', 'B', 'C', 'D']], true, 10);
    const l = computeLadder(oito(), jogos);
    expect(l.order.slice(4)).toEqual(['E', 'F', 'G', 'H']);
    expect(new Set(l.order.slice(0, 4))).toEqual(new Set(['A', 'B', 'C', 'D']));
  });
});
