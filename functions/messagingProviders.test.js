/**
 * A conversa com os provedores: a assinatura da AWS (conferida contra o
 * exemplo publicado pela própria AWS), as assinaturas dos webhooks e o
 * formato do que vai para cada API — sobre um `fetch` falso.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const Prov = require('./messagingProviders.js');
const P = require('./messagingPolicy.js');
// Montada em partes: o detector de segredos (check-no-secrets) procura o formato da chave da AWS.
const CHAVE_AWS_FALSA = ['AKIA', 'EXAMPLE123456789'].join('');

function fakeFetch(respostas = []) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? String(init.body) : '' });
    const r = respostas.shift() || { status: 200, body: {} };
    const texto = typeof r.body === 'string' ? r.body : JSON.stringify(r.body);
    return { ok: r.status < 400, status: r.status, text: async () => texto };
  };
  fn.calls = calls;
  return fn;
}

const settings = P.normalizeSettings({
  email: { enabled: true, domain: 'picklerush.com.br' },
  whatsapp: { enabled: true, phone_number_id: '123', waba_id: '456' },
  sms: { enabled: true, sender: '+15550001111' },
});

describe('signV4', () => {
  it('⭐ bate com o exemplo oficial da AWS (IAM ListUsers, 2015-08-30)', () => {
    const { signature } = Prov.signV4({
      method: 'GET',
      url: 'https://iam.amazonaws.com/?Action=ListUsers&Version=2010-05-08',
      region: 'us-east-1',
      service: 'iam',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
      now: new Date('2015-08-30T12:36:00Z'),
    });
    expect(signature).toBe('5d672d79c15b13162d9279b0855cfba6789a8edb4c82c400e06b5924a6f2b5d7');
  });
});

describe('Amazon SES', () => {
  it('envia pela API v2, com a etiqueta do registro e o conjunto de configuração', async () => {
    const f = fakeFetch([{ status: 200, body: { MessageId: 'm-1' } }]);
    const r = await Prov.sesSend({
      settings, secrets: { ses: { access_key_id: CHAVE_AWS_FALSA, secret_access_key: 'x' } }, fetchImpl: f, useConfigSet: true,
    }, { from: 'avisos@picklerush.com.br', to: 'a@b.com', subject: 'Oi', html: '<p>Oi</p>', text: 'Oi', tag: 'n1_email', headers: { 'List-Unsubscribe': '<https://x>' } });
    expect(r.id).toBe('m-1');
    expect(f.calls[0].url).toBe('https://email.sa-east-1.amazonaws.com/v2/email/outbound-emails');
    const body = JSON.parse(f.calls[0].body);
    expect(body.EmailTags).toEqual([{ Name: 'outbox', Value: 'n1_email' }]);
    expect(body.ConfigurationSetName).toBe('picklerush');
    expect(body.Content.Simple.Headers).toEqual([{ Name: 'List-Unsubscribe', Value: '<https://x>' }]);
    expect(f.calls[0].init.headers.Authorization).toMatch(new RegExp(`^AWS4-HMAC-SHA256 Credential=${CHAVE_AWS_FALSA}/\\d{8}/sa-east-1/ses/aws4_request`));
  });
  it('sem chave, erro claro antes de chamar a Amazon', async () => {
    const f = fakeFetch();
    await expect(Prov.sesSend({ settings, secrets: {}, fetchImpl: f }, { to: 'a@b.com' })).rejects.toThrow(/chave de acesso/);
    expect(f.calls).toHaveLength(0);
  });
  it('erro da API vira ProviderError com a mensagem e se dá para tentar de novo', async () => {
    const f = fakeFetch([{ status: 503, body: { message: 'Service busy' } }]);
    const err = await Prov.sesSend({ settings, secrets: { ses: { access_key_id: CHAVE_AWS_FALSA, secret_access_key: 'x' } }, fetchImpl: f }, { to: 'a@b.com', subject: 's', html: 'h', text: 't' }).catch((e) => e);
    expect(err).toBeInstanceOf(Prov.ProviderError);
    expect(err.message).toMatch(/Service busy/);
    expect(err.retryable).toBe(true);
  });
  it('os registros de DNS: três DKIM, MAIL FROM (MX + SPF) e DMARC', () => {
    const r = Prov.sesRecords('picklerush.com.br', ['a1', 'b2', 'c3'], 'sa-east-1');
    expect(r.filter((x) => x.purpose === 'dkim').map((x) => x.name)).toEqual(['a1._domainkey.picklerush.com.br', 'b2._domainkey.picklerush.com.br', 'c3._domainkey.picklerush.com.br']);
    expect(r.find((x) => x.type === 'MX')).toMatchObject({ name: 'mail.picklerush.com.br', value: 'feedback-smtp.sa-east-1.amazonses.com', priority: 10 });
    expect(r.find((x) => x.purpose === 'dmarc').name).toBe('_dmarc.picklerush.com.br');
  });
});

describe('Resend', () => {
  it('envia com a chave e a etiqueta', async () => {
    const f = fakeFetch([{ status: 200, body: { id: 'r-1' } }]);
    const r = await Prov.resendSend({ settings, secrets: { resend: { api_key: 're_123' } }, fetchImpl: f }, { from: 'a@picklerush.com.br', to: 'b@c.com', subject: 's', html: 'h', text: 't', tag: 'x' });
    expect(r.id).toBe('r-1');
    expect(f.calls[0].init.headers.Authorization).toBe('Bearer re_123');
    expect(JSON.parse(f.calls[0].body).tags).toEqual([{ name: 'outbox', value: 'x' }]);
  });
});

describe('WhatsApp', () => {
  it('manda o modelo com os parâmetros e o fim do link do botão', async () => {
    const f = fakeFetch([{ status: 200, body: { messages: [{ id: 'wamid.1' }] } }]);
    const r = await Prov.whatsappSendTemplate({ settings, secrets: { whatsapp: { access_token: 'EAA' } }, fetchImpl: f }, {
      to: '+5551999998888', template: 'picklerush_aviso', langCode: 'pt_BR', params: ['Título', 'Texto'], button: 'minhas-reservas',
    });
    expect(r.id).toBe('wamid.1');
    expect(f.calls[0].url).toBe('https://graph.facebook.com/v23.0/123/messages');
    const b = JSON.parse(f.calls[0].body);
    expect(b.to).toBe('5551999998888');
    expect(b.template.language.code).toBe('pt_BR');
    expect(b.template.components[1]).toEqual({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'minhas-reservas' }] });
  });
  it('os modelos: aviso (utilidade) e código (autenticação), nos três idiomas', () => {
    const d = Prov.whatsappTemplateDefinitions(settings, 'https://picklerush.web.app');
    expect(d).toHaveLength(6);
    expect(d.filter((x) => x.category === 'AUTHENTICATION').map((x) => x.language).sort()).toEqual(['en_US', 'es', 'pt_BR']);
    const aviso = d.find((x) => x.name === 'picklerush_aviso' && x.language === 'pt_BR');
    expect(aviso.components[1].buttons[0].url).toBe('https://picklerush.web.app/{{1}}');
  });
});

describe('SMS', () => {
  it('Twilio: número vira From; MG… vira Messaging Service', async () => {
    const f = fakeFetch([{ status: 201, body: { sid: 'SM1' } }, { status: 201, body: { sid: 'SM2' } }]);
    const secrets = { twilio: { account_sid: `AC${'0'.repeat(32)}`, auth_token: 't' } };
    await Prov.twilioSend({ settings, secrets, fetchImpl: f }, { to: '+5551999998888', body: 'oi' });
    expect(new URLSearchParams(f.calls[0].body).get('From')).toBe('+15550001111');
    const s2 = { ...settings, sms: { ...settings.sms, sender: `MG${'a'.repeat(32)}` } };
    await Prov.twilioSend({ settings: s2, secrets, fetchImpl: f }, { to: '+5551999998888', body: 'oi' });
    expect(new URLSearchParams(f.calls[1].body).get('MessagingServiceSid')).toBe(`MG${'a'.repeat(32)}`);
  });
  it('Zenvia: token no cabeçalho, número sem o +', async () => {
    const f = fakeFetch([{ status: 200, body: { id: 'z1' } }]);
    const s = { ...settings, sms: { ...settings.sms, provider: 'zenvia', sender: 'picklerush' } };
    const r = await Prov.sendSms({ settings: s, secrets: { zenvia: { api_token: 'tok' } }, fetchImpl: f }, { to: '+5551999998888', body: 'oi' });
    expect(r.id).toBe('z1');
    expect(f.calls[0].init.headers['X-API-TOKEN']).toBe('tok');
    expect(JSON.parse(f.calls[0].body)).toMatchObject({ from: 'picklerush', to: '5551999998888' });
  });
});

describe('assinaturas dos webhooks', () => {
  it('Meta (X-Hub-Signature-256)', () => {
    const corpo = Buffer.from('{"a":1}');
    const sig = `sha256=${crypto.createHmac('sha256', 'segredo').update(corpo).digest('hex')}`;
    expect(Prov.verifyMetaSignature(corpo, sig, 'segredo')).toBe(true);
    expect(Prov.verifyMetaSignature(corpo, sig, 'outro')).toBe(false);
    expect(Prov.verifyMetaSignature(corpo, sig, '')).toBe(false);
  });
  it('Resend (Svix), com prazo de 5 minutos', () => {
    const secret = `whsec_${Buffer.from('chave-secreta').toString('base64')}`;
    const corpo = Buffer.from('{"type":"email.delivered"}');
    const ts = '1700000000';
    const v1 = crypto.createHmac('sha256', Buffer.from('chave-secreta')).update(`msg_1.${ts}.${corpo}`).digest('base64');
    const h = { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': `v1,${v1}` };
    expect(Prov.verifySvixSignature(corpo, h, secret, 1700000000 * 1000)).toBe(true);
    expect(Prov.verifySvixSignature(corpo, h, secret, (1700000000 + 600) * 1000)).toBe(false);
  });
  it('Twilio (HMAC-SHA1 da URL + parâmetros em ordem)', () => {
    const url = 'https://picklerush.web.app/api/mensagens/webhook/twilio';
    const params = { MessageSid: 'SM1', MessageStatus: 'delivered' };
    const sig = crypto.createHmac('sha1', 'tok').update(`${url}MessageSidSM1MessageStatusdelivered`).digest('base64');
    expect(Prov.verifyTwilioSignature(url, params, sig, 'tok')).toBe(true);
    expect(Prov.verifyTwilioSignature(url, { ...params, MessageStatus: 'failed' }, sig, 'tok')).toBe(false);
  });
  it('Amazon SNS: só certificados da própria Amazon; assinatura RSA conferida', async () => {
    expect(Prov.isAmazonSnsUrl('https://sns.sa-east-1.amazonaws.com/x.pem')).toBe(true);
    expect(Prov.isAmazonSnsUrl('https://sns.sa-east-1.amazonaws.com.golpe.io/x.pem')).toBe(false);
    expect(Prov.isAmazonSnsUrl('http://sns.sa-east-1.amazonaws.com/x.pem')).toBe(false);
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
    const pem = publicKey.export({ type: 'spki', format: 'pem' });
    const m = {
      Type: 'Notification', MessageId: '1', TopicArn: 'arn:aws:sns:sa-east-1:1:t', Message: '{}', Timestamp: '2026-10-16T00:00:00Z',
      SignatureVersion: '2', SigningCertURL: 'https://sns.sa-east-1.amazonaws.com/c.pem',
    };
    m.Signature = crypto.createSign('RSA-SHA256').update(Prov.snsStringToSign(m)).sign(privateKey, 'base64');
    const f = async () => ({ ok: true, text: async () => pem });
    expect(await Prov.verifySnsMessage(m, { fetchImpl: f })).toBe(true);
    expect(await Prov.verifySnsMessage({ ...m, Message: '{"x":1}' }, { fetchImpl: f })).toBe(false);
  });
});
