/**
 * Serviço de torneios da casa — o que precisa estar certo no banco.
 *
 * O que protege:
 *  1. ⭐ encerrar DUAS vezes não soma os pontos duas vezes (conferido no
 *     banco, não no que a tela tem em mãos);
 *  2. só encerra torneio que começou (sem jogo, não há o que pontuar);
 *  3. encerrar grava o ladder, marca o torneio e AVISA quem jogou;
 *  4. 🐞 o corte da lista leva os torneios mais ANTIGOS, não os futuros;
 *  5. "meus torneios da casa" consulta por `participants` (array-contains).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const banco = new Map();
const consultas = [];

const snap = (path) => ({
  id: path.split('/').pop(),
  exists: () => banco.has(path),
  data: () => banco.get(path),
});

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: vi.fn(() => Promise.resolve()), NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ _col: nome }),
  doc: (_db, col, id) => ({ _path: `${col?._col || col}/${id}` }),
  getDoc: async (ref) => snap(ref._path),
  getDocs: async (q) => {
    const [colRef, ...filtros] = q._args;
    consultas.push({ col: colRef._col, filtros });
    const docs = [...banco.entries()]
      .filter(([p]) => p.startsWith(`${colRef._col}/`))
      .filter(([, d]) => filtros.every((f) => (f._op === 'array-contains'
        ? (d[f._campo] || []).includes(f._valor)
        : d[f._campo] === f._valor)))
      .map(([p]) => snap(p));
    return { docs };
  },
  query: (...args) => ({ _args: args }),
  where: (campo, op, valor) => ({ _campo: campo, _op: op, _valor: valor }),
  setDoc: async (ref, data, opts) => {
    banco.set(ref._path, opts?.merge ? { ...banco.get(ref._path), ...data } : data);
  },
  updateDoc: async (ref, data) => { banco.set(ref._path, { ...banco.get(ref._path), ...data }); },
  deleteDoc: async (ref) => { banco.delete(ref._path); },
  serverTimestamp: () => 'agora',
  increment: (n) => ({ _inc: n }),
  arrayUnion: (...v) => ({ _union: v }),
  arrayRemove: (...v) => ({ _remove: v }),
}));

const { finishInternalTournament, listArenaTournaments, listMyInternalTournaments } = await import('./leaguesService.js');
const { notifyUsers } = await import('@/core/services/notificationService');

const classificacao = [
  { user_id: 'u1', name: 'Ana', position: 1, won: 2 },
  { user_id: 'u2', name: 'Bia', position: null, won: 0 },
];

beforeEach(() => {
  banco.clear();
  consultas.length = 0;
  notifyUsers.mockClear();
  banco.set('arena_internal_tournaments/t1', {
    arena_id: 'a1', name: 'Copa', status: 'running', game_day_id: 'gd1', participants: ['u1', 'u2'],
  });
});

describe('finishInternalTournament', () => {
  it('⭐ grava o ladder, encerra o torneio e avisa quem jogou', async () => {
    await finishInternalTournament({ id: 't1', arena_id: 'a1' }, classificacao, {}, { uid: 'g' });
    const ladder = banco.get('arena_ladders/a1_geral');
    expect(ladder.rankings.find((r) => r.user_id === 'u1')).toMatchObject({ points: 100, titles: 1 });
    expect(ladder.rankings.find((r) => r.user_id === 'u2')).toMatchObject({ points: 10 });
    expect(banco.get('arena_internal_tournaments/t1').status).toBe('finished');
    expect(notifyUsers).toHaveBeenCalledTimes(1);
    expect(notifyUsers.mock.calls[0][0].sort()).toEqual(['u1', 'u2']);
    expect(notifyUsers.mock.calls[0][1].message).toContain('campeão: Ana');
  });

  it('⭐ encerrar DUAS vezes não soma os pontos duas vezes', async () => {
    const t = { id: 't1', arena_id: 'a1', status: 'running' };
    await finishInternalTournament(t, classificacao, {}, { uid: 'g' });
    // A tela ainda acha que está "em andamento" (segundo clique, outra aba).
    await expect(finishInternalTournament(t, classificacao, {}, { uid: 'g' }))
      .rejects.toThrow(/já foi encerrado/);
    expect(banco.get('arena_ladders/a1_geral').rankings.find((r) => r.user_id === 'u1').points).toBe(100);
  });

  it('não encerra torneio que ainda não começou', async () => {
    banco.set('arena_internal_tournaments/t2', { arena_id: 'a1', name: 'Futuro', status: 'scheduled' });
    await expect(finishInternalTournament({ id: 't2', arena_id: 'a1' }, classificacao, {}, { uid: 'g' }))
      .rejects.toThrow(/já começou/);
    expect(banco.has('arena_ladders/a1_geral')).toBe(false);
  });
});

describe('listas', () => {
  it('🐞 o corte leva os torneios mais ANTIGOS — o futuro continua ocupando a quadra', async () => {
    banco.set('arena_internal_tournaments/velho', { arena_id: 'a1', date: '2020-01-01' });
    banco.set('arena_internal_tournaments/futuro', { arena_id: 'a1', date: '2099-01-01' });
    const r = await listArenaTournaments('a1', { lim: 1 });
    expect(r.map((t) => t.id)).toEqual(['futuro']);
  });

  it('meus torneios da casa: por `participants`, com o nome da arena', async () => {
    banco.set('arenas/a1', { name: 'Arena Um' });
    banco.set('arena_internal_tournaments/t9', { arena_id: 'a1', name: 'Outro', participants: ['u9'] });
    const r = await listMyInternalTournaments('u1');
    expect(r.torneios.map((t) => t.id)).toEqual(['t1']);
    expect(r.arenas).toEqual([{ id: 'a1', name: 'Arena Um' }]);
    const c = consultas.find((q) => q.col === 'arena_internal_tournaments');
    expect(c.filtros).toEqual([{ _campo: 'participants', _op: 'array-contains', _valor: 'u1' }]);
  });
});
