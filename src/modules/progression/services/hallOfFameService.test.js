import { describe, it, expect, vi, beforeEach } from 'vitest';

const wheres = [];
const orders = [];
let mockDocs = [];
const mockGetDocs = vi.fn(async () => ({ docs: mockDocs }));
const mockGetDoc = vi.fn(async () => ({ exists: () => false }));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  getFirestore: () => ({}),
  collection: (db, name) => ({ _name: name }),
  doc: (db, c, id) => ({ _c: c, _id: id }),
  query: (...args) => ({ _q: args }),
  where: (...args) => { wheres.push(args); return { _w: args }; },
  orderBy: (...args) => { orders.push(args); return { _ob: args }; },
  limit: (...args) => ({ _l: args }),
  getDocs: (...args) => mockGetDocs(...args),
  getDoc: (...args) => mockGetDoc(...args),
}));

import { fetchHallOfFame, fetchTopPlayer, fetchMyHallRow, hallRowToView } from './hallOfFameService';

const hall = (uid, position, over = {}) => ({
  id: uid,
  data: () => ({ uid, position, xp: 6000 - position * 100, tier: 'Veterano', level: 9, achievements: 20, displayName: `Atleta ${uid}`, photoUrl: 'x.jpg', state: 'SP', city: 'Campinas', ...over }),
});

describe('hallOfFameService (placar público gravado pelo servidor)', () => {
  beforeEach(() => {
    wheres.length = 0; orders.length = 0;
    mockDocs = [hall('u1', 1), hall('u2', 2), hall('u3', 3)];
  });

  it('devolve nome, foto e estado — nunca o uid cru no lugar do nome', async () => {
    const list = await fetchHallOfFame();
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({ uid: 'u1', position: 1, name: 'Atleta u1', photoUrl: 'x.jpg', state: 'SP', tier: 'Veterano' });
    expect(list[0].xpTotal).toBe(5900);
  });

  it('ordena pela posição que o servidor numerou, sem filtrar tier no cliente', async () => {
    await fetchHallOfFame();
    expect(orders[0]).toEqual(['position', 'asc']);
    expect(wheres).toHaveLength(0);
  });

  it('filtra por UF na consulta (índice state+position)', async () => {
    await fetchHallOfFame({ state: 'RS' });
    expect(wheres[0]).toEqual(['state', '==', 'RS']);
  });

  it('fetchTopPlayer devolve o primeiro e null se vazio', async () => {
    expect((await fetchTopPlayer()).uid).toBe('u1');
    mockDocs = [];
    expect(await fetchTopPlayer()).toBeNull();
  });

  it('quem não está no Hall volta null', async () => {
    expect(await fetchMyHallRow('u9')).toBeNull();
    expect(await fetchMyHallRow(null)).toBeNull();
  });

  it('linha incompleta recebe padrões seguros', () => {
    expect(hallRowToView('z', {})).toMatchObject({ uid: 'z', name: 'Atleta', tier: 'Calouro', level: 1, xpTotal: 0 });
  });
});
