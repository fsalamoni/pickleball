/**
 * AVISOS POR E-MAIL E CELULAR — o motor de entrega.
 *
 * Todo aviso novo (`notifications`) passa por `handleNotice`: para cada canal
 * pronto (e-mail, WhatsApp, SMS), a regra pura (`messagingPolicy.js`) decide
 * mandar agora, juntar no resumo, esperar (horário silencioso, mensagem que
 * talvez seja lida no app) ou não mandar. O que sai — ou espera — vira um
 * documento em `message_outbox/{aviso}_{canal}`, que é ao mesmo tempo o
 * registro de entrega, a fila e a base dos tetos e do orçamento.
 *
 * `processQueue` (a cada 10 min) manda o que esperava, monta os resumos e
 * apaga o registro velho. `handleHttp` atende os retornos dos provedores
 * (entregue, devolvido, reclamação, "PARAR") e as páginas de descadastro e
 * de denúncia que o rodapé do e-mail oferece.
 *
 * Nada aqui roda com a funcionalidade desligada (`external_messaging`).
 */
const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const P = require('./messagingPolicy');
const Prov = require('./messagingProviders');
const Tpl = require('./messagingTemplates');

const FLAG = 'external_messaging';
const OUTBOX = 'message_outbox';
const SUPPRESSIONS = 'message_suppressions';
const REPORTS = 'message_reports';
const KEEP_MS = 90 * 86400000;
const MAX_ATTEMPTS = 3;
const STOP_WORDS = ['parar', 'pare', 'sair', 'stop', 'cancelar', 'descadastrar', 'unsubscribe', 'basta', 'baja'];

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const suppressionId = (channel, address) => sha(`${channel}:${String(address || '').trim().toLowerCase()}`);
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/* ------------------------------------------------------- contexto ------ */

let cache = null;

/** Configuração, chaves, estado do domínio e a flag — com 30 s de memória. */
async function loadContext(db, { now = Date.now(), fresh = false } = {}) {
  if (!fresh && cache && cache.db === db && now - cache.at < 30000) return cache.value;
  const [s, sec, g, st, rt] = await Promise.all([
    db.collection('platform_settings').doc('messaging').get(),
    db.collection('platform_secrets').doc('messaging').get(),
    db.collection('platform_settings').doc('global').get(),
    db.collection('platform_settings').doc('messaging_status').get(),
    db.collection('platform_secrets').doc('messaging_runtime').get(),
  ]);
  const global = g.exists ? g.data() || {} : {};
  const value = {
    settings: P.normalizeSettings(s.exists ? s.data() : {}),
    secrets: sec.exists ? sec.data() || {} : {},
    flagOn: Boolean(global.feature_flags && global.feature_flags[FLAG] === true),
    status: st.exists ? st.data() || {} : {},
    // Identificadores do provedor que não precisam ficar públicos (conta AWS).
    runtime: rt.exists ? rt.data() || {} : {},
  };
  cache = { db, at: now, value };
  return value;
}

const resetCache = () => { cache = null; };

/** A chave que assina os links do rodapé; criada na primeira vez. */
async function hmacKey(db, ctx) {
  if (ctx.secrets.hmac_key) return ctx.secrets.hmac_key;
  const key = crypto.randomBytes(32).toString('hex');
  await db.collection('platform_secrets').doc('messaging').set({ hmac_key: key }, { merge: true });
  ctx.secrets.hmac_key = key;
  return key;
}

function signToken(key, payload) {
  const corpo = b64u(JSON.stringify(payload));
  return `${corpo}.${b64u(crypto.createHmac('sha256', key).update(corpo).digest())}`;
}

function readToken(key, token) {
  const [corpo, assinatura] = String(token || '').split('.');
  if (!corpo || !assinatura || !key) return null;
  const esperado = b64u(crypto.createHmac('sha256', key).update(corpo).digest());
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(fromB64u(corpo).toString('utf8')); } catch (_) { return null; }
}

/** Idioma do modelo aprovado mais próximo do da pessoa, ou ''. */
function approvedWaLang(ctx, template, lang) {
  const lista = ((ctx.status.whatsapp && ctx.status.whatsapp.templates) || [])
    .filter((t) => t.name === template && t.status === 'APPROVED').map((t) => t.language);
  return [Prov.waLang(lang), 'pt_BR', 'en_US', 'es'].find((l) => lista.includes(l)) || '';
}

/** O que falta para cada canal funcionar. Lista vazia = pronto. */
function missing(ctx) {
  const { settings: s, secrets: k, status: st } = ctx;
  const falta = { email: [], whatsapp: [], sms: [], push: [] };
  const em = st.email || {};
  if (!s.email.enabled) falta.email.push('disabled');
  if (!s.email.domain) falta.email.push('domain');
  if (s.email.provider === 'ses' && !(k.ses && k.ses.access_key_id && k.ses.secret_access_key)) falta.email.push('credentials');
  if (s.email.provider === 'resend' && !(k.resend && k.resend.api_key)) falta.email.push('credentials');
  if (s.email.domain && !(em.domain === s.email.domain && em.provider === s.email.provider && em.verified === true)) falta.email.push('dns');
  if (!s.whatsapp.enabled) falta.whatsapp.push('disabled');
  if (!s.whatsapp.phone_number_id || !s.whatsapp.waba_id) falta.whatsapp.push('ids');
  if (!(k.whatsapp && k.whatsapp.access_token)) falta.whatsapp.push('credentials');
  if (!approvedWaLang(ctx, s.whatsapp.template_aviso, 'pt')) falta.whatsapp.push('templates');
  if (!s.sms.enabled) falta.sms.push('disabled');
  if (!s.sms.sender) falta.sms.push('sender');
  const cred = s.sms.provider === 'zenvia' ? k.zenvia && k.zenvia.api_token : k.twilio && k.twilio.account_sid && k.twilio.auth_token;
  if (!cred) falta.sms.push('credentials');
  // O push não tem interruptor nem chave secreta: basta a chave pública.
  if (!s.push.vapid_public_key) falta.push.push('vapid_key');
  return falta;
}

