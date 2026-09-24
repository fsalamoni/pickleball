/**
 * Pacote de horas: o atleta PEDE, a arena CONFIRMA.
 *
 * O que protege:
 *  1. ⭐ o pedido NÃO grava carteira (o atleta não pode — era o defeito) e
 *     avisa a arena com o caminho direto para confirmar;
 *  2. ⭐ a venda credita as horas, soma o valor gasto e registra a
 *     transação; quem não era membro vira membro;
 *  3. a venda conta no pacote (`sold_count`) e avisa a pessoa;
 *  4. pedido de pacote fora da vitrine é recusado.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const banco = new Map();
const escritas = [];
const snap = (path) => ({ id: path.split('/').pop(), exists: () => banco.has(path), data: () => banco.get(path) });

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: vi.fn(() => Promise.resolve()), NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));
// Os gestores como o BANCO devolve: documentos. `listArenaManagerIds` é quem
// os traduz em uids — mandar os documentos ao aviso era o defeito (o pedido
// ia para "[object Object]").
vi.mock('./arenaService.js', () => ({
  listArenaManagers: vi.fn(async () => estado.gestores),
  listArenaManagerIds: vi.fn(async () => estado.gestores.map((g) => g.user_id)),
}));
const estado = { gestores: [{ id: 'a1_g1', arena_id: 'a1', user_id: 'g1' }] };
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ _col: nome }),
  doc: (_db, col, id) => ({ _path: `${col?._col || col}/${id}` }),
  getDoc: async (ref) => snap(ref._path),
  getDocs: async () => ({ docs: [] }),
  query: (...a) => a, where: (...a) => a, orderBy: () => null, limit: () => null,
  setDoc: async (ref, data, opts) => {
    escritas.push(ref._path);
    banco.set(ref._path, opts?.merge ? { ...banco.get(ref._path), ...data } : data);
  },
  updateDoc: async (ref, data) => {
    escritas.push(ref._path);
    const atual = banco.get(ref._path) || {};
    const novo = { ...atual };
    Object.entries(data).forEach(([k, v]) => { novo[k] = v?._inc ? (Number(atual[k]) || 0) + v._inc : v; });
    banco.set(ref._path, novo);
  },
  deleteDoc: async () => {},
  writeBatch: () => ({ update: () => {}, set: () => {}, commit: async () => {} }),
  serverTimestamp: () => 'agora',
  increment: (n) => ({ _inc: n }),
}));

const { requestPackagePurchase, sellPackageToMember } = await import('./membersService.js');
const { notifyUsers } = await import('@/core/services/notificationService');

beforeEach(() => {
  banco.clear();
  escritas.length = 0;
  estado.gestores = [{ id: 'a1_g1', arena_id: 'a1', user_id: 'g1' }];
  notifyUsers.mockClear();
  banco.set('arena_packages/p1', { arena_id: 'a1', name: '10 horas', hours: 10, price: 500, validity_days: 90, active: true });
});

describe('o atleta PEDE', () => {
  it('⭐ não grava carteira nenhuma — só avisa a arena, com o caminho para confirmar', async () => {
    const r = await requestPackagePurchase('a1', 'p1', { uid: 'u1', displayName: 'Ana' }, null);
    expect(r.notified).toBe(1);
    expect(escritas).toEqual([]);
    const [gestores, aviso] = notifyUsers.mock.calls[0];
    // ⭐ uids — não os documentos de gestor.
    expect(gestores).toEqual(['g1']);
    expect(aviso.link).toBe('/arenas/a1/gerir?aba=membros&pacote=p1&para=u1');
    expect(aviso.message).toContain('Ana quer o pacote "10 horas"');
  });

  it('pacote fora da vitrine não é pedido', async () => {
    banco.set('arena_packages/p1', { ...banco.get('arena_packages/p1'), active: false });
    await expect(requestPackagePurchase('a1', 'p1', { uid: 'u1' }, null)).rejects.toThrow(/saiu da vitrine/);
  });

  it('arena sem gestor: diz que não há quem receba o pedido', async () => {
    estado.gestores = [];
    await expect(requestPackagePurchase('a1', 'p1', { uid: 'u1' }, null)).rejects.toThrow(/não tem quem receba/);
  });
});

describe('a arena CONFIRMA', () => {
  it('⭐ quem não era membro vira membro, e as horas entram na carteira', async () => {
    await sellPackageToMember('a1', 'p1', { user_id: 'u1', user_name: 'Ana' }, { uid: 'g1' });
    expect(banco.has('arena_members/a1_u1')).toBe(true);
    const w = banco.get('arena_wallets/a1_u1');
    expect(w.packages).toHaveLength(1);
    expect(w.packages[0]).toMatchObject({ pkg_id: 'p1', total_hours: 10, used_hours: 0, sold_by: 'g1' });
    expect(w.total_spent).toBe(500);
    expect(w.transactions.at(-1)).toMatchObject({ type: 'package_purchase', amount: 500 });
  });

  it('membro com carteira: o pacote SOMA ao que já tinha', async () => {
    banco.set('arena_members/a1_u1', { arena_id: 'a1', user_id: 'u1', points: 0 });
    banco.set('arena_wallets/a1_u1', {
      arena_id: 'a1', user_id: 'u1', balance: 30, total_spent: 100,
      packages: [{ pkg_id: 'velho', total_hours: 2, used_hours: 1 }], transactions: [],
    });
    await sellPackageToMember('a1', 'p1', { user_id: 'u1' }, { uid: 'g1' });
    const w = banco.get('arena_wallets/a1_u1');
    expect(w.packages.map((p) => p.pkg_id)).toEqual(['velho', 'p1']);
    expect(w.total_spent).toBe(600);
    expect(w.balance).toBe(30);
    expect(banco.get('arena_members/a1_u1').points).toBe(500);
  });

  it('conta a venda no pacote e avisa a pessoa', async () => {
    await sellPackageToMember('a1', 'p1', { user_id: 'u1' }, { uid: 'g1' });
    expect(banco.get('arena_packages/p1').sold_count).toBe(1);
    const aviso = notifyUsers.mock.calls.find(([uids]) => uids[0] === 'u1' && uids.length === 1);
    expect(aviso).toBeTruthy();
  });
});
