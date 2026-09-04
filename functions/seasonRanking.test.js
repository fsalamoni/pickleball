/**
 * Ranking sazonal: a montagem das linhas é pura, então dá para testar toda a
 * regra sem Firestore. O que importa aqui é que a temporada seja de verdade
 * uma temporada — e não uma cópia do ranking de vida inteira.
 */
import { describe, it, expect } from 'vitest';
import { buildSeasonRows, prizeForPosition, currentSeasonId } from './seasonRanking.js';

const prog = (uid, xpTotal, tier = 'Jogador') => ({ uid, xpTotal, tier });

describe('currentSeasonId', () => {
  it('é YYYY-MM no fuso de Brasília', () => {
    // 2026-10-01T01:00Z = 30/09 22:00 em Brasília → ainda é setembro.
    // Rodando de madrugada em UTC, o mês virava antes da hora.
    expect(currentSeasonId(new Date('2026-10-01T01:00:00Z'))).toBe('2026-09');
    expect(currentSeasonId(new Date('2026-10-01T05:00:00Z'))).toBe('2026-10');
  });
});

describe('prizeForPosition', () => {
  it('top 1% leva o prêmio maior', () => {
    expect(prizeForPosition(1, 100)).toBe(1000);
  });
  it('top 10% leva o prêmio intermediário', () => {
    expect(prizeForPosition(5, 100)).toBe(500);
  });
  it('demais participantes levam o de participação', () => {
    expect(prizeForPosition(50, 100)).toBe(50);
  });
  it('entrada inválida não premia', () => {
    expect(prizeForPosition(0, 100)).toBe(0);
    expect(prizeForPosition(1, 0)).toBe(0);
  });
});

describe('buildSeasonRows · XP da TEMPORADA, não de vida inteira', () => {
  it('na estreia, todo mundo começa a temporada zerado', () => {
    const linhas = buildSeasonRows(
      [prog('veterano', 90000), prog('novato', 100)],
      new Map(),
    );
    // o veterano tem 90k de vida, mas 0 nesta temporada
    for (const l of linhas) expect(l.xp).toBe(0);
    expect(linhas.find((l) => l.uid === 'veterano').baselineXp).toBe(90000);
    expect(linhas.find((l) => l.uid === 'novato').baselineXp).toBe(100);
  });

  it('quem jogou mais NA TEMPORADA fica na frente, mesmo com menos XP de vida', () => {
    const existentes = new Map([
      ['veterano', { baselineXp: 90000 }],
      ['novato', { baselineXp: 100 }],
    ]);
    const linhas = buildSeasonRows(
      [prog('veterano', 90100), prog('novato', 1100)], // +100 vs +1000
      existentes,
    );
    expect(linhas[0].uid).toBe('novato');
    expect(linhas[0].xp).toBe(1000);
    expect(linhas[1].uid).toBe('veterano');
    expect(linhas[1].xp).toBe(100);
  });

  it('o baseline é preservado entre execuções', () => {
    const existentes = new Map([['a', { baselineXp: 500 }]]);
    const linhas = buildSeasonRows([prog('a', 800)], existentes);
    expect(linhas[0].baselineXp).toBe(500);
    expect(linhas[0].xp).toBe(300);
  });

  it('posições são 1-based e sequenciais', () => {
    const linhas = buildSeasonRows(
      [prog('a', 300), prog('b', 200), prog('c', 100)],
      new Map([['a', { baselineXp: 0 }], ['b', { baselineXp: 0 }], ['c', { baselineXp: 0 }]]),
    );
    expect(linhas.map((l) => l.position)).toEqual([1, 2, 3]);
    expect(linhas.map((l) => l.uid)).toEqual(['a', 'b', 'c']);
  });

  it('deltaPosition é positivo para quem subiu', () => {
    const existentes = new Map([
      ['a', { baselineXp: 0, position: 3 }],
      ['b', { baselineXp: 0, position: 1 }],
    ]);
    const linhas = buildSeasonRows([prog('a', 500), prog('b', 100)], existentes);
    expect(linhas.find((l) => l.uid === 'a')).toMatchObject({ position: 1, deltaPosition: 2 });
    expect(linhas.find((l) => l.uid === 'b')).toMatchObject({ position: 2, deltaPosition: -1 });
  });

  it('estreante tem delta 0 (não havia de onde subir)', () => {
    const linhas = buildSeasonRows([prog('novo', 100)], new Map());
    expect(linhas[0].deltaPosition).toBe(0);
  });

  it('empate tem desempate estável — a ordem não oscila entre execuções', () => {
    const existentes = new Map([['a', { baselineXp: 0 }], ['b', { baselineXp: 0 }]]);
    const um = buildSeasonRows([prog('b', 100), prog('a', 100)], existentes);
    const dois = buildSeasonRows([prog('a', 100), prog('b', 100)], existentes);
    expect(um.map((l) => l.uid)).toEqual(dois.map((l) => l.uid));
  });

  it('XP nunca fica negativo, mesmo se o total cair', () => {
    const existentes = new Map([['a', { baselineXp: 900 }]]);
    const linhas = buildSeasonRows([prog('a', 500)], existentes);
    expect(linhas[0].xp).toBe(0);
  });

  it('grava o shape que o schema do cliente espera', () => {
    const linhas = buildSeasonRows([prog('a', 100)], new Map(), 1234);
    expect(linhas[0]).toMatchObject({
      uid: 'a', schemaVersion: 2, tier: 'Jogador', position: 1, updatedAt: 1234,
    });
    expect(typeof linhas[0].xp).toBe('number');
    expect(typeof linhas[0].prizeXp).toBe('number');
  });

  it('lista vazia devolve lista vazia', () => {
    expect(buildSeasonRows([], new Map())).toEqual([]);
  });
});

describe('contrato com o cliente', () => {
  it('as linhas gravadas passam pelo schema que o app usa para ler', async () => {
    const { SeasonRankingSchema } = await import('@/modules/progression/domain/gamificationV2Schema2.js');
    const linhas = buildSeasonRows(
      [prog('a', 900), prog('b', 400, 'Imortal')],
      new Map([['a', { baselineXp: 100, position: 2 }]]),
    );
    for (const linha of linhas) {
      // a função grava `seasonId` no momento do batch
      const doc = { ...linha, seasonId: '2026-09' };
      const parsed = SeasonRankingSchema.safeParse(doc);
      expect(parsed.success, `linha recusada: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });
});
