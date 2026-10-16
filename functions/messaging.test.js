/**
 * O motor de entrega sobre um Firestore, um Auth e um `fetch` falsos: o que
 * sai na hora, o que espera, o resumo, os tetos, a lista de bloqueio, os
 * retornos dos provedores e as páginas de descadastro e denúncia.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const M = require('./messaging.js');
const { createRichFakeDb } = require('../tests/fakes/fakeFirestoreRico.cjs');
// Montada em partes: o detector de segredos (check-no-secrets) procura o formato da chave da AWS.
const CHAVE_AWS_FALSA = ['AKIA', 'EXAMPLE123456789'].join('');

// 12h e 23h em Brasília; 9h do dia seguinte.
const MEIO_DIA = Date.UTC(2026, 9, 16, 15, 0);
const NOITE = Date.UTC(2026, 9, 17, 2, 0);
const MANHA_SEGUINTE = Date.UTC(2026, 9, 17, 12, 0);

function fakeFetch(fn) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? String(init.body) : '' });
    const r = (fn && fn(url, init)) || { status: 200, body: { MessageId: `ses-${calls.length}`, messages: [{ id: `wamid.${calls.length}` }], sid: `SM${calls.length}` } };
    return { ok: r.status < 400, status: r.status, text: async () => JSON.stringify(r.body || {}) };
  };
  f.calls = calls;
  return f;
}

const fakeAuth = (users) => ({ getUser: async (uid) => { if (!users[uid]) throw new Error('no'); return users[uid]; } });

function seed(extra = {}) {
  return {
    'platform_settings/global': { feature_flags: { external_messaging: true } },
    'platform_settings/messaging': {
      email: { enabled: true, domain: 'picklerush.com.br', provider: 'ses' },
      whatsapp: { enabled: true, phone_number_id: '123', waba_id: '456' },
    },
    'platform_settings/messaging_status': {
      email: { domain: 'picklerush.com.br', provider: 'ses', verified: true },
      whatsapp: { templates: [{ name: 'picklerush_aviso', language: 'pt_BR', status: 'APPROVED' }] },
    },
    'platform_secrets/messaging': {
      ses: { access_key_id: CHAVE_AWS_FALSA, secret_access_key: 's' },
      whatsapp: { access_token: 'EAA', app_secret: 'app', verify_token: 'vt' },
      twilio: { account_sid: `AC${'0'.repeat(32)}`, auth_token: 'tok' },
      hmac_key: 'k'.repeat(64),
    },
    'users/u1': { platform_name: 'Bia', language: 'pt' },
    'users/u2': { platform_name: 'Caio', phone_verified_number: '+5551999998888', notification_channels: { whatsapp: { on: true } } },
    ...extra,
  };
}

let db; let fetchImpl; let deps;
const auth = fakeAuth({ u1: { email: 'bia@x.com', emailVerified: true }, u2: { email: 'caio@x.com', emailVerified: false } });
const outbox = () => db.dump('message_outbox');

beforeEach(() => {
  M.resetCache();
  db = createRichFakeDb(seed());
  fetchImpl = fakeFetch();
  deps = { db, auth, fetchImpl, now: MEIO_DIA, counters: { count: async (f, v) => Object.values(db.dump('message_outbox')).filter((d) => d[f] === v).length, monthCost: async () => 0 } };
});

describe('handleNotice', () => {
  it('flag desligada: nada sai e nada é gravado', async () => {
    db = createRichFakeDb(seed({ 'platform_settings/global': { feature_flags: {} } }));
    const r = await M.handleNotice({ ...deps, db }, 'n1', { user_id: 'u1', origin: 'server', title: 'Oi', link: '/minhas-reservas' });
    expect(r).toMatchObject({ handled: false, reason: 'flag_off' });
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('⭐ aviso do servidor sobre reserva sai por e-mail na hora e fica registrado', async () => {
    const r = await M.handleNotice(deps, 'n1', { user_id: 'u1', origin: 'server', title: 'Reserva confirmada', message: 'Sábado 18h', link: '/minhas-reservas' });
    expect(r.results.email).toBe('sent');
    expect(fetchImpl.calls[0].url).toContain('email.sa-east-1.amazonaws.com/v2/email/outbound-emails');
    const corpo = JSON.parse(fetchImpl.calls[0].body);
    expect(corpo.Destination.ToAddresses).toEqual(['bia@x.com']);
    expect(corpo.FromEmailAddress).toBe('"PickleRush" <avisos@picklerush.com.br>');
    const o = outbox().n1_email;
    expect(o).toMatchObject({ status: 'sent', provider: 'ses', counted: true, k_user: 'u1|2026-10-16|email', to_masked: 'b•••a@x.com' });
    // A Bia não tem celular confirmado: o WhatsApp nem é tentado.
    expect(r.results.whatsapp).toBe('phone_unverified');
  });

  it('⭐ o gatilho rodando duas vezes não manda duas vezes', async () => {
    const n = { user_id: 'u1', origin: 'server', title: 'Oi', link: '/minhas-reservas' };
    await M.handleNotice(deps, 'n1', n);
    const r = await M.handleNotice(deps, 'n1', n);
    expect(r.results.email).toBe('duplicate');
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it('⭐ aviso antigo (sem origem e sem remetente) não sai', async () => {
    const r = await M.handleNotice(deps, 'n1', { user_id: 'u1', title: 'Oi', link: '/minhas-reservas' });
    expect(r).toMatchObject({ handled: false, reason: 'legacy_notice' });
  });

  it('endereço na lista de bloqueio não recebe', async () => {
    await db.collection('message_suppressions').doc(M.suppressionId('email', 'bia@x.com')).set({ reason: 'complaint' });
    const r = await M.handleNotice(deps, 'n1', { user_id: 'u1', origin: 'server', title: 'Oi', link: '/minhas-reservas' });
    expect(r.results.email).toBe('suppressed');
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('⭐ teto por remetente: uma pessoa não dispara e-mails sem fim', async () => {
    const c = { count: async (f) => (f === 'k_pair' ? 5 : 0), monthCost: async () => 0 };
    const r = await M.handleNotice({ ...deps, counters: c }, 'n1', { user_id: 'u1', sent_by: 'u2', title: 'Oi', link: '/torneios' });
    expect(r.results.email).toBe('cap_pair');
    expect(outbox().n1_email.status).toBe('capped');
  });

  it('⭐ aviso em massa do admin: só pelos canais marcados, sem o teto por remetente', async () => {
    await db.collection('users').doc('adm').set({ role: 'platform_admin', platform_name: 'Admin' });
    const c = { count: async (f) => (f === 'k_sender' ? 9999 : f === 'k_pair' ? 99 : 0), monthCost: async () => 0 };
    const aviso = { user_id: 'u1', sent_by: 'adm', title: 'Manutenção', link: '/torneios', broadcast: { kind: 'servico', channels: ['email'] } };
    const r = await M.handleNotice({ ...deps, counters: c }, 'b1', aviso);
    expect(r.results.email).toBe('sent');
    const r2 = await M.handleNotice({ ...deps, counters: c }, 'b2', { ...aviso, broadcast: { kind: 'servico', channels: [] } });
    expect(r2.results.email).toBe('not_in_broadcast');
  });

  it('WhatsApp de quem confirmou o número e escolheu; à noite espera o fim do silêncio', async () => {
    const n = { user_id: 'u2', origin: 'server', title: 'Reserva confirmada', message: 'x', link: '/minhas-reservas' };
    await db.collection('notifications').doc('n2').set(n);
    const r = await M.handleNotice({ ...deps, now: NOITE }, 'n2', n);
    expect(r.results.whatsapp).toBe('delay');
    expect(outbox().n2_whatsapp).toMatchObject({ status: 'queued', reason: 'quiet_hours' });
    // O e-mail do Caio não foi confirmado.
    expect(r.results.email).toBe('email_unverified');
    const q = await M.processQueue({ ...deps, now: MANHA_SEGUINTE });
    expect(q.due).toBe(1);
    expect(outbox().n2_whatsapp).toMatchObject({ status: 'sent', provider: 'whatsapp', cost_brl: 0.035 });
    const b = JSON.parse(fetchImpl.calls[0].body);
    expect(b.template).toMatchObject({ name: 'picklerush_aviso', language: { code: 'pt_BR' } });
  });

  it('⭐ falha temporária do provedor tenta de novo depois', async () => {
    let primeira = true;
    const f = fakeFetch(() => { if (primeira) { primeira = false; return { status: 503, body: { message: 'ocupado' } }; } return null; });
    const n = { user_id: 'u1', origin: 'server', title: 'Oi', link: '/minhas-reservas' };
    await db.collection('notifications').doc('n1').set(n);
    const r = await M.handleNotice({ ...deps, fetchImpl: f }, 'n1', n);
    expect(r.results.email).toBe('retry');
    expect(outbox().n1_email).toMatchObject({ status: 'queued', reason: 'retry', attempts: 1 });
    await M.processQueue({ ...deps, fetchImpl: f, now: MEIO_DIA + 6 * 60000 });
    expect(outbox().n1_email.status).toBe('sent');
  });
});

describe('fila: mensagem de chat e resumo', () => {
  it('⭐ chat lido no app em 15 minutos não vira e-mail', async () => {
    await db.collection('notifications').doc('c1').set({ user_id: 'u1', sent_by: 'u2', type: 'chat_message', title: 'Nova mensagem', read: false });
    await M.handleNotice(deps, 'c1', (await db.collection('notifications').doc('c1').get()).data());
    expect(outbox().c1_email).toMatchObject({ status: 'queued', reason: 'wait_unread' });
    await db.collection('notifications').doc('c1').set({ read: true }, { merge: true });
    await M.processQueue({ ...deps, now: MEIO_DIA + 16 * 60000 });
    expect(outbox().c1_email).toMatchObject({ status: 'skipped', reason: 'read_in_app' });
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it('chat não lido vira e-mail depois da espera', async () => {
    await db.collection('notifications').doc('c1').set({ user_id: 'u1', sent_by: 'u2', type: 'chat_message', title: 'Nova mensagem', read: false });
    await M.handleNotice(deps, 'c1', (await db.collection('notifications').doc('c1').get()).data());
    await M.processQueue({ ...deps, now: MEIO_DIA + 16 * 60000 });
    expect(outbox().c1_email.status).toBe('sent');
    expect(JSON.parse(fetchImpl.calls[0].body).Content.Simple.Body.Html.Data).toContain('Enviado por Caio');
  });

  it('⭐ resumo diário: um e-mail só, de manhã, com o que não foi lido', async () => {
    for (const id of ['k1', 'k2', 'k3']) {
      // eslint-disable-next-line no-await-in-loop
      await db.collection('notifications').doc(id).set({ user_id: 'u1', origin: 'server', type: 'event_invite', title: `Evento ${id}`, read: id === 'k3' });
      // eslint-disable-next-line no-await-in-loop
      await M.handleNotice(deps, id, (await db.collection('notifications').doc(id).get()).data());
    }
    expect(outbox().k1_email.status).toBe('digest_daily');
    expect(fetchImpl.calls).toHaveLength(0);
    // 7h: ainda não é a hora do resumo (8h).
    await M.processQueue({ ...deps, now: Date.UTC(2026, 9, 17, 10, 0) });
    expect(fetchImpl.calls).toHaveLength(0);
    const q = await M.processQueue({ ...deps, now: MANHA_SEGUINTE });
    expect(q.digests).toBe(1);
    expect(fetchImpl.calls).toHaveLength(1);
    const html = JSON.parse(fetchImpl.calls[0].body).Content.Simple.Body.Html.Data;
    expect(html).toContain('Evento k1');
    expect(html).not.toContain('Evento k3');
    expect(outbox().k1_email.status).toBe('in_digest');
    expect(db.dump('platform_secrets').messaging_runtime.last_daily_day).toBe('2026-10-17');
    // Rodando de novo no mesmo dia, nada sai.
    await M.processQueue({ ...deps, now: MANHA_SEGUINTE + 600000 });
    expect(fetchImpl.calls).toHaveLength(1);
  });
});

describe('retornos dos provedores', () => {
  const req = (method, path, extra = {}) => ({ method, path, query: {}, headers: {}, get(k) { return this.headers[k.toLowerCase()]; }, ...extra });

  it('WhatsApp: confirmação do webhook pelo token', async () => {
    const r = await M.handleHttp(deps, req('GET', '/api/mensagens/webhook/whatsapp', { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'vt', 'hub.challenge': '42' } }));
    expect(r).toEqual({ code: 200, text: '42' });
    const ruim = await M.handleHttp(deps, req('GET', '/api/mensagens/webhook/whatsapp', { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'x' } }));
    expect(ruim.code).toBe(403);
  });

  it('⭐ WhatsApp: entrega atualiza o registro; PARAR desliga o canal da pessoa', async () => {
    await db.collection('message_outbox').doc('n9_whatsapp').set({ provider_id: 'wamid.9', status: 'sent' });
    const corpo = JSON.stringify({ entry: [{ changes: [{ value: {
      statuses: [{ id: 'wamid.9', status: 'delivered' }],
      messages: [{ from: '5551999998888', text: { body: 'PARAR' } }],
    } }] }] });
    const sig = `sha256=${crypto.createHmac('sha256', 'app').update(corpo).digest('hex')}`;
    const r = await M.handleHttp(deps, req('POST', '/api/mensagens/webhook/whatsapp', { rawBody: Buffer.from(corpo), headers: { 'x-hub-signature-256': sig } }));
    expect(r.code).toBe(200);
    expect(outbox().n9_whatsapp.status).toBe('delivered');
    expect(db.dump('users').u2.notification_channels.whatsapp.on).toBe(false);
    expect(db.dump('message_suppressions')[M.suppressionId('whatsapp', '+5551999998888')]).toMatchObject({ reason: 'stop' });
  });

  it('assinatura errada é recusada', async () => {
    const r = await M.handleHttp(deps, req('POST', '/api/mensagens/webhook/whatsapp', { rawBody: Buffer.from('{}'), headers: { 'x-hub-signature-256': 'sha256=00' } }));
    expect(r.code).toBe(403);
  });

  it('Twilio: status de entrega pela assinatura da URL pública', async () => {
    await db.collection('message_outbox').doc('n8_sms').set({ provider_id: 'SM8', status: 'sent' });
    const params = { MessageSid: 'SM8', MessageStatus: 'undelivered', ErrorCode: '30005' };
    const url = 'https://picklerush.web.app/api/mensagens/webhook/twilio';
    const sig = crypto.createHmac('sha1', 'tok').update(url + Object.keys(params).sort().map((k) => k + params[k]).join('')).digest('base64');
    const r = await M.handleHttp(deps, req('POST', '/api/mensagens/webhook/twilio', { body: params, headers: { 'x-twilio-signature': sig } }));
    expect(r.code).toBe(200);
    expect(outbox().n8_sms).toMatchObject({ status: 'failed', error: 'Twilio 30005' });
  });

  it('⭐ devolução definitiva e reclamação entram na lista de bloqueio', async () => {
    await db.collection('message_outbox').doc('n7_email').set({ status: 'sent', user_id: 'u1' });
    await M.applyEmailEvent(deps, { kind: 'complaint', outboxId: 'n7_email', recipients: ['bia@x.com'] }, MEIO_DIA);
    expect(outbox().n7_email).toMatchObject({ status: 'complained', k_issue: '2026-10|email|complaint' });
    // `user_ids`: é por ele que a exclusão de conta acha o registro.
    expect(db.dump('message_suppressions')[M.suppressionId('email', 'bia@x.com')]).toMatchObject({ reason: 'complaint', masked: 'b•••a@x.com', user_ids: ['u1'] });
    // "Entregue" depois não apaga a reclamação.
    await M.applyEmailEvent(deps, { kind: 'delivered', outboxId: 'n7_email' }, MEIO_DIA);
    expect(outbox().n7_email.status).toBe('complained');
  });

  it('SNS de outro tópico é recusado', async () => {
    const r = await M.handleHttp(deps, req('POST', '/api/mensagens/webhook/ses', { rawBody: Buffer.from(JSON.stringify({ TopicArn: 'arn:x' })) }));
    expect(r.code).toBe(403);
  });
});

describe('descadastro e denúncia', () => {
  const ctxKey = 'k'.repeat(64);
  const req = (method, path, t) => ({ method, path, query: { t }, headers: {}, get() { return undefined; } });

  it('⭐ o GET só mostra a página (leitor de e-mail abre link sozinho); o POST aplica', async () => {
    const t = M.signToken(ctxKey, { k: 'sair', u: 'u1', c: 'email', a: 'torneios', l: 'pt' });
    const g = await M.handleHttp(deps, req('GET', '/api/mensagens/sair', t));
    expect(g.code).toBe(200);
    expect(g.html).toContain('torneios');
    expect(g.html).toContain('<form method="post"');
    expect(db.dump('users').u1.notification_channels).toBeUndefined();
    const p = await M.handleHttp(deps, req('POST', '/api/mensagens/sair', t));
    expect(p.code).toBe(200);
    expect(db.dump('users').u1.notification_channels.email.areas.torneios).toBe('nao');
  });

  it('link adulterado não muda nada', async () => {
    const t = M.signToken(ctxKey, { k: 'sair', u: 'u1', a: 'all' });
    const r = await M.handleHttp(deps, req('POST', '/api/mensagens/sair', `${t.split('.')[0]}.xxxx`));
    expect(r.code).toBe(400);
    expect(db.dump('users').u1.notification_channels).toBeUndefined();
  });

  it('⭐ denunciar registra para o admin e bloqueia o remetente para quem denunciou', async () => {
    const t = M.signToken(ctxKey, { k: 'denuncia', u: 'u1', s: 'u2', n: 'n1', l: 'pt' });
    await M.handleHttp(deps, req('POST', '/api/mensagens/denunciar', t));
    const rep = Object.values(db.dump('message_reports'))[0];
    expect(rep).toMatchObject({ reporter_uid: 'u1', sender_uid: 'u2', notice_id: 'n1', status: 'open' });
    expect(db.dump('users').u1.notification_channels.blocked_senders).toEqual(['u2']);
  });
});

describe('o que falta para cada canal', () => {
  it('sem nada configurado, a lista diz o que fazer', async () => {
    db = createRichFakeDb({});
    const ctx = await M.loadContext(db, { fresh: true });
    expect(M.missing(ctx)).toEqual({
      email: ['disabled', 'domain', 'credentials'],
      whatsapp: ['disabled', 'ids', 'credentials', 'templates'],
      sms: ['disabled', 'sender', 'credentials'],
    });
  });
});
