/**
 * Cupons de todos os tipos e o programa de indicação — o serviço.
 *
 * O que protege:
 *  1. ⭐ o custo unitário do vale NUNCA vai para o cupom (legível por qualquer
 *     conta): vai para `arena_settings.coupon_costs`;
 *  2. ⭐ vale na recepção: só vale; recusa com o motivo; conta o uso e quem usou;
 *  3. um programa de indicação ativo por arena;
 *  4. ⭐ código de indicação copiado (documento que não é do dono do código)
 *     não credita ninguém;
 *  5. as regras do programa: limite por pessoa, "só quem nunca reservou",
 *     prêmio diferente para cada lado, e o custo registrado (`reward_total`).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const banco = new Map();
const escritas = [];
const snap = (path) => ({ id: path.split('/').pop(), exists: () => banco.has(path), data: () => banco.get(path) });
const daColecao = (col) => [...banco.entries()]
  .filter(([k]) => k.startsWith(`${col}/`))
  .map(([k, v]) => ({ id: k.split('/').pop(), data: () => v }));

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: vi.fn(() => Promise.resolve()), NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));
vi.mock('./v3SettingsService.js', () => ({
  getOrCreateArenaSettings: vi.fn(async (id) => {
    if (!banco.has(`arena_settings/${id}`)) banco.set(`arena_settings/${id}`, { padrao: true });
    return banco.get(`arena_settings/${id}`);
  }),
}));

function aplicar(atual, data) {
  const novo = { ...atual };
  Object.entries(data).forEach(([k, v]) => {
    if (k.includes('.')) {
      const [raiz, filho] = k.split('.');
      const mapa = { ...(novo[raiz] || {}) };
      if (v?._delete) delete mapa[filho]; else mapa[filho] = v;
      novo[raiz] = mapa;
    } else if (v?._inc !== undefined) novo[k] = (Number(atual[k]) || 0) + v._inc;
    else if (v?._union) novo[k] = [...new Set([...(atual[k] || []), ...v._union])];
    else novo[k] = v;
  });
  return novo;
}

let proximoId = 0;
vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ _col: nome }),
  doc: (_db, col, id) => {
    const nome = col?._col || col;
    return { _path: `${nome}/${id ?? `novo${(proximoId += 1)}`}`, get id() { return this._path.split('/').pop(); } };
  },
  getDoc: async (ref) => snap(ref._path),
  getDocs: async (q) => {
    const col = q[0]._col;
    const filtros = q.slice(1).filter((f) => Array.isArray(f) && f[1] === '==');
    const docs = daColecao(col).filter((d) => filtros.every(([campo, , valor]) => d.data()[campo] === valor));
    return { docs };
  },
  query: (...a) => a,
  where: (campo, op, valor) => [campo, op, valor],
  orderBy: () => null,
  limit: () => null,
  setDoc: async (ref, data) => { escritas.push({ path: ref._path, data }); banco.set(ref._path, data); },
  updateDoc: async (ref, data) => {
    escritas.push({ path: ref._path, data });
    banco.set(ref._path, aplicar(banco.get(ref._path) || {}, data));
  },
  deleteDoc: async (ref) => { banco.delete(ref._path); },
  runTransaction: async (_db, fn) => fn({
    get: async (ref) => snap(ref._path),
    update: (ref, data) => { escritas.push({ path: ref._path, data }); banco.set(ref._path, aplicar(banco.get(ref._path) || {}, data)); },
  }),
  serverTimestamp: () => 'agora',
  increment: (n) => ({ _inc: n }),
  arrayUnion: (...v) => ({ _union: v }),
  deleteField: () => ({ _delete: true }),
}));

const svc = await import('./marketingService.js');

beforeEach(() => {
  banco.clear();
  escritas.length = 0;
});

describe('⭐ o custo do vale mora onde só a arena lê', () => {
  it('criar um vale com custo: o cupom NÃO leva o custo; arena_settings leva', async () => {
    const id = await svc.createArenaCoupon('a1', {
      kind: 'drink', code: 'COCO', benefit: '1 água de coco', unit_cost: '3.50',
    }, { uid: 'g' });
    const cupom = banco.get(`arena_coupons/${id}`);
    expect(cupom).toMatchObject({ arena_id: 'a1', kind: 'drink', benefit: '1 água de coco', used_count: 0 });
    expect(JSON.stringify(cupom)).not.toMatch(/unit_cost|3\.5/);
    expect(banco.get('arena_settings/a1').coupon_costs).toEqual({ [id]: 3.5 });
    // O documento de configurações nasceu com os padrões, não só com o custo.
    expect(banco.get('arena_settings/a1').padrao).toBe(true);
  });

  it('custo vazio apaga (desconhecido, nunca zero); apagar o cupom leva o custo junto', async () => {
    banco.set('arena_settings/a1', { coupon_costs: { c1: 2, c2: 5 } });
    await svc.setCouponUnitCost('a1', 'c1', '');
    expect(banco.get('arena_settings/a1').coupon_costs).toEqual({ c2: 5 });
    banco.set('arena_coupons/c2', { arena_id: 'a1', code: 'X', kind: 'food', benefit: 'lanche', active: true });
    await svc.deleteArenaCoupon('c2', null, { arenaId: 'a1' });
    expect(banco.get('arena_settings/a1').coupon_costs).toEqual({});
  });

  it('editar um vale para desconto remove o custo unitário', async () => {
    banco.set('arena_coupons/c1', { arena_id: 'a1', code: 'X', kind: 'food', benefit: 'lanche', active: true });
    banco.set('arena_settings/a1', { coupon_costs: { c1: 4 } });
    await svc.updateArenaCoupon('c1', { kind: 'discount', code: 'X', type: 'percent', value: 10, unit_cost: 4 }, null, { arenaId: 'a1' });
    expect(banco.get('arena_settings/a1').coupon_costs).toEqual({});
    expect(banco.get('arena_coupons/c1')).toMatchObject({ kind: 'discount', benefit: null, value: 10 });
  });
});

describe('⭐ vale na recepção', () => {
  beforeEach(() => {
    banco.set('arena_coupons/coco', {
      arena_id: 'a1', code: 'COCO', kind: 'drink', benefit: '1 água de coco', active: true,
      used_count: 0, max_uses: 2, once_per_user: true,
    });
  });

  it('conta o uso e guarda quem usou', async () => {
    await svc.redeemVoucher('a1', 'coco', { userId: 'u1', userName: 'Ana' });
    expect(banco.get('arena_coupons/coco')).toMatchObject({ used_count: 1, used_by: ['u1'] });
  });

  it('recusa quem já usou (com o motivo em terceira pessoa) e quem passa do limite', async () => {
    await svc.redeemVoucher('a1', 'coco', { userId: 'u1' });
    await expect(svc.redeemVoucher('a1', 'coco', { userId: 'u1' })).rejects.toThrow(/Esta pessoa já usou/);
    await svc.redeemVoucher('a1', 'coco', {});
    await expect(svc.redeemVoucher('a1', 'coco', { userId: 'u9' })).rejects.toThrow(/limite de usos/);
  });

  it('recusa cupom de outra arena, desconto na reserva e o programa de indicação', async () => {
    await expect(svc.redeemVoucher('b2', 'coco', {})).rejects.toThrow(/outra arena/);
    banco.set('arena_coupons/dez', { arena_id: 'a1', code: 'DEZ', type: 'percent', value: 10, active: true });
    await expect(svc.redeemVoucher('a1', 'dez', {})).rejects.toThrow(/entra sozinho no preço/);
    banco.set('arena_coupons/ind', { arena_id: 'a1', code: 'INDICACAO', kind: 'referral', referrer_reward: 10, active: true });
    await expect(svc.redeemVoucher('a1', 'ind', {})).rejects.toThrow(/aba Indicações/);
  });

  it('acha o cupom pelo código digitado na recepção', async () => {
    expect((await svc.findArenaCouponByCode('a1', ' coco '))?.id).toBe('coco');
    expect(await svc.findArenaCouponByCode('a1', 'NADA')).toBeNull();
  });
});

describe('um programa de indicação ativo por arena', () => {
  it('recusa criar um segundo programa ativo, e religar um antigo por cima', async () => {
    await svc.createArenaCoupon('a1', { kind: 'referral', referrer_reward: 20 });
    await expect(svc.createArenaCoupon('a1', { kind: 'referral', referrer_reward: 30 })).rejects.toThrow(/Já existe um programa/);
    banco.set('arena_coupons/velho', { arena_id: 'a1', code: 'INDICACAO', kind: 'referral', referrer_reward: 5, active: false });
    await expect(svc.setCouponActive('velho', true)).rejects.toThrow(/Já existe um programa/);
  });

  it('editar o PRÓPRIO programa ativo não conflita consigo mesmo', async () => {
    const id = await svc.createArenaCoupon('a1', { kind: 'referral', referrer_reward: 20 });
    await svc.updateArenaCoupon(id, { kind: 'referral', referrer_reward: 25 }, null, { arenaId: 'a1' });
    expect(banco.get(`arena_coupons/${id}`).referrer_reward).toBe(25);
  });
});

describe('⭐ indicação: o código tem de ser do dono', () => {
  beforeEach(() => {
    banco.set('arena_referrals/a1_anaUid1', { arena_id: 'a1', referrer_id: 'anaUid1', code: 'ANAUIDK7Q2', redeemed_count: 0 });
  });

  it('o código legítimo é achado', async () => {
    expect((await svc.findReferralByCode('a1', 'anauidk7q2'))?.referrer_id).toBe('anaUid1');
  });

  it('🐞 documento de outra pessoa com o código copiado não é achado', async () => {
    banco.clear();
    // Sequestro antigo: o documento da vítima com o atacante como indicador.
    banco.set('arena_referrals/a1_vitima', { arena_id: 'a1', referrer_id: 'atacante', code: 'ATACANX1Y2' });
    // Código reescrito com o código de outra pessoa.
    banco.set('arena_referrals/a1_atacante', { arena_id: 'a1', referrer_id: 'atacante', code: 'ANAUIDK7Q2' });
    expect(await svc.findReferralByCode('a1', 'ATACANX1Y2')).toBeNull();
    expect(await svc.findReferralByCode('a1', 'ANAUIDK7Q2')).toBeNull();
  });
});

describe('indicação: as regras do programa', () => {
  const programa = { kind: 'referral', referrer_reward: 20, max_per_referrer: 2, first_booking_only: true };
  beforeEach(() => {
    banco.set('arena_referrals/a1_anaUid1', { id: 'a1_anaUid1', arena_id: 'a1', referrer_id: 'anaUid1', code: 'ANAUIDK7Q2', redeemed_count: 0 });
  });

  it('prêmio diferente para cada lado, e o custo registrado em reward_total', async () => {
    const r = await svc.redeemReferral('a1', {
      code: 'ANAUIDK7Q2', referredId: 'novo', referrerReward: 20, referredReward: 10, program: programa,
    });
    expect(r).toMatchObject({ referrerId: 'anaUid1', referrerReward: 20, referredReward: 10 });
    expect(banco.get('arena_referrals/a1_anaUid1')).toMatchObject({ redeemed_count: 1, redeemed_by: ['novo'], reward_total: 30 });
  });

  it('o formato antigo (reward sozinho) ainda vale para os dois lados', async () => {
    const r = await svc.redeemReferral('a1', { code: 'ANAUIDK7Q2', referredId: 'novo', reward: 15 });
    expect(r).toMatchObject({ referrerReward: 15, referredReward: 15, reward: 15 });
  });

  it('respeita o limite de indicações por pessoa', async () => {
    banco.set('arena_referrals/a1_anaUid1', { ...banco.get('arena_referrals/a1_anaUid1'), redeemed_count: 2 });
    await expect(svc.redeemReferral('a1', { code: 'ANAUIDK7Q2', referredId: 'novo', reward: 10, program: programa }))
      .rejects.toThrow(/limite de 2 indicações/);
  });

  it('"só quem nunca reservou aqui": recusa quem já tem reserva confirmada — fora a que está sendo confirmada', async () => {
    banco.set('arena_bookings/b1', { arena_id: 'a1', athlete_id: 'novo', status: 'confirmed' });
    await expect(svc.redeemReferral('a1', { code: 'ANAUIDK7Q2', referredId: 'novo', reward: 10, program: programa }))
      .rejects.toThrow(/nunca reservou/);
    const r = await svc.redeemReferral('a1', {
      code: 'ANAUIDK7Q2', referredId: 'novo', reward: 10, program: programa, exceptBookingId: 'b1',
    });
    expect(r.referrerId).toBe('anaUid1');
  });

  it('reserva recusada ou cancelada não conta como "já reservou"', async () => {
    banco.set('arena_bookings/b1', { arena_id: 'a1', athlete_id: 'novo', status: 'declined' });
    expect(await svc.hasPriorArenaBooking('a1', 'novo')).toBe(false);
  });

  it('ninguém indica a si mesmo; prêmio zero dos dois lados é recusado', async () => {
    await expect(svc.redeemReferral('a1', { code: 'ANAUIDK7Q2', referredId: 'anaUid1', reward: 10 })).rejects.toThrow(/a si mesmo/);
    await expect(svc.redeemReferral('a1', { code: 'ANAUIDK7Q2', referredId: 'novo', referrerReward: 0, referredReward: 0 }))
      .rejects.toThrow(/pelo menos um dos lados/);
  });
});

describe('banners da tela inicial (Onda BZ)', () => {
  it('lista só os cupons marcados como banner E ligados', async () => {
    banco.set('arena_coupons/b1', { arena_id: 'a1', code: 'SOL10', show_home: true, active: true });
    banco.set('arena_coupons/b2', { arena_id: 'a1', code: 'OFF', show_home: true, active: false });
    banco.set('arena_coupons/b3', { arena_id: 'a1', code: 'SOARENA', show_public: true, active: true });
    const ids = (await svc.listHomeBannerCoupons()).map((c) => c.id);
    expect(ids).toContain('b1');
    expect(ids).not.toContain('b2');
    expect(ids).not.toContain('b3');
  });
});
