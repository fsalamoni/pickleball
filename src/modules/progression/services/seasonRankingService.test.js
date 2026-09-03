/**
 * Teste do seasonRankingService com Firestore mockado.
 *
 * Este service era o único da gamificação sem teste — e era justamente onde
 * estava um `snap.data()` num QuerySnapshot (que não tem `.data()`), ou seja,
 * `listUserSeasons` estourava TypeError em toda chamada.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDocData = {};
let mockQueryDocs = [];

const mockSetDoc = vi.fn(async (ref, data) => { mockDocData[ref._path] = data; });
const mockGetDoc = vi.fn(async (ref) => ({
  exists: () => mockDocData[ref._path] !== undefined,
  data: () => mockDocData[ref._path],
}));
const mockGetDocs = vi.fn(async () => ({
  docs: mockQueryDocs.map((d) => ({ id: d.__id || 'x', data: () => d })),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (db, path) => ({ _path: path }),
  collection: (db, path) => ({ _path: path }),
  query: (...args) => ({ _q: args }),
  where: (...a) => ({ _where: a }),
  orderBy: (...a) => ({ _orderBy: a }),
  limit: (n) => ({ _limit: n }),
  getDoc: (...args) => mockGetDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  setDoc: (...args) => mockSetDoc(...args),
  onSnapshot: () => () => {},
  serverTimestamp: () => ({ _isServerTimestamp: true }),
}));

import {
  currentSeasonId,
  upsertSeasonRanking,
  getSeasonRanking,
  listSeasonTop,
  listUserSeasons,
} from './seasonRankingService';

const row = (over = {}) => ({
  seasonId: '2026-09', uid: 'u1', schemaVersion: 2, xp: 1200,
  tier: 'Jogador', position: 3, deltaPosition: -1, prizeXp: 0, updatedAt: 1, ...over,
});

describe('seasonRankingService', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockQueryDocs = [];
    mockSetDoc.mockClear();
    mockGetDocs.mockClear();
  });

  it('currentSeasonId é YYYY-MM', () => {
    expect(currentSeasonId()).toMatch(/^\d{4}-\d{2}$/);
  });

  it('upsertSeasonRanking grava no caminho seasonId_uid', async () => {
    await upsertSeasonRanking({
      seasonId: '2026-09', uid: 'u1', xp: 1200, tier: 'Jogador',
      position: 3, deltaPosition: -1, prizeXp: 0,
    });
    expect(mockDocData['season_rankings/2026-09_u1']).toBeTruthy();
    expect(mockDocData['season_rankings/2026-09_u1'].xp).toBe(1200);
  });

  it('upsertSeasonRanking recusa payload fora do schema', async () => {
    await expect(upsertSeasonRanking({
      seasonId: '2026-09', uid: 'u1', xp: -5, tier: 'Jogador',
      position: 3, deltaPosition: 0, prizeXp: 0,
    })).rejects.toThrow(/schema inválido/);
  });

  it('upsertSeasonRanking ignora chamada sem seasonId ou uid', async () => {
    expect(await upsertSeasonRanking({ seasonId: null, uid: 'u1' })).toBeNull();
    expect(await upsertSeasonRanking({ seasonId: '2026-09', uid: null })).toBeNull();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('getSeasonRanking devolve null se o doc não existe', async () => {
    expect(await getSeasonRanking('2026-09', 'ninguem')).toBeNull();
  });

  it('getSeasonRanking devolve a linha existente', async () => {
    mockDocData['season_rankings/2026-09_u1'] = row();
    const res = await getSeasonRanking('2026-09', 'u1');
    expect(res.xp).toBe(1200);
    expect(res.position).toBe(3);
  });

  it('listSeasonTop devolve as linhas da season', async () => {
    mockQueryDocs = [row({ uid: 'u1', xp: 900 }), row({ uid: 'u2', xp: 700 })];
    const res = await listSeasonTop({ seasonId: '2026-09' });
    expect(res).toHaveLength(2);
    expect(res[0].uid).toBe('u1');
  });

  it('listSeasonTop devolve [] sem seasonId', async () => {
    expect(await listSeasonTop({})).toEqual([]);
  });

  it('listUserSeasons devolve o histórico do atleta (regressão: TypeError)', async () => {
    mockQueryDocs = [row({ seasonId: '2026-09', xp: 900 }), row({ seasonId: '2026-08', xp: 500 })];
    const res = await listUserSeasons('u1');
    expect(res).toHaveLength(2);
    expect(res.map((r) => r.seasonId)).toEqual(['2026-09', '2026-08']);
    expect(res.map((r) => r.xp)).toEqual([900, 500]);
  });

  it('listUserSeasons devolve [] sem uid', async () => {
    expect(await listUserSeasons(null)).toEqual([]);
  });

  it('listUserSeasons descarta linhas fora do schema em vez de quebrar', async () => {
    mockQueryDocs = [row({ xp: 900 }), { lixo: true }, row({ seasonId: '2026-08', xp: 100 })];
    const res = await listUserSeasons('u1');
    expect(res).toHaveLength(2);
  });
});

describe('seasonRankingService · janela do mês', () => {
  it('getCurrentSeason devolve início e fim válidos do mês corrente', async () => {
    const { getCurrentSeason } = await import('./seasonRankingService');
    const r = getCurrentSeason();
    expect(Number.isFinite(r.startMs)).toBe(true);
    expect(Number.isFinite(r.endMs)).toBe(true);
    expect(r.endMs).toBeGreaterThan(r.startMs);
    // o início é sempre o dia 1 do mês corrente
    expect(new Date(r.startMs).getDate()).toBe(1);
  });

  it('currentSeasonId bate com o ano/mês de hoje', () => {
    const now = new Date();
    const esperado = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now).slice(0, 7);
    expect(currentSeasonId()).toBe(esperado);
  });
});
