/**
 * Simples × duplas (Onda CF) — o tipo de um jogo e de uma quadra.
 *
 * O que protege:
 *  1. ⭐ o tipo sai do NÚMERO DE ATLETAS por lado — a mesma regra da
 *     publicação e do servidor; o campo `kind` só vale com os lados vazios;
 *  2. ⭐ jogo antigo, sem `kind`, é duplas (nada muda para o legado);
 *  3. ⭐ a quadra lembra o tipo do ÚLTIMO jogo criado nela;
 *  4. a escolha de quem organiza vence o derivado;
 *  5. ⭐ no simples a dupla vinculada não vale (senão os dois jogariam um
 *     contra o outro).
 */
import { describe, it, expect } from 'vitest';
import {
  GAME_KIND, gameKindOf, normalizeGameKind, slotsForKind, sideSizeForKind,
  splitGamesByKind, gameKindsIn, courtKindsFromGames, mergeCourtKinds,
  kindOfCourt, hasSinglesCourt, withoutPartnerLinks, fillableCourts,
} from './gameKind.js';

const jogo = (a, b, extra = {}) => ({ side_a: a.map((id) => ({ id })), side_b: b.map((id) => ({ id })), ...extra });

describe('⭐ o tipo de um jogo', () => {
  it('1 × 1 é simples; 2 × 2 é duplas', () => {
    expect(gameKindOf(jogo(['a'], ['b']))).toBe(GAME_KIND.SINGLES);
    expect(gameKindOf(jogo(['a', 'b'], ['c', 'd']))).toBe(GAME_KIND.DOUBLES);
  });

  it('⭐ jogo antigo, sem `kind` e com quatro, é duplas', () => {
    expect(gameKindOf({ side_a: ['a', 'b'], side_b: ['c', 'd'] })).toBe(GAME_KIND.DOUBLES);
  });

  it('⭐ os lados decidem, não o campo (a publicação e o servidor fazem igual)', () => {
    expect(gameKindOf(jogo(['a'], ['b'], { kind: 'doubles' }))).toBe(GAME_KIND.SINGLES);
    expect(gameKindOf(jogo(['a', 'b'], ['c', 'd'], { kind: 'singles' }))).toBe(GAME_KIND.DOUBLES);
  });

  it('com os lados vazios, vale o campo; sem nada, duplas', () => {
    expect(gameKindOf({ kind: 'singles', side_a: [], side_b: [] })).toBe(GAME_KIND.SINGLES);
    expect(gameKindOf({})).toBe(GAME_KIND.DOUBLES);
    expect(gameKindOf(null)).toBe(GAME_KIND.DOUBLES);
  });

  it('normaliza qualquer valor: só "singles" é simples', () => {
    expect(normalizeGameKind('singles')).toBe('singles');
    expect(normalizeGameKind('SINGLES')).toBe('doubles');
    expect(normalizeGameKind(undefined)).toBe('doubles');
  });

  it('quantos atletas cada tipo leva', () => {
    expect(slotsForKind('singles')).toBe(2);
    expect(slotsForKind('doubles')).toBe(4);
    expect(sideSizeForKind('singles')).toBe(1);
    expect(sideSizeForKind('doubles')).toBe(2);
  });
});

describe('os jogos separados por tipo', () => {
  const jogos = [jogo(['a', 'b'], ['c', 'd']), jogo(['e'], ['f']), jogo(['a'], ['c'])];

  it('separa sem perder nenhum', () => {
    const s = splitGamesByKind(jogos);
    expect(s.doubles).toHaveLength(1);
    expect(s.singles).toHaveLength(2);
  });

  it('os tipos presentes, duplas primeiro', () => {
    expect(gameKindsIn(jogos)).toEqual(['doubles', 'singles']);
    expect(gameKindsIn([jogo(['a'], ['b'])])).toEqual(['singles']);
    expect(gameKindsIn([])).toEqual([]);
  });
});

