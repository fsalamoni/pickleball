/**
 * CARTEIRINHA NO APPLE WALLET E NO GOOGLE WALLET (rodada 3, Bloco 6b,
 * `docs/50` §44).
 *
 * Sem credencial configurada, nada muda: a carteirinha digital da plataforma
 * segue igual e os botões de carteira não aparecem. O admin da plataforma
 * configura em Painel admin → Federações (credenciais da PLATAFORMA — um
 * emissor no Google, um Pass Type ID na Apple); elas moram em
 * `platform_secrets/wallet` (nem o admin lê de volta: a tela vê só o fim).
 *
 *  - `links` (o titular ou o responsável do dependente): o link "Salvar no
 *    Google Wallet" (JWT assinado com a conta de serviço, o objeto vai dentro)
 *    e o de baixar o `.pkpass` (assinado com o certificado do Pass Type ID);
 *  - a carteirinha na carteira SE ATUALIZA: quando muda a situação, a
 *    validade, o código ou o plano da filiação (`onMemberChange`), o objeto do
 *    Google é corrigido pela API e cada iPhone que guardou o passe recebe o
 *    aviso (APNs) e busca a versão nova pelo serviço web da Apple
 *    (`/api/carteira/apple/v1/...`, `hook`). Suspensa: "Suspensa" e anulada
 *    (`voided`/`INACTIVE`); vencida: expirada pela própria data.
 *
 * O passe leva só o que a carteirinha já mostra: nome, número, validade,
 * situação e o QR da verificação pública (`/f/verificar/{código}`).
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const m = require('./federationMembership.js');
const F = require('./federations.js');

const { C, falha, texto, auditoria } = F;
const ORIGIN = 'https://picklerush.web.app';
const SECRET_DOC = ['platform_secrets', 'wallet'];
const DEVICES = 'federation_wallet_devices';
const APPLE_BASE = '/api/carteira/apple';
const ICON = path.join(__dirname, 'assets', 'wallet-icon.png');
/** Mudou um destes campos, a carteirinha na carteira precisa ser refeita. */
const WATCHED = Object.freeze(['status', 'valid_until', 'card_code', 'plan_id', 'member_number', 'user_name', 'discipline_until_ms']);
const BAND = Object.freeze({ active: 'Em dia', expired: 'Vencida', suspended: 'Suspensa' });

/* ------------------------------------------------------------ cartão -- */

const DEFAULT_COLOR = '#0f172a';
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : DEFAULT_COLOR);
const rgbParts = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Tinta legível sobre a cor (luminância relativa da WCAG, o mesmo critério do `readableInk`). */
function inkFor(h) {
  const lin = rgbParts(h).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? '#ffffff' : '#0f172a';
}
const rgb = (h) => `rgb(${rgbParts(h).join(', ')})`;
const dataCurta = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

/** O que vai na carteira — a mesma conta de situação da carteirinha (`membershipState`). */
function walletCard(member, fed, hoje, nowMs) {
  const st = m.membershipState(member, hoje, nowMs);
  const color = hex(fed && fed.branding && fed.branding.color);
  const code = String((member && member.card_code) || '');
  return {
    status: st.status,
    hasCard: Boolean(code) && ['active', 'expired', 'suspended'].includes(st.status),
    fedName: (fed && fed.name) || 'Federação', acronym: (fed && fed.acronym) || '',
    logo: (fed && fed.branding && /^https:\/\//.test(String(fed.branding.logo_url || ''))) ? fed.branding.logo_url : `${ORIGIN}/icones/app-claro-192-v1.png`,
    color, ink: inkFor(color),
    name: (member && member.user_name) || 'Atleta',
    number: (member && member.member_number) || '—',
    validUntil: String((member && member.valid_until) || ''),
    validLabel: dataCurta(member && member.valid_until),
    band: BAND[st.status] || 'Sem validade',
    code,
    verifyUrl: code ? `${ORIGIN}/f/verificar/${encodeURIComponent(code)}` : '',
  };
}

/* ------------------------------------------------------------ Google -- */

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function jwtRS256(claims, privateKey) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}
const lv = (value) => ({ defaultValue: { language: 'pt-BR', value: String(value || '—') } });
const googleClassId = (g) => `${g.issuer_id}.picklerush_federacao`;
const googleObjectId = (g, memberId) => `${g.issuer_id}.fed_${String(memberId).replace(/[^\w.-]/g, '_')}`;

