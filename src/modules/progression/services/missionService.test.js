/**
 * Teste do service missionService com Firestore mockado.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDocData = {};
const mockGetDoc = vi.fn(async (ref) => ({
  exists: () => mockDocData[ref._path] !== undefined,
  data: () => mockDocData[ref._path],
}));
const mockSetDoc = vi.fn(async (ref, data) => { mockDocData[ref._path] = data; });
const mockGetDocs = vi.fn(async () => ({ docs: [] }));

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  doc: (db, path) => ({ _path: path }),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  onSnapshot: () => () => {},
  collection: (db, name) => ({ _name: name }),
  query: (...args) => ({ _q: args }),
  where: (...args) => ({ _w: args }),
  getDocs: (...args) => mockGetDocs(...args),
  serverTimestamp: () => ({ _isServerTimestamp: true }),
}));

import {
  getMissionsForDate,
  getOrCreateDailyMissions,
  progressMission,
  claimDailyBonus,
} from './missionService';

describe('missionService', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
  });

  it('getMissionsForDate retorna null se uid vazio', async () => {
    expect(await getMissionsForDate(null, new Date('2026-09-02'))).toBeNull();
  });

  it('getMissionsForDate retorna null se doc não existe', async () => {
    expect(await getMissionsForDate('u1', new Date('2026-09-02'))).toBeNull();
  });

  it('getOrCreateDailyMissions cria doc novo se não existe', async () => {
    const res = await getOrCreateDailyMissions('u1', 'Aprendiz', new Date('2026-09-02T12:00:00Z'));
    expect(res).toBeTruthy();
    expect(res.scope).toBe('daily');
    expect(res.missions.length).toBeGreaterThan(0);
    expect(res.bonusClaimed).toBe(false);
    expect(res.completedAt).toBeNull();
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('getOrCreateDailyMissions retorna existente sem recriar', async () => {
    const existing = {
      uid: 'u1', date: '2026-09-02', scope: 'daily',
      missions: [{ id: 'm1', title: 't', description: 't', metric: 'm', target: 1, current: 0, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 }],
      bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1,
    };
    mockDocData[`user_missions/u1_${new Date('2026-09-02').toISOString().slice(0, 10)}`] = existing;
    mockSetDoc.mockClear();
    const res = await getOrCreateDailyMissions('u1', 'Aprendiz', new Date('2026-09-02T12:00:00Z'));
    expect(res).toBeTruthy();
    expect(res.missions[0].id).toBe('m1');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('progressMission atualiza current e não estoura target', async () => {
    const dateKey = new Date('2026-09-02T12:00:00Z').toISOString().slice(0, 10);
    mockDocData[`user_missions/u1_${dateKey}`] = {
      uid: 'u1', date: dateKey, scope: 'daily',
      missions: [
        { id: 'm1', title: 't', description: 't', metric: 'm', target: 3, current: 1, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 },
      ],
      bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1,
    };
    const updated = await progressMission('u1', 'm1', 5, new Date('2026-09-02T12:00:00Z'));
    expect(updated.missions[0].current).toBe(3); // cap
    expect(updated.completedAt).toBeTruthy();
  });

  it('progressMission retorna null se missão não existe', async () => {
    const dateKey = new Date('2026-09-02T12:00:00Z').toISOString().slice(0, 10);
    mockDocData[`user_missions/u1_${dateKey}`] = {
      uid: 'u1', date: dateKey, scope: 'daily',
      missions: [{ id: 'other', title: 't', description: 't', metric: 'm', target: 1, current: 0, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 }],
      bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1,
    };
    const res = await progressMission('u1', 'm-inexistente', 1, new Date('2026-09-02T12:00:00Z'));
    expect(res).toBeNull();
  });

  it('claimDailyBonus marca bonusClaimed=true', async () => {
    const dateKey = new Date('2026-09-02T12:00:00Z').toISOString().slice(0, 10);
    mockDocData[`user_missions/u1_${dateKey}`] = {
      uid: 'u1', date: dateKey, scope: 'daily',
      missions: [{ id: 'm1', title: 't', description: 't', metric: 'm', target: 1, current: 1, xp: 30, bonus: 15, bonusClaimed: false, seed: 1 }],
      bonusClaimed: false, completedAt: null, createdAt: 1, updatedAt: 1,
    };
    const res = await claimDailyBonus('u1', new Date('2026-09-02T12:00:00Z'));
    expect(res.bonusClaimed).toBe(true);
  });
});