const readiness = (ctx) => {
  const f = missing(ctx);
  return { email: f.email.length === 0, whatsapp: f.whatsapp.length === 0, sms: f.sms.length === 0, push: f.push.length === 0 };
};

/* ---------------------------------------------------------- pessoas ---- */

async function loadUser(deps, uid) {
  const snap = await deps.db.collection('users').doc(uid).get();
  const u = snap.exists ? snap.data() || {} : {};
  let a = null;
  try { a = deps.auth ? await deps.auth.getUser(uid) : null; } catch (_) { a = null; }
  return {
    uid,
    exists: snap.exists,
    prefs: P.normalizeUserChannels(u.notification_channels),
    language: u.language || null,
    email: a && a.email ? String(a.email).toLowerCase() : '',
    emailVerified: Boolean(a && a.emailVerified),
    phone: typeof u.phone_verified_number === 'string' ? u.phone_verified_number : '',
    closed: u.account_status === 'suspended' || u.account_status === 'blocked',
    name: u.platform_name || u.full_name || u.display_name || '',
    role: u.role || '',
  };
}

const destinationOf = (channel, user) => (channel === 'email' ? user.email : user.phone);
const maskDest = (channel, v) => (channel === 'email' ? P.maskEmail(v) : P.maskPhone(v));

/* ------------------------------------------------------- contagens ----- */

function defaultCounters(db) {
  return {
    async count(field, value) {
      const r = await db.collection(OUTBOX).where(field, '==', value).count().get();
      return r.data().count || 0;
    },
    async monthCost(month) {
      // eslint-disable-next-line global-require
      const { AggregateField } = require('firebase-admin/firestore');
      const r = await db.collection(OUTBOX).where('month', '==', month).aggregate({ total: AggregateField.sum('cost_brl') }).get();
      return Number(r.data().total) || 0;
    },
  };
}

/** Os tetos: falha de leitura não segura o aviso, exceto no orçamento (dinheiro). */
async function checkCaps(deps, ctx, { channel, user, classified, now }) {
  const counters = deps.counters || defaultCounters(deps.db);
  const { day, month } = P.partesLocais(now);
  const contar = (f, v) => counters.count(f, v).catch(() => 0);
  const counts = {
    user: await contar('k_user', `${user.uid}|${day}|${channel}`),
    sender: classified.sender && channel === 'email' ? await contar('k_sender', `${classified.sender}|${day}|email`) : 0,
    pair: classified.sender ? await contar('k_pair', `${classified.sender}|${user.uid}|${day}`) : 0,
    month_cost: 0,
  };
  if (channel !== 'email') {
    try { counts.month_cost = await counters.monthCost(month); } catch (_) { return 'budget_unknown'; }
  }
  return P.capReason(channel, counts, ctx.settings, { trust: classified.broadcast ? 'server' : classified.trust });
}

function sentKeys({ channel, user, classified, now }) {
  const { day, month } = P.partesLocais(now);
  return {
    day,
    month,
    counted: true,
    k_user: `${user.uid}|${day}|${channel}`,
    k_sender: classified.sender && channel === 'email' ? `${classified.sender}|${day}|email` : null,
    k_pair: classified.sender ? `${classified.sender}|${user.uid}|${day}` : null,
    k_day: `${day}|${channel}`,
    k_month: `${month}|${channel}`,
  };
}

/* --------------------------------------------------------- envio ------- */

/** `"Nome" <endereço>`, com o nome codificado quando tem acento. */
function fromHeader(settings) {
  const nome = settings.email.from_name;
  const addr = P.fromAddress(settings);
  // eslint-disable-next-line no-control-regex
  const n = /^[\x20-\x7e]*$/.test(nome) ? `"${nome}"` : `=?UTF-8?B?${Buffer.from(nome).toString('base64')}?=`;
  return `${n} <${addr}>`;
}

function providerCtx(deps, ctx) {
  return {
    settings: ctx.settings,
    secrets: ctx.secrets,
    fetchImpl: deps.fetchImpl || fetch,
    useConfigSet: Boolean(ctx.runtime.ses_topic_arn && ctx.settings.email.provider === 'ses'),
  };
}

const webhookUrl = (settings, provider) => `${settings.public_origin}/api/mensagens/webhook/${provider}`;

/** Manda UMA mensagem já montada. Devolve { id, provider, cost, segments }. */
async function sendVia(deps, ctx, channel, msg) {
  const pctx = providerCtx(deps, ctx);
  const s = ctx.settings;
  if (channel === 'email') {
    const r = await Prov.sendEmail(pctx, {
      from: fromHeader(s), to: msg.to, subject: msg.subject, html: msg.html, text: msg.text,
      replyTo: s.email.reply_to || '', headers: msg.headers || {}, tag: msg.tag || '',
    });
    return { id: r.id, provider: s.email.provider, cost: 0, segments: 0 };
  }
  if (channel === 'whatsapp') {
    const lang = approvedWaLang(ctx, msg.template, msg.lang);
    if (!lang) throw new Prov.ProviderError('WhatsApp: o modelo ainda não foi aprovado pela Meta.', { code: 'template_not_approved' });
    const r = await Prov.whatsappSendTemplate(pctx, { to: msg.to, template: msg.template, langCode: lang, params: msg.params, button: msg.button });
    return { id: r.id, provider: 'whatsapp', cost: s.whatsapp.unit_cost_brl, segments: 1 };
  }
  const segments = P.smsSegments(msg.body);
  const r = await Prov.sendSms(pctx, { to: msg.to, body: msg.body, statusCallback: webhookUrl(s, 'twilio') });
  return { id: r.id, provider: s.sms.provider, cost: Math.round(segments * s.sms.unit_cost_brl * 10000) / 10000, segments };
}

