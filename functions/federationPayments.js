/**
 * PIX COM BAIXA AUTOMÁTICA da federação (rodada 3, Bloco 6a, `docs/50` §43).
 *
 * Sem chave configurada, nada muda: o Pix estático da chave da federação e o
 * "Já paguei" que o financeiro confirma. Com a chave de um provedor (Mercado
 * Pago ou Asaas) — da CONTA DA FEDERAÇÃO, o dinheiro vai direto para ela —:
 *
 *  - `pix` (quem paga): cria (ou reaproveita) a cobrança Pix no provedor e
 *    grava em `federation_charges.gateway` só o necessário (provedor, id,
 *    copia e cola, validade) — o QR a tela desenha do copia e cola;
 *  - o AVISO do provedor chega em `/api/federacao/pix/{fed}/{token}`
 *    (`hook`): o servidor NÃO confia no corpo — busca o pagamento no provedor
 *    com a chave da federação e só dá baixa se ele está pago, aponta para esta
 *    cobrança e cobre o valor. A baixa é a MESMA do financeiro
 *    (`fecharCobranca`, ator `gateway`): filiação ativa, curso, multa, chancela;
 *  - `check` (quem paga ou o financeiro): a mesma conferência sob pedido, para
 *    quando o aviso do provedor não chegou;
 *  - `gateway_save`/`gateway_off`/`gateway_status` (financeiro): a chave mora
 *    em `federation_secrets/{fed}` (nenhuma regra: o navegador não lê nem
 *    grava, nem o admin) e a tela vê só "configurada …1234". O sinal público
 *    `federations.payment_gateway` (em `fedLocked()`) diz à tela que há baixa
 *    automática.
 *
 * O Asaas exige o CPF de quem paga: sem ele (a federação não pede CPF, curso de
 * quem não é filiado), a cobrança cai no Pix estático de sempre.
 */
const crypto = require('node:crypto');
const F = require('./federations.js');

const { C, falha, texto, auditoria, flagLigada, federacao, exigePerm } = F;
const SECRETS = 'federation_secrets';
const ORIGIN = 'https://picklerush.web.app';
const PROVIDERS = Object.freeze(['mercadopago', 'asaas']);
const PIX_TTL_MS = 24 * 3600 * 1000;
const REUSE_MARGIN_MS = 10 * 60 * 1000;
/** O ator da baixa automática (vai para `confirmed_by` e para a auditoria). */
const GATEWAY_ACTOR = Object.freeze({ uid: 'gateway', name: 'Pix automático', email: '' });

const hookUrl = (fedId, token) => `${ORIGIN}/api/federacao/pix/${fedId}/${token}`;
const cents = (v) => Math.round(Number(v || 0) * 100);
const isoBR = (ms) => new Date(ms - 3 * 3600 * 1000).toISOString().slice(0, 23) + '-03:00';
const dataBR = (ms) => new Date(ms - 3 * 3600 * 1000).toISOString().slice(0, 10);

class ProviderError extends Error {}