function googleObject(card, g, memberId) {
  const state = card.status === 'active' ? 'ACTIVE' : (card.status === 'expired' ? 'EXPIRED' : 'INACTIVE');
  return {
    id: googleObjectId(g, memberId),
    classId: googleClassId(g),
    state,
    cardTitle: lv(card.acronym || card.fedName),
    subheader: lv('Filiado'),
    header: lv(card.name),
    hexBackgroundColor: card.color,
    logo: { sourceUri: { uri: card.logo } },
    textModulesData: [
      { id: 'numero', header: 'Nº', body: card.number },
      { id: 'validade', header: 'Validade', body: card.validLabel },
      { id: 'situacao', header: 'Situação', body: card.band },
    ],
    ...(card.verifyUrl ? { barcode: { type: 'QR_CODE', value: card.verifyUrl, alternateText: card.code } } : {}),
    ...(card.validUntil ? { validTimeInterval: { end: { date: `${card.validUntil}T23:59:59-03:00` } } } : {}),
  };
}

function googleSaveUrl(card, g, memberId, nowMs) {
  const jwt = jwtRS256({
    iss: g.client_email, aud: 'google', typ: 'savetowallet', iat: Math.floor(nowMs / 1000), origins: [ORIGIN],
    payload: { genericClasses: [{ id: googleClassId(g) }], genericObjects: [googleObject(card, g, memberId)] },
  }, g.private_key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

async function googleToken(fetchImpl, g, nowMs) {
  const iat = Math.floor(nowMs / 1000);
  const assertion = jwtRS256({ iss: g.client_email, scope: 'https://www.googleapis.com/auth/wallet_object.issuer', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }, g.private_key);
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Google OAuth HTTP ${res.status}`);
  return json.access_token;
}

/** Corrige o objeto no Google. 404 = a pessoa nunca salvou: nada a fazer. */
async function googlePatch(fetchImpl, g, card, memberId, nowMs) {
  const token = await googleToken(fetchImpl, g, nowMs);
  const obj = googleObject(card, g, memberId);
  const res = await fetchImpl(`https://walletobjects.googleapis.com/walletobjects/v1/genericObject/${encodeURIComponent(obj.id)}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(obj),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Google Wallet HTTP ${res.status}`);
  return res.status !== 404;
}

/* ------------------------------------------------------------- Apple -- */

/** Um ZIP sem compressão (o `.pkpass`): cabeçalhos locais, diretório central e fim. */
function zipStore(files) {
  const partes = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of Object.entries(files)) {
    const nome = Buffer.from(name, 'utf8');
    const crc = zlib.crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nome.length, 26); local.writeUInt16LE(0, 28);
    partes.push(local, nome, data);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0, 8); cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0x21, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nome.length, 28); cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    central.push(cd, nome);
    offset += 30 + nome.length + data.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
  end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...partes, cdBuf, end]);
}

/** A assinatura PKCS#7 destacada do `manifest.json` (certificado do Pass Type ID + WWDR). */
function signManifest(manifest, a, nowMs) {
  const forge = require('node-forge');
  const cert = forge.pki.certificateFromPem(a.cert_pem);
  const key = a.key_passphrase ? forge.pki.decryptRsaPrivateKey(a.key_pem, a.key_passphrase) : forge.pki.privateKeyFromPem(a.key_pem);
  if (!key) throw new Error('Chave do certificado da Apple inválida.');
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString('binary'));
  p7.addCertificate(cert);
  p7.addCertificate(forge.pki.certificateFromPem(a.wwdr_pem));
  p7.addSigner({
    key, certificate: cert, digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date(nowMs) },
    ],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

