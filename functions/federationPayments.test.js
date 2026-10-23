/**
 * Pix com baixa automática contra o Firestore falso e um provedor falso: sem
 * chave nada muda (Pix estático); o financeiro salva a chave (o provedor a
 * confere) e a tela vê só o fim dela; quem paga gera o Pix (reaproveitado
 * enquanto vale); o aviso do provedor só dá baixa conferindo o pagamento no
 * provedor — token errado, valor menor, outra cobrança ou não pago não mexem
 * em nada — e a baixa é a do financeiro (filiação ativa, carteirinha).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pay = require('./federationPayments.js');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0);
const ANA = { uid: 'ana', name: 'Ana Souza', email: 'ana@exemplo.com' };
const FIN = { uid: 'fin', name: 'Tesoureira' };
const ZE = { uid: 'ze' };
const CHAVE_MP = 'APP_USR-1234567890-abcdef-9999';

function cenario(extra = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', published: true, member_counter: 0, modules: {} },
    'federation_staff/fgp_fin': { federation_id: 'fgp', user_id: 'fin', role: 'custom', perms: ['finance'] },
    'federation_plans/anual': { federation_id: 'fgp', name: 'Atleta anual', person_type: 'athlete', tier: 'federated', billing: 'annual', price_cents: 5000, active: true },
    'users/ana': { full_name: 'Ana Souza', birth_date: '1990-05-01' },
    'federation_members/fgp_ana': { federation_id: 'fgp', user_id: 'ana', status: 'awaiting_payment', plan_id: 'anual', tier: 'federated', full_name: 'Ana Souza' },
    'federation_members/fgp_ana/private/data': { cpf: '52998224725' },
    'federation_charges/ch1': { federation_id: 'fgp', member_id: 'fgp_ana', payer_uid: 'ana', payer_name: 'Ana Souza', origin: 'membership', plan_id: 'anual', plan_name: 'Atleta anual', amount_cents: 5000, status: 'open', due_date: '2026-11-02' },
    ...extra,
  });
}

/** Provedor falso: responde por URL e guarda as chamadas. */
function provedor(pagamento = {}) {
  const chamadas = [];
  const f = async (url, opts = {}) => {
    chamadas.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers });
    let json = {};
    if (url.endsWith('/users/me') || url.endsWith('/finance/balance')) json = { id: 1 };
    else if (url.endsWith('/v1/payments')) json = { id: 777, status: 'pending', point_of_interaction: { transaction_data: { qr_code: '000201PIXMP' } } };
    else if (url.includes('/v1/payments/')) json = { id: 777, status: 'approved', transaction_amount: 50, external_reference: 'ch1', ...pagamento };
    else if (url.includes('/customers?')) json = { data: [] };
    else if (url.endsWith('/customers')) json = { id: 'cus_1' };
    else if (url.endsWith('/v3/payments')) json = { id: 'pay_1' };
    else if (url.endsWith('/pixQrCode')) json = { payload: '000201PIXASAAS', expirationDate: '2026-10-24 23:59:59' };
    else if (url.includes('/v3/payments/')) json = { id: 'pay_1', status: 'RECEIVED', value: 50, externalReference: 'ch1', ...pagamento };
    else if (url.endsWith('/webhooks')) json = { id: 'wh' };
    return { ok: true, status: 200, text: async () => JSON.stringify(json) };
  };
  f.chamadas = chamadas;
  return f;
}

const ctx = (db, fetchImpl, now = NOW) => ({ db, now, fetchImpl, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {}, error() {} } });
const doc = (db, path) => db.store.docs.get(path);
const salvar = (db, f, extra = {}) => pay.payments(ctx(db, f), FIN, { federationId: 'fgp', action: 'gateway_save', provider: 'mercadopago', key: CHAVE_MP, ...extra });

describe('sem chave: nada muda', () => {
  it('o Pix volta estático e o aviso não acha a federação', async () => {
    const db = cenario();
    const f = provedor();
    expect(await pay.payments(ctx(db, f), ANA, { action: 'pix', chargeId: 'ch1' })).toEqual({ mode: 'static' });
    expect(await pay.hook(ctx(db, f), { fedId: 'fgp', token: 'a'.repeat(48), body: { type: 'payment', data: { id: '777' } } })).toBe(404);
    expect(f.chamadas).toHaveLength(0);
  });
});

