import { describe, it, expect } from 'vitest';
import { leagueDivisionPodium } from './leaguePodium.js';
import { playoffFirstRound, playoffState } from './leaguePlayoff.js';

const dupla = (id, extra = {}) => ({
  id, name: `Dupla ${id}`, division_id: 'd1', status: 'active',
  players: [{ uid: `${id}-a`, name: `${id} A` }, { uid: null, name: `${id} B` }],
  ...extra,
});
const jogo = (a, b, vence = 'a', extra = {}) => ({
  id: `${a}x${b}${extra.phase || ''}`, division_id: 'd1', phase: 'season', side_a: a, side_b: b,
  games: [vence === 'a' ? { a: 11, b: 5 } : { a: 5, b: 11 }], status: 'done', ...extra,
});
const LIGA = { id: 'l1', status: 'finished', format: 'doubles_round_robin', season: {}, standings: {} };
const quatro = ['e1', 'e2', 'e3', 'e4'].map((id) => dupla(id));
// e1 vence todos; e2 vence e3 e e4; e3 vence e4.
const todosContraTodos = [
  jogo('e1', 'e2'), jogo('e1', 'e3'), jogo('e1', 'e4'), jogo('e2', 'e3'), jogo('e2', 'e4'), jogo('e3', 'e4'),
];
const ordem = (p) => p.places.map((x) => [x.position, x.entryId]);

describe('pódio da divisão da liga', () => {
  it('só liga ENCERRADA tem pódio', () => {
    ['draft', 'open', 'running', 'cancelled'].forEach((status) => {
      expect(leagueDivisionPodium({ ...LIGA, status }, quatro, todosContraTodos)).toEqual({ complete: false, places: [] });
    });
    expect(leagueDivisionPodium(null, quatro, todosContraTodos).complete).toBe(false);
  });

  it('sem playoff: os três primeiros da tabela, com os atletas de cada inscrição', () => {
    const p = leagueDivisionPodium(LIGA, quatro, todosContraTodos);
    expect(p.complete).toBe(true);
    expect(ordem(p)).toEqual([[1, 'e1'], [2, 'e2'], [3, 'e3']]);
    expect(p.places[0]).toMatchObject({ name: 'Dupla e1', players: [{ uid: 'e1-a', name: 'e1 A' }, { uid: null, name: 'e1 B' }] });
  });

  it('sem nenhum jogo decidido não há pódio; quem não jogou não sobe', () => {
    expect(leagueDivisionPodium(LIGA, quatro, []).complete).toBe(false);
    expect(leagueDivisionPodium(LIGA, quatro, [{ ...jogo('e1', 'e2'), games: [], status: 'scheduled' }]).complete).toBe(false);
    expect(ordem(leagueDivisionPodium(LIGA, quatro, [jogo('e1', 'e2')]))).toEqual([[1, 'e1'], [2, 'e2']]);
  });

  it('quem desistiu não sobe ao pódio', () => {
    const es = quatro.map((e) => (e.id === 'e2' ? { ...e, status: 'withdrawn' } : e));
    expect(ordem(leagueDivisionPodium(LIGA, es, todosContraTodos))).toEqual([[1, 'e1'], [2, 'e3'], [3, 'e4']]);
  });

  describe('com playoff', () => {
    const liga = (terceiro) => ({ ...LIGA, season: { playoff: { enabled: true, size: 4, third_place: terceiro } } });
    const po = (m, vence) => jogo(m.side_a, m.side_b, vence, { ...m, id: `po${m.round}${m.slot}`, phase: 'playoff' });
    const semis = playoffFirstRound(['e1', 'e2', 'e3', 'e4'], 4); // e1×e4, e2×e3

    it('campeão e vice são os da final; o 3º é o do jogo de 3º lugar', () => {
      const feitas = [po(semis[0], 'b'), po(semis[1], 'a')]; // e4 e e2 vão à final
      const prox = playoffState(feitas, { thirdPlace: true }).next;
      const ms = [...todosContraTodos, ...feitas, po(prox[0], 'a'), po(prox[1], 'b')]; // final e4×e2: e4; 3º e1×e3: e3
      expect(ordem(leagueDivisionPodium(liga(true), quatro, ms))).toEqual([[1, 'e4'], [2, 'e2'], [3, 'e3']]);
    });

    it('sem jogo de 3º lugar, o 3º é o melhor da tabela entre os que não chegaram à final', () => {
      const feitas = [po(semis[0], 'b'), po(semis[1], 'a')];
      const prox = playoffState(feitas).next;
      const ms = [...todosContraTodos, ...feitas, po(prox[0], 'a')];
      expect(ordem(leagueDivisionPodium(liga(false), quatro, ms))).toEqual([[1, 'e4'], [2, 'e2'], [3, 'e1']]);
    });

    it('playoff começado e não terminado: ninguém foi campeão', () => {
      const ms = [...todosContraTodos, po(semis[0], 'a'), { ...po(semis[1], 'a'), games: [] }];
      expect(leagueDivisionPodium(liga(false), quatro, ms)).toEqual({ complete: false, places: [] });
    });

    it('playoff ligado e nunca montado: vale a tabela', () => {
      expect(ordem(leagueDivisionPodium(liga(true), quatro, todosContraTodos))).toEqual([[1, 'e1'], [2, 'e2'], [3, 'e3']]);
    });
  });

  describe('escada', () => {
    const LADDER = { ...LIGA, format: 'ladder_individual' };
    const ind = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id.toUpperCase(), status: 'active', created_at: i + 1, players: [{ uid: `u-${id}`, name: id.toUpperCase() }] }));
    const quadra = (ta, tb, vence, n) => ({
      id: `s1-${n}`, division_id: 'd1', phase: 'ladder', session: 1, group: 0, team_a: ta, team_b: tb,
      games: [vence === 'a' ? { a: 11, b: 4 } : { a: 4, b: 11 }], status: 'done', created_at: 10,
    });
    // Americano de 4: "a" vence os três; "b" vence dois; "c" vence um.
    const sessao = [quadra(['a', 'b'], ['c', 'd'], 'a', 1), quadra(['a', 'c'], ['b', 'd'], 'a', 2), quadra(['a', 'd'], ['b', 'c'], 'b', 3)];

    it('os três primeiros da escada, depois de uma sessão fechada', () => {
      const p = leagueDivisionPodium(LADDER, ind, sessao);
      expect(p.complete).toBe(true);
      expect(p.places.map((x) => x.entryId)).toEqual(['a', 'b', 'c']);
    });

    it('sem sessão fechada não há pódio', () => {
      expect(leagueDivisionPodium(LADDER, ind, []).complete).toBe(false);
      expect(leagueDivisionPodium(LADDER, ind, [sessao[0], { ...sessao[1], games: [], status: 'scheduled' }]).complete).toBe(false);
    });
  });
});