const authToken = (cfg, memberId) => crypto.createHmac('sha256', cfg.token_secret).update(String(memberId)).digest('hex').slice(0, 40);

function applePassJson(card, a, memberId, token) {
  return {
    formatVersion: 1,
    passTypeIdentifier: a.pass_type_id, teamIdentifier: a.team_id, serialNumber: memberId,
    organizationName: card.fedName, description: `Carteirinha ${card.acronym || card.fedName}`,
    authenticationToken: token, webServiceURL: `${ORIGIN}${APPLE_BASE}`,
    backgroundColor: rgb(card.color), foregroundColor: rgb(card.ink), labelColor: rgb(card.ink),
    logoText: card.acronym || card.fedName,
    generic: {
      primaryFields: [{ key: 'nome', label: 'FILIADO', value: card.name }],
      secondaryFields: [{ key: 'numero', label: 'Nº', value: card.number }, { key: 'validade', label: 'VALIDADE', value: card.validLabel }],
      auxiliaryFields: [{ key: 'situacao', label: 'SITUAÇÃO', value: card.band, changeMessage: 'Situação da filiação: %@' }],
      backFields: [{ key: 'verificar', label: 'Verificar a filiação', value: card.verifyUrl || '—' }],
    },
    ...(card.verifyUrl ? { barcodes: [{ format: 'PKBarcodeFormatQR', message: card.verifyUrl, messageEncoding: 'iso-8859-1', altText: card.code }] } : {}),
    ...(card.validUntil ? { expirationDate: `${card.validUntil}T23:59:59-03:00` } : {}),
    ...(card.status === 'suspended' ? { voided: true } : {}),
  };
}

function buildPkpass(card, a, memberId, token, nowMs, sign = signManifest) {
  const icon = fs.readFileSync(ICON);
  const files = {
    'pass.json': Buffer.from(JSON.stringify(applePassJson(card, a, memberId, token)), 'utf8'),
    'icon.png': icon, 'icon@2x.png': icon, 'logo.png': icon, 'logo@2x.png': icon,
  };
  const manifest = Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, crypto.createHash('sha1').update(v).digest('hex')]))), 'utf8');
  return zipStore({ ...files, 'manifest.json': manifest, signature: sign(manifest, a, nowMs) });
}

/** O aviso da Apple (APNs, HTTP/2 com o certificado do Pass Type ID): corpo vazio, o iPhone busca o passe. */
async function applePush(a, pushTokens) {
  if (!pushTokens.length) return 0;
  const http2 = require('node:http2');
  const sessao = http2.connect('https://api.push.apple.com', { cert: a.cert_pem, key: a.key_pem, passphrase: a.key_passphrase || undefined });
  let ok = 0;
  try {
    await Promise.all(pushTokens.map((tok) => new Promise((resolve) => {
      const req = sessao.request({ ':method': 'POST', ':path': `/3/device/${tok}`, 'apns-topic': a.pass_type_id, 'apns-push-type': 'background', 'apns-priority': '5' });
      req.on('response', (h) => { if (h[':status'] === 200) ok += 1; });
      req.on('error', () => resolve());
      req.on('close', () => resolve());
      req.end('{}');
    })));
  } finally {
    sessao.close();
  }
  return ok;
}

/* ------------------------------------------------------------ config -- */

async function config(ctx) {
  const s = await ctx.db.collection(SECRET_DOC[0]).doc(SECRET_DOC[1]).get();
  const v = s.exists ? s.data() : {};
  const g = v.google && v.google.issuer_id && v.google.client_email && v.google.private_key ? v.google : null;
  const a = v.apple && v.apple.pass_type_id && v.apple.team_id && v.apple.cert_pem && v.apple.key_pem && v.apple.wwdr_pem ? v.apple : null;
  return { google: g, apple: a, token_secret: v.token_secret || '' };
}

