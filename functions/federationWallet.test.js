/**
 * Carteirinha no Apple Wallet e no Google Wallet contra o Firestore falso, com
 * credenciais geradas no teste (chave RSA da conta de serviço; certificado
 * autoassinado fazendo de Pass Type ID e de WWDR): sem credencial, nada; só o
 * titular pede os links; o objeto do Google leva a situação certa; o `.pkpass`
 * é um ZIP com o passe e a assinatura; o serviço web da Apple exige o token;
 * mudar a situação corrige o Google e avisa cada iPhone — e só ela.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const w = require('./federationWallet.js');
const forge = require('node-forge');
const { createFakeDb, FakeFieldValue } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 23, 15, 0, 0);
const ANA = { uid: 'ana', name: 'Ana' };
const ADMIN = { uid: 'root', name: 'Admin', isPlatformAdmin: true };

const googleKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
function certAutoassinado() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(NOW - 86400000);
  cert.validity.notAfter = new Date(NOW + 365 * 86400000);
  const attrs = [{ name: 'commonName', value: 'Pass Type ID: pass.br.teste' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert_pem: forge.pki.certificateToPem(cert), key_pem: forge.pki.privateKeyToPem(keys.privateKey) };
}
const apple = certAutoassinado();
const GOOGLE = { issuer_id: '3388000000012345678', client_email: 'carteira@projeto.iam.gserviceaccount.com', private_key: googleKey };
const APPLE = { pass_type_id: 'pass.br.teste', team_id: 'ABCDE12345', ...apple, wwdr_pem: apple.cert_pem };

function cenario({ secrets, member = {} } = {}) {
  const db = createFakeDb({
    'platform_settings/global': { feature_flags: { federations: true } },
    'federations/fgp': { name: 'Federação Gaúcha', acronym: 'FGP', slug: 'fgp', status: 'approved', branding: { color: '#fde047' } },
    'federation_members/fgp_ana': {
      federation_id: 'fgp', user_id: 'ana', status: 'active', user_name: 'Ana Souza', member_number: 'FGP-0007',
      valid_until: '2027-03-31', card_code: 'K7M2P9QX', plan_id: 'anual', ...member,
    },
    ...(secrets ? { 'platform_secrets/wallet': secrets } : {}),
  });
  return { db, now: NOW, FieldValue: FakeFieldValue, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { warn() {}, error() {} } };
}
const comChaves = () => cenario({ secrets: { google: GOOGLE, apple: APPLE, token_secret: 'a'.repeat(64) } });
const jwtPayload = (url) => JSON.parse(Buffer.from(url.split('/save/')[1].split('.')[1], 'base64url').toString('utf8'));

describe('carteira — links', () => {
  it('sem credencial, nenhum link (tudo como antes)', async () => {
    expect(await w.wallet(cenario(), ANA, { action: 'links', memberId: 'fgp_ana' })).toEqual({ google: null, apple: null });
  });

  it('só o titular (ou o responsável) pede', async () => {
    await expect(w.wallet(comChaves(), { uid: 'ze' }, { action: 'links', memberId: 'fgp_ana' })).rejects.toThrow(/titular/);
  });

  it('o Google recebe o objeto com a situação e o QR; a Apple, o link com token', async () => {
    const ctx = comChaves();
    const r = await w.wallet(ctx, ANA, { action: 'links', memberId: 'fgp_ana' });
    const obj = jwtPayload(r.google).payload.genericObjects[0];
    expect(obj.state).toBe('ACTIVE');
    expect(obj.barcode.value).toBe('https://picklerush.web.app/f/verificar/K7M2P9QX');
    expect(obj.header.defaultValue.value).toBe('Ana Souza');
    expect(r.apple).toBe(`https://picklerush.web.app/api/carteira/apple/pass/fgp_ana/${w.authToken({ token_secret: 'a'.repeat(64) }, 'fgp_ana')}`);
    expect(ctx.db.store.docs.get('federation_members/fgp_ana').wallet_google).toBe(true);
  });

  it('sem código de carteirinha (ainda não paga), nada', async () => {
    const ctx = cenario({ secrets: { google: GOOGLE, token_secret: 'x' }, member: { status: 'awaiting_payment', card_code: '' } });
    expect(await w.wallet(ctx, ANA, { action: 'links', memberId: 'fgp_ana' })).toEqual({ google: null, apple: null });
  });

  it('suspensa: INACTIVE no Google e anulada na Apple; tinta escura sobre amarelo', () => {
    const card = w.walletCard({ status: 'active', valid_until: '2027-03-31', card_code: 'X', discipline_until_ms: NOW + 1000 }, { branding: { color: '#fde047' } }, '2026-10-23', NOW);
    expect(card.status).toBe('suspended');
    expect(card.ink).toBe('#0f172a');
    expect(w.googleObject(card, GOOGLE, 'm1').state).toBe('INACTIVE');
    expect(w.applePassJson(card, APPLE, 'm1', 't').voided).toBe(true);
  });
});

describe('carteira — configuração', () => {
  it('só o admin da plataforma configura; a chave errada não entra', async () => {
    await expect(w.wallet(cenario(), ANA, { action: 'config_save', provider: 'google', ...GOOGLE })).rejects.toThrow(/admin/);
    await expect(w.wallet(cenario(), ADMIN, { action: 'config_save', provider: 'google', ...GOOGLE, private_key: 'x' })).rejects.toThrow(/chave privada/);
  });

  it('salva Google e Apple; o resumo não devolve chave; desligar apaga', async () => {
    const ctx = cenario();
    await w.wallet(ctx, ADMIN, { action: 'config_save', provider: 'google', ...GOOGLE });
    const r = await w.wallet(ctx, ADMIN, { action: 'config_save', provider: 'apple', ...APPLE });
    expect(r).toEqual({
      google: { enabled: true, issuer_id: GOOGLE.issuer_id, client_email: GOOGLE.client_email },
      apple: { enabled: true, pass_type_id: 'pass.br.teste', team_id: 'ABCDE12345' },
    });
    expect(JSON.stringify(r)).not.toMatch(/PRIVATE KEY/);
    expect(ctx.db.store.docs.get('platform_secrets/wallet').token_secret).toMatch(/^[a-f0-9]{64}$/);
    const off = await w.wallet(ctx, ADMIN, { action: 'config_save', provider: 'google_off' });
    expect(off.google).toEqual({ enabled: false });
    expect(off.apple.enabled).toBe(true);
  });
});

describe('carteira — Apple (passe e serviço web)', () => {
  const tok = () => w.authToken({ token_secret: 'a'.repeat(64) }, 'fgp_ana');

  it('o download exige o token e entrega um ZIP com passe, manifesto e assinatura', async () => {
    const ctx = comChaves();
    expect((await w.hook(ctx, { method: 'GET', path: `/api/carteira/apple/pass/fgp_ana/${'0'.repeat(40)}` })).status).toBe(404);
    const r = await w.hook(ctx, { method: 'GET', path: `/api/carteira/apple/pass/fgp_ana/${tok()}` });
    expect(r.status).toBe(200);
    expect(r.headers['Content-Type']).toBe('application/vnd.apple.pkpass');
    expect(r.body.readUInt32LE(0)).toBe(0x04034b50);
    const txt = r.body.toString('latin1');
    ['pass.json', 'manifest.json', 'signature', 'icon.png'].forEach((n) => expect(txt).toContain(n));
    const pass = JSON.parse(txt.slice(txt.indexOf('{"formatVersion"'), txt.indexOf('}PK') + 1));
    expect(pass.serialNumber).toBe('fgp_ana');
    expect(pass.barcodes[0].message).toBe('https://picklerush.web.app/f/verificar/K7M2P9QX');
  });

  it('registro do aparelho, lista do que mudou e remoção', async () => {
    const ctx = comChaves();
    const base = '/api/carteira/apple/v1/devices/dev1/registrations/pass.br.teste';
    const auth = { authorization: `ApplePass ${tok()}` };
    expect((await w.hook(ctx, { method: 'POST', path: `${base}/fgp_ana`, headers: { authorization: 'ApplePass errado' }, body: { pushToken: 'p1' } })).status).toBe(401);
    expect((await w.hook(ctx, { method: 'POST', path: `${base}/fgp_ana`, headers: auth, body: { pushToken: 'p1' } })).status).toBe(201);
    expect((await w.hook(ctx, { method: 'POST', path: `${base}/fgp_ana`, headers: auth, body: { pushToken: 'p1' } })).status).toBe(200);
    expect((await w.hook(ctx, { method: 'GET', path: base, query: {} })).status).toBe(204);
    ctx.db.store.docs.get('federation_members/fgp_ana').wallet_updated_ms = NOW;
    const lista = await w.hook(ctx, { method: 'GET', path: base, query: { passesUpdatedSince: String(NOW - 1) } });
    expect(JSON.parse(lista.body).serialNumbers).toEqual(['fgp_ana']);
    const passe = await w.hook(ctx, { method: 'GET', path: '/api/carteira/apple/v1/passes/pass.br.teste/fgp_ana', headers: auth });
    expect(passe.status).toBe(200);
    expect((await w.hook(ctx, { method: 'DELETE', path: `${base}/fgp_ana`, headers: auth })).status).toBe(200);
    expect([...ctx.db.store.docs.keys()].some((k) => k.startsWith(`${w.DEVICES}/`))).toBe(false);
  });

  it('sem credencial da Apple, o endereço não existe', async () => {
    expect((await w.hook(cenario(), { method: 'GET', path: '/api/carteira/apple/pass/fgp_ana/x' })).status).toBe(404);
  });
});

describe('carteira — atualização', () => {
  it('mudou a situação: corrige o Google e avisa cada iPhone; outro campo não dispara', async () => {
    const ctx = comChaves();
    ctx.db.store.docs.set(`${w.DEVICES}/d1`, { device: 'dev1', serial: 'fgp_ana', push_token: 'p1' });
    const chamadas = [];
    const fetchImpl = async (url, opts) => {
      chamadas.push([url, opts.method, opts.body]);
      if (url.includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 'tk' }) };
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const pushes = [];
    const push = async (_a, tokens) => { pushes.push(tokens); return tokens.length; };
    const antes = { ...ctx.db.store.docs.get('federation_members/fgp_ana'), wallet_google: true };
    const depois = { ...antes, status: 'suspended' };
    const r = await w.onMemberChange(ctx, antes, depois, 'fgp_ana', { fetchImpl, push });
    expect(r).toEqual({ google: true, apple: 1 });
    const patch = chamadas.find(([, m]) => m === 'PATCH');
    expect(JSON.parse(patch[2]).state).toBe('INACTIVE');
    expect(pushes).toEqual([['p1']]);
    expect(ctx.db.store.docs.get('federation_members/fgp_ana').wallet_updated_ms).toBe(NOW);
    expect(await w.onMemberChange(ctx, antes, { ...antes, notes: 'x' }, 'fgp_ana', { fetchImpl, push })).toEqual({ skipped: 'nada mudou' });
  });

  it('sem credencial, nada a fazer', async () => {
    expect(await w.onMemberChange(cenario(), { status: 'active' }, { status: 'suspended' }, 'fgp_ana')).toEqual({ skipped: 'sem carteira' });
  });
});
