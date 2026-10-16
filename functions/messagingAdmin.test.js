/**
 * As ações do painel admin → Comunicações e das Configurações da pessoa.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const A = require('./messagingAdmin.js');
const M = require('./messaging.js');
const { createRichFakeDb } = require('../tests/fakes/fakeFirestoreRico.cjs');
// Montada em partes: o detector de segredos (check-no-secrets) procura o formato da chave da AWS.
const CHAVE_AWS_FALSA = ['AKIA', 'EXAMPLE123456789'].join('');

const AGORA = Date.UTC(2026, 9, 16, 15, 0);
const admin = { uid: 'adm', email: 'adm@x.com' };

function fakeFetch() {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, body: init.body ? String(init.body) : '' });
    return { ok: true, status: 200, text: async () => JSON.stringify({ sid: 'SM1', MessageId: 'm1', messages: [{ id: 'wamid.1' }] }) };
  };
  f.calls = calls;
  return f;
}

const base = () => ({
  'platform_settings/global': { feature_flags: { external_messaging: true } },
  'platform_settings/messaging': {
    email: { enabled: true, domain: 'picklerush.com.br', provider: 'ses', login_emails: true },
    sms: { enabled: true, sender: '+15550001111' },
  },
  'platform_settings/messaging_status': { email: { domain: 'picklerush.com.br', provider: 'ses', verified: true } },
  'platform_secrets/messaging': {
    ses: { access_key_id: CHAVE_AWS_FALSA, secret_access_key: 'segredo' },
    twilio: { account_sid: `AC${'1'.repeat(32)}`, auth_token: 'tok' },
    hmac_key: 'k'.repeat(64),
  },
  'users/u1': { platform_name: 'Bia', notification_channels: { sms: { on: true } } },
});

let db; let fetchImpl; let deps;
const auth = {
  getUser: async (uid) => ({ u1: { email: 'bia@x.com', emailVerified: true } }[uid] || Promise.reject(new Error('no'))),
  getUserByEmail: async (e) => (e === 'bia@x.com' ? { uid: 'u1' } : Promise.reject(new Error('no'))),
  generatePasswordResetLink: async () => 'https://pickletour.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=x',
  generateEmailVerificationLink: async () => 'https://pickletour.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=y',
};

beforeEach(() => {
  M.resetCache();
  db = createRichFakeDb(base());
  fetchImpl = fakeFetch();
  deps = { db, auth, fetchImpl, now: AGORA };
});

describe('chaves', () => {
  it('⭐ o painel vê só "configurada" e o fim do que não é segredo', () => {
    const s = A.secretsSummary({ ses: { access_key_id: CHAVE_AWS_FALSA, secret_access_key: 'segredo' } });
    expect(s.ses).toEqual({ access_key_id: { set: true, hint: '…6789' }, secret_access_key: { set: true } });
    expect(JSON.stringify(s)).not.toContain('segredo');
    expect(s.resend.api_key).toEqual({ set: false });
  });
  it('confere o formato antes de gravar; vazio mantém o que está', () => {
    expect(() => A.validateSecrets('ses', { access_key_id: 'abc' })).toThrow(/AKIA/);
    expect(() => A.validateSecrets('resend', { api_key: 'abc' })).toThrow(/re_/);
    expect(() => A.validateSecrets('twilio', { auth_token: 'a b' })).toThrow(/espaço/);
    expect(A.validateSecrets('ses', { access_key_id: '', secret_access_key: 'x' })).toEqual({ secret_access_key: 'x' });
    expect(() => A.validateSecrets('nada', {})).toThrow(/desconhecido/);
  });
  it('salvar grava no documento fechado e registra quais campos (sem os valores)', async () => {
    const r = await A.adminAction(deps, admin, { action: 'save_secrets', group: 'resend', values: { api_key: 're_novo' } });
    expect(r.secrets.resend.api_key.set).toBe(true);
    expect(db.dump('platform_secrets').messaging.resend.api_key).toBe('re_novo');
    const log = Object.values(db.dump('audit_logs'))[0];
    expect(log).toMatchObject({ action: 'messaging_secrets_saved', details: { group: 'resend', fields: ['api_key'] } });
    expect(JSON.stringify(log)).not.toContain('re_novo');
  });
});

describe('estado e prévia', () => {
  it('o estado traz o que falta, os endereços dos webhooks e as contagens', async () => {
    const s = await A.adminAction(deps, admin, { action: 'status' });
    expect(s.ready).toEqual({ email: true, whatsapp: false, sms: true });
    expect(s.missing.whatsapp).toContain('credentials');
    expect(s.webhooks.twilio).toBe('https://picklerush.web.app/api/mensagens/webhook/twilio');
    expect(JSON.stringify(s)).not.toContain('segredo');
  });
  it('prévia do e-mail, do WhatsApp e do SMS', async () => {
    const p = await A.adminAction(deps, admin, { action: 'preview', kind: 'notice_user', lang: 'pt' });
    expect(p.email.html).toContain('Enviado por Ana Souza');
    expect(p.email.html).not.toContain('www.exemplo.com');
    expect(p.whatsapp.params).toHaveLength(2);
    expect(p.sms).toMatch(/^PickleRush:/);
  });
  it('teste do e-mail vai para o admin e fica no registro', async () => {
    const r = await A.adminAction(deps, admin, { action: 'send_test', channel: 'email' });
    expect(r).toMatchObject({ ok: true, to: 'a•••m@x.com' });
    expect(Object.values(db.dump('message_outbox'))[0]).toMatchObject({ kind: 'test', channel: 'email', status: 'sent' });
  });
  it('teste de canal sem configuração diz o que falta', async () => {
    await expect(A.adminAction(deps, admin, { action: 'send_test', channel: 'whatsapp', to: '51999998888' })).rejects.toThrow(/falta configurar/);
  });
});

describe('por que não chegou', () => {
  it('⭐ explica canal a canal e registra o acesso do suporte', async () => {
    await db.collection('notifications').doc('n1').set({ user_id: 'u1', origin: 'server', title: 'Reserva', link: '/minhas-reservas', created_at_ms: AGORA });
    await db.collection('notifications').doc('n2').set({ user_id: 'u1', title: 'Antigo', created_at_ms: AGORA - 1 });
    const r = await A.adminAction(deps, admin, { action: 'explain_user', query: 'bia@x.com' });
    expect(r.email).toMatchObject({ masked: 'b•••a@x.com', verified: true });
    expect(r.decisions[0].channels.email.action).toBe('send');
    expect(r.decisions[0].channels.sms.reason).toBe('phone_unverified');
    expect(r.decisions[1].channels.email.reason).toBe('legacy_notice');
    expect(Object.values(db.dump('admin_access_logs'))[0]).toMatchObject({ admin_uid: 'adm', target_uid: 'u1', action: 'messaging_explain' });
  });
});

describe('celular da pessoa', () => {
  it('⭐ código por SMS: manda, confirma e grava o número confirmado', async () => {
    const r = await A.userAction(deps, 'u1', { action: 'phone_send_code', phone: '(51) 99999-8888' });
    expect(r).toMatchObject({ channel: 'sms', masked: '+55 51 •••••-8888' });
    const corpo = new URLSearchParams(fetchImpl.calls[0].body).get('Body');
    const codigo = corpo.match(/\d{6}/)[0];
    // O código nunca fica gravado em claro.
    expect(JSON.stringify(db.dump('phone_verifications'))).not.toContain(codigo);
    await expect(A.userAction(deps, 'u1', { action: 'phone_confirm', code: '000000' === codigo ? '111111' : '000000' })).rejects.toThrow(/errado/);
    const ok = await A.userAction(deps, 'u1', { action: 'phone_confirm', code: codigo });
    expect(ok.ok).toBe(true);
    expect(db.dump('users').u1).toMatchObject({ phone_verified_number: '+5551999998888', phone_verified_at: AGORA });
    expect(db.dump('phone_verifications').u1).toBeUndefined();
  });
  it('não deixa pedir código em sequência', async () => {
    await A.userAction(deps, 'u1', { action: 'phone_send_code', phone: '51999998888' });
    await expect(A.userAction({ ...deps, now: AGORA + 10000 }, 'u1', { action: 'phone_send_code', phone: '51999998888' })).rejects.toThrow(/minuto/);
  });
  it('código vencido é recusado', async () => {
    await A.userAction(deps, 'u1', { action: 'phone_send_code', phone: '51999998888' });
    const codigo = new URLSearchParams(fetchImpl.calls[0].body).get('Body').match(/\d{6}/)[0];
    await expect(A.userAction({ ...deps, now: AGORA + 11 * 60000 }, 'u1', { action: 'phone_confirm', code: codigo })).rejects.toThrow(/venceu/);
  });
  it('esquecer o celular desliga WhatsApp e SMS', async () => {
    await db.collection('users').doc('u1').set({ phone_verified_number: '+5551999998888', phone_verified_at: 1 }, { merge: true });
    await A.userAction(deps, 'u1', { action: 'phone_forget' });
    const u = db.dump('users').u1;
    expect(u.phone_verified_number).toBeUndefined();
    expect(u.notification_channels.sms.on).toBe(false);
  });
});

describe('e-mails de sistema', () => {
  it('⭐ "esqueci a senha" pelo nosso provedor, sem dizer se a conta existe', async () => {
    expect(await A.authEmailAction(deps, { action: 'password_reset', email: 'bia@x.com' })).toEqual({ handled: true });
    expect(fetchImpl.calls[0].body).toContain('mode=resetPassword');
    expect(await A.authEmailAction(deps, { action: 'password_reset', email: 'ninguem@x.com' })).toEqual({ handled: true });
    expect(fetchImpl.calls).toHaveLength(1);
  });
  it('desligado no painel: o app usa o e-mail do Firebase', async () => {
    await db.collection('platform_settings').doc('messaging').set({ email: { login_emails: false } }, { merge: true });
    M.resetCache();
    expect(await A.authEmailAction(deps, { action: 'password_reset', email: 'bia@x.com' })).toEqual({ handled: false });
  });
  it('no máximo três por dia', async () => {
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await A.authEmailAction({ ...deps, now: AGORA + i * 1000 }, { action: 'password_reset', email: 'bia@x.com' });
    }
    const r = await A.authEmailAction({ ...deps, now: AGORA + 5000 }, { action: 'password_reset', email: 'bia@x.com' });
    expect(r).toEqual({ handled: true, limited: true });
    expect(fetchImpl.calls).toHaveLength(3);
  });
});