async function noticeUrls(deps, ctx, { user, classified, noticeId }) {
  const key = await hmacKey(deps.db, ctx);
  const o = ctx.settings.public_origin;
  const lang = Tpl.langOf(user.language);
  const sair = signToken(key, { k: 'sair', u: user.uid, c: 'email', a: classified.area, l: lang });
  const out = {
    settings: `${o}/configuracoes#email-e-celular`,
    unsubscribe: `${o}/api/mensagens/sair?t=${sair}`,
  };
  if (classified.trust === 'user' && classified.sender) {
    out.report = `${o}/api/mensagens/denunciar?t=${signToken(key, { k: 'denuncia', u: user.uid, s: classified.sender, n: noticeId, l: lang })}`;
  }
  return out;
}

async function senderNameOf(db, classified) {
  if (classified.trust !== 'user' || !classified.sender) return '';
  try {
    const s = await db.collection('users').doc(classified.sender).get();
    const d = s.exists ? s.data() || {} : {};
    return d.platform_name || d.full_name || d.display_name || '';
  } catch (_) { return ''; }
}

/** Monta a mensagem do aviso no formato do canal. */
async function buildNoticeMessage(deps, ctx, { channel, notice, classified, user, noticeId, outboxId }) {
  if (channel === 'email') {
    const urls = await noticeUrls(deps, ctx, { user, classified, noticeId });
    const senderName = await senderNameOf(deps.db, classified);
    const m = Tpl.noticeEmail({ notice, classified, language: user.language, settings: ctx.settings, senderName, urls });
    return { ...m, to: user.email, tag: outboxId };
  }
  if (channel === 'whatsapp') {
    const w = Tpl.whatsappNotice({ notice, classified, language: user.language });
    return { to: user.phone, template: ctx.settings.whatsapp.template_aviso, lang: w.lang, params: w.params, button: w.button };
  }
  return { to: user.phone, body: Tpl.smsNotice({ notice, classified, language: user.language, settings: ctx.settings }) };
}

/**
 * Entrega um item da saída: confere supressão e tetos, manda e grava o
 * resultado. Nunca lança — o resultado vai para o documento.
 */
async function deliver(deps, ctx, { ref, item, channel, notice, classified, user, noticeId, now }) {
  const dest = destinationOf(channel, user);
  const base = { updated_at_ms: now, to_masked: maskDest(channel, dest) };
  try {
    const sup = await deps.db.collection(SUPPRESSIONS).doc(suppressionId(channel, dest)).get();
    if (sup.exists) {
      await ref.set({ ...base, status: 'suppressed', reason: (sup.data() || {}).reason || 'suppressed' }, { merge: true });
      return 'suppressed';
    }
    const cap = await checkCaps(deps, ctx, { channel, user, classified, now });
    if (cap) {
      await ref.set({ ...base, status: 'capped', reason: cap }, { merge: true });
      return cap;
    }
    const msg = await buildNoticeMessage(deps, ctx, { channel, notice, classified, user, noticeId, outboxId: ref.id });
    const r = await sendVia(deps, ctx, channel, msg);
    await ref.set({
      ...base, ...sentKeys({ channel, user, classified, now }),
      status: 'sent', reason: item.reason || 'chosen', provider: r.provider, provider_id: r.id || null,
      cost_brl: r.cost, segments: r.segments, sent_at_ms: now, error: null,
    }, { merge: true });
    return 'sent';
  } catch (err) {
    const tentativas = (Number(item.attempts) || 0) + 1;
    const retry = err && err.retryable && tentativas < MAX_ATTEMPTS;
    const { month } = P.partesLocais(now);
    await ref.set({
      ...base,
      status: retry ? 'queued' : 'failed',
      reason: retry ? 'retry' : (err && err.code) || 'error',
      error: String((err && err.message) || err).slice(0, 300),
      attempts: tentativas,
      ...(retry ? { send_after_ms: now + 5 * 60000 * 2 ** (tentativas - 1) } : { k_issue: `${month}|${channel}|failed` }),
    }, { merge: true }).catch(() => {});
    return retry ? 'retry' : 'failed';
  }
}

const outboxRef = (db, noticeId, channel) => db.collection(OUTBOX).doc(`${noticeId}_${channel}`);

async function isPlatformAdmin(db, uid) {
  try {
    const s = await db.collection('users').doc(String(uid)).get();
    return s.exists && (s.data() || {}).role === 'platform_admin';
  } catch (_) { return false; }
}

/**
 * Um aviso acabou de ser criado: decide e entrega por cada canal pronto.
 * @returns {Promise<{handled:boolean, reason?:string, results?:object}>}
 */
