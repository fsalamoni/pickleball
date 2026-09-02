/**
 * Teste do service achievementsV2Service com Firestore mockado.
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
  listUserAchievementsV2,
  unlockAchievementV2,
  markAchievementNotified,
  incrementAchievementShare,
} from './achievementsV2Service';

describe('achievementsV2Service', () => {
  beforeEach(() => {
    Object.keys(mockDocData).forEach((k) => delete mockDocData[k]);
    mockSetDoc.mockClear();
    mockGetDoc.mockClear();
    mockGetDocs.mockClear();
  });

  it('listUserAchievementsV2 retorna [] se uid vazio', async () => {
    expect(await listUserAchievementsV2(null)).toEqual([]);
  });

  it('unlockAchievementV2 cria doc se não existe', async () => {
    const res = await unlockAchievementV2('u1', 'first_blood', 'match', 'common', 1000);
    expect(res).toBeTruthy();
    expect(res.achievementId).toBe('first_blood');
    expect(res.progress).toBe(1);
  });

  it('unlockAchievementV2 é idempotente (retorna existente)', async () => {
    mockDocData['user_achievements_v2/u1_first_blood'] = {
      uid: 'u1', achievementId: 'first_blood', family: 'match', rarity: 'common',
      unlockedAt: 500, progress: 1, shareCount: 0, notified: false,
    };
    mockSetDoc.mockClear();
    const res = await unlockAchievementV2('u1', 'first_blood', 'match', 'common', 9999);
    expect(res.unlockedAt).toBe(500); // não sobrescreveu
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('markAchievementNotified seta notified=true', async () => {
    mockDocData['user_achievements_v2/u1_x'] = {
      uid: 'u1', achievementId: 'x', family: 'match', rarity: 'common',
      unlockedAt: 1, progress: 1, shareCount: 0, notified: false,
    };
    await markAchievementNotified('u1', 'x');
    expect(mockSetDoc).toHaveBeenCalled();
    const args = mockSetDoc.mock.calls[0][1];
    expect(args.notified).toBe(true);
  });

  it('incrementAchievementShare soma 1 ao shareCount', async () => {
    mockDocData['user_achievements_v2/u1_x'] = {
      uid: 'u1', achievementId: 'x', family: 'match', rarity: 'common',
      unlockedAt: 1, progress: 1, shareCount: 2, notified: false,
    };
    await incrementAchievementShare('u1', 'x');
    const args = mockSetDoc.mock.calls[0][1];
    expect(args.shareCount).toBe(3);
  });
});
