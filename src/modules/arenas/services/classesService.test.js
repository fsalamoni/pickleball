/**
 * Serviço de aulas — o que a tela NÃO decide mais.
 *
 * O que protege:
 *  1. 🐞 a matrícula decide a divisão com o que está no BANCO: professor da
 *     casa não paga comissão (a tela mandava `partner: true` fixo), e a
 *     comissão configurada em 0% é 0% (o `|| 20` virava 20%);
 *  2. a agenda com `includeClosed` traz as aulas dadas e canceladas; sem ele
 *     (calendários), só as de pé;
 *  3. 🐞 o corte por limite leva as aulas mais ANTIGAS, nunca as futuras;
 *  4. trocar o professor da aula leva o professor novo às matrículas (é o
 *     `coach_id` da matrícula que deixa o professor ver os alunos).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const banco = new Map();
const escritas = [];

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
  doc: (_db, col, id) => ({ _path: `${col?._col || col}/${id || `auto${escritas.length}`}`, id: id || `auto${escritas.length}` }),
  getDoc: async (ref) => snap(ref._path),
  getDocs: async (q) => {
    const [colRef, ...filtros] = q._args;
    const docs = [...banco.entries()]
      .filter(([p]) => p.startsWith(`${colRef._col}/`))
      .filter(([, d]) => filtros.every((f) => d[f._campo] === f._valor))
      .map(([p]) => snap(p));
    return { docs };
  },
  query: (...args) => ({ _args: args }),
  where: (campo, _op, valor) => ({ _campo: campo, _valor: valor }),
  setDoc: async (ref, data) => { escritas.push(['set', ref._path, data]); banco.set(ref._path, data); },
  updateDoc: async (ref, data) => { escritas.push(['update', ref._path, data]); banco.set(ref._path, { ...banco.get(ref._path), ...data }); },
  deleteDoc: async (ref) => { banco.delete(ref._path); },
  writeBatch: () => {
    const ops = [];
    return {
      update: (ref, data) => ops.push([ref, data]),
      commit: async () => ops.forEach(([ref, data]) => {
        escritas.push(['batch', ref._path, data]);
        banco.set(ref._path, { ...banco.get(ref._path), ...data });
      }),
    };
  },
  serverTimestamp: () => 'agora',
  increment: (n) => ({ _inc: n }),
}));

const { bookClass, listArenaClasses, updateArenaClass, cancelArenaClass, listClassBookings } = await import('./classesService.js');
const { notifyUsers } = await import('@/core/services/notificationService');

const usuario = { uid: 'aluno1', displayName: 'Aluno' };

beforeEach(() => {
  banco.clear();
  escritas.length = 0;
  banco.set('arena_classes/k1', {
    arena_id: 'a1', coach_id: 'c1', price: 100, status: 'scheduled', max_students: 4, enrolled: 0,
  });
});

const matriculaGravada = () => banco.get('arena_class_bookings/k1_aluno1');

describe('🐞 bookClass — a divisão sai do BANCO, não da tela', () => {
  it('⭐ professor da CASA não paga comissão (mesmo que a tela mande partner: true)', async () => {
    banco.set('arena_coaches/c1', { arena_id: 'a1', name: 'Rafa', partner: false });
    await bookClass('k1', usuario, null, { partner: true, commissionPct: 50 });
    expect(matriculaGravada()).toMatchObject({ amount: 100, arena_amount: 0, coach_amount: 100, commission_pct: 0 });
  });

  it('professor PARCEIRO paga a comissão CONFIGURADA no módulo', async () => {
    banco.set('arena_coaches/c1', { arena_id: 'a1', name: 'Rafa', partner: true });
    banco.set('arena_module_states/a1_classes_marketplace', { config: { commission_pct: 30 } });
    await bookClass('k1', usuario, null);
    expect(matriculaGravada()).toMatchObject({ arena_amount: 30, coach_amount: 70, commission_pct: 30 });
  });

  it('🐞 comissão configurada em ZERO é zero (o `|| 20` virava 20%)', async () => {
    banco.set('arena_coaches/c1', { arena_id: 'a1', name: 'Rafa', partner: true });
    banco.set('arena_module_states/a1_classes_marketplace', { config: { commission_pct: 0 } });
    await bookClass('k1', usuario, null);
    expect(matriculaGravada()).toMatchObject({ arena_amount: 0, commission_pct: 0 });
  });

  it('sem configuração, parceiro paga o padrão de 20%', async () => {
    banco.set('arena_coaches/c1', { arena_id: 'a1', name: 'Rafa', partner: true });
    await bookClass('k1', usuario, null);
    expect(matriculaGravada()).toMatchObject({ arena_amount: 20, commission_pct: 20 });
  });

  it('a matrícula leva `user_id` (o campo que a regra confere) e o professor da aula', async () => {
    banco.set('arena_coaches/c1', { arena_id: 'a1', partner: false });
    await bookClass('k1', usuario, null);
    expect(matriculaGravada()).toMatchObject({ user_id: 'aluno1', coach_id: 'c1', arena_id: 'a1', paid: false });
  });
});

describe('listArenaClasses', () => {
  beforeEach(() => {
    banco.clear();
    banco.set('arena_classes/velha', { arena_id: 'a1', date: '2020-01-01', start: '10:00', status: 'scheduled' });
    banco.set('arena_classes/dada', { arena_id: 'a1', date: '2026-01-01', start: '10:00', status: 'completed' });
    banco.set('arena_classes/cancelada', { arena_id: 'a1', date: '2026-02-01', start: '10:00', status: 'cancelled' });
    banco.set('arena_classes/futura', { arena_id: 'a1', date: '2099-01-01', start: '10:00', status: 'scheduled' });
    banco.set('arena_classes/outra', { arena_id: 'a2', date: '2099-01-01', start: '10:00', status: 'scheduled' });
  });

  it('sem `includeClosed` (calendários), só as aulas de pé', async () => {
    const r = await listArenaClasses('a1');
    expect(r.map((a) => a.id)).toEqual(['velha', 'futura']);
  });

  it('⭐ com `includeClosed`, as dadas e as canceladas também (a agenda precisa delas)', async () => {
    const r = await listArenaClasses('a1', { includeClosed: true });
    expect(r.map((a) => a.id)).toEqual(['velha', 'dada', 'cancelada', 'futura']);
  });

  it('🐞 o limite corta as mais ANTIGAS — a aula futura nunca some do calendário', async () => {
    const r = await listArenaClasses('a1', { lim: 1 });
    expect(r.map((a) => a.id)).toEqual(['futura']);
  });
});

describe('updateArenaClass — trocar o professor', () => {
  beforeEach(() => {
    banco.clear();
    banco.set('arena_classes/k1', {
      arena_id: 'a1', coach_id: 'c1', date: '2099-10-01', start: '19:00', end: '20:00',
      price: 100, status: 'scheduled', max_students: 4, enrolled: 1, format: 'group', level: 'beginner',
    });
    banco.set('arena_class_bookings/k1_x', { class_id: 'k1', arena_id: 'a1', coach_id: 'c1', user_id: 'x' });
    // matrícula com o mesmo class_id em OUTRA arena não é desta aula
    banco.set('arena_class_bookings/k1_y', { class_id: 'k1', arena_id: 'a2', coach_id: 'c1', user_id: 'y' });
  });

  it('⭐ o professor novo vai para as matrículas', async () => {
    await updateArenaClass('k1', { coach_id: 'c2' }, { uid: 'gestor' });
    expect(banco.get('arena_class_bookings/k1_x').coach_id).toBe('c2');
    expect(banco.get('arena_class_bookings/k1_y').coach_id).toBe('c1');
  });

  it('sem trocar o professor, as matrículas não são tocadas', async () => {
    await updateArenaClass('k1', { price: 120 }, { uid: 'gestor' });
    expect(escritas.some(([tipo]) => tipo === 'batch')).toBe(false);
  });
});

describe('🐞 a ARENA lê os alunos filtrando pela arena', () => {
  beforeEach(() => {
    banco.clear();
    banco.set('arena_classes/k1', { arena_id: 'a1', date: '2099-10-01', start: '19:00', status: 'scheduled' });
    banco.set('arena_class_bookings/k1_x', { class_id: 'k1', arena_id: 'a1', user_id: 'x' });
    banco.set('arena_class_bookings/k1_z', { class_id: 'k1', arena_id: 'a1', user_id: 'z' });
  });

  it('sem a arena, nem consulta (a regra recusaria)', async () => {
    expect(await listClassBookings('k1')).toEqual([]);
  });

  it('com a arena, traz os alunos da aula', async () => {
    const r = await listClassBookings('k1', 'a1');
    expect(r.map((b) => b.user_id).sort()).toEqual(['x', 'z']);
  });

  it('⭐ cancelar a aula avisa os alunos (antes quebrava no meio, sem avisar ninguém)', async () => {
    notifyUsers.mockClear();
    await cancelArenaClass('k1', 'Chuva', { uid: 'gestor' });
    expect(banco.get('arena_classes/k1').status).toBe('cancelled');
    expect(notifyUsers).toHaveBeenCalledTimes(1);
    expect(notifyUsers.mock.calls[0][0].sort()).toEqual(['x', 'z']);
  });
});

