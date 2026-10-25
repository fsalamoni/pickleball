/**
 * Associação do clube — o ciclo no SERVIDOR contra o Firestore falso: a flag
 * barra, o pedido nasce pendente e avisa a secretaria, aprovar plano pago gera
 * a cobrança, só o financeiro confirma, confirmar dá número, código e o acesso
 * de membro, a verificação pública devolve o mínimo, suspender gira o código,
 * a adoção só vale em plano gratuito e a varredura vence e avisa.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ca = require('./clubAssociation.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 25, 15, 0, 0); // 2026-10-25 12:00 em Brasília
const ctx = (db, now = NOW) => ({ db, now, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const ANA = { uid: 'ana' };
const PRES = { uid: 'pres' };
const SEC = { uid: 'sec' };
const TES = { uid: 'tes' };
const ZE = { uid: 'ze' };

function cenario({ flag = true, publicado = true } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: flag } },
    'clubs/c1': { name: 'Clube Pickle Sul', city: 'Porto Alegre', member_count: 1, association: { enabled: true, published: publicado } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_tes': { club_id: 'c1', user_id: 'tes', role: 'member' },
    'club_members/c1_sec': { club_id: 'c1', user_id: 'sec', role: 'member' },
    'club_x/c1/staff/tes': { user_id: 'tes', perms: ['finance'], term_end_ms: 0 },
    'club_x/c1/staff/sec': { user_id: 'sec', perms: ['members'], term_end_ms: 0 },
    'club_x/c1/plans/anual': { club_id: 'c1', name: 'Sócio', price_cents: 12000, billing: 'annual', active: true, public: true },
    'club_x/c1/plans/mensal': { club_id: 'c1', name: 'Mensal', price_cents: 3000, billing: 'monthly', active: true, public: true },
    'club_x/c1/plans/livre': { club_id: 'c1', name: 'Amigo', price_cents: 0, billing: 'annual', active: true, public: true },
    'club_x/c1/plans/auto': { club_id: 'c1', name: 'Direto', price_cents: 0, billing: 'annual', active: true, auto_approve: true },
    'club_x/c1/plans/jovem': { club_id: 'c1', name: 'Jovem', price_cents: 0, billing: 'annual', active: true, age_max: 17 },
    'club_x/c1/cfg/pix': { pix_key: 'clube@pix.com', receiver_name: 'Clube Pickle Sul' },
    'users/ana': { full_name: 'Ana Souza', birth_date: '1990-05-01', photo_url: 'https://x/ana.png' },
    'users/ze': { full_name: 'Zé', birth_date: '1990-05-01' },
  });
}
const doc = (db, path) => db.store.docs.get(path);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);
const assoc = (db, actor, data, now) => ca.association(ctx(db, now), actor, { clubId: 'c1', ...data });
const cobrancas = (db) => [...db.store.docs.entries()].filter(([p]) => p.startsWith('club_x/c1/charges/'));

describe('associação do clube no servidor', () => {
  it('com a flag desligada nada se filia', async () => {
    const db = cenario({ flag: false });
    await expect(assoc(db, ANA, { action: 'request', planId: 'anual' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('clube que não abriu ao público não recebe pedidos', async () => {
    const db = cenario({ publicado: false });
    await expect(assoc(db, ANA, { action: 'request', planId: 'anual' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('o pedido nasce pendente e avisa a secretaria (e quem administra)', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'anual' });
    expect(doc(db, 'club_x/c1/aff/ana')).toMatchObject({ status: 'pending', plan_id: 'anual', user_name: 'Ana Souza' });
    expect(avisosPara(db, 'sec')).toHaveLength(1);
    expect(avisosPara(db, 'pres')).toHaveLength(1);
    expect(avisosPara(db, 'tes')).toHaveLength(0);
  });

  it('não pede duas vezes enquanto a filiação está viva', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'anual' });
    await expect(assoc(db, ANA, { action: 'request', planId: 'livre' })).rejects.toMatchObject({ code: 'already-exists' });
  });

  it('plano por faixa de idade recusa quem está fora dela', async () => {
    const db = cenario();
    await expect(assoc(db, ANA, { action: 'request', planId: 'jovem' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('aprovar plano gratuito ativa na hora: número, código, validade vazia e acesso de membro', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'livre' });
    await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    const a = doc(db, 'club_x/c1/aff/ana');
    expect(a.status).toBe('active');
    expect(a.member_number).toBe('SUL-2026-000001');
    expect(a.valid_until).toBe('');
    expect(doc(db, `club_card_index/${a.card_code}`)).toMatchObject({ club_id: 'c1', user_id: 'ana' });
    expect(doc(db, 'club_members/c1_ana')).toMatchObject({ role: 'member', user_id: 'ana' });
    expect(doc(db, 'clubs/c1').member_count).toBe(2);
    expect(avisosPara(db, 'ana')).toHaveLength(1);
  });

  it('quem já é membro não vira membro de novo (contador intacto)', async () => {
    const db = cenario();
    db.store.docs.set('club_members/c1_ana', { club_id: 'c1', user_id: 'ana', role: 'member' });
    await assoc(db, ANA, { action: 'request', planId: 'livre' });
    await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    expect(doc(db, 'clubs/c1').member_count).toBe(1);
  });

  it('plano de aprovação automática ativa no pedido', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'auto' });
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('active');
  });

  it('aprovar plano pago gera a cobrança com o Pix do clube e espera o pagamento', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'anual' });
    const r = await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('awaiting_payment');
    const c = doc(db, `club_x/c1/charges/${r.chargeId}`);
    expect(c).toMatchObject({ status: 'open', amount_cents: 12000, user_id: 'ana', origin: 'membership' });
    expect(c.payment.pix_key).toBe('clube@pix.com');
  });

  it('só quem tem a permissão decide: o financeiro não aprova, o estranho não confirma', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'anual' });
    await expect(assoc(db, TES, { action: 'approve', userId: 'ana' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(assoc(db, ZE, { action: 'approve', userId: 'ana' })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await assoc(db, PRES, { action: 'approve', userId: 'ana' });
    await expect(assoc(db, SEC, { action: 'charge_confirm', chargeId: r.chargeId, decision: 'confirm' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('recusar exige motivo e avisa; a pessoa pode pedir de novo', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'anual' });
    await expect(assoc(db, SEC, { action: 'reject', userId: 'ana' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await assoc(db, SEC, { action: 'reject', userId: 'ana', reason: 'Documento incompleto' });
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('rejected');
    await assoc(db, ANA, { action: 'request', planId: 'anual' });
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('pending');
  });

  it('o pagamento: declarar avisa o financeiro, confirmar ativa com validade de um ano e fecha a cobrança', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'anual' });
    const { chargeId } = await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    await expect(assoc(db, ZE, { action: 'declare', chargeId })).rejects.toMatchObject({ code: 'permission-denied' });
    await assoc(db, ANA, { action: 'declare', chargeId });
    expect(doc(db, `club_x/c1/charges/${chargeId}`).status).toBe('declared');
    expect(avisosPara(db, 'tes')).toHaveLength(1);
    await assoc(db, TES, { action: 'charge_confirm', chargeId, decision: 'confirm' });
    const a = doc(db, 'club_x/c1/aff/ana');
    expect(a).toMatchObject({ status: 'active', valid_from: '2026-10-25', valid_until: '2027-10-25' });
    expect(doc(db, `club_x/c1/charges/${chargeId}`)).toMatchObject({ status: 'paid', confirmed_by: 'tes' });
    expect(doc(db, 'club_members/c1_ana')).toBeTruthy();
    await expect(assoc(db, TES, { action: 'charge_confirm', chargeId, decision: 'confirm' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('cancelar a cobrança de uma filiação nova devolve o pedido para a análise', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'anual' });
    const { chargeId } = await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    await assoc(db, TES, { action: 'charge_confirm', chargeId, decision: 'cancel', note: 'Valor errado' });
    expect(doc(db, `club_x/c1/charges/${chargeId}`).status).toBe('cancelled');
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('pending');
  });

  it('a mensalidade vale um mês', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'mensal' });
    const { chargeId } = await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    await assoc(db, TES, { action: 'charge_confirm', chargeId, decision: 'confirm' });
    expect(doc(db, 'club_x/c1/aff/ana').valid_until).toBe('2026-11-25');
  });

  it('a verificação pública devolve o mínimo e não carrega nada de contato', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'livre' });
    await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    const code = doc(db, 'club_x/c1/aff/ana').card_code;
    const v = await ca.verify(ctx(db), { code: code.toLowerCase() });
    expect(v).toMatchObject({ found: true, name: 'Ana Souza', status: 'active', club: { id: 'c1', name: 'Clube Pickle Sul' } });
    expect(Object.keys(v)).not.toContain('user_id');
    expect(await ca.verify(ctx(db), { code: 'XXXXXXXXXX' })).toEqual({ found: false });
  });

  it('suspender gira o código (o antigo deixa de verificar) e reintegrar volta ao estado anterior', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'livre' });
    await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    const antigo = doc(db, 'club_x/c1/aff/ana').card_code;
    await expect(assoc(db, SEC, { action: 'suspend', userId: 'ana' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await assoc(db, SEC, { action: 'suspend', userId: 'ana', reason: 'Conduta' });
    const a = doc(db, 'club_x/c1/aff/ana');
    expect(a.status).toBe('suspended');
    expect(a.card_code).not.toBe(antigo);
    expect((await ca.verify(ctx(db), { code: antigo })).found).toBe(false);
    expect((await ca.verify(ctx(db), { code: a.card_code })).status).toBe('suspended');
    await assoc(db, SEC, { action: 'reinstate', userId: 'ana' });
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('active');
  });

  it('sair do clube encerra a filiação e tira o acesso; o único administrador não sai', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'livre' });
    await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    await assoc(db, ANA, { action: 'leave' });
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('cancelled');
    expect(doc(db, 'club_members/c1_ana')).toBeUndefined();
    expect(doc(db, 'clubs/c1').member_count).toBe(1);
    await expect(assoc(db, PRES, { action: 'leave' })).rejects.toBeTruthy();
  });

  it('a secretaria filia direto: gratuito ativa; pago "já pago" ativa e registra a entrada', async () => {
    const db = cenario();
    await assoc(db, SEC, { action: 'grant', userId: 'ana', planId: 'livre' });
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('active');
    const db2 = cenario();
    const r = await assoc(db2, SEC, { action: 'grant', userId: 'ze', planId: 'anual', paid: true });
    expect(doc(db2, 'club_x/c1/aff/ze').status).toBe('active');
    expect(doc(db2, `club_x/c1/charges/${r.chargeId}`)).toMatchObject({ status: 'paid', amount_cents: 12000 });
  });

  it('adotar os membros existentes só vale em plano gratuito e pula quem já tem filiação', async () => {
    const db = cenario();
    db.store.docs.set('club_members/c1_m1', { club_id: 'c1', user_id: 'm1', user_name: 'M1', role: 'member' });
    db.store.docs.set('club_members/c1_m2', { club_id: 'c1', user_id: 'm2', user_name: 'M2', role: 'member' });
    await expect(assoc(db, SEC, { action: 'adopt', planId: 'anual' })).rejects.toMatchObject({ code: 'failed-precondition' });
    const r = await assoc(db, SEC, { action: 'adopt', planId: 'livre' });
    expect(r).toMatchObject({ adopted: 5, remaining: 0 });
    expect(doc(db, 'club_x/c1/aff/m1')).toMatchObject({ status: 'active', adopted: true });
    expect(doc(db, 'club_x/c1/aff/pres')).toBeTruthy();
    const r2 = await assoc(db, SEC, { action: 'adopt', planId: 'livre' });
    expect(r2.adopted).toBe(0);
    const numeros = ['m1', 'm2', 'pres'].map((u) => doc(db, `club_x/c1/aff/${u}`).member_number);
    expect(new Set(numeros).size).toBe(3);
  });

  it('a renovação abre 30 dias antes e gera a cobrança; confirmar estende a partir do vencimento', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'anual' });
    const { chargeId } = await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    await assoc(db, TES, { action: 'charge_confirm', chargeId, decision: 'confirm' });
    await expect(assoc(db, ANA, { action: 'renew' })).rejects.toMatchObject({ code: 'failed-precondition' });
    const perto = Date.UTC(2027, 9, 1, 15);
    const r = await assoc(db, ANA, { action: 'renew' }, perto);
    expect(doc(db, `club_x/c1/charges/${r.chargeId}`)).toMatchObject({ origin: 'renewal', status: 'open' });
    await expect(assoc(db, ANA, { action: 'renew' }, perto)).rejects.toMatchObject({ code: 'already-exists' });
    await assoc(db, TES, { action: 'charge_confirm', chargeId: r.chargeId, decision: 'confirm' }, perto);
    expect(doc(db, 'club_x/c1/aff/ana').valid_until).toBe('2028-10-25');
  });
});

describe('varredura diária', () => {
  async function ativa(db, planId) {
    await assoc(db, ANA, { action: 'request', planId });
    const { chargeId } = await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    await assoc(db, TES, { action: 'charge_confirm', chargeId, decision: 'confirm' });
  }

  it('vence quem venceu e avisa uma vez só os prazos', async () => {
    const db = cenario();
    await ativa(db, 'anual'); // vale até 2027-10-25
    const antes = avisosPara(db, 'ana').length;
    const aos20 = Date.UTC(2027, 9, 5, 15);
    await ca.sweep(ctx(db, aos20));
    expect(avisosPara(db, 'ana')).toHaveLength(antes + 1);
    await ca.sweep(ctx(db, aos20));
    expect(avisosPara(db, 'ana')).toHaveLength(antes + 1);
    const depois = Date.UTC(2027, 9, 27, 15);
    const r = await ca.sweep(ctx(db, depois));
    expect(r.vencidas).toBe(1);
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('expired');
  });

  it('plano gratuito nunca vence', async () => {
    const db = cenario();
    await assoc(db, ANA, { action: 'request', planId: 'livre' });
    await assoc(db, SEC, { action: 'approve', userId: 'ana' });
    await ca.sweep(ctx(db, Date.UTC(2030, 0, 1, 15)));
    expect(doc(db, 'club_x/c1/aff/ana').status).toBe('active');
  });

  it('a mensalidade seguinte já espera a pessoa, uma só', async () => {
    const db = cenario();
    await ativa(db, 'mensal'); // vale até 2026-11-25
    const perto = Date.UTC(2026, 10, 20, 15);
    const r = await ca.sweep(ctx(db, perto));
    expect(r.novas).toBe(1);
    await ca.sweep(ctx(db, perto));
    expect(cobrancas(db).filter(([, c]) => c.origin === 'renewal')).toHaveLength(1);
  });

  it('sem a flag não faz nada', async () => {
    const db = cenario({ flag: false });
    expect(await ca.sweep(ctx(db))).toEqual({ skipped: 'flag' });
  });
});