function configSummary(cfg) {
  return {
    google: cfg.google ? { enabled: true, issuer_id: cfg.google.issuer_id, client_email: cfg.google.client_email } : { enabled: false },
    apple: cfg.apple ? { enabled: true, pass_type_id: cfg.apple.pass_type_id, team_id: cfg.apple.team_id } : { enabled: false },
  };
}

function validaPem(v, tipo) {
  const s = String(v || '').trim();
  return s.includes(`-----BEGIN ${tipo}`) ? s : '';
}

async function configSave(ctx, actor, data) {
  if (!actor.isPlatformAdmin) falha('permission-denied', 'Só o admin da plataforma configura as carteiras.');
  const atual = await config(ctx);
  const doc = { token_secret: atual.token_secret || crypto.randomBytes(32).toString('hex'), updated_at_ms: ctx.now, updated_by: actor.uid };
  if (data.provider === 'google') {
    const g = { issuer_id: texto(data.issuer_id, 40), client_email: texto(data.client_email, 200), private_key: String(data.private_key || '').replace(/\\n/g, '\n').trim() };
    if (!/^\d{6,30}$/.test(g.issuer_id)) falha('invalid-argument', 'O ID do emissor do Google Wallet é só números.');
    if (!/@.+\.iam\.gserviceaccount\.com$/.test(g.client_email)) falha('invalid-argument', 'Use o e-mail da conta de serviço (…@….iam.gserviceaccount.com).');
    if (!validaPem(g.private_key, 'PRIVATE KEY')) falha('invalid-argument', 'Cole a chave privada da conta de serviço (BEGIN PRIVATE KEY).');
    try { crypto.createPrivateKey(g.private_key); } catch { falha('invalid-argument', 'A chave privada da conta de serviço não abriu.'); }
    doc.google = g;
  } else if (data.provider === 'apple') {
    const a = {
      pass_type_id: texto(data.pass_type_id, 120), team_id: texto(data.team_id, 20),
      cert_pem: validaPem(data.cert_pem, 'CERTIFICATE'), key_pem: validaPem(data.key_pem, ''), wwdr_pem: validaPem(data.wwdr_pem, 'CERTIFICATE'),
      key_passphrase: String(data.key_passphrase || '').slice(0, 200),
    };
    if (!/^pass\.[\w.-]+$/.test(a.pass_type_id)) falha('invalid-argument', 'O Pass Type ID começa com "pass." (ex.: pass.br.com.picklerush.carteirinha).');
    if (!/^[A-Z0-9]{10}$/.test(a.team_id)) falha('invalid-argument', 'O Team ID da Apple tem 10 letras e números.');
    if (!a.cert_pem || !a.key_pem || !a.wwdr_pem) falha('invalid-argument', 'Cole o certificado, a chave e o certificado WWDR da Apple em PEM.');
    try { signManifest(Buffer.from('{}'), a, ctx.now); } catch (err) { falha('invalid-argument', `O certificado da Apple não assinou (${err.message}).`); }
    doc.apple = a;
  } else if (data.provider === 'google_off' || data.provider === 'apple_off') {
    // Apaga a credencial (nulo = não configurada); o resto do documento fica.
    doc[data.provider.replace('_off', '')] = null;
  } else {
    falha('invalid-argument', 'Escolha Google ou Apple.');
  }
  await ctx.db.collection(SECRET_DOC[0]).doc(SECRET_DOC[1]).set(doc, { merge: true });
  await auditoria(ctx, actor, 'federation_wallet_config', { provider: data.provider });
  return configSummary(await config(ctx));
}

/* -------------------------------------------------------------- ações -- */

