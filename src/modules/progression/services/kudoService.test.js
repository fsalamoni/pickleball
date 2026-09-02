import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDocData = {};
const mockGetDoc = vi.fn(async (ref) => ({
  exists: () => mockDocData[ref._path] !== undefined,
  data: () => mockDocData[ref._path],
}));
const mockSetDoc = vi.fn(async (ref, data, opts) => {
  if (opts && opts.merge && mockDocData[ref._path]) {
    mockDocData[ref._path] = { ...mockDocData[ref._path], ...data };
  } else {
    mockDocData[ref._path] = data;
  }
});
const mockRunTransaction = vi.fn(async (_db, fn) => {
  // Tx simplificado: lê via mockGetDoc, escreve via mockSetDoc
  const txGet = async (ref) => {
    if (ref._path in mockDocData) {
      return { exists: () => true, data: () => mockDocData[ref._path] };
    }
    return { exists: () => false, data: () => undefined };
  };
  const tx = {
    get: txGet,
    set: async (ref, data, opts) => {
      if (opts && opts.merge && mockDocData[ref._path]) {
        mockDocData[ref._path] = { ...mockDocData[ref._path], ...data };
      } else {
        mockDocData[ref._path] = data;
      }
    },
    update: (ref, data) => { mockDocData[ref._path] = { ...mockDocData[ref._path], ...data }; },
    delete: (ref) => { delete mockDocData[ref._path]; },
  };
  return fn(tx);
});

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (db, path) => ({ _path: path }),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  onSnapshot: () => () => {},
  collection: (db, name) => ({ _name: name }),
  query: (...args) => ({ _q: args }),
  where: (...args) => ({ _w: args }),
  getDocs: () => ({ docs: [] }),
  serverTimestamp: () => ({ _isServerTimestamp: true }),
  runTransaction: (...args) => mockRunTransaction(...args),
}));

import {
  giveKudo,
  listKudosReceivedBy,
  listKudosGivenBy,
  getKudoIndex,
} from './kudoService';

describe('kudoService', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
    mockRunTransaction.mockClear();
  });

  it('giveKudo cria kudo + atualiza indexes', async () => {
    const res = await giveKudo({
      fromUid: 'u1', toUid: 'u2', type: 'sportsmanship', scope: 'match',
    });
    expect(res).toBeTruthy();
    expect(res.fromUid).toBe('u1');
    expect(res.toUid).toBe('u2');
    expect(mockDocData[`user_kudos/${res.kudoId}`]).toBeTruthy();
    expect(mockDocData['user_kudos_index/u1'].givenCount).toBe(1);
    expect(mockDocData['user_kudos_index/u2'].receivedCount).toBe(1);
  });

  it('giveKudo rejeita self-kudo', async () => {
    await expect(giveKudo({ fromUid: 'u1', toUid: 'u1', type: 'sportsmanship' }))
      .rejects.toThrow('si mesmo');
  });

  it('giveKudo rejeita quando giver estourou cap diário (50)', async () => {
    mockDocData['user_kudos_index/u1'] = {
      uid: 'u1', schemaVersion: 2,
      receivedCount: 0, givenCount: 100, givenToday: 50, receivedToday: 0,
      lastKudoDay: new Date().toISOString().slice(0, 10), updatedAt: 1,
    };
    await expect(giveKudo({ fromUid: 'u1', toUid: 'u2', type: 'sportsmanship' }))
      .rejects.toThrow('50 kudos dados');
  });

  it('giveKudo rejeita quando receiver estourou cap diário (100)', async () => {
    mockDocData['user_kudos_index/u2'] = {
      uid: 'u2', schemaVersion: 2,
      receivedCount: 100, givenCount: 0, givenToday: 0, receivedToday: 100,
      lastKudoDay: new Date().toISOString().slice(0, 10), updatedAt: 1,
    };
    await expect(giveKudo({ fromUid: 'u1', toUid: 'u2', type: 'sportsmanship' }))
      .rejects.toThrow('100 kudos recebidos');
  });

  it('giveKudo reseta contadores diários quando muda o dia', async () => {
    mockDocData['user_kudos_index/u1'] = {
      uid: 'u1', schemaVersion: 2,
      receivedCount: 0, givenCount: 100, givenToday: 50, receivedToday: 0,
      lastKudoDay: '2020-01-01', updatedAt: 1,
    };
    const res = await giveKudo({ fromUid: 'u1', toUid: 'u2', type: 'sportsmanship' });
    expect(res).toBeTruthy();
    // givenToday foi resetado e incrementado
    expect(mockDocData['user_kudos_index/u1'].givenToday).toBe(1);
  });

  it('getKudoIndex retorna empty se não existe', async () => {
    const idx = await getKudoIndex('u-new');
    expect(idx.uid).toBe('u-new');
    expect(idx.givenCount).toBe(0);
  });

  it('listKudosReceivedBy retorna [] se uid vazio', async () => {
    expect(await listKudosReceivedBy(null)).toEqual([]);
  });

  it('listKudosGivenBy retorna [] se uid vazio', async () => {
    expect(await listKudosGivenBy(null)).toEqual([]);
  });
});