describe('configuração', () => {
  it('só o financeiro salva; o provedor confere a chave; a tela vê só o fim', async () => {
    const db = cenario();
    await expect(pay.payments(ctx(db, provedor()), ZE, { federationId: 'fgp', action: 'gateway_save', provider: 'mercadopago', key: CHAVE_MP })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await salvar(db, provedor());
    expect(r).toMatchObject({ provider: 'mercadopago', enabled: true, hint: '…9999', webhook_auto: true });
    expect(JSON.stringify(r)).not.toContain(CHAVE_MP);
    expect(doc(db, 'federations/fgp').payment_gateway).toMatchObject({ provider: 'mercadopago', enabled: true });
    expect(doc(db, 'federation_secrets/fgp').mercadopago.access_token).toBe(CHAVE_MP);
    expect(await pay.payments(ctx(db, provedor()), FIN, { federationId: 'fgp', action: 'gateway_status' })).toMatchObject({ hint: '…9999' });
  });

  it('chave recusada pelo provedor não é salva', async () => {
    const db = cenario();
    const ruim = async () => ({ ok: false, status: 401, text: async () => '{"message":"invalid token"}' });
    await expect(salvar(db, ruim)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(doc(db, 'federation_secrets/fgp')).toBeUndefined();
  });

  it('desligar apaga a chave e o sinal', async () => {
    const db = cenario();
    await salvar(db, provedor());
    await pay.payments(ctx(db, provedor()), FIN, { federationId: 'fgp', action: 'gateway_off' });
    expect(doc(db, 'federation_secrets/fgp')).toBeUndefined();
    expect(doc(db, 'federations/fgp').payment_gateway.enabled).toBe(false);
  });
});

describe('Pix e baixa automática (Mercado Pago)', () => {
  it('quem paga gera o Pix; outro não; o mesmo Pix é reaproveitado enquanto vale', async () => {
    const db = cenario();
    await salvar(db, provedor());
    const f = provedor();
    await expect(pay.payments(ctx(db, f), ZE, { action: 'pix', chargeId: 'ch1' })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await pay.payments(ctx(db, f), ANA, { action: 'pix', chargeId: 'ch1' });
    expect(r).toMatchObject({ mode: 'gateway', payload: '000201PIXMP' });
    const criado = f.chamadas.find((c) => c.method === 'POST');
    expect(criado.body).toMatchObject({ transaction_amount: 50, payment_method_id: 'pix', external_reference: 'ch1', payer: { email: 'ana@exemplo.com' } });
    expect(criado.body.notification_url).toMatch(/^https:\/\/picklerush\.web\.app\/api\/federacao\/pix\/fgp\/[a-f0-9]{48}$/);
    expect(doc(db, 'federation_charges/ch1').gateway).toMatchObject({ provider: 'mercadopago', id: '777' });
    const f2 = provedor();
    expect((await pay.payments(ctx(db, f2, NOW + 3600_000), ANA, { action: 'pix', chargeId: 'ch1' })).payload).toBe('000201PIXMP');
    expect(f2.chamadas).toHaveLength(0);
  });

  it('o aviso confere no provedor e dá a baixa do financeiro: filiação ativa', async () => {
    const db = cenario();
    await salvar(db, provedor());
    await pay.payments(ctx(db, provedor()), ANA, { action: 'pix', chargeId: 'ch1' });
    const token = doc(db, 'federation_secrets/fgp').webhook_token;
    expect(await pay.hook(ctx(db, provedor()), { fedId: 'fgp', token: 'b'.repeat(48), body: { type: 'payment', data: { id: '777' } } })).toBe(404);
    expect(await pay.hook(ctx(db, provedor()), { fedId: 'fgp', token, query: { type: 'payment', 'data.id': '777' } })).toBe(200);
    expect(doc(db, 'federation_charges/ch1')).toMatchObject({ status: 'paid', confirmed_by: 'gateway' });
    expect(doc(db, 'federation_members/fgp_ana').status).toBe('active');
    // Repetido: idempotente.
    expect(await pay.hook(ctx(db, provedor()), { fedId: 'fgp', token, body: { type: 'payment', data: { id: '777' } } })).toBe(200);
  });

  it('não pago, valor menor, outra cobrança ou outro pagamento: nada muda', async () => {
    for (const pagamento of [{ status: 'pending' }, { transaction_amount: 49.99 }, { external_reference: 'ch2' }, { id: 778 }]) {
      const db = cenario();
      await salvar(db, provedor());
      await pay.payments(ctx(db, provedor()), ANA, { action: 'pix', chargeId: 'ch1' });
      const token = doc(db, 'federation_secrets/fgp').webhook_token;
      expect(await pay.hook(ctx(db, provedor(pagamento)), { fedId: 'fgp', token, body: { type: 'payment', data: { id: '777' } } })).toBe(200);
      expect(doc(db, 'federation_charges/ch1').status).toBe('open');
    }
  });

  it('conferir agora (quando o aviso não chegou) dá a mesma baixa', async () => {
    const db = cenario();
    await salvar(db, provedor());
    await pay.payments(ctx(db, provedor()), ANA, { action: 'pix', chargeId: 'ch1' });
    expect(await pay.payments(ctx(db, provedor({ status: 'pending' })), ANA, { action: 'check', chargeId: 'ch1' })).toEqual({ paid: false });
    await expect(pay.payments(ctx(db, provedor()), ZE, { action: 'check', chargeId: 'ch1' })).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await pay.payments(ctx(db, provedor()), ANA, { action: 'check', chargeId: 'ch1' })).toEqual({ paid: true });
    expect(doc(db, 'federation_members/fgp_ana').status).toBe('active');
  });

  it('provedor fora do ar: volta o Pix estático', async () => {
    const db = cenario();
    await salvar(db, provedor());
    const fora = async () => ({ ok: false, status: 503, text: async () => '' });
    expect(await pay.payments(ctx(db, fora), ANA, { action: 'pix', chargeId: 'ch1' })).toMatchObject({ mode: 'static', reason: 'provider' });
  });
});

describe('Asaas', () => {
  it('com CPF: cliente, cobrança e QR; o aviso PAYMENT_RECEIVED dá baixa', async () => {
    const db = cenario();
    const f = provedor();
    const r = await salvar(db, f, { provider: 'asaas', key: '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwMDAwMDA6OiRhYWNoXzRlNTU', sandbox: true });
    expect(r).toMatchObject({ provider: 'asaas', sandbox: true, webhook_auto: true });
    expect(f.chamadas.some((c) => c.url.startsWith('https://api-sandbox.asaas.com/v3/webhooks'))).toBe(true);
    const p = provedor();
    expect(await pay.payments(ctx(db, p), ANA, { action: 'pix', chargeId: 'ch1' })).toMatchObject({ mode: 'gateway', payload: '000201PIXASAAS' });
    expect(p.chamadas.find((c) => c.url.endsWith('/customers')).body).toMatchObject({ cpfCnpj: '52998224725', externalReference: 'ana' });
    const token = doc(db, 'federation_secrets/fgp').webhook_token;
    expect(await pay.hook(ctx(db, provedor()), { fedId: 'fgp', token, body: { event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } } })).toBe(200);
    expect(doc(db, 'federation_charges/ch1').status).toBe('paid');
  });

  it('sem CPF: Pix estático', async () => {
    const db = cenario();
    db.store.docs.delete('federation_members/fgp_ana/private/data');
    await salvar(db, provedor(), { provider: 'asaas', key: '$aact_chave_longa_de_teste_123456' });
    expect(await pay.payments(ctx(db, provedor()), ANA, { action: 'pix', chargeId: 'ch1' })).toEqual({ mode: 'static', reason: 'cpf' });
  });
});

describe('regras puras', () => {
  it('reaproveita só o mesmo provedor com mais de 10 min de validade', () => {
    const c = { gateway: { provider: 'mercadopago', payload: 'x', expires_at_ms: NOW + 11 * 60_000 } };
    expect(pay.reusableGateway(c, 'mercadopago', NOW)).toBe(true);
    expect(pay.reusableGateway(c, 'asaas', NOW)).toBe(false);
    expect(pay.reusableGateway(c, 'mercadopago', NOW + 2 * 60_000)).toBe(false);
  });
  it('o id do aviso de cada provedor', () => {
    expect(pay.mercadopago.paymentIdFrom({ type: 'merchant_order', data: { id: 1 } })).toBe('');
    expect(pay.mercadopago.paymentIdFrom({}, { topic: 'payment', id: '9' })).toBe('9');
    expect(pay.asaas.paymentIdFrom({ event: 'SUBSCRIPTION_CREATED', payment: { id: 'x' } })).toBe('');
  });
});
