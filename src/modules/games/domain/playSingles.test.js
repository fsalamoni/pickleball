/**
 * O Play com jogo SIMPLES (Onda CF).
 *
 * O que protege:
 *  1. ⭐ sem tipo por quadra (ou com todas de duplas) a simulação é IDÊNTICA à
 *     de antes — nenhum dia de jogo existente muda;
 *  2. ⭐ a quadra de simples leva os DOIS primeiros da fila (a ordem manda);
 *  3. ⭐ no simples a dupla vinculada não prende ninguém: quem tem o parceiro
 *     em quadra pode jogar simples;
 *  4. ⭐ com o rodízio equilibrado, o primeiro da fila joga sempre e o
 *     adversário varia;
 *  5. o sorteio da rodada e a previsão continuam saindo da MESMA fonte;
 *  6. quadra de simples com um só na fila espera 1, não 3.
 */
import { describe, it, expect } from 'vitest';
import {
  simulatePlaySequence, drawPlayRoundForFreeCourts, forecastPlayByCourtBalanced,
  buildPlayHistory,
} from './playRotation.js';
import { assignPlaySides } from './gamePlay.js';

const P = (id, extra = {}) => ({
  id, available_since: extra.since ?? 0, available_tie: 0,
  created_at_ms: 0, play_gender: 'male', play_level: 3.0, ...extra,
});
const fila = (...ids) => ids.map((id, i) => P(id, { since: i }));
const simples = (a, b, extra = {}) => ({ side_a: [{ id: a }], side_b: [{ id: b }], kind: 'singles', status: 'finished', ...extra });

describe('⭐ sem simples, nada muda', () => {
  const entrada = fila('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i');
  const jogos = [{ side_a: [{ id: 'x' }, { id: 'y' }], side_b: [{ id: 'z' }, { id: 'w' }], court: 2, order: 1 }];

  it('sem `courtKinds` e com todas de duplas, a simulação é a mesma', () => {
    const base = simulatePlaySequence(entrada, { courts: 3, games: jogos });
    const duplas = simulatePlaySequence(entrada, {
      courts: 3, games: jogos, courtKinds: { 1: 'doubles', 2: 'doubles', 3: 'doubles' },
    });
    expect(duplas).toEqual(base);
  });

  it('também com o rodízio equilibrado', () => {
    const historico = buildPlayHistory(jogos);
    const base = simulatePlaySequence(entrada, { courts: 3, games: jogos, history: historico });
    const duplas = simulatePlaySequence(entrada, {
      courts: 3, games: jogos, history: historico, courtKinds: { 1: 'doubles', 3: 'doubles' },
    });
    expect(duplas).toEqual(base);
  });
});

describe('⭐ a quadra de simples', () => {
  it('leva os DOIS primeiros da fila; a de duplas, os quatro seguintes', () => {
    const { blocks } = simulatePlaySequence(fila('a', 'b', 'c', 'd', 'e', 'f'), {
      courts: 2, games: [], courtKinds: { 1: 'singles', 2: 'doubles' },
    });
    expect(blocks[0]).toMatchObject({ court: 1, kind: 'singles', slots: 2, full: true });
    expect(blocks[0].players.map((p) => p.id)).toEqual(['a', 'b']);
    expect(blocks[1]).toMatchObject({ court: 2, kind: 'doubles', slots: 4, full: true });
    expect(blocks[1].players.map((p) => p.id)).toEqual(['c', 'd', 'e', 'f']);
  });

  it('⭐ a dupla vinculada não prende ninguém no simples', () => {
    // `a` e `b` são dupla, e `b` está em quadra: nas duplas `a` aguardaria.
    const entrada = [P('a', { since: 0, partner_id: 'b' }), P('c', { since: 1 }), P('d', { since: 2 })];
    const emQuadra = { side_a: [{ id: 'b' }, { id: 'x' }], side_b: [{ id: 'y' }, { id: 'z' }], court: 2, order: 1 };
    const { blocks } = simulatePlaySequence(entrada, {
      courts: 2, games: [emQuadra], courtKinds: { 1: 'singles', 2: 'doubles' },
    });
    expect(blocks[0].players.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('com um só na fila, espera 1 — não 3', () => {
    const { blocks } = simulatePlaySequence(fila('a'), { courts: 1, games: [], courtKinds: { 1: 'singles' } });
    expect(blocks[0]).toMatchObject({ full: false, waiting: 1, slots: 2 });
  });

  it('⭐ rodízio equilibrado: o primeiro joga sempre, e o adversário varia', () => {
    const entrada = fila('a', 'b', 'c', 'd');
    const historico = buildPlayHistory([simples('a', 'b', { order: 1 }), simples('a', 'b', { order: 2 })]);
    const { blocks } = simulatePlaySequence(entrada, {
      courts: 1, games: [], history: historico, courtKinds: { 1: 'singles' },
    });
    const ids = blocks[0].players.map((p) => p.id);
    expect(ids[0]).toBe('a');
    expect(ids).not.toContain('b');
  });
});

describe('o sorteio da rodada com tipos diferentes', () => {
  const opts = { courts: 2, games: [], courtKinds: { 1: 'doubles', 2: 'singles' } };
  const entrada = fila('a', 'b', 'c', 'd', 'e', 'f', 'g');

  it('⭐ cada quadra com o seu tipo, e a previsão anuncia o mesmo', () => {
    const rodada = drawPlayRoundForFreeCourts(entrada, opts);
    expect(rodada).toEqual([
      { court: 1, kind: 'doubles', ids: ['a', 'b', 'c', 'd'] },
      { court: 2, kind: 'singles', ids: ['e', 'f'] },
    ]);
    const previsto = simulatePlaySequence(entrada, opts).blocks
      .filter((b) => b.free && b.full)
      .map((b) => ({ court: b.court, kind: b.kind, ids: b.players.map((p) => p.id) }));
    expect(rodada).toEqual(previsto);
  });

  it('a previsão por quadra devolve o tipo e as vagas de cada uma', () => {
    const porQuadra = forecastPlayByCourtBalanced(fila('a', 'b'), {
      courts: 2, games: [], courtKinds: { 1: 'singles', 2: 'doubles' },
    });
    expect(porQuadra.map((q) => [q.court, q.kind, q.slots])).toEqual([[1, 'singles', 2], [2, 'doubles', 4]]);
  });
});

describe('os lados da partida', () => {
  it('simples é 1 × 1, na ordem da fila', () => {
    expect(assignPlaySides([P('a'), P('b')], { kind: 'singles' })).toEqual({ side_a: ['a'], side_b: ['b'] });
  });

  it('duplas continua sendo o pareamento de sempre', () => {
    const r = assignPlaySides([P('a'), P('b'), P('c'), P('d')], { rng: () => 0.5 });
    expect(r.side_a).toHaveLength(2);
    expect(r.side_b).toHaveLength(2);
  });

  it('simples com um só não inventa partida', () => {
    expect(assignPlaySides([P('a')], { kind: 'singles' })).toEqual({ side_a: [], side_b: [] });
  });
});