async function handleNotice(deps, noticeId, notice) {
  const now = deps.now || Date.now();
  if (!notice || !notice.user_id) return { handled: false, reason: 'no_user' };
  const ctx = await loadContext(deps.db, { now });
  if (!ctx.flagOn) return { handled: false, reason: 'flag_off' };
  const ready = readiness(ctx);
  const canais = P.EXTERNAL_CHANNELS.filter((c) => ready[c]);
  if (canais.length === 0) return { handled: false, reason: 'no_channel_ready' };
  const senderIsAdmin = notice.broadcast && notice.sent_by ? await isPlatformAdmin(deps.db, notice.sent_by) : false;
  const classified = P.classifyNotice(notice, { senderIsAdmin });
  if (classified.trust === 'legacy') return { handled: false, reason: 'legacy_notice' };
  const user = await loadUser(deps, String(notice.user_id));
  if (!user.exists) return { handled: false, reason: 'no_user' };
  if (user.closed && !classified.essential) return { handled: false, reason: 'account_closed' };

  const results = {};
  for (const channel of canais) {
    const d = P.decideChannel(channel, classified, {
      settings: ctx.settings, prefs: user.prefs, now, flagOn: true, ready,
      user: { email: user.email, emailVerified: user.emailVerified, phoneVerified: Boolean(user.phone) },
    });
    if (d.action === 'skip') { results[channel] = d.reason; continue; }
    const ref = outboxRef(deps.db, noticeId, channel);
    const item = {
      notice_id: noticeId, user_id: user.uid, channel, area: classified.area, trust: classified.trust,
      sent_by: classified.sender || null, essential: classified.essential, kind: 'notice',
      status: d.action === 'send' ? 'sending' : d.action === 'delay' ? 'queued' : d.action,
      reason: d.reason, send_after_ms: d.sendAfter || null, attempts: 0, cost_brl: 0, counted: false,
      created_at_ms: now, updated_at_ms: now, expire_at_ms: now + KEEP_MS,
    };
    try {
      // eslint-disable-next-line no-await-in-loop
      await ref.create(item);
    } catch (err) {
      results[channel] = 'duplicate';
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    results[channel] = d.action === 'send'
      ? await deliver(deps, ctx, { ref, item, channel, notice, classified, user, noticeId, now })
      : d.action;
  }
  return { handled: true, results };
}

/* --------------------------------------------------------- a fila ------ */

/** O que esperava (horário silencioso, mensagem não lida, nova tentativa). */
async function processDue(deps, ctx, now) {
  const snap = await deps.db.collection(OUTBOX).where('status', '==', 'queued').limit(400).get();
  // ponytail: varre os 400 primeiros da fila e filtra o prazo em memória; com
  // fila maior que isso, um índice (status, send_after_ms) resolve.
  const vencidos = snap.docs.filter((d) => Number((d.data() || {}).send_after_ms) <= now).slice(0, 150);
  const ready = readiness(ctx);
  let enviados = 0;
  for (const doc of vencidos) {
    const item = doc.data() || {};
    const fim = (status, reason) => doc.ref.set({ status, reason, updated_at_ms: now }, { merge: true });
    if (!ready[item.channel]) { await fim('skipped', 'not_ready'); continue; } // eslint-disable-line no-await-in-loop
    // eslint-disable-next-line no-await-in-loop
    const nSnap = await deps.db.collection('notifications').doc(String(item.notice_id)).get();
    if (!nSnap.exists) { await fim('skipped', 'notice_deleted'); continue; } // eslint-disable-line no-await-in-loop
    const notice = nSnap.data() || {};
    if (item.reason === 'wait_unread' && notice.read === true) { await fim('skipped', 'read_in_app'); continue; } // eslint-disable-line no-await-in-loop
    // eslint-disable-next-line no-await-in-loop
    const senderIsAdmin = notice.broadcast && notice.sent_by ? await isPlatformAdmin(deps.db, notice.sent_by) : false;
    const classified = P.classifyNotice(notice, { senderIsAdmin });
    // eslint-disable-next-line no-await-in-loop
    const user = await loadUser(deps, String(item.user_id));
    if (user.closed && !classified.essential) { await fim('skipped', 'account_closed'); continue; } // eslint-disable-line no-await-in-loop
    // A pessoa pode ter mudado de ideia enquanto o aviso esperava: decide de novo.
    const d = P.decideChannel(item.channel, classified, {
      settings: ctx.settings, prefs: user.prefs, now, flagOn: true, ready,
      user: { email: user.email, emailVerified: user.emailVerified, phoneVerified: Boolean(user.phone) },
    });
    const jaEsperou = item.reason === 'wait_unread' && d.reason === 'wait_unread';
    if (d.action === 'skip') { await fim('skipped', d.reason); continue; } // eslint-disable-line no-await-in-loop
    if (d.action === 'digest_daily' || d.action === 'digest_weekly') { await fim(d.action, 'digest'); continue; } // eslint-disable-line no-await-in-loop
    if (d.action === 'delay' && !jaEsperou) {
      // eslint-disable-next-line no-await-in-loop
      await doc.ref.set({ send_after_ms: d.sendAfter, reason: d.reason, updated_at_ms: now }, { merge: true });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const r = await deliver(deps, ctx, { ref: doc.ref, item, channel: item.channel, notice, classified, user, noticeId: item.notice_id, now });
    if (r === 'sent') enviados += 1;
  }
  return enviados;
}

/** Monta e manda os resumos de UM tipo (`digest_daily` ou `digest_weekly`). */
async function sendDigests(deps, ctx, status, now) {
  const LIMITE = 1500;
  const snap = await deps.db.collection(OUTBOX).where('status', '==', status).limit(LIMITE).get();
  const porPessoa = new Map();
  snap.docs.forEach((d) => {
    const it = d.data() || {};
    if (!porPessoa.has(it.user_id)) porPessoa.set(it.user_id, []);
    porPessoa.get(it.user_id).push(d);
  });
  let enviados = 0;
  const { day } = P.partesLocais(now);
  const weekly = status === 'digest_weekly';
  for (const [uid, docs] of porPessoa) {
    const marcar = async (s, reason, extra = {}) => {
      const batch = deps.db.batch();
      docs.forEach((d) => batch.set(d.ref, { status: s, reason, updated_at_ms: now, ...extra }, { merge: true }));
      await batch.commit();
    };
    // eslint-disable-next-line no-await-in-loop
    const user = await loadUser(deps, String(uid));
    if (!user.exists || user.closed || !user.email || !user.emailVerified || user.prefs.email.on !== true) {
      await marcar('skipped', !user.exists ? 'no_user' : user.closed ? 'account_closed' : 'channel_off_user'); // eslint-disable-line no-await-in-loop
      continue;
    }
    const refs = docs.map((d) => deps.db.collection('notifications').doc(String((d.data() || {}).notice_id)));
    // eslint-disable-next-line no-await-in-loop
    const notices = refs.length ? await deps.db.getAll(...refs) : [];
    const items = [];
    notices.forEach((s) => {
      if (!s.exists) return;
      const n = s.data() || {};
      if (n.read === true) return;
      items.push({ notice: n, classified: P.classifyNotice(n, {}) });
    });
    if (items.length === 0) { await marcar('skipped', 'read_in_app'); continue; } // eslint-disable-line no-await-in-loop
    const digestId = `digest_${uid}_${day}_${weekly ? 'w' : 'd'}`;
    const ref = deps.db.collection(OUTBOX).doc(digestId);
    const classified = { trust: 'server', sender: null, area: 'outros' };
    const registro = {
      user_id: uid, channel: 'email', kind: weekly ? 'digest_weekly' : 'digest_daily', area: 'outros', trust: 'server',
      items: items.length, status: 'sending', reason: 'digest', attempts: 0, cost_brl: 0, counted: false,
      created_at_ms: now, updated_at_ms: now, expire_at_ms: now + KEEP_MS,
    };
    try {
      // eslint-disable-next-line no-await-in-loop
      await ref.create(registro);
    } catch (_) { continue; }
    try {
      // eslint-disable-next-line no-await-in-loop
      const sup = await deps.db.collection(SUPPRESSIONS).doc(suppressionId('email', user.email)).get();
      if (sup.exists) {
        await ref.set({ status: 'suppressed', reason: 'suppressed' }, { merge: true }); // eslint-disable-line no-await-in-loop
        await marcar('skipped', 'suppressed'); // eslint-disable-line no-await-in-loop
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const key = await hmacKey(deps.db, ctx);
      const o = ctx.settings.public_origin;
      const urls = {
        settings: `${o}/configuracoes#email-e-celular`,
        unsubscribe: `${o}/api/mensagens/sair?t=${signToken(key, { k: 'sair', u: uid, c: 'email', a: 'all', l: Tpl.langOf(user.language) })}`,
      };
      const m = Tpl.digestEmail({ items, language: user.language, settings: ctx.settings, weekly, urls });
      // eslint-disable-next-line no-await-in-loop
      const r = await sendVia(deps, ctx, 'email', { ...m, to: user.email, tag: digestId });
      // eslint-disable-next-line no-await-in-loop
      await ref.set({
        ...sentKeys({ channel: 'email', user, classified, now }), status: 'sent', provider: r.provider,
        provider_id: r.id || null, sent_at_ms: now, to_masked: P.maskEmail(user.email),
      }, { merge: true });
      await marcar('in_digest', 'digest', { digest_id: digestId }); // eslint-disable-line no-await-in-loop
      enviados += 1;
    } catch (err) {
      // eslint-disable-next-line no-await-in-loop
      await ref.set({ status: 'failed', error: String((err && err.message) || err).slice(0, 300) }, { merge: true }).catch(() => {});
    }
  }
  return { enviados, esgotou: snap.docs.length < LIMITE };
}

/** Hora do resumo? Diário uma vez por dia; semanal no dia escolhido. */
async function processDigests(deps, ctx, now) {
  if (!readiness(ctx).email) return 0;
  const local = P.partesLocais(now);
  if (local.hour < ctx.settings.digest.hour) return 0;
  const runtimeRef = deps.db.collection('platform_secrets').doc('messaging_runtime');
  const rt = await runtimeRef.get();
  const r = rt.exists ? rt.data() || {} : {};
  let total = 0;
  if (r.last_daily_day !== local.day) {
    const d = await sendDigests(deps, ctx, 'digest_daily', now);
    total += d.enviados;
    if (d.esgotou) await runtimeRef.set({ last_daily_day: local.day }, { merge: true });
  }
  if (local.weekday === ctx.settings.digest.weekly_day && r.last_weekly_day !== local.day) {
    const w = await sendDigests(deps, ctx, 'digest_weekly', now);
    total += w.enviados;
    if (w.esgotou) await runtimeRef.set({ last_weekly_day: local.day }, { merge: true });
  }
  return total;
}

/** Apaga o registro com mais de 90 dias (o que foi entregue e o que não foi). */
async function cleanup(deps, now) {
  const snap = await deps.db.collection(OUTBOX).where('expire_at_ms', '<=', now).limit(400).get();
  if (snap.empty) return 0;
  const batch = deps.db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.docs.length;
}

async function processQueue(deps) {
  const now = deps.now || Date.now();
  const ctx = await loadContext(deps.db, { now, fresh: true });
  const out = { due: 0, digests: 0, cleaned: 0 };
  if (ctx.flagOn) {
    out.due = await processDue(deps, ctx, now);
    out.digests = await processDigests(deps, ctx, now);
  }
  out.cleaned = await cleanup(deps, now);
  return out;
}

/* -------------------------------------- devoluções, reclamações, PARAR -- */

/**
 * `user_ids`: as contas daquele endereço — é por eles que a exclusão de conta
 * acha o registro e tira o endereço (o bloqueio continua valendo pelo id,
 * que é o hash do endereço).
 */
async function addSuppression(db, { channel, address, reason, source, now, userIds = [] }) {
  const addr = String(address || '').trim().toLowerCase();
  if (!addr) return;
  const uids = userIds.filter(Boolean).map(String);
  await db.collection(SUPPRESSIONS).doc(suppressionId(channel, addr)).set({
    channel, address: addr, masked: maskDest(channel, addr), reason, source, created_at_ms: now,
    ...(uids.length ? { user_ids: FieldValue.arrayUnion(...uids) } : {}),
  }, { merge: true });
}

async function findOutbox(db, { outboxId, providerId }) {
  if (outboxId) {
    const s = await db.collection(OUTBOX).doc(String(outboxId)).get();
    if (s.exists) return s;
  }
  if (providerId) {
    const q = await db.collection(OUTBOX).where('provider_id', '==', String(providerId)).limit(1).get();
    if (!q.empty) return q.docs[0];
  }
  return null;
}

/** Um evento de e-mail (Amazon ou Resend), já traduzido. */
async function applyEmailEvent(deps, { kind, outboxId, providerId, recipients = [], permanent = true, detail = '' }, now) {
  const doc = await findOutbox(deps.db, { outboxId, providerId });
  const { month } = P.partesLocais(now);
  const status = { delivered: 'delivered', bounce: 'bounced', complaint: 'complained', reject: 'failed', delay: 'delayed' }[kind];
  if (doc && status) {
    const atual = (doc.data() || {}).status;
    // "Entregue" depois de uma reclamação não apaga a reclamação.
    if (!(status === 'delivered' && ['complained', 'bounced'].includes(atual))) {
      await doc.ref.set({
        status, updated_at_ms: now, ...(detail ? { error: String(detail).slice(0, 300) } : {}),
        ...(kind === 'bounce' || kind === 'complaint' || kind === 'reject' ? { k_issue: `${month}|email|${kind}` } : {}),
      }, { merge: true });
    }
  }
  if ((kind === 'bounce' && permanent) || kind === 'complaint') {
    for (const r of recipients) {
      // eslint-disable-next-line no-await-in-loop
      await addSuppression(deps.db, { channel: 'email', address: r, reason: kind, source: 'provider', now, userIds: [doc && (doc.data() || {}).user_id] });
    }
  }
}

/** Alguém respondeu PARAR: desliga o canal para todas as contas com aquele número. */
async function applyStop(deps, { channel, phone, now }) {
  const e164 = P.normalizePhone(phone.startsWith('+') ? phone : `+${phone}`);
  if (!e164) return 0;
  const q = await deps.db.collection('users').where('phone_verified_number', '==', e164).limit(10).get();
  await addSuppression(deps.db, { channel, address: e164, reason: 'stop', source: 'reply', now, userIds: q.docs.map((d) => d.id) });
  const batch = deps.db.batch();
  q.docs.forEach((d) => batch.set(d.ref, { notification_channels: { [channel]: { on: false } } }, { merge: true }));
  if (!q.empty) await batch.commit();
  return q.docs.length;
}

const isStopWord = (texto) => STOP_WORDS.includes(String(texto || '').trim().toLowerCase().replace(/[^a-z]/g, ''));

const rawOf = (req) => (req.rawBody ? Buffer.from(req.rawBody) : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})));

