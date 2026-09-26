/**
 * A FONTE ÚNICA do sorteio do dia de jogo.
 *
 * O que estes testes protegem:
 *  1. ⭐ os três formatos de grade saem daqui — nenhuma tela fica só no Americano;
 *  2. ⭐ a dupla vinculada atravessa o sorteio do Americano;
 *  3. ⭐ Mexicano e Rei da Quadra NÃO honram vínculo, e isso é dito em voz alta
 *     (`fixedPairsIgnored`) em vez de ignorado em silêncio;
 *  4. o sorteio é aditivo: jogo com resultado nunca é descartado;
 *  5. cada lado embute o `user_id`, que é o que faz o jogo contar no ranking.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/modules/rating/services/unifiedLevelService', () => ({
  fetchUnifiedLevelsByParticipant: vi.fn(async () => ({})),
}));

const { buildGameDayDraw, mutualFixedPairs, formatHonorsFixedPairs } = await import('./gameDayDrawPlanner.js');
const { GAME_DAY_FORMAT } = await import('@/modules/clubs/domain/gameDayFormats');

const P = (id, extra = {}) => ({ id, name: id.toUpperCase(), user_id: `u_${id}`, ...extra });
const oito = () => ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => P(id));

describe('mutualFixedPairs', () => {
  it('⭐ só o vínculo MÚTUO conta — meio vínculo não é dupla', () => {
    const lista = [
      P('a', { partner_id: 'b' }), P('b', { partner_id: 'a' }),
      P('c', { partner_id: 'd' }), P('d'), // c aponta para d, d não aponta de volta
    ];
    expect(mutualFixedPairs(lista)).toEqual([['a', 'b']]);
  });

  it('não devolve o mesmo par duas vezes, nem quebra com lista vazia', () => {
    const lista = [P('a', { partner_id: 'b' }), P('b', { partner_id: 'a' })];
    expect(mutualFixedPairs(lista)).toHaveLength(1);
    expect(mutualFixedPairs([])).toEqual([]);
    expect(mutualFixedPairs(null)).toEqual([]);
  });
});

describe('formatHonorsFixedPairs', () => {
  it('⭐ só o Americano honra: os outros montam duplas pela classificação', () => {
    expect(formatHonorsFixedPairs(GAME_DAY_FORMAT.AMERICANO)).toBe(true);
    expect(formatHonorsFixedPairs(undefined)).toBe(true); // padrão é Americano
    expect(formatHonorsFixedPairs(GAME_DAY_FORMAT.MEXICANO)).toBe(false);
    expect(formatHonorsFixedPairs(GAME_DAY_FORMAT.KING_OF_COURT)).toBe(false);
  });
});

describe('⭐ buildGameDayDraw — a mesma conta para toda origem', () => {
  it('⭐ Americano: gera rodadas e embute o user_id de cada lado', async () => {
    const res = await buildGameDayDraw({ participants: oito(), rounds: 3, seed: 's' });
    expect(res.payload.length).toBeGreaterThan(0);
    expect(res.label).toBe('Americano');
    res.payload.forEach((g) => {
      expect(g.kind).toBe('doubles');
      [...g.side_a, ...g.side_b].forEach((slot) => {
        expect(slot.user_id).toBe(`u_${slot.id}`);
        expect(slot.name).toBeTruthy();
      });
    });
  });

  it('⭐ Mexicano e Rei da Quadra saem da MESMA função', async () => {
    const mex = await buildGameDayDraw({
      format: GAME_DAY_FORMAT.MEXICANO, participants: oito(), rounds: 3, seed: 's',
    });
    const rei = await buildGameDayDraw({
      format: GAME_DAY_FORMAT.KING_OF_COURT, participants: oito(), seed: 's',
    });
    expect(mex.payload.length).toBeGreaterThan(0);
    expect(mex.label).toBe('Mexicano');
    expect(rei.payload.length).toBeGreaterThan(0);
    expect(rei.label).toBe('Rei da Quadra');
  });

  it('⭐ a dupla vinculada joga junta no Americano', async () => {
    const participants = oito();
    participants[0].partner_id = 'b';
    participants[1].partner_id = 'a';
    const res = await buildGameDayDraw({ participants, rounds: 6, seed: 'dupla' });
    expect(res.fixedPairs).toEqual([['a', 'b']]);
    expect(res.fixedPairsIgnored).toBe(false);
    res.payload.forEach((g) => {
      const lados = [g.side_a, g.side_b].map((l) => l.map((x) => x.id).sort().join('+'));
      const todos = [...g.side_a, ...g.side_b].map((x) => x.id);
      expect(todos.includes('a')).toBe(todos.includes('b'));
      if (todos.includes('a')) expect(lados).toContain('a+b');
    });
  });

  it('⭐ no Mexicano o vínculo NÃO vale — e a função DIZ isso', async () => {
    const participants = oito();
    participants[0].partner_id = 'b';
    participants[1].partner_id = 'a';
    const res = await buildGameDayDraw({
      format: GAME_DAY_FORMAT.MEXICANO, participants, rounds: 3, seed: 'mex',
    });
    expect(res.fixedPairs).toEqual([['a', 'b']]);
    expect(res.fixedPairsIgnored).toBe(true);
  });

  it('⭐ ADITIVO: o jogo com resultado nunca é descartado', async () => {
    const jogoComPlacar = {
      id: 'g1', round: 1, score_a: 11, score_b: 5,
      side_a: [{ id: 'a' }, { id: 'b' }], side_b: [{ id: 'c' }, { id: 'd' }],
    };
    const res = await buildGameDayDraw({
      participants: oito(), games: [jogoComPlacar], replaceUnscored: true, rounds: 2, seed: 's',
    });
    expect(res.removeIds).not.toContain('g1');
    // As rodadas novas vêm DEPOIS da que já existe.
    res.payload.forEach((g) => expect(g.round).toBeGreaterThan(1));
  });

  it('nível indisponível não trava o sorteio', async () => {
    const { fetchUnifiedLevelsByParticipant } = await import('@/modules/rating/services/unifiedLevelService');
    fetchUnifiedLevelsByParticipant.mockRejectedValueOnce(new Error('rede'));
    const res = await buildGameDayDraw({ participants: oito(), rounds: 2, seed: 's' });
    expect(res.payload.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Onda CF — o sorteio em SIMPLES                                     */
