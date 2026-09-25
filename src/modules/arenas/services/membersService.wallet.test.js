/**
 * Carteira e pontos: as escritas que a REGRA confere.
 *
 * O que protege:
 *  1. ⭐ a carteira NOVA nasce com `arena_id` e `user_id` — a regra de criação
 *     confere `arena_id`, e sem ele o primeiro crédito de quem ainda não tinha
 *     carteira era recusado (indicação, resgate de pontos, crédito manual);
 *  2. crédito numa carteira existente soma e mantém o extrato;
 *  3. ⭐ reserva de quem NÃO é membro não cria documento de membro — antes o
 *     `set` com `merge` tentava, a regra recusava e o lote inteiro caía;
 *  4. reserva de membro soma os pontos e baixa o pacote no MESMO lote;
 *  5. ⭐ tornar membro NÃO regrava a carteira que já existia (o saldo de
 *     indicação e as horas pagas ficavam zerados) nem zera os pontos de quem
 *     já era membro;
 *  6. ⭐ 🐞 a baixa de horas funciona com a carteira como o BANCO devolve
 *     (`pkg_id` + Timestamp) — antes o plano casava por `p.id`, que a carteira
 *     não tem, e nada era baixado; e duas compras do mesmo pacote não são
 *     debitadas juntas.
 *
 * O banco falso aqui não recusa nada — por isso o teste confere o CONTEÚDO do
 * que seria gravado, e as asserções de regra ficam no emulador
 * (`tests/rules/arenaUserDocs.rules.test.js`).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const banco = new Map();
const lote = [];
const snap = (path) => ({ id: path.split('/').pop(), exists: () => banco.has(path), data: () => banco.get(path) });

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: vi.fn(() => Promise.resolve()), NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));
vi.mock('./arenaService.js', () => ({ listArenaManagerIds: vi.fn(async () => []) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ _col: nome }),
  doc: (_db, col, id) => ({ _path: `${col?._col || col}/${id}` }),
  getDoc: async (ref) => snap(ref._path),
  getDocs: async () => ({ docs: [] }),
  query: (...a) => a, where: (...a) => a, orderBy: () => null, limit: () => null,
  setDoc: async (ref, data, opts) => {
    const atual = opts?.merge ? (banco.get(ref._path) || {}) : {};
    const novo = { ...atual };
    Object.entries(data).forEach(([k, v]) => { novo[k] = v?._inc ? (Number(atual[k]) || 0) + v._inc : v; });
    banco.set(ref._path, novo);
  },
  updateDoc: async () => {},
  deleteDoc: async () => {},
  writeBatch: () => ({
    set: (ref, data) => lote.push({ path: ref._path, data }),
    update: (ref, data) => lote.push({ path: ref._path, data }),
    commit: async () => {},
  }),
  serverTimestamp: () => 'agora',
  increment: (n) => ({ _inc: n }),
  arrayUnion: (...v) => ({ _union: v }),
}));

const { creditWallet, consumeMemberBenefit } = await import('./membersService.js');
const { createAuditLog } = await import('@/core/services/auditService');

beforeEach(() => {
  banco.clear();
  lote.length = 0;
  createAuditLog.mockClear();
});

describe('creditWallet', () => {
  it('⭐ carteira NOVA nasce com arena_id e user_id (é o que a regra confere)', async () => {
    await creditWallet('a1', 'u1', 20, 'veio por indicação', { uid: 'g1' });
    const w = banco.get('arena_wallets/a1_u1');
    expect(w.arena_id).toBe('a1');
    expect(w.user_id).toBe('u1');
    expect(w.balance).toBe(20);
    expect(w.points).toBe(0);
    expect(w.transactions).toHaveLength(1);
    expect(w.transactions[0]).toMatchObject({ type: 'credit', amount: 20, source: 'veio por indicação' });
  });

  it('carteira existente: soma o saldo e mantém o extrato', async () => {
    banco.set('arena_wallets/a1_u1', {
      arena_id: 'a1', user_id: 'u1', balance: 10, points: 40, packages: [{ pkg_id: 'p1' }],
      transactions: [{ type: 'credit', amount: 10 }],
    });
    await creditWallet('a1', 'u1', 5, 'ajuste', { uid: 'g1' });
    const w = banco.get('arena_wallets/a1_u1');
    expect(w.balance).toBe(15);
    expect(w.points).toBe(40);
    expect(w.packages).toEqual([{ pkg_id: 'p1' }]);
    expect(w.transactions.map((t) => t.amount)).toEqual([10, 5]);
  });

  it('valor inválido não grava nada', async () => {
    await creditWallet('a1', 'u1', 0, 'x', null);
    await creditWallet('a1', 'u1', -3, 'x', null);
    expect(banco.size).toBe(0);
  });
});

describe('consumeMemberBenefit', () => {
  it('⭐ quem NÃO é membro: nenhum documento de membro é criado, nada é gravado', async () => {
    await consumeMemberBenefit('a1', 'u1', { points: 30, reference: 'reserva b1' }, { uid: 'g1' });
    expect(lote).toEqual([]);
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('membro: soma os pontos', async () => {
    banco.set('arena_members/a1_u1', { arena_id: 'a1', user_id: 'u1', points: 10 });
    await consumeMemberBenefit('a1', 'u1', { points: 30, reference: 'reserva b1' }, { uid: 'g1' });
    expect(lote).toHaveLength(1);
    expect(lote[0].path).toBe('arena_members/a1_u1');
    expect(lote[0].data.points).toEqual({ _inc: 30 });
  });

  it('membro com pacote: baixa as horas e soma os pontos no MESMO lote', async () => {
    banco.set('arena_members/a1_u1', { arena_id: 'a1', user_id: 'u1', points: 0 });
    banco.set('arena_wallets/a1_u1', {
      arena_id: 'a1', user_id: 'u1', balance: 0,
      packages: [{ pkg_id: 'p1', total_hours: 10, used_hours: 2 }], transactions: [],
    });
    await consumeMemberBenefit('a1', 'u1', {
      packagePlan: [{ id: 'p1', hours: 2 }], points: 5, reference: 'reserva b1',
    }, { uid: 'g1' });
    const carteira = lote.find((l) => l.path === 'arena_wallets/a1_u1');
    const membro = lote.find((l) => l.path === 'arena_members/a1_u1');
    expect(carteira.data.packages[0].used_hours).toBe(4);
    expect(membro.data.points).toEqual({ _inc: 5 });
  });

  it('⭐ 🐞 carteira como o banco devolve: baixa as horas numa entrada só', async () => {
    // Timestamp de verdade tem `toMillis`; o módulo do Firestore está falso aqui.
    const vence = (dias) => ({ toMillis: () => Date.now() + dias * 86_400_000 });
    banco.set('arena_wallets/a1_u1', {
      arena_id: 'a1', user_id: 'u1', balance: 0, transactions: [],
      packages: [
        { pkg_id: 'dez', total_hours: 10, used_hours: 0, expires_at: vence(60) },
        { pkg_id: 'dez', total_hours: 10, used_hours: 0, expires_at: vence(10) },
      ],
    });
    await consumeMemberBenefit('a1', 'u1', { packageHours: 2, reference: 'reserva b1' }, { uid: 'g1' });
    const carteira = lote.find((l) => l.path === 'arena_wallets/a1_u1');
    // Sai do que vence ANTES (a segunda), e só dela.
    expect(carteira.data.packages.map((p) => p.used_hours)).toEqual([0, 2]);
    expect(carteira.data.transactions.at(-1)).toMatchObject({ type: 'package_use', hours: 2 });
  });

  it('pedido com mais horas do que a carteira tem agora: baixa só o que há', async () => {
    banco.set('arena_wallets/a1_u1', {
      arena_id: 'a1', user_id: 'u1', balance: 0, transactions: [],
      packages: [{ pkg_id: 'dez', total_hours: 10, used_hours: 9 }],
    });
    await consumeMemberBenefit('a1', 'u1', { packageHours: 3 }, { uid: 'g1' });
    const carteira = lote.find((l) => l.path === 'arena_wallets/a1_u1');
    expect(carteira.data.packages[0].used_hours).toBe(10);
    expect(createAuditLog.mock.calls[0][0].details.package_hours).toBe(1);
  });

  it('pacote sem carteira e sem ser membro: não grava lote vazio nem auditoria', async () => {
    await consumeMemberBenefit('a1', 'u1', { packagePlan: [{ id: 'p1', hours: 1 }] }, null);
    expect(lote).toEqual([]);
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});

describe('addArenaMember', () => {
  it('⭐ tornar membro quem já tinha carteira (crédito de indicação) NÃO zera o saldo', async () => {
    const { addArenaMember } = await import('./membersService.js');
    banco.set('arena_wallets/a1_u1', {
      arena_id: 'a1', user_id: 'u1', balance: 20, packages: [{ pkg_id: 'p1', total_hours: 10 }],
      transactions: [{ type: 'credit', amount: 20 }],
    });
    await addArenaMember('a1', { user_id: 'u1', user_name: 'Ana' }, { uid: 'g1' });
    expect(banco.get('arena_members/a1_u1')).toMatchObject({ arena_id: 'a1', user_id: 'u1', user_name: 'Ana', points: 0 });
    const w = banco.get('arena_wallets/a1_u1');
    expect(w.balance).toBe(20);
    expect(w.packages).toHaveLength(1);
  });

  it('⭐ incluir de novo quem já é membro não zera pontos nem nível', async () => {
    const { addArenaMember } = await import('./membersService.js');
    banco.set('arena_members/a1_u1', { arena_id: 'a1', user_id: 'u1', points: 800, tier: 'gold', user_name: 'Ana' });
    await addArenaMember('a1', { user_id: 'u1', user_name: 'Ana Souza' }, { uid: 'g1' });
    // O banco falso ignora `updateDoc`; o que importa é o documento não ser REGRAVADO.
    expect(banco.get('arena_members/a1_u1')).toMatchObject({ points: 800, tier: 'gold' });
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it('quem não tinha nada: membro e carteira zerada', async () => {
    const { addArenaMember } = await import('./membersService.js');
    await addArenaMember('a1', { user_id: 'u2', user_name: 'Bia' }, { uid: 'g1' });
    expect(banco.get('arena_members/a1_u2')).toMatchObject({ arena_id: 'a1', user_id: 'u2', points: 0 });
    expect(banco.get('arena_wallets/a1_u2')).toMatchObject({ arena_id: 'a1', user_id: 'u2', balance: 0 });
  });
});
