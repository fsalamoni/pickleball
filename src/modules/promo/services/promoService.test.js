/**
 * Divulgação da plataforma e dos professores — o SERVIÇO (Onda CG).
 *
 * O que protege:
 *  1. ⭐ o custo unitário do vale NUNCA vai no cupom (legível por qualquer
 *     conta): vai para as configurações privadas do emissor;
 *  2. o emissor é gravado, e dois cupons com o mesmo código não nascem;
 *  3. ⭐ registrar uso: só o cupom DO emissor; conta o uso e quem usou; recusa
 *     com o motivo;
 *  4. ⭐ a campanha: público vazio não envia; o link do AVISO nunca leva `#`
 *     (a regra recusaria o lote inteiro);
 *  5. ⭐ o cupom do pedido de aula é aplicado na CONFIRMAÇÃO pelo professor —
 *     preço já descontado, uso contado; cupom que não vale é recusado com o
 *     motivo e a aula é confirmada assim mesmo.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const banco = new Map();
const escritas = [];
const snap = (path) => ({ id: path.split('/').pop(), exists: () => banco.has(path), data: () => banco.get(path) });
const daColecao = (col) => [...banco.entries()]
  .filter(([k]) => k.startsWith(`${col}/`))
  .map(([k, v]) => ({ id: k.split('/').pop(), data: () => v }));
const notifyUsers = vi.fn(() => Promise.resolve());

vi.mock('@/core/config/firebase', () => ({ db: {} }));
vi.mock('@/core/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/services/auditService', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/core/services/notificationService', () => ({
  notifyUsers: (...a) => notifyUsers(...a), NOTIFICATION_TYPE: { GENERIC: 'generic' },
}));

function aplicar(atual, data) {
  const novo = { ...atual };
  Object.entries(data).forEach(([k, v]) => {
    if (v?._inc !== undefined) novo[k] = (Number(atual[k]) || 0) + v._inc;
    else if (v?._union) novo[k] = [...new Set([...(atual[k] || []), ...v._union])];
    else novo[k] = v;
  });
  return novo;
}
function mesclar(atual = {}, data = {}) {
  const novo = { ...atual };
  Object.entries(data).forEach(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && !v._inc && !v._union && !v._delete) {
      const filho = { ...(novo[k] || {}) };
      Object.entries(v).forEach(([kk, vv]) => { if (vv?._delete) delete filho[kk]; else filho[kk] = vv; });
      novo[k] = filho;
    } else novo[k] = v;
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
    return { docs, empty: docs.length === 0 };
  },
  query: (...a) => a,
  where: (campo, op, valor) => [campo, op, valor],
  orderBy: () => null,
  limit: () => null,
  setDoc: async (ref, data, opts) => {
    escritas.push({ path: ref._path, data });
    banco.set(ref._path, opts?.merge ? mesclar(banco.get(ref._path), data) : data);
  },
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

const svc = await import('./promoService.js');
const { respondLesson } = await import('../../coaches/services/lessonService.js');

const PLATAFORMA = { type: 'platform', id: 'platform', name: 'PickleRush' };
const PROF = { type: 'coach', id: 'prof', name: 'Prof. Ana' };
const admin = { uid: 'admin' };
const professor = { uid: 'prof' };

beforeEach(() => {
  banco.clear();
  escritas.length = 0;
  notifyUsers.mockClear();
});

describe('cupons', () => {
  it('⭐ o custo do vale vai para as configurações privadas, nunca para o cupom', async () => {
    const id = await svc.createPromoCoupon(PLATAFORMA, {
      code: 'agua', kind: 'drink', benefit: '1 água no Open', unit_cost: 4.5,
    }, admin);
    const cupom = banco.get(`promo_coupons/${id}`);
    expect(cupom).toMatchObject({ issuer_type: 'platform', issuer_id: 'platform', code: 'AGUA', kind: 'drink', used_count: 0 });
    expect(JSON.stringify(cupom)).not.toContain('4.5');
    expect(banco.get('promo_settings/platform').coupon_costs[id]).toBe(4.5);
  });

  it('não cria dois cupons com o mesmo código', async () => {
    await svc.createPromoCoupon(PROF, { code: 'AULA10', value: 10 }, professor);
    await expect(svc.createPromoCoupon(PROF, { code: 'aula10', value: 5 }, professor)).rejects.toThrow(/já tem um cupom/);
  });

  it('não grava cupom inválido (a tela ajuda, o serviço confere)', async () => {
    await expect(svc.createPromoCoupon(PROF, { code: 'X', value: 500 }, professor)).rejects.toThrow(/100%/);
    await expect(svc.createPromoCoupon({ type: 'arena', id: 'a1' }, { code: 'X', value: 5 }, professor)).rejects.toThrow(/Emissor/);
  });

  it('deixar de ser vale apaga o custo unitário', async () => {
    const id = await svc.createPromoCoupon(PROF, { code: 'BRINDE', kind: 'product', benefit: 'Overgrip', unit_cost: 8 }, professor);
    await svc.updatePromoCoupon(PROF, id, { code: 'BRINDE', kind: 'discount', value: 10, unit_cost: 8 }, professor);
    expect(banco.get('promo_settings/prof').coupon_costs[id]).toBeUndefined();
  });
});

describe('⭐ registrar uso', () => {
  it('conta o uso e quem usou', async () => {
    const id = await svc.createPromoCoupon(PROF, { code: 'CLINICA', kind: 'clinic', benefit: 'Clínica de voleio' }, professor);
    await svc.redeemPromoCoupon(PROF, id, { userId: 'ana', userName: 'Ana' }, professor);
    expect(banco.get(`promo_coupons/${id}`)).toMatchObject({ used_count: 1, used_by: ['ana'] });
  });

  it('uma vez por pessoa: a segunda é recusada com o motivo', async () => {
    const id = await svc.createPromoCoupon(PROF, { code: 'CLINICA', kind: 'clinic', benefit: 'Clínica' }, professor);
    await svc.redeemPromoCoupon(PROF, id, { userId: 'ana' }, professor);
    await expect(svc.redeemPromoCoupon(PROF, id, { userId: 'ana' }, professor)).rejects.toThrow('Esta pessoa já usou este cupom.');
  });

  it('⭐ o cupom de outro emissor não é registrado', async () => {
    const id = await svc.createPromoCoupon(PLATAFORMA, { code: 'OPEN', value: 10 }, admin);
    await expect(svc.redeemPromoCoupon(PROF, id, {}, professor)).rejects.toThrow(/outro emissor/);
  });

  it('achar pelo código: só entre os do emissor', async () => {
    await svc.createPromoCoupon(PLATAFORMA, { code: 'OPEN', value: 10 }, admin);
    expect(await svc.findPromoCouponByCode(PROF, 'open')).toBeNull();
    expect((await svc.findPromoCouponByCode(PLATAFORMA, ' open ')).code).toBe('OPEN');
  });
});

describe('⭐ campanha', () => {
  const banner = { source: 'design', template_id: 'destaque', design: { layout: 'destaque', title: 'Turma nova', bg: '#0b0b0c', fg: '#ffffff', accent: '#d4f82e' } };

  it('publica banner + aviso, e o link do aviso nunca leva #', async () => {
    const r = await svc.publishPromoCampaign(PROF, {
      name: 'Clínica de sábado', message: 'Vagas abertas', audience: 'alunos_ativos', notify: true,
      banner, destination: { type: 'clinics' }, show_on_page: true, show_home: true, banner_until: '2026-10-10',
      visibility: 'alunos',
    }, ['ana', 'bia', 'ana'], professor, { today: '2026-09-26' });
    expect(r.sent).toBe(2);
    expect(r.link).toBe('/coaches/prof#professor-clinicas');
    const c = banco.get(`promo_campaigns/${r.id}`);
    expect(c).toMatchObject({
      issuer_type: 'coach', issuer_id: 'prof', show_home: true, show_on_page: true, banner_active: true,
      visibility: 'alunos', sent_count: 2, reach: { mode: 'brasil', state: '', city: '' },
    });
    const aviso = notifyUsers.mock.calls[0][1];
    expect(aviso.link).toBe(`/campanhas/${r.id}`);
    expect(aviso.link).not.toContain('#');
  });

  it('público vazio não envia', async () => {
    await expect(svc.publishPromoCampaign(PLATAFORMA, { name: 'X', message: 'Y', notify: true }, [], admin))
      .rejects.toThrow(/ninguém/);
    expect(notifyUsers).not.toHaveBeenCalled();
  });

  it('a plataforma não aponta para destino de professor', async () => {
    const r = await svc.publishPromoCampaign(PLATAFORMA, {
      name: 'X', notify: false, banner, destination: { type: 'book_lesson' },
    }, [], admin, { today: '2026-09-26' });
    expect(banco.get(`promo_campaigns/${r.id}`).destination.type).toBe('details');
  });

  it('editar o banner não reenvia o aviso, e pausar tira do ar', async () => {
    const r = await svc.publishPromoCampaign(PLATAFORMA, {
      name: 'X', message: 'Y', notify: true, banner, destination: { type: 'ranking' },
    }, ['ana'], admin, { today: '2026-09-26' });
    notifyUsers.mockClear();
    await svc.updatePromoCampaign(r.id, { banner_active: false, reach: { mode: 'estado', state: 'RS' } }, admin, { today: '2026-09-26' });
    expect(banco.get(`promo_campaigns/${r.id}`)).toMatchObject({ banner_active: false, reach: { mode: 'estado', state: 'RS' } });
    expect(notifyUsers).not.toHaveBeenCalled();
  });
});

describe('⭐ o cupom do pedido de aula, na confirmação', () => {
  async function preparar({ usadoPor = [] } = {}) {
    banco.set('coaches/prof', { display_name: 'Prof. Ana', hourly_rate: 100 });
    const id = await svc.createPromoCoupon(PROF, { code: 'AULA10', value: 10 }, professor);
    if (usadoPor.length) banco.set(`promo_coupons/${id}`, { ...banco.get(`promo_coupons/${id}`), used_by: usadoPor });
    const aula = {
      id: 'l1', coach_id: 'prof', student_id: 'ana', status: 'requested', price: null,
      slots: [{ date: '2026-09-30', start: '18:00', end: '19:30' }],
      coupon: { coupon_id: id, code: 'AULA10', status: 'pending' },
    };
    banco.set('coach_lessons/l1', aula);
    return { id, aula };
  }

  it('aplica o desconto, grava o valor já descontado e conta o uso', async () => {
    const { id, aula } = await preparar();
    await respondLesson(aula, 'confirmed', professor);
    const gravada = banco.get('coach_lessons/l1');
    expect(gravada.status).toBe('confirmed');
    expect(gravada.price).toBe(135);
    expect(gravada.coupon).toMatchObject({ status: 'applied', discount_value: 15, original_price: 150 });
    expect(banco.get(`promo_coupons/${id}`)).toMatchObject({ used_count: 1, used_by: ['ana'] });
    expect(notifyUsers.mock.calls.at(-1)[1].message).toContain('Cupom AULA10 aplicado');
  });

  it('⭐ cupom já usado por este aluno: recusado com o motivo, e a aula é confirmada', async () => {
    const { id, aula } = await preparar({ usadoPor: ['ana'] });
    await respondLesson(aula, 'confirmed', professor);
    const gravada = banco.get('coach_lessons/l1');
    expect(gravada.status).toBe('confirmed');
    expect(gravada.coupon).toMatchObject({ status: 'rejected', reason: 'Você já usou este cupom.' });
    expect(gravada.price).toBeNull();
    expect(banco.get(`promo_coupons/${id}`).used_count).toBe(0);
  });

  it('recusar a aula não mexe no cupom', async () => {
    const { id, aula } = await preparar();
    await respondLesson(aula, 'declined', professor);
    expect(banco.get('coach_lessons/l1').coupon.status).toBe('pending');
    expect(banco.get(`promo_coupons/${id}`).used_count).toBe(0);
  });
});