describe('⭐ o tipo de cada quadra', () => {
  it('quadra que nunca recebeu jogo é de duplas', () => {
    expect(courtKindsFromGames([], 3)).toEqual({ 1: 'doubles', 2: 'doubles', 3: 'doubles' });
  });

  it('⭐ vale o ÚLTIMO jogo criado na quadra (aberto ou encerrado)', () => {
    const jogos = [
      jogo(['a', 'b'], ['c', 'd'], { court: 2, created_at_ms: 1, status: 'finished' }),
      jogo(['e'], ['f'], { court: 2, created_at_ms: 5, status: 'finished' }),
      jogo(['a'], ['b'], { court: 1, created_at_ms: 3, status: 'finished' }),
      jogo(['a', 'b'], ['c', 'd'], { court: 1, created_at_ms: 9 }),
    ];
    expect(courtKindsFromGames(jogos, 2)).toEqual({ 1: 'doubles', 2: 'singles' });
  });

  it('sem `created_at_ms`, a `order` desempata', () => {
    const jogos = [jogo(['a'], ['b'], { court: 1, order: 2 }), jogo(['a', 'b'], ['c', 'd'], { court: 1, order: 1 })];
    expect(courtKindsFromGames(jogos, 1)).toEqual({ 1: 'singles' });
  });

  it('jogo sem quadra ou de quadra além do total não inventa quadra', () => {
    const jogos = [jogo(['a'], ['b'], { court: null }), jogo(['a'], ['b'], { court: 9 })];
    expect(courtKindsFromGames(jogos, 2)).toEqual({ 1: 'doubles', 2: 'doubles' });
  });

  it('a escolha de quem organiza vence o derivado', () => {
    const d = { 1: 'doubles', 2: 'singles' };
    expect(mergeCourtKinds(d, { 1: 'singles' })).toEqual({ 1: 'singles', 2: 'singles' });
    expect(mergeCourtKinds(d, { 2: 'qualquer' })).toEqual({ 1: 'doubles', 2: 'doubles' });
    expect(mergeCourtKinds(d, {})).toEqual(d);
  });

  it('leitura do mapa', () => {
    expect(kindOfCourt({ 2: 'singles' }, 2)).toBe('singles');
    expect(kindOfCourt({}, 1)).toBe('doubles');
    expect(hasSinglesCourt({ 1: 'doubles', 2: 'singles' })).toBe(true);
    expect(hasSinglesCourt({ 1: 'doubles' })).toBe(false);
  });
});

describe('⭐ no simples, a dupla vinculada não vale', () => {
  it('tira o vínculo sem mexer no resto (nem no original)', () => {
    const fila = [{ id: 'a', partner_id: 'b', available_since: 1 }, { id: 'b', partner_id: 'a' }, { id: 'c' }];
    const sem = withoutPartnerLinks(fila);
    expect(sem.map((p) => p.partner_id ?? null)).toEqual([null, null, null]);
    expect(sem[0].available_since).toBe(1);
    expect(fila[0].partner_id).toBe('b');
  });
});

describe('fillableCourts — quantas quadras livres a fila enche', () => {
  it('só duplas: de 4 em 4', () => {
    expect(fillableCourts([1, 2, 3], {}, 9)).toBe(2);
    expect(fillableCourts([1, 2], {}, 3)).toBe(0);
  });

  it('com simples: as duplas primeiro, o simples com o que sobra', () => {
    expect(fillableCourts([1, 2], { 2: 'singles' }, 6)).toBe(2);
    expect(fillableCourts([1, 2], { 2: 'singles' }, 5)).toBe(1);
    // Três não enchem as duplas, mas dão um simples.
    expect(fillableCourts([1, 2], { 2: 'singles' }, 3)).toBe(1);
  });

  it('sem quadra livre ou sem fila, nenhuma', () => {
    expect(fillableCourts([], {}, 8)).toBe(0);
    expect(fillableCourts([1], {}, 0)).toBe(0);
  });
});
