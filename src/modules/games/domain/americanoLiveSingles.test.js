/**
 * O Americano aprimorado com jogo SIMPLES (Onda CF).
 *
 * O que protege:
 *  1. ⭐ sem quadra de simples, a previsão é IDÊNTICA à de antes;
 *  2. ⭐ o primeiro da fila joga sempre; o adversário é o que menos repete
 *     confronto de simples, com nível parecido e perto do topo;
 *  3. ⭐ no simples a dupla vinculada não vale;
 *  4. ⭐ com quadras de tipos diferentes, cada uma sai com o seu tipo, e o que
 *     se sorteia é o que a previsão anuncia;
 *  5. três na fila não enchem as duplas, mas dão um simples;
 *  6. a bússola do Americano (duplas e confrontos) não conta jogo simples.
 */
import { describe, it, expect } from 'vitest';
import {
  drawNextAmericanoLiveMatch, forecastAmericanoLiveMatches,
  drawAmericanoLiveRoundForFreeCourts, americanoLiveProgress,
} from './americanoLive.js';

const P = (id, extra = {}) => ({ id, name: id.toUpperCase(), ...extra });
const fila = (ids) => ids.map((id, i) => P(id, { available_since: 1000 + i }));
const rng = () => 0.5;
const simples = (a, b) => ({ side_a: [{ id: a }], side_b: [{ id: b }], kind: 'singles', status: 'finished', score_a: 11, score_b: 5 });

describe('⭐ sem simples, nada muda', () => {
  it('a previsão sem `courtKinds` e com todas de duplas é a mesma', () => {
    const entrada = fila(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
    const base = forecastAmericanoLiveMatches(entrada, { courts: 2, games: [], rng });
    const duplas = forecastAmericanoLiveMatches(entrada, {
      courts: 2, games: [], rng, courtKinds: { 1: 'doubles', 2: 'doubles' },
    });
    expect(duplas).toEqual(base);
  });
});

describe('⭐ a próxima partida simples', () => {
  it('o primeiro da fila joga sempre, 1 × 1', () => {
    const r = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c']), { kind: 'singles', rng });
    expect(r.side_a).toEqual(['a']);
    expect(r.side_b).toHaveLength(1);
    expect(r.ids).toEqual(['a', r.side_b[0]]);
  });

  it('⭐ evita repetir o adversário de simples', () => {
    const r = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c']), {
      kind: 'singles', rng, games: [simples('a', 'b')],
    });
    expect(r.side_b).toEqual(['c']);
  });

  it('sem repetição, fica com quem está mais perto do topo', () => {
    const r = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c', 'd']), { kind: 'singles', rng });
    expect(r.side_b).toEqual(['b']);
  });

  it('prefere nível parecido quando isso compensa descer na fila', () => {
    const levels = { a: 5.0, b: 2.5, c: 4.9 };
    const r = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c']), { kind: 'singles', rng, levels });
    expect(r.side_b).toEqual(['c']);
  });

  it('⭐ a dupla vinculada não vale no simples', () => {
    const entrada = [
      P('a', { available_since: 1, partner_id: 'z' }), // parceiro fora da fila
      P('b', { available_since: 2 }),
    ];
    const r = drawNextAmericanoLiveMatch(entrada, { kind: 'singles', rng });
    expect(r.ids).toEqual(['a', 'b']);
  });

  it('com um só na fila não há partida', () => {
    expect(drawNextAmericanoLiveMatch(fila(['a']), { kind: 'singles', rng })).toBeNull();
  });

  it('jogo de DUPLAS no histórico não conta como confronto de simples', () => {
    const duplas = { side_a: [{ id: 'a' }, { id: 'x' }], side_b: [{ id: 'b' }, { id: 'y' }], status: 'finished' };
    const r = drawNextAmericanoLiveMatch(fila(['a', 'b', 'c']), { kind: 'singles', rng, games: [duplas] });
    expect(r.side_b).toEqual(['b']);
  });
});

describe('⭐ quadras de tipos diferentes', () => {
  const opts = { courts: 2, games: [], rng, courtKinds: { 1: 'singles', 2: 'doubles' } };

  it('cada quadra sai com o seu tipo — duplas primeiro, depois o simples', () => {
    const blocos = forecastAmericanoLiveMatches(fila(['a', 'b', 'c', 'd', 'e', 'f']), opts);
    const q1 = blocos.find((b) => b.court === 1);
    const q2 = blocos.find((b) => b.court === 2);
    expect(q2.kind).toBe('doubles');
    expect(q2.players).toHaveLength(4);
    expect(q1.kind).toBe('singles');
    expect(q1.side_a).toHaveLength(1);
    expect(q1.side_b).toHaveLength(1);
  });

  it('⭐ o que se sorteia é o que a previsão anuncia', () => {
    const entrada = fila(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    const previsto = forecastAmericanoLiveMatches(entrada, opts)
      .filter((b) => !b.conditional)
      .map((b) => ({
        court: b.court, kind: b.kind, ids: b.players.map((p) => p.id), side_a: b.side_a, side_b: b.side_b,
      }));
    expect(drawAmericanoLiveRoundForFreeCourts(entrada, opts)).toEqual(previsto);
  });

  it('três na fila não enchem as duplas, mas dão um simples', () => {
    const r = drawAmericanoLiveRoundForFreeCourts(fila(['a', 'b', 'c']), opts);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ court: 1, kind: 'singles' });
  });

  it('quadra ocupada de simples prevê simples (condicional)', () => {
    const emQuadra = { side_a: [{ id: 'x' }], side_b: [{ id: 'y' }], court: 1, status: 'open', kind: 'singles', created_at_ms: 1 };
    const blocos = forecastAmericanoLiveMatches(fila(['a', 'b', 'c', 'd']), {
      ...opts, games: [emQuadra],
    });
    const condicional = blocos.find((b) => b.conditional);
    expect(condicional).toMatchObject({ court: 1, kind: 'singles' });
  });
});

describe('a bússola do Americano não conta jogo simples', () => {
  it('simples conta como partida jogada, mas não forma dupla nem confronto', () => {
    const participants = ['a', 'b', 'c', 'd'].map((id) => P(id));
    const p = americanoLiveProgress({ participants, games: [simples('a', 'b'), simples('a', 'b')] });
    expect(p.duplasFormadas).toBe(0);
    expect(p.confrontosCompletos).toBe(0);
    expect(p.jogosPorAtleta.get('a')).toBe(2);
  });
});
