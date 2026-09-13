/**
 * A pré-busca da arena.
 *
 * É código INVISÍVEL: quando para de funcionar, nada quebra — a página só
 * volta a demorar, e ninguém liga uma coisa à outra. Por isso os testes são
 * sobre o contrato dela, não sobre o efeito:
 *
 *  1. ⭐ busca EXATAMENTE as chaves que a página vai pedir (chave diferente =
 *     cache que nunca se encontra);
 *  2. ⭐ semeia a arena que o cartão já tem em mãos, mas NUNCA por cima de um
 *     dado já guardado, que pode ser mais novo;
 *  3. ⭐ falha em silêncio: ninguém pediu essa busca, então ela não pode
 *     estourar erro na tela de quem só passou o mouse.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/arenaService.js', () => ({
  getArena: vi.fn(async () => ({ id: 'a1', name: 'Arena' })),
  listArenaCourts: vi.fn(async () => []),
  listArenaCourtSchedules: vi.fn(async () => []),
  listArenaUnavailabilities: vi.fn(async () => []),
}));
vi.mock('../services/bookingService.js', () => ({
  listArenaBookings: vi.fn(async () => []),
}));

const { prefetchArena } = await import('./arenaPrefetch.js');
const { arenaKeys } = await import('./arenaKeys.js');

function clienteFalso({ jaGuardado = {} } = {}) {
  const pedidas = [];
  const guardado = { ...jaGuardado };
  return {
    pedidas,
    guardado,
    getQueryData: (chave) => guardado[JSON.stringify(chave)],
    setQueryData: (chave, valor) => { guardado[JSON.stringify(chave)] = valor; },
    prefetchQuery: async (opcoes) => { pedidas.push(opcoes.queryKey); },
  };
}

const chaves = (qc) => qc.pedidas.map((k) => JSON.stringify(k));

describe('prefetchArena', () => {
  let qc;
  beforeEach(() => { qc = clienteFalso(); });

  it('⭐ busca as mesmas chaves que a página da arena vai pedir', async () => {
    await prefetchArena(qc, 'a1');
    expect(chaves(qc)).toEqual(expect.arrayContaining([
      JSON.stringify(arenaKeys.arena('a1')),
      JSON.stringify(arenaKeys.quadras('a1')),
      JSON.stringify(arenaKeys.janelas('a1')),
      JSON.stringify(arenaKeys.reservas('a1')),
      JSON.stringify(arenaKeys.bloqueios('a1', undefined, undefined)),
    ]));
  });

  it('⭐ semeia a arena que o cartão já tem, sem ir ao banco de novo', async () => {
    const arena = { id: 'a1', name: 'Arena do Zé' };
    await prefetchArena(qc, 'a1', { arena });
    expect(qc.getQueryData(arenaKeys.arena('a1'))).toEqual(arena);
  });

  it('⭐ mas NUNCA por cima do que já está guardado', async () => {
    const maisNova = { id: 'a1', name: 'Nome novo' };
    qc = clienteFalso({ jaGuardado: { [JSON.stringify(arenaKeys.arena('a1'))]: maisNova } });
    await prefetchArena(qc, 'a1', { arena: { id: 'a1', name: 'Nome velho' } });
    expect(qc.getQueryData(arenaKeys.arena('a1'))).toEqual(maisNova);
  });

  it('não semeia com a arena errada', async () => {
    await prefetchArena(qc, 'a1', { arena: { id: 'OUTRA', name: 'x' } });
    expect(qc.getQueryData(arenaKeys.arena('a1'))).toBeUndefined();
  });

  it('⭐ falha em silêncio — ninguém pediu esta busca', async () => {
    const quebrado = clienteFalso();
    quebrado.prefetchQuery = async () => { throw new Error('rede caiu'); };
    await expect(prefetchArena(quebrado, 'a1')).resolves.toBeUndefined();
  });

  it('sem cliente ou sem arena, não faz nada', async () => {
    await expect(prefetchArena(null, 'a1')).resolves.toBeUndefined();
    await prefetchArena(qc, '');
    expect(qc.pedidas).toEqual([]);
  });
});