async function links(ctx, actor, data) {
  const ref = ctx.db.collection(C.members).doc(texto(data.memberId, 120));
  const snap = await ref.get();
  if (!snap.exists) falha('not-found', 'Filiação não encontrada.');
  const member = { id: snap.id, ...snap.data() };
  if (member.user_id !== actor.uid && member.guardian_uid !== actor.uid) falha('permission-denied', 'Só o titular adiciona a carteirinha à carteira.');
  const cfg = await config(ctx);
  if (!cfg.google && !cfg.apple) return { google: null, apple: null };
  const fed = (await ctx.db.collection(C.federations).doc(member.federation_id).get()).data() || {};
  const card = walletCard(member, fed, m.isoDateBR(ctx.now), ctx.now);
  if (!card.hasCard) return { google: null, apple: null };
  // Guardado para a atualização saber que há um objeto no Google a corrigir.
  if (cfg.google && !member.wallet_google) await ref.update({ wallet_google: true });
  return {
    google: cfg.google ? googleSaveUrl(card, cfg.google, member.id, ctx.now) : null,
    apple: cfg.apple ? `${ORIGIN}${APPLE_BASE}/pass/${encodeURIComponent(member.id)}/${authToken(cfg, member.id)}` : null,
  };
}

async function wallet(ctx, actor, data) {
  if (!(await F.flagLigada(ctx))) falha('failed-precondition', 'As federações não estão ligadas nesta plataforma.');
  if (data.action === 'links') return links(ctx, actor, data);
  if (data.action === 'config_status') {
    if (!actor.isPlatformAdmin) falha('permission-denied', 'Só o admin da plataforma.');
    return configSummary(await config(ctx));
  }
  if (data.action === 'config_save') return configSave(ctx, actor, data);
  return falha('invalid-argument', 'Ação desconhecida.');
}

/* --------------------------------------------------------------- HTTP -- */

const devId = (device, serial) => crypto.createHash('sha256').update(`${device}|${serial}`).digest('hex').slice(0, 40);

async function passResponse(ctx, cfg, memberId, sign) {
  const snap = await ctx.db.collection(C.members).doc(memberId).get();
  if (!snap.exists) return { status: 404 };
  const member = { id: snap.id, ...snap.data() };
  const fed = (await ctx.db.collection(C.federations).doc(member.federation_id).get()).data() || {};
  const card = walletCard(member, fed, m.isoDateBR(ctx.now), ctx.now);
  if (!card.code) return { status: 404 };
  const body = buildPkpass(card, cfg.apple, member.id, authToken(cfg, member.id), ctx.now, sign);
  return {
    status: 200, body,
    headers: { 'Content-Type': 'application/vnd.apple.pkpass', 'Content-Disposition': `attachment; filename="carteirinha-${card.acronym || 'federacao'}.pkpass"`, 'Last-Modified': new Date(ctx.now).toUTCString(), 'Cache-Control': 'no-store' },
  };
}

/**
 * O endereço `/api/carteira/apple/...`: o download do passe (link com o token
 * de cada filiação) e o serviço web da Apple (registro do aparelho, lista do
 * que mudou, passe atualizado, remoção, log). Devolve `{ status, headers?, body? }`.
 */