/* ------------------------------------------------------------------ */
describe('⭐ buildGameDayDraw em simples', () => {
  it('⭐ Americano de simples: todo jogo 1 × 1, gravado como `singles`, com o uid', async () => {
    const r = await buildGameDayDraw({
      format: GAME_DAY_FORMAT.AMERICANO, participants: oito(), rounds: 2, seed: 's', kind: 'singles',
    });
    expect(r.kind).toBe('singles');
    expect(r.label).toBe('Americano de simples');
    expect(r.payload).toHaveLength(8);
    r.payload.forEach((g) => {
      expect(g.kind).toBe('singles');
      expect(g.side_a).toHaveLength(1);
      expect(g.side_b).toHaveLength(1);
      expect(g.side_a[0].user_id).toMatch(/^u_/);
    });
  });

  it('⭐ sem `kind`, o sorteio é o de duplas de sempre', async () => {
    const r = await buildGameDayDraw({ format: GAME_DAY_FORMAT.AMERICANO, participants: oito(), rounds: 1, seed: 'd' });
    expect(r.kind).toBe('doubles');
    r.payload.forEach((g) => { expect(g.kind).toBe('doubles'); expect(g.side_a).toHaveLength(2); });
    expect(r.fixedPairsReason).toBeNull();
  });

  it('simples funciona com 2 ou 3 participantes (duplas exige 4)', async () => {
    const r = await buildGameDayDraw({
      format: GAME_DAY_FORMAT.AMERICANO, participants: [P('a'), P('b'), P('c')], rounds: 3, seed: 't', kind: 'singles',
    });
    expect(r.payload.length).toBeGreaterThan(0);
  });

  it('⭐ Mexicano e Rei da Quadra ignoram o pedido de simples (são duplas por definição)', async () => {
    const r = await buildGameDayDraw({
      format: GAME_DAY_FORMAT.MEXICANO, participants: oito(), rounds: 1, seed: 'm', kind: 'singles',
    });
    expect(r.kind).toBe('doubles');
    r.payload.forEach((g) => expect(g.side_a).toHaveLength(2));
  });

  it('⭐ com dupla vinculada, o simples AVISA que o vínculo não vale', async () => {
    const parts = oito();
    parts[0].partner_id = 'b';
    parts[1].partner_id = 'a';
    const r = await buildGameDayDraw({
      format: GAME_DAY_FORMAT.AMERICANO, participants: parts, rounds: 1, seed: 'v', kind: 'singles',
    });
    expect(r.fixedPairsIgnored).toBe(true);
    expect(r.fixedPairsReason).toBe('singles');
  });

  it('o aditivo continua a numeração das rodadas', async () => {
    const existentes = [{ id: 'g1', round: 3, side_a: [{ id: 'a' }, { id: 'b' }], side_b: [{ id: 'c' }, { id: 'd' }], score_a: 11, score_b: 2 }];
    const r = await buildGameDayDraw({
      format: GAME_DAY_FORMAT.AMERICANO, participants: oito(), games: existentes, rounds: 1, seed: 'x', kind: 'singles',
    });
    expect(Math.min(...r.payload.map((g) => g.round))).toBe(4);
  });
});
