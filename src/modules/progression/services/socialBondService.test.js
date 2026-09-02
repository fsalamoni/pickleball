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
  getOrCreateRivalry,
  recordRivalGame,
  createCrew,
  joinCrew,
  leaveCrew,
  startMentorship,
  recordMentorLesson,
  endMentorship,
} from './socialBondService';

describe('socialBondService · rivals', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('getOrCreateRivalry rejeita mesmo uid', async () => {
    expect(await getOrCreateRivalry('u1', 'u1')).toBeNull();
  });

  it('getOrCreateRivalry cria novo doc', async () => {
    const res = await getOrCreateRivalry('u1', 'u2');
    expect(res).toBeTruthy();
    expect(res.pairKey).toBe('u1_u2');
    expect(res.userA).toBe('u1');
  });

  it('recordRivalGame atualiza contadores', async () => {
    const res = await recordRivalGame({ uidA: 'u1', uidB: 'u2', winnerUid: 'u1' });
    expect(res.gamesA).toBe(1);
    expect(res.gamesB).toBe(1);
    expect(res.winsA).toBe(1);
    expect(res.winsB).toBe(0);
  });
});

describe('socialBondService · crews', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('createCrew cria crew + adiciona owner', async () => {
    const res = await createCrew({ createdBy: 'u1', name: 'Smash Bros' });
    expect(res).toBeTruthy();
    expect(res.createdBy).toBe('u1');
    expect(res.membersCount).toBe(1);
    expect(res.name).toBe('Smash Bros');
    // owner é adicionado
    const memberKey = Object.keys(mockDocData).find((k) => k.startsWith('crew_members/c'));
    expect(mockDocData[memberKey].role).toBe('owner');
  });

  it('joinCrew adiciona member', async () => {
    const crew = await createCrew({ createdBy: 'u1', name: 'Smash' });
    const res = await joinCrew({ crewId: crew.crewId, uid: 'u2' });
    expect(res.role).toBe('member');
    expect(mockDocData[`crews/${crew.crewId}`].membersCount).toBe(2);
  });

  it('joinCrew rejeita duplicado', async () => {
    const crew = await createCrew({ createdBy: 'u1', name: 'Smash' });
    const r1 = await joinCrew({ crewId: crew.crewId, uid: 'u2' });
    const r2 = await joinCrew({ crewId: crew.crewId, uid: 'u2' });
    expect(r2.role).toBe('member');
    expect(mockDocData[`crews/${crew.crewId}`].membersCount).toBe(2);
  });

  it('leaveCrew remove member', async () => {
    const crew = await createCrew({ createdBy: 'u1', name: 'Smash' });
    await joinCrew({ crewId: crew.crewId, uid: 'u2' });
    const ok = await leaveCrew({ crewId: crew.crewId, uid: 'u2' });
    expect(ok).toBe(true);
    expect(mockDocData[`crews/${crew.crewId}`].membersCount).toBe(1);
  });

  it('leaveCrew rejeita owner', async () => {
    const crew = await createCrew({ createdBy: 'u1', name: 'Smash' });
    await expect(leaveCrew({ crewId: crew.crewId, uid: 'u1' }))
      .rejects.toThrow('owner não pode sair');
  });
});

describe('socialBondService · mentorships', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('startMentorship rejeita mesmo uid', async () => {
    expect(await startMentorship({ mentorUid: 'u1', apprenticeUid: 'u1' })).toBeNull();
  });

  it('startMentorship cria nova', async () => {
    const res = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1' });
    expect(res).toBeTruthy();
    expect(res.status).toBe('active');
    expect(res.lessonsCompleted).toBe(0);
  });

  it('recordMentorLesson incrementa lessonsCompleted', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1' });
    const res = await recordMentorLesson(m.pairKey);
    expect(res.lessonsCompleted).toBe(1);
  });

  it('endMentorship marca como completed', async () => {
    const m = await startMentorship({ mentorUid: 'm1', apprenticeUid: 'a1' });
    const res = await endMentorship(m.pairKey, 'completed');
    expect(res.status).toBe('completed');
    expect(res.endedAt).toBeGreaterThan(0);
  });
});
