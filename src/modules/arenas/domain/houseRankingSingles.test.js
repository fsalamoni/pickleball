/**
 * Ranking da casa com jogo SIMPLES (Onda CF).
 *
 * O que protege:
 *  1. ⭐ um dia só de duplas sai EXATAMENTE como antes (mesmo evento, mesma chave);
 *  2. ⭐ simples e duplas no mesmo dia viram DOIS eventos, com colocações
 *     próprias — o vencedor do simples não leva a colocação das duplas;
 *  3. o dia continua contando como UM dia no resumo;
 *  4. dia sem resultado continua sendo um evento "sem resultado".
 */
import { describe, it, expect } from 'vitest';
import {
  gameDayHouseEvent, gameDayHouseEvents, buildHouseRanking, houseRankingSummary,
} from './houseRanking.js';

const P = (id, uid, name) => ({ id, user_id: uid, name });
const lado = (ids) => ids.map((id) => ({ id }));
const jogo = (a, b, sa, sb) => ({ side_a: lado(a), side_b: lado(b), score_a: sa, score_b: sb });
const DIA = { id: 'gd1', title: 'Quinta', date: '2026-09-18', format: 'americano' };
const PARTS = [P('p1', 'ana', 'Ana'), P('p2', 'bia', 'Bia'), P('p3', 'caio', 'Caio'), P('p4', 'duda', 'Duda'), P('p5', 'eva', 'Eva')];
const DUPLAS = jogo(['p1', 'p2'], ['p3', 'p4'], 11, 6);
const SIMPLES = jogo(['p5'], ['p1'], 11, 2);

describe('⭐ gameDayHouseEvents', () => {
  it('⭐ dia só de duplas: exatamente o evento de sempre', () => {
    const evs = gameDayHouseEvents({ gameDay: DIA, participants: PARTS, games: [DUPLAS] });
    expect(evs).toEqual([gameDayHouseEvent({ gameDay: DIA, participants: PARTS, games: [DUPLAS] })]);
  });

  it('⭐ simples e duplas: dois eventos, cada um com a sua colocação', () => {
    const [duplas, simples] = gameDayHouseEvents({ gameDay: DIA, participants: PARTS, games: [DUPLAS, SIMPLES] });
    expect(duplas.key).toBe('gd:gd1');
    expect(duplas.title).toBe('Quinta · duplas');
    expect(simples.key).toBe('gd:gd1:simples');
    expect(simples.title).toBe('Quinta · simples');
    // Eva venceu o simples e não jogou duplas.
    expect(simples.entries.find((e) => e.user_id === 'eva').position).toBe(1);
    expect(duplas.entries.some((e) => e.user_id === 'eva')).toBe(false);
    // Ana venceu nas duplas e perdeu no simples: 1º lá, 2º aqui.
    expect(duplas.entries.find((e) => e.user_id === 'ana').position).toBe(1);
    expect(simples.entries.find((e) => e.user_id === 'ana').position).toBe(2);
  });

  it('dia só de simples: um evento, marcado como simples', () => {
    const evs = gameDayHouseEvents({ gameDay: DIA, participants: PARTS, games: [SIMPLES] });
    expect(evs).toHaveLength(1);
    expect(evs[0].key).toBe('gd:gd1:simples');
    expect(evs[0].title).toBe('Quinta · simples');
  });

  it('sem resultado: um evento "sem resultado", como sempre', () => {
    const evs = gameDayHouseEvents({ gameDay: DIA, participants: PARTS, games: [jogo(['p1'], ['p2'], null, null)] });
    expect(evs).toHaveLength(1);
    expect(evs[0].status).toBe('no_results');
    expect(evs[0].key).toBe('gd:gd1');
  });

  it('o dia com os dois tipos conta como UM dia no resumo, e os pontos somam', () => {
    const evs = gameDayHouseEvents({ gameDay: DIA, participants: PARTS, games: [DUPLAS, SIMPLES] });
    expect(houseRankingSummary(evs).gameDays).toBe(1);
    const { rows } = buildHouseRanking(evs);
    const ana = rows.find((r) => r.user_id === 'ana');
    expect(ana.events).toBe(2);
  });
});