async function hookSes(deps, ctx, req, now) {
  let m;
  try { m = JSON.parse(rawOf(req).toString('utf8')); } catch (_) { return { code: 400 }; }
  const topic = ctx.runtime.ses_topic_arn;
  if (!topic || m.TopicArn !== topic) return { code: 403 };
  if (!(await Prov.verifySnsMessage(m, { fetchImpl: deps.fetchImpl || fetch }))) return { code: 403 };
  if (m.Type === 'SubscriptionConfirmation') {
    if (Prov.isAmazonSnsUrl(m.SubscribeURL)) await (deps.fetchImpl || fetch)(m.SubscribeURL);
    await deps.db.collection('platform_settings').doc('messaging_status').set({ email: { webhook_confirmed_at_ms: now } }, { merge: true });
    return { code: 200 };
  }
  if (m.Type !== 'Notification') return { code: 200 };
  let ev;
  try { ev = JSON.parse(m.Message); } catch (_) { return { code: 200 }; }
  const tipo = String(ev.eventType || ev.notificationType || '').toLowerCase();
  const tags = (ev.mail && ev.mail.tags) || {};
  const outboxId = Array.isArray(tags.outbox) ? tags.outbox[0] : tags.outbox;
  const kind = { delivery: 'delivered', bounce: 'bounce', complaint: 'complaint', reject: 'reject', deliverydelay: 'delay' }[tipo];
  if (!kind) return { code: 200 };
  const recipients = kind === 'bounce' ? ((ev.bounce && ev.bounce.bouncedRecipients) || []).map((r) => r.emailAddress)
    : kind === 'complaint' ? ((ev.complaint && ev.complaint.complainedRecipients) || []).map((r) => r.emailAddress) : [];
  await applyEmailEvent(deps, {
    kind, outboxId, providerId: ev.mail && ev.mail.messageId, recipients,
    permanent: !(ev.bounce && ev.bounce.bounceType && ev.bounce.bounceType !== 'Permanent'),
    detail: ev.bounce ? `${ev.bounce.bounceType || ''} ${ev.bounce.bounceSubType || ''}`.trim() : '',
  }, now);
  return { code: 200 };
}