async function hook(ctx, { method, path: p, headers = {}, body = {}, query = {} }, deps = {}) {
  const cfg = await config(ctx);
  if (!cfg.apple || !cfg.token_secret) return { status: 404 };
  const rel = String(p || '').replace(/^.*\/api\/carteira\/apple/, '');
  const sign = deps.sign || signManifest;
  const auth = String(headers.authorization || headers.Authorization || '').replace(/^ApplePass\s+/i, '');
  const tokenOk = (serial, tok) => {
    const x = Buffer.from(String(tok || ''));
    const y = Buffer.from(authToken(cfg, serial));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  let r;
  if ((r = rel.match(/^\/pass\/([\w-]{1,120})\/([a-f0-9]{40})$/)) && method === 'GET') {
    return tokenOk(r[1], r[2]) ? passResponse(ctx, cfg, r[1], sign) : { status: 404 };
  }
  if ((r = rel.match(/^\/v1\/passes\/([\w.-]+)\/([\w-]{1,120})$/)) && method === 'GET') {
    if (r[1] !== cfg.apple.pass_type_id || !tokenOk(r[2], auth)) return { status: 401 };
    return passResponse(ctx, cfg, r[2], sign);
  }
  if ((r = rel.match(/^\/v1\/devices\/([\w-]{1,120})\/registrations\/([\w.-]+)\/([\w-]{1,120})$/))) {
    if (r[2] !== cfg.apple.pass_type_id || !tokenOk(r[3], auth)) return { status: 401 };
    const ref = ctx.db.collection(DEVICES).doc(devId(r[1], r[3]));
    if (method === 'POST') {
      const push = String((body && body.pushToken) || '').slice(0, 200);
      if (!push) return { status: 400 };
      const ja = await ref.get();
      await ref.set({ device: r[1], serial: r[3], push_token: push, created_at_ms: ja.exists ? ja.data().created_at_ms : ctx.now, updated_at_ms: ctx.now });
      return { status: ja.exists ? 200 : 201 };
    }
    if (method === 'DELETE') { await ref.delete(); return { status: 200 }; }
    return { status: 405 };
  }
  if ((r = rel.match(/^\/v1\/devices\/([\w-]{1,120})\/registrations\/([\w.-]+)$/)) && method === 'GET') {
    if (r[2] !== cfg.apple.pass_type_id) return { status: 404 };
    const regs = await ctx.db.collection(DEVICES).where('device', '==', r[1]).get();
    const desde = Number(query.passesUpdatedSince || 0);
    const mudou = [];
    for (const d of regs.docs) {
      const mem = await ctx.db.collection(C.members).doc(d.data().serial).get();
      if (mem.exists && Number(mem.data().wallet_updated_ms || 0) > desde) mudou.push(d.data().serial);
    }
    if (!mudou.length) return { status: 204 };
    return { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serialNumbers: mudou, lastUpdated: String(ctx.now) }) };
  }
  if (rel === '/v1/log' && method === 'POST') {
    (Array.isArray(body && body.logs) ? body.logs : []).slice(0, 10).forEach((l) => ctx.logger && ctx.logger.warn && ctx.logger.warn('apple wallet log', String(l).slice(0, 300)));
    return { status: 200 };
  }
  return { status: 404 };
}

/* ------------------------------------------------------------ gatilho -- */

/** Mudou o que a carteira mostra: corrige o Google e avisa cada iPhone. */
async function onMemberChange(ctx, before, after, memberId, deps = {}) {
  if (!before || !after) return { skipped: 'create/delete' };
  if (!WATCHED.some((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))) return { skipped: 'nada mudou' };
  const cfg = await config(ctx);
  if (!cfg.google && !cfg.apple) return { skipped: 'sem carteira' };
  const fed = (await ctx.db.collection(C.federations).doc(after.federation_id).get()).data() || {};
  const card = walletCard(after, fed, m.isoDateBR(ctx.now), ctx.now);
  const out = { google: false, apple: 0 };
  if (cfg.google && after.wallet_google) {
    try { out.google = await googlePatch(deps.fetchImpl || ctx.fetchImpl || fetch, cfg.google, card, memberId, ctx.now); } catch (err) { ctx.logger && ctx.logger.warn && ctx.logger.warn('google wallet patch', err.message); }
  }
  if (cfg.apple) {
    const regs = await ctx.db.collection(DEVICES).where('serial', '==', memberId).get();
    if (regs.docs.length) {
      // O serviço web responde "mudou" a partir desta marca (não é campo vigiado: não volta a disparar).
      await ctx.db.collection(C.members).doc(memberId).update({ wallet_updated_ms: ctx.now });
      const tokens = [...new Set(regs.docs.map((d) => d.data().push_token).filter(Boolean))];
      try { out.apple = await (deps.push || applePush)(cfg.apple, tokens); } catch (err) { ctx.logger && ctx.logger.warn && ctx.logger.warn('apple wallet push', err.message); }
    }
  }
  return out;
}

module.exports = {
  wallet, hook, onMemberChange, walletCard, googleObject, googleSaveUrl, applePassJson, buildPkpass, zipStore, authToken, inkFor, WATCHED, DEVICES,
};
