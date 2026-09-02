import { describe, it, expect, vi } from 'vitest';

const mockDocs = [
  { id: 'u1', data: () => ({ uid: 'u1', xpTotal: 5500, tier: 'Craque', level: 8, achievementsUnlocked: 25, achievementsTotal: 83 }) },
  { id: 'u2', data: () => ({ uid: 'u2', xpTotal: 4500, tier: 'Competidor', level: 7, achievementsUnlocked: 18, achievementsTotal: 83 }) },
  { id: 'u3', data: () => ({ uid: 'u3', xpTotal: 4000, tier: 'Calouro', level: 2, achievementsUnlocked: 3, achievementsTotal: 83 }) },
];
const mockGetDocs = vi.fn(async () => ({ docs: mockDocs }));

vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (db, name) => ({ _name: name }),
  query: (...args) => ({ _q: args }),
  where: (...args) => ({ _w: args }),
  orderBy: (...args) => ({ _ob: args }),
  limit: (...args) => ({ _l: args }),
  getDocs: (...args) => mockGetDocs(...args),
}));

import { fetchHallOfFame, fetchTopPlayer } from './hallOfFameService';

describe('hallOfFameService', () => {
  it('fetchHallOfFame retorna lista mapeada', async () => {
    const list = await fetchHallOfFame();
    expect(list).toHaveLength(3);
    expect(list[0].uid).toBe('u1');
    expect(list[0].xpTotal).toBe(5500);
  });

  it('fetchTopPlayer retorna primeiro', async () => {
    const top = await fetchTopPlayer();
    expect(top.uid).toBe('u1');
  });

  it('fetchTopPlayer retorna null se lista vazia', async () => {
    mockGetDocs.mockReturnValueOnce({ docs: [] });
    const top = await fetchTopPlayer();
    expect(top).toBeNull();
  });
});