async function hookResend(deps, ctx, req, now) {
  const raw = rawOf(req);
  const secret = ctx.secrets.resend && ctx.secrets.resend.webhook_secret;
  const h = (k) => req.get ? req.get(k) : (req.headers || {})[k];
  if (!Prov.verifySvixSignature(raw, { 'svix-id': h('svix-id'), 'svix-timestamp': h('svix-timestamp'), 'svix-signature': h('svix-signature') }, secret, now)) {
    return { code: 403 };
  }
  let ev;
  try { ev = JSON.parse(raw.toString('utf8')); } catch (_) { return { code: 400 }; }
  const kind = { 'email.delivered': 'delivered', 'email.bounced': 'bounce', 'email.complained': 'complaint', 'email.delivery_delayed': 'delay', 'email.failed': 'reject' }[ev.type];
  if (!kind) return { code: 200 };
  const d = ev.data || {};
  const tags = d.tags || {};
  const outboxId = Array.isArray(tags) ? ((tags.find((t) => t.name === 'outbox') || {}).value) : tags.outbox;
  await applyEmailEvent(deps, {
    kind, outboxId, providerId: d.email_id, recipients: Array.isArray(d.to) ? d.to : [d.to].filter(Boolean),
    permanent: !(d.bounce && d.bounce.type && String(d.bounce.type).toLowerCase() !== 'permanent'),
    detail: d.bounce ? String(d.bounce.message || d.bounce.type || '') : '',
  }, now);
  return { code: 200 };
}

const WA_STATUS = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };

async function hookWhatsapp(deps, ctx, req, now) {
  const w = ctx.secrets.whatsapp || {};
  if (req.method === 'GET') {
    const q = req.query || {};
    if (q['hub.mode'] === 'subscribe' && w.verify_token && q['hub.verify_token'] === w.verify_token) {
      await deps.db.collection('platform_settings').doc('messaging_status').set({ whatsapp: { webhook_confirmed_at_ms: now } }, { merge: true });
      return { code: 200, text: String(q['hub.challenge'] || '') };
    }
    return { code: 403 };
  }
  const raw = rawOf(req);
  const assinatura = req.get ? req.get('x-hub-signature-256') : (req.headers || {})['x-hub-signature-256'];
  if (!Prov.verifyMetaSignature(raw, assinatura, w.app_secret)) return { code: 403 };
  let corpo;
  try { corpo = JSON.parse(raw.toString('utf8')); } catch (_) { return { code: 400 }; }
  const { month } = P.partesLocais(now);
  for (const entry of corpo.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      for (const s of v.statuses || []) {
        const status = WA_STATUS[s.status];
        if (!status) continue;
        // eslint-disable-next-line no-await-in-loop
        const doc = await findOutbox(deps.db, { providerId: s.id });
        if (!doc) continue;
        const erro = s.errors && s.errors[0];
        // eslint-disable-next-line no-await-in-loop
        await doc.ref.set({
          status, updated_at_ms: now,
          ...(erro ? { error: `${erro.code || ''} ${erro.title || erro.message || ''}`.trim().slice(0, 300), k_issue: `${month}|whatsapp|failed` } : {}),
        }, { merge: true });
      }
      for (const msg of v.messages || []) {
        const texto = (msg.text && msg.text.body) || (msg.button && msg.button.text) || '';
        // eslint-disable-next-line no-await-in-loop
        if (msg.from && isStopWord(texto)) await applyStop(deps, { channel: 'whatsapp', phone: String(msg.from), now });
      }
    }
  }
  return { code: 200 };
}

const TWILIO_STATUS = { delivered: 'delivered', undelivered: 'failed', failed: 'failed', sent: 'sent' };

async function hookTwilio(deps, ctx, req, now) {
  const tw = ctx.secrets.twilio || {};
  const params = req.body && typeof req.body === 'object' ? req.body : Object.fromEntries(new URLSearchParams(rawOf(req).toString('utf8')));
  const assinatura = req.get ? req.get('x-twilio-signature') : (req.headers || {})['x-twilio-signature'];
  if (!Prov.verifyTwilioSignature(webhookUrl(ctx.settings, 'twilio'), params, assinatura, tw.auth_token)) return { code: 403 };
  const { month } = P.partesLocais(now);
  if (params.MessageStatus && params.MessageSid && TWILIO_STATUS[params.MessageStatus]) {
    const doc = await findOutbox(deps.db, { providerId: params.MessageSid });
    if (doc) {
      const falhou = TWILIO_STATUS[params.MessageStatus] === 'failed';
      await doc.ref.set({
        status: TWILIO_STATUS[params.MessageStatus], updated_at_ms: now,
        ...(falhou ? { error: `Twilio ${params.ErrorCode || ''}`.trim(), k_issue: `${month}|sms|failed` } : {}),
      }, { merge: true });
    }
  } else if (params.From && isStopWord(params.Body)) {
    await applyStop(deps, { channel: 'sms', phone: String(params.From), now });
  }
  return { code: 200, xml: '<?xml version="1.0" encoding="UTF-8"?><Response/>' };
}

/* ----------------------------------------- descadastro e denúncia ------ */

const PAGES = {
  pt: {
    sairTitulo: 'Parar estes e-mails', sairArea: 'Você não vai mais receber avisos de {area} por e-mail.',
    sairTudo: 'Você não vai mais receber e-mails de avisos do PickleRush.', confirmar: 'Confirmar',
    pronto: 'Pronto', mudar: 'Você pode mudar isso quando quiser em Configurações → E-mail e celular.',
    denTitulo: 'Denunciar este e-mail', denTexto: 'A denúncia vai para a equipe do PickleRush, e esta pessoa não poderá mais mandar avisos para o seu e-mail.',
    denunciar: 'Denunciar', denPronto: 'Denúncia recebida. Obrigado por avisar — você não vai mais receber e-mails desta pessoa.',
    invalido: 'Este link não é válido. Para mudar os seus e-mails, abra Configurações → E-mail e celular no PickleRush.',
    abrir: 'Abrir as Configurações',
  },
  en: {
    sairTitulo: 'Stop these e-mails', sairArea: 'You will no longer get {area} notices by e-mail.',
    sairTudo: 'You will no longer get PickleRush notice e-mails.', confirmar: 'Confirm',
    pronto: 'Done', mudar: 'You can change this at any time in Settings → E-mail and phone.',
    denTitulo: 'Report this e-mail', denTexto: 'The report goes to the PickleRush team, and this person will no longer be able to send notices to your e-mail.',
    denunciar: 'Report', denPronto: 'Report received. Thank you — you will no longer get e-mails from this person.',
    invalido: 'This link is not valid. To change your e-mails, open Settings → E-mail and phone on PickleRush.',
    abrir: 'Open Settings',
  },
  es: {
    sairTitulo: 'Dejar de recibir estos correos', sairArea: 'Ya no recibirás avisos de {area} por correo.',
    sairTudo: 'Ya no recibirás correos de avisos de PickleRush.', confirmar: 'Confirmar',
    pronto: 'Listo', mudar: 'Puedes cambiarlo cuando quieras en Configuración → Correo y celular.',
    denTitulo: 'Denunciar este correo', denTexto: 'La denuncia va al equipo de PickleRush, y esta persona ya no podrá enviar avisos a tu correo.',
    denunciar: 'Denunciar', denPronto: 'Denuncia recibida. Gracias por avisar — ya no recibirás correos de esta persona.',
    invalido: 'Este enlace no es válido. Para cambiar tus correos, abre Configuración → Correo y celular en PickleRush.',
    abrir: 'Abrir la Configuración',
  },
};

function page(lang, titulo, corpoHtml) {
  return `<!doctype html><html lang="${lang === 'pt' ? 'pt-BR' : lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="robots" content="noindex"><title>${Tpl.esc(titulo)} · PickleRush</title></head>`
    + '<body style="margin:0;background:#F7F9FC;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#1F2937">'
    + '<main style="max-width:480px;margin:48px auto;padding:0 16px"><div style="background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:28px 24px">'
    + `<p style="margin:0 0 16px"><span style="background:#0B0F19;color:#D4F82E;font-weight:800;padding:6px 12px;border-radius:8px">PickleRush</span></p>`
    + `<h1 style="font-size:22px;margin:0 0 12px;color:#0B0F19">${Tpl.esc(titulo)}</h1>${corpoHtml}</div></main></body></html>`;
}