async function pedir(fetchImpl, url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetchImpl(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text();
  let json = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { json = null; }
  if (!res.ok) throw new ProviderError(`HTTP ${res.status}${json && (json.message || (json.errors && json.errors[0] && json.errors[0].description)) ? `: ${json.message || json.errors[0].description}` : ''}`);
  return json || {};
}

/* ----------------------------------------------------------- provedores -- */

const mercadopago = {
  base: 'https://api.mercadopago.com',
  auth: (s) => ({ Authorization: `Bearer ${s.mercadopago.access_token}` }),
  async test(f, s) { await pedir(f, `${this.base}/users/me`, { headers: this.auth(s) }); },
  async create(f, s, { charge, payer, now, fedId, token }) {
    const r = await pedir(f, `${this.base}/v1/payments`, {
      method: 'POST',
      headers: { ...this.auth(s), 'X-Idempotency-Key': `${charge.id}-${now}` },
      body: {
        transaction_amount: charge.amount_cents / 100,
        description: String(charge.plan_name || 'Cobrança da federação').slice(0, 120),
        payment_method_id: 'pix',
        external_reference: charge.id,
        notification_url: hookUrl(fedId, token),
        date_of_expiration: isoBR(now + PIX_TTL_MS),
        payer: { email: payer.email, first_name: String(payer.name || '').split(' ')[0] || undefined },
      },
    });
    const td = (r.point_of_interaction && r.point_of_interaction.transaction_data) || {};
    if (!r.id || !td.qr_code) throw new ProviderError('O Mercado Pago não devolveu o código Pix.');
    return { id: String(r.id), payload: td.qr_code, expires_at_ms: now + PIX_TTL_MS };
  },
  async get(f, s, id) {
    const r = await pedir(f, `${this.base}/v1/payments/${encodeURIComponent(id)}`, { headers: this.auth(s) });
    return { id: String(r.id), paid: r.status === 'approved', amount_cents: cents(r.transaction_amount), reference: String(r.external_reference || '') };
  },
  /** `?type=payment&data.id=1`, `{ type: 'payment', data: { id } }` ou o antigo `?topic=payment&id=1`. */
  paymentIdFrom(body = {}, query = {}) {
    const tipo = body.type || query.type || query.topic || '';
    if (tipo && tipo !== 'payment') return '';
    return String((body.data && body.data.id) || query['data.id'] || (query.data && query.data.id) || query.id || '');
  },
};

const asaas = {
  base: (s) => (s.asaas.sandbox ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3'),
  auth: (s) => ({ access_token: s.asaas.api_key, 'User-Agent': 'PickleRush' }),
  async test(f, s) { await pedir(f, `${this.base(s)}/finance/balance`, { headers: this.auth(s) }); },
  async create(f, s, { charge, payer, now }) {
    if (!payer.cpf) return null;
    const h = this.auth(s);
    const achados = await pedir(f, `${this.base(s)}/customers?externalReference=${encodeURIComponent(charge.payer_uid)}`, { headers: h });
    let cliente = achados.data && achados.data[0] && achados.data[0].id;
    if (!cliente) {
      const novo = await pedir(f, `${this.base(s)}/customers`, {
        method: 'POST', headers: h,
        body: { name: payer.name || 'Pagador', cpfCnpj: payer.cpf, email: payer.email || undefined, externalReference: charge.payer_uid, notificationDisabled: true },
      });
      cliente = novo.id;
    }
    const pg = await pedir(f, `${this.base(s)}/payments`, {
      method: 'POST', headers: h,
      body: { customer: cliente, billingType: 'PIX', value: charge.amount_cents / 100, dueDate: dataBR(now + PIX_TTL_MS), description: String(charge.plan_name || 'Cobrança da federação').slice(0, 500), externalReference: charge.id },
    });
    const qr = await pedir(f, `${this.base(s)}/payments/${encodeURIComponent(pg.id)}/pixQrCode`, { headers: h });
    if (!pg.id || !qr.payload) throw new ProviderError('O Asaas não devolveu o código Pix.');
    // `expirationDate` vem "AAAA-MM-DD HH:MM:SS" no horário de Brasília.
    const exp = qr.expirationDate ? Date.parse(`${String(qr.expirationDate).replace(' ', 'T')}-03:00`) : NaN;
    return { id: String(pg.id), payload: qr.payload, expires_at_ms: Number.isFinite(exp) ? exp : now + PIX_TTL_MS };
  },
  async get(f, s, id) {
    const r = await pedir(f, `${this.base(s)}/payments/${encodeURIComponent(id)}`, { headers: this.auth(s) });
    return { id: String(r.id), paid: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(r.status), amount_cents: cents(r.value), reference: String(r.externalReference || '') };
  },
  paymentIdFrom(body = {}) {
    if (!/^PAYMENT_/.test(String(body.event || ''))) return '';
    return String((body.payment && body.payment.id) || '');
  },
  /** O aviso do Asaas é cadastrado pela API; falhando, a tela mostra o endereço para colar. */
  async registerHook(f, s, url) {
    await pedir(f, `${this.base(s)}/webhooks`, {
      method: 'POST', headers: this.auth(s),
      body: { name: 'PickleRush', url, enabled: true, interrupted: false, sendType: 'SEQUENTIALLY', events: ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'] },
    });
  },
};

const IMPL = { mercadopago, asaas };

/* --------------------------------------------------------------- regras -- */

/** Dá baixa? Só pago, desta cobrança, do pagamento gravado e cobrindo o valor. */
function paymentSettles(payment, charge) {
  if (!payment || !charge || !charge.gateway) return false;
  return payment.paid === true
    && payment.reference === charge.id
    && payment.id === String(charge.gateway.id)
    && payment.amount_cents >= Number(charge.amount_cents || 0);
}

/** O Pix gravado ainda serve (mesmo provedor, válido por mais 10 min)? */
function reusableGateway(charge, provider, now) {
  const g = charge && charge.gateway;
  return Boolean(g && g.provider === provider && g.payload && Number(g.expires_at_ms) > now + REUSE_MARGIN_MS);
}

function sameToken(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

function summary(secret) {
  if (!secret || !PROVIDERS.includes(secret.provider)) return { provider: '', enabled: false };
  const chave = secret.provider === 'asaas' ? secret.asaas.api_key : secret.mercadopago.access_token;
  return {
    provider: secret.provider, enabled: true, hint: chave ? `…${String(chave).slice(-4)}` : '',
    sandbox: secret.provider === 'asaas' ? Boolean(secret.asaas.sandbox) : String(chave || '').startsWith('TEST-'),
    webhook_url: secret.webhook_token ? hookUrl(secret.federation_id, secret.webhook_token) : '',
    webhook_auto: secret.provider === 'mercadopago' ? true : Boolean(secret.webhook_auto),
    updated_at_ms: secret.updated_at_ms || null,
  };
}

/* --------------------------------------------------------------- ações -- */

const fetchOf = (ctx) => ctx.fetchImpl || fetch;
const secretRef = (ctx, fedId) => ctx.db.collection(SECRETS).doc(fedId);

async function segredo(ctx, fedId) {
  const s = await secretRef(ctx, fedId).get();
  const v = s.exists ? s.data() : null;
  return v && PROVIDERS.includes(v.provider) ? v : null;
}

async function gatewaySave(ctx, actor, fed, data) {
  const provider = String(data.provider || '');
  if (!PROVIDERS.includes(provider)) falha('invalid-argument', 'Escolha o Mercado Pago ou o Asaas.');
  const chave = texto(data.key, 400);
  if (chave.length < 16) falha('invalid-argument', 'Cole a chave completa do provedor.');
  const atual = await segredo(ctx, fed.id);
  const novo = {
    federation_id: fed.id, provider,
    mercadopago: { access_token: provider === 'mercadopago' ? chave : '' },
    asaas: { api_key: provider === 'asaas' ? chave : '', sandbox: provider === 'asaas' && data.sandbox === true },
    webhook_token: (atual && atual.webhook_token) || crypto.randomBytes(24).toString('hex'),
    webhook_auto: false, updated_at_ms: ctx.now, updated_by: actor.uid,
  };
  try {
    await IMPL[provider].test(fetchOf(ctx), novo);
  } catch (err) {
    falha('failed-precondition', `O provedor recusou a chave (${err.message}). Confira se é a chave de produção da conta da federação.`);
  }
  if (provider === 'asaas') {
    try { await asaas.registerHook(fetchOf(ctx), novo, hookUrl(fed.id, novo.webhook_token)); novo.webhook_auto = true; } catch (err) { ctx.logger && ctx.logger.warn && ctx.logger.warn('asaas webhook manual', { fed: fed.id, err: err.message }); }
  }
  const batch = ctx.db.batch();
  batch.set(secretRef(ctx, fed.id), novo);
  batch.update(ctx.db.collection(C.federations).doc(fed.id), { payment_gateway: { provider, enabled: true, since_ms: ctx.now } });
  await batch.commit();
  await auditoria(ctx, actor, 'federation_payment_gateway_save', { federation_id: fed.id, provider });
  return summary(novo);
}

async function gatewayOff(ctx, actor, fed) {
  const batch = ctx.db.batch();
  batch.delete(secretRef(ctx, fed.id));
  batch.update(ctx.db.collection(C.federations).doc(fed.id), { payment_gateway: { provider: '', enabled: false, off_at_ms: ctx.now } });
  await batch.commit();
  await auditoria(ctx, actor, 'federation_payment_gateway_off', { federation_id: fed.id });
  return { provider: '', enabled: false };
}

async function cobranca(ctx, chargeId) {
  const snap = await ctx.db.collection(C.charges).doc(texto(chargeId, 80)).get();
  if (!snap.exists) falha('not-found', 'Cobrança não encontrada.');
  return { snap, charge: { id: snap.id, ...snap.data() } };
}

async function pagador(ctx, actor, charge) {
  let cpf = '';
  if (charge.member_id) {
    const p = await ctx.db.collection(C.members).doc(charge.member_id).collection('private').doc('data').get();
    const mem = await ctx.db.collection(C.members).doc(charge.member_id).get();
    // CPF só o do PRÓPRIO filiado que paga (o de um dependente não é de quem paga).
    if (p.exists && mem.exists && mem.data().user_id === charge.payer_uid) cpf = String(p.data().cpf || '').replace(/\D/g, '');
  }
  return { name: charge.payer_name || actor.name || '', email: actor.email || '', cpf };
}

/** Confere no provedor e, pago, dá a baixa. Devolve `{ paid }`. */
async function conferir(ctx, fed, secret, snap, charge) {
  if (!charge.gateway || charge.gateway.provider !== secret.provider) return { paid: false };
  const pg = await IMPL[secret.provider].get(fetchOf(ctx), secret, charge.gateway.id);
  if (!paymentSettles(pg, charge)) return { paid: false };
  await F.fecharCobranca(ctx, GATEWAY_ACTOR, { fed, snap, charge, action: 'confirm', note: `Pix confirmado pelo ${secret.provider === 'asaas' ? 'Asaas' : 'Mercado Pago'}` });
  return { paid: true };
}

async function pix(ctx, actor, data) {
  const { snap, charge } = await cobranca(ctx, data.chargeId);
  if (charge.payer_uid !== actor.uid) falha('permission-denied', 'Só quem paga gera o Pix desta cobrança.');
  if (!['open', 'declared'].includes(charge.status) || !(charge.amount_cents > 0)) return { mode: 'static' };
  const fed = await federacao(ctx, charge.federation_id);
  const secret = await segredo(ctx, fed.id);
  if (!secret) return { mode: 'static' };
  if (reusableGateway(charge, secret.provider, ctx.now)) return { mode: 'gateway', provider: secret.provider, payload: charge.gateway.payload, expires_at_ms: charge.gateway.expires_at_ms };
  try {
    // Um Pix anterior que venceu pode ter sido pago no último minuto: confere antes de gerar outro.
    if (charge.gateway && (await conferir(ctx, fed, secret, snap, charge)).paid) return { mode: 'paid' };
    const novo = await IMPL[secret.provider].create(fetchOf(ctx), secret, { charge, payer: await pagador(ctx, actor, charge), now: ctx.now, fedId: fed.id, token: secret.webhook_token });
    if (!novo) return { mode: 'static', reason: 'cpf' };
    const gateway = { provider: secret.provider, id: novo.id, payload: novo.payload, expires_at_ms: novo.expires_at_ms, created_at_ms: ctx.now };
    await snap.ref.update({ gateway });
    return { mode: 'gateway', provider: secret.provider, payload: gateway.payload, expires_at_ms: gateway.expires_at_ms };
  } catch (err) {
    if (err instanceof F.FederationError) throw err;
    // Provedor fora do ar: o Pix estático continua valendo (o financeiro confirma como sempre).
    ctx.logger && ctx.logger.warn && ctx.logger.warn('federation pix gateway falhou', { charge: charge.id, err: err.message });
    return { mode: 'static', reason: 'provider' };
  }
}

async function check(ctx, actor, data) {
  const { snap, charge } = await cobranca(ctx, data.chargeId);
  const fed = await federacao(ctx, charge.federation_id);
  if (charge.payer_uid !== actor.uid) await exigePerm(ctx, fed.id, actor, 'finance');
  if (charge.status === 'paid') return { paid: true };
  if (!['open', 'declared'].includes(charge.status)) return { paid: false };
  const secret = await segredo(ctx, fed.id);
  if (!secret) return { paid: false };
  try {
    return await conferir(ctx, fed, secret, snap, charge);
  } catch (err) {
    if (err instanceof F.FederationError) throw err;
    falha('unavailable', 'Não deu para conferir com o provedor agora. Tente de novo em instantes.');
  }
  return { paid: false };
}

async function payments(ctx, actor, data) {
  if (!(await flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  if (data.action === 'pix') return pix(ctx, actor, data);
  if (data.action === 'check') return check(ctx, actor, data);
  const fed = await federacao(ctx, texto(data.federationId, 80));
  // Quem vê a aba Recebimento: o financeiro e o admin da federação.
  const perms = await F.staffPerms(ctx, fed.id, actor);
  if (!perms.includes('finance') && !perms.includes('admin')) falha('permission-denied', 'Você não tem permissão para isso nesta federação.');
  if (data.action === 'gateway_status') return summary(await segredo(ctx, fed.id));
  if (data.action === 'gateway_save') return gatewaySave(ctx, actor, fed, data);
  if (data.action === 'gateway_off') return gatewayOff(ctx, actor, fed);
  return falha('invalid-argument', 'Ação desconhecida.');
}

/**
 * O aviso do provedor (HTTP, sem conta). Devolve o código HTTP: 200 para o
 * que foi tratado ou ignorado (o provedor para de repetir), 404 para endereço
 * que não existe e 500 para falha passageira (o provedor repete depois).
 */
async function hook(ctx, { fedId, token, body = {}, query = {} }) {
  const secret = await segredo(ctx, String(fedId || '').slice(0, 80));
  if (!secret || !sameToken(token, secret.webhook_token)) return 404;
  if (!(await flagLigada(ctx))) return 200;
  const impl = IMPL[secret.provider];
  const id = impl.paymentIdFrom(body || {}, query || {});
  if (!id) return 200;
  try {
    const pg = await impl.get(fetchOf(ctx), secret, id);
    if (!pg.paid || !pg.reference) return 200;
    const snap = await ctx.db.collection(C.charges).doc(pg.reference.slice(0, 80)).get();
    if (!snap.exists) return 200;
    const charge = { id: snap.id, ...snap.data() };
    if (charge.federation_id !== fedId || !['open', 'declared'].includes(charge.status) || !paymentSettles(pg, charge)) return 200;
    const fed = await federacao(ctx, fedId);
    await F.fecharCobranca(ctx, GATEWAY_ACTOR, { fed, snap, charge, action: 'confirm', note: `Pix confirmado pelo ${secret.provider === 'asaas' ? 'Asaas' : 'Mercado Pago'}` });
    return 200;
  } catch (err) {
    // Fechada no meio do caminho (o financeiro confirmou à mão): nada a fazer.
    if (err instanceof F.FederationError && err.code === 'failed-precondition') return 200;
    ctx.logger && ctx.logger.error && ctx.logger.error('federationPixHook falhou', { fed: fedId, err: err.message });
    return 500;
  }
}

module.exports = { payments, hook, paymentSettles, reusableGateway, summary, mercadopago, asaas, GATEWAY_ACTOR, SECRETS, PROVIDERS };