const pTag = (t) => `<p style="font-size:16px;line-height:24px;margin:0 0 14px">${Tpl.esc(t)}</p>`;
const btnForm = (action, rotulo) => `<form method="post" action="${Tpl.esc(action)}"><button type="submit" style="background:#0B0F19;color:#fff;border:0;border-radius:10px;padding:13px 22px;font-size:16px;font-weight:600;cursor:pointer">${Tpl.esc(rotulo)}</button></form>`;
const btnLink = (href, rotulo) => `<a href="${Tpl.esc(href)}" style="display:inline-block;background:#0B0F19;color:#fff;border-radius:10px;padding:13px 22px;font-size:16px;font-weight:600;text-decoration:none">${Tpl.esc(rotulo)}</a>`;

/**
 * `/api/mensagens/sair` e `/api/mensagens/denunciar`. GET mostra a página com
 * o botão (leitores de e-mail abrem links sozinhos — o GET nunca muda nada);
 * POST aplica. O POST do "descadastrar com um clique" (RFC 8058) vem do
 * próprio programa de e-mail e também aplica.
 */
async function handlePage(deps, ctx, req, kind, now) {
  const q = req.query || {};
  const key = await hmacKey(deps.db, ctx);
  const tk = readToken(key, q.t);
  const lang = tk && PAGES[tk.l] ? tk.l : 'pt';
  const t = PAGES[lang];
  const origin = ctx.settings.public_origin;
  if (!tk || !tk.u || (kind === 'sair' && tk.k !== 'sair') || (kind === 'denunciar' && (tk.k !== 'denuncia' || !tk.s))) {
    return { code: 400, html: page(lang, t.sairTitulo, pTag(t.invalido) + btnLink(`${origin}/configuracoes#email-e-celular`, t.abrir)) };
  }
  const action = `${origin}/api/mensagens/${kind}?t=${encodeURIComponent(q.t)}`;
  const areaNome = (Tpl.T[lang] || Tpl.T.pt).areas[tk.a] || '';
  if (kind === 'sair') {
    const textoFinal = tk.a === 'all' ? t.sairTudo : Tpl.esc(t.sairArea).replace('{area}', Tpl.esc(areaNome));
    if (req.method !== 'POST') {
      return { code: 200, html: page(lang, t.sairTitulo, `<p style="font-size:16px;line-height:24px;margin:0 0 14px">${tk.a === 'all' ? Tpl.esc(textoFinal) : textoFinal}</p>${btnForm(action, t.confirmar)}`) };
    }
    const campo = tk.a === 'all' || !P.AREAS.includes(tk.a) ? { on: false } : { areas: { [tk.a]: 'nao' } };
    await deps.db.collection('users').doc(String(tk.u)).set({ notification_channels: { email: campo } }, { merge: true });
    await deps.db.collection('audit_logs').add({
      action: 'message_unsubscribe', entity_type: 'user', entity_id: String(tk.u), actor_id: String(tk.u),
      details: { channel: 'email', area: tk.a }, created_at: new Date(now), created_at_ms: now,
    }).catch(() => {});
    return { code: 200, html: page(lang, t.pronto, `<p style="font-size:16px;line-height:24px;margin:0 0 14px">${tk.a === 'all' ? Tpl.esc(textoFinal) : textoFinal}</p>${pTag(t.mudar)}${btnLink(`${origin}/configuracoes#email-e-celular`, t.abrir)}`) };
  }
  if (req.method !== 'POST') return { code: 200, html: page(lang, t.denTitulo, pTag(t.denTexto) + btnForm(action, t.denunciar)) };
  const reportId = sha(`${tk.u}|${tk.n || ''}`).slice(0, 40);
  await deps.db.collection(REPORTS).doc(reportId).set({
    reporter_uid: String(tk.u), sender_uid: String(tk.s), notice_id: tk.n ? String(tk.n) : null, channel: 'email',
    status: 'open', created_at_ms: now,
  }, { merge: true });
  await deps.db.collection('users').doc(String(tk.u)).set({
    notification_channels: { blocked_senders: FieldValue.arrayUnion(String(tk.s)) },
  }, { merge: true });
  return { code: 200, html: page(lang, t.pronto, pTag(t.denPronto) + btnLink(`${origin}/configuracoes#email-e-celular`, t.abrir)) };
}

/** O roteador de `/api/mensagens/**`. Devolve { code, html?, text?, xml? }. */
async function handleHttp(deps, req) {
  const now = deps.now || Date.now();
  const caminho = String(req.path || req.url || '').split('?')[0].replace(/\/+$/, '');
  const fim = caminho.split('/').filter(Boolean);
  const ctx = await loadContext(deps.db, { now });
  const ultimo = fim[fim.length - 1];
  if (fim.includes('webhook')) {
    if (req.method !== 'POST' && !(ultimo === 'whatsapp' && req.method === 'GET')) return { code: 405 };
    if (ultimo === 'ses') return hookSes(deps, ctx, req, now);
    if (ultimo === 'resend') return hookResend(deps, ctx, req, now);
    if (ultimo === 'whatsapp') return hookWhatsapp(deps, ctx, req, now);
    if (ultimo === 'twilio') return hookTwilio(deps, ctx, req, now);
    return { code: 404 };
  }
  if (ultimo === 'sair' || ultimo === 'denunciar') {
    if (req.method !== 'GET' && req.method !== 'POST') return { code: 405 };
    return handlePage(deps, ctx, req, ultimo, now);
  }
  return { code: 404 };
}

module.exports = {
  FLAG,
  OUTBOX,
  SUPPRESSIONS,
  REPORTS,
  KEEP_MS,
  sha,
  suppressionId,
  loadContext,
  resetCache,
  hmacKey,
  signToken,
  readToken,
  approvedWaLang,
  missing,
  readiness,
  loadUser,
  sendVia,
  fromHeader,
  webhookUrl,
  handleNotice,
  processQueue,
  addSuppression,
  applyEmailEvent,
  applyStop,
  isStopWord,
  handleHttp,
  isPlatformAdmin,
};
