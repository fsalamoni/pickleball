/**
 * AVISOS POR E-MAIL E CELULAR — as ações chamadas pelo aplicativo.
 *
 *  - `adminAction`: o painel admin → Comunicações (só o admin da plataforma):
 *    estado, chaves, domínio, testes, prévias, "por que não chegou", lista de
 *    bloqueio, denúncias, modelos do WhatsApp, registro de entregas.
 *  - `userAction`: as Configurações da pessoa: confirmar o celular por
 *    código, esquecer o celular, confirmar o e-mail, mandar um e-mail de teste.
 *  - `authEmailAction`: o "esqueci a senha" pelo nosso provedor (sem login).
 *
 * As chaves dos provedores ficam em `platform_secrets/messaging`, que a regra
 * fecha para TODO MUNDO: só o servidor lê. O painel vê só "configurada" e os
 * últimos 4 caracteres do que não é segredo.
 */
const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');
const P = require('./messagingPolicy');
const Prov = require('./messagingProviders');
const Tpl = require('./messagingTemplates');
const M = require('./messaging');

class ActionError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (message, code = 'failed-precondition') => { throw new ActionError(code, message); };

/** Os campos de cada grupo de chaves; `secret: false` pode mostrar o fim. */
const SECRET_FIELDS = Object.freeze({
  ses: { access_key_id: { secret: false }, secret_access_key: { secret: true } },
  resend: { api_key: { secret: true }, webhook_secret: { secret: true } },
  whatsapp: { access_token: { secret: true }, app_secret: { secret: true }, verify_token: { secret: true } },
  twilio: { account_sid: { secret: false }, auth_token: { secret: true } },
  zenvia: { api_token: { secret: true } },
});

function secretsSummary(secrets) {
  const out = {};
  Object.entries(SECRET_FIELDS).forEach(([g, campos]) => {
    out[g] = {};
    Object.entries(campos).forEach(([k, meta]) => {
      const v = secrets[g] && typeof secrets[g][k] === 'string' ? secrets[g][k] : '';
      out[g][k] = v ? (meta.secret ? { set: true } : { set: true, hint: `…${v.slice(-4)}` }) : { set: false };
    });
  });
  return out;
}

const audit = (db, actor, action, details, now) => db.collection('audit_logs').add({
  action, entity_type: 'platform_settings', entity_id: 'messaging', actor_id: actor.uid, actor_email: actor.email || '',
  details, created_at: new Date(now), created_at_ms: now,
}).catch(() => {});

const providerCtx = (deps, ctx) => ({
  settings: ctx.settings, secrets: ctx.secrets, fetchImpl: deps.fetchImpl || fetch,
  useConfigSet: Boolean(ctx.runtime.ses_topic_arn && ctx.settings.email.provider === 'ses'),
});

const statusRef = (db) => db.collection('platform_settings').doc('messaging_status');
const runtimeRef = (db) => db.collection('platform_secrets').doc('messaging_runtime');

async function contar(q) {
  try { return (await q.count().get()).data().count || 0; } catch (_) { return null; }
}

/* ------------------------------------------------------------ estado --- */

async function statusAction(deps, ctx, now) {
  const { db } = deps;
  const { day, month } = P.partesLocais(now);
  const out = db.collection(M.OUTBOX);
  const stats = { today: {}, month: {}, issues: {}, month_cost: null };
  for (const ch of P.EXTERNAL_CHANNELS) {
    /* eslint-disable no-await-in-loop */
    stats.today[ch] = await contar(out.where('k_day', '==', `${day}|${ch}`));
    stats.month[ch] = await contar(out.where('k_month', '==', `${month}|${ch}`));
    stats.issues[ch] = {};
    const tipos = ch === 'email' ? ['bounce', 'complaint', 'reject', 'failed'] : ['failed'];
    for (const tipo of tipos) stats.issues[ch][tipo] = await contar(out.where('k_issue', '==', `${month}|${ch}|${tipo}`));
    /* eslint-enable no-await-in-loop */
  }
  try {
    // eslint-disable-next-line global-require
    const { AggregateField } = require('firebase-admin/firestore');
    const r = await out.where('month', '==', month).aggregate({ total: AggregateField.sum('cost_brl') }).get();
    stats.month_cost = Number(r.data().total) || 0;
  } catch (_) { stats.month_cost = null; }
  const pessoas = {
    phones_verified: await contar(db.collection('users').where('phone_verified_at', '>', 0)),
    whatsapp_on: await contar(db.collection('users').where('notification_channels.whatsapp.on', '==', true)),
    sms_on: await contar(db.collection('users').where('notification_channels.sms.on', '==', true)),
    email_off: await contar(db.collection('users').where('notification_channels.email.on', '==', false)),
    marketing_on: await contar(db.collection('users').where('notification_channels.marketing', '==', true)),
    push_devices: await contar(db.collection('push_tokens')),
  };
  const suppressions = await contar(db.collection(M.SUPPRESSIONS));
  const openReports = await contar(db.collection(M.REPORTS).where('status', '==', 'open'));

  const alerts = [];
  const enviados = Number(stats.month.email) || 0;
  if (enviados >= 50) {
    const rec = (Number(stats.issues.email.complaint) || 0) / enviados;
    const dev = (Number(stats.issues.email.bounce) || 0) / enviados;
    if (rec * 100 >= ctx.settings.limits.complaint_alert_pct) alerts.push({ level: 'danger', code: 'complaint_rate', value: rec });
    if (dev >= 0.04) alerts.push({ level: 'warning', code: 'bounce_rate', value: dev });
  }
  const orc = ctx.settings.limits.monthly_budget_brl;
  if (stats.month_cost !== null && orc > 0 && stats.month_cost >= orc * 0.8) {
    alerts.push({ level: stats.month_cost >= orc ? 'danger' : 'warning', code: 'budget', value: stats.month_cost });
  }
  const conta = ctx.status.email && ctx.status.email.account;
  if (ctx.settings.email.provider === 'ses' && conta && conta.production === false) alerts.push({ level: 'warning', code: 'ses_sandbox' });
  if (openReports) alerts.push({ level: 'warning', code: 'open_reports', value: openReports });

  const o = ctx.settings.public_origin;
  return {
    flagOn: ctx.flagOn,
    settings: ctx.settings,
    secrets: secretsSummary(ctx.secrets),
    status: ctx.status,
    runtime: { ses_events: Boolean(ctx.runtime.ses_topic_arn), resend_domain: Boolean(ctx.runtime.resend_domain_id) },
    missing: M.missing(ctx),
    ready: M.readiness(ctx),
    webhooks: {
      ses: M.webhookUrl(ctx.settings, 'ses'),
      resend: M.webhookUrl(ctx.settings, 'resend'),
      whatsapp: M.webhookUrl(ctx.settings, 'whatsapp'),
      twilio: M.webhookUrl(ctx.settings, 'twilio'),
      unsubscribe: `${o}/api/mensagens/sair`,
    },
    stats,
    people: pessoas,
    suppressions,
    open_reports: openReports,
    alerts,
    now,
  };
}

/* ------------------------------------------------------------ chaves --- */

function validateSecrets(group, values) {
  const campos = SECRET_FIELDS[group];
  if (!campos) fail('Grupo de chaves desconhecido.', 'invalid-argument');
  const out = {};
  Object.entries(values || {}).forEach(([k, v]) => {
    if (!campos[k]) fail(`Campo desconhecido: ${k}.`, 'invalid-argument');
    const t = typeof v === 'string' ? v.trim() : '';
    if (!t) return; // vazio = manter o que está gravado
    if (t.length > 1000 || /[\r\n\s]/.test(t)) fail('A chave não pode ter espaço nem quebra de linha. Copie de novo, só o valor.', 'invalid-argument');
    out[k] = t;
  });
  if (group === 'ses' && out.access_key_id && !/^(AKIA|ASIA)[A-Z0-9]{12,}$/.test(out.access_key_id)) {
    fail('O Access key ID da AWS começa com AKIA e tem 20 caracteres.', 'invalid-argument');
  }
  if (group === 'resend' && out.api_key && !/^re_/.test(out.api_key)) fail('A chave do Resend começa com re_.', 'invalid-argument');
  if (group === 'resend' && out.webhook_secret && !/^whsec_/.test(out.webhook_secret)) fail('O segredo do webhook do Resend começa com whsec_.', 'invalid-argument');
  if (group === 'twilio' && out.account_sid && !/^AC[0-9a-f]{32}$/i.test(out.account_sid)) fail('O Account SID da Twilio começa com AC e tem 34 caracteres.', 'invalid-argument');
  return out;
}

async function saveSecrets(deps, ctx, actor, data, now) {
  const group = String(data.group || '');
  const ref = deps.db.collection('platform_secrets').doc('messaging');
  if (data.clear === true) {
    if (!SECRET_FIELDS[group]) fail('Grupo de chaves desconhecido.', 'invalid-argument');
    await ref.set({ [group]: FieldValue.delete() }, { merge: true });
    await audit(deps.db, actor, 'messaging_secrets_cleared', { group }, now);
  } else {
    const valores = validateSecrets(group, data.values);
    if (!Object.keys(valores).length) fail('Nada para salvar: preencha ao menos um campo.', 'invalid-argument');
    await ref.set({ [group]: valores, updated_at_ms: now }, { merge: true });
    await audit(deps.db, actor, 'messaging_secrets_saved', { group, fields: Object.keys(valores) }, now);
  }
  M.resetCache();
  const fresco = await M.loadContext(deps.db, { now, fresh: true });
  return { secrets: secretsSummary(fresco.secrets), missing: M.missing(fresco) };
}

/* ----------------------------------------------------------- domínio --- */

async function domainSetup(deps, ctx, actor, now) {
  const { domain, provider } = ctx.settings.email;
  if (!domain) fail('Salve o domínio primeiro (aba E-mail → Domínio).');
  const pctx = providerCtx(deps, ctx);
  let res;
  if (provider === 'ses') {
    res = await Prov.sesSetupDomain(pctx, { domain, webhookUrl: M.webhookUrl(ctx.settings, 'ses') });
    await runtimeRef(deps.db).set({ ses_topic_arn: res.topicArn }, { merge: true });
  } else {
    res = await Prov.resendSetupDomain(pctx, { domain });
    await runtimeRef(deps.db).set({ resend_domain_id: res.domainId }, { merge: true });
  }
  const email = { domain, provider, records: res.records, verified: false, checks: {}, prepared_at_ms: now, checked_at_ms: null };
  await statusRef(deps.db).set({ email }, { merge: true });
  await audit(deps.db, actor, 'messaging_domain_prepared', { domain, provider }, now);
  M.resetCache();
  return { email };
}

async function domainCheck(deps, ctx, actor, now) {
  const { domain, provider } = ctx.settings.email;
  if (!domain) fail('Salve o domínio primeiro (aba E-mail → Domínio).');
  const pctx = providerCtx(deps, ctx);
  const r = provider === 'ses'
    ? await Prov.sesDomainStatus(pctx, { domain })
    : await Prov.resendDomainStatus(pctx, { domainId: ctx.runtime.resend_domain_id });
  const anterior = ctx.status.email || {};
  const email = {
    domain, provider, records: r.records, verified: r.verified, checks: r.checks, account: r.account || null,
    prepared_at_ms: anterior.prepared_at_ms || null, checked_at_ms: now,
    verified_at_ms: r.verified ? anterior.verified_at_ms || now : null,
    webhook_confirmed_at_ms: anterior.webhook_confirmed_at_ms || null,
  };
  await statusRef(deps.db).set({ email }, { merge: true });
  if (r.verified && !anterior.verified) await audit(deps.db, actor, 'messaging_domain_verified', { domain, provider }, now);
  M.resetCache();
  return { email };
}

/* ------------------------------------------------------- testes ------- */

const SAMPLE = {
  title: 'Reserva confirmada',
  message: 'Sua reserva na Arena Central para sábado, 18h, foi confirmada. Leve a raquete e chegue 10 minutos antes.',
  link: '/minhas-reservas',
  type: 'generic',
};

async function recordTest(db, { channel, r, actor, toMasked, now, kind = 'test' }) {
  const { day, month } = P.partesLocais(now);
  await db.collection(M.OUTBOX).doc(`${kind}_${channel}_${now}_${crypto.randomBytes(3).toString('hex')}`).set({
    kind, channel, user_id: actor.uid, status: 'sent', reason: kind, provider: r.provider, provider_id: r.id || null,
    cost_brl: r.cost || 0, segments: r.segments || 0, counted: false, day, month, k_day: `${day}|${channel}`,
    k_month: `${month}|${channel}`, to_masked: toMasked, created_at_ms: now, updated_at_ms: now, sent_at_ms: now,
    expire_at_ms: now + M.KEEP_MS,
  });
}

async function sendTest(deps, ctx, actor, data, now) {
  const channel = String(data.channel || '');
  if (!P.EXTERNAL_CHANNELS.includes(channel)) fail('Canal desconhecido.', 'invalid-argument');
  const falta = M.missing(ctx)[channel].filter((f) => f !== 'disabled');
  if (falta.length) fail(`Ainda falta configurar: ${falta.join(', ')}.`);
  const lang = Tpl.langOf(data.lang);
  try {
    if (channel === 'email') {
      const to = P.normalizeEmailAddress(data.to || actor.email);
      if (!to) fail('Informe um e-mail válido.', 'invalid-argument');
      const m = Tpl.systemEmail('test', { language: lang, settings: ctx.settings });
      const r = await M.sendVia(deps, ctx, 'email', { ...m, to });
      await recordTest(deps.db, { channel, r, actor, toMasked: P.maskEmail(to), now });
      return { ok: true, to: P.maskEmail(to), id: r.id };
    }
    const to = P.normalizePhone(data.to);
    if (!to) fail('Informe um celular válido, com DDD (ex.: 51 99999-8888).', 'invalid-argument');
    const classified = { trust: 'server', area: 'arenas', essential: false };
    const msg = channel === 'whatsapp'
      ? (() => {
        const w = Tpl.whatsappNotice({ notice: SAMPLE, classified, language: lang });
        return { to, template: ctx.settings.whatsapp.template_aviso, lang: w.lang, params: w.params, button: w.button };
      })()
      : { to, body: Tpl.smsNotice({ notice: SAMPLE, classified, language: lang, settings: ctx.settings }) };
    const r = await M.sendVia(deps, ctx, channel, msg);
    await recordTest(deps.db, { channel, r, actor, toMasked: P.maskPhone(to), now });
    return { ok: true, to: P.maskPhone(to), id: r.id, cost_brl: r.cost };
  } catch (err) {
    if (err instanceof ActionError) throw err;
    return { ok: false, error: String((err && err.message) || err).slice(0, 400) };
  }
}

/* -------------------------------------------------------------- push --- */

/** Códigos do FCM que querem dizer "este aparelho não recebe mais" (os mesmos de `pushOnNotificationCreate`). */
const FCM_TOKEN_MORTO = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Um push de verdade para os aparelhos em que o PRÓPRIO admin ativou o push:
 * a única prova de que chave, aparelho e Firebase Cloud Messaging conversam.
 * Aparelho que o FCM diz que morreu sai da lista, como no envio normal.
 */
async function pushTest(deps, ctx, actor, data) {
  const snap = await deps.db.collection('push_tokens').where('user_id', '==', actor.uid).get();
  const docs = snap.docs.filter((d) => d.data() && d.data().token);
  if (!docs.length) return { ok: false, devices: 0, sent: 0, failed: 0, removed: 0, errors: [] };
  const m = Tpl.pushTest(data.lang);
  const link = `${ctx.settings.public_origin}/configuracoes#notificacoes-push`;
  let res;
  try {
    res = await deps.fcm.sendEachForMulticast({
      notification: { title: m.title, body: m.body },
      webpush: { fcmOptions: { link }, notification: { icon: '/pwa-192.png', badge: '/pwa-192.png' } },
      data: { link, type: 'push_test', teste: '1' },
      tokens: docs.map((d) => d.data().token),
    });
  } catch (err) {
    return { ok: false, devices: docs.length, sent: 0, failed: docs.length, removed: 0, errors: [String((err && (err.code || err.message)) || err).slice(0, 200)] };
  }
  const mortos = [];
  const erros = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = (r.error && r.error.code) || 'unknown';
    erros.push(code);
    if (FCM_TOKEN_MORTO.has(code)) mortos.push(docs[i].ref);
  });
  if (mortos.length) {
    const b = deps.db.batch();
    mortos.forEach((ref) => b.delete(ref));
    await b.commit().catch(() => {});
  }
  return {
    ok: res.successCount > 0, devices: docs.length, sent: res.successCount, failed: res.failureCount,
    removed: mortos.length, errors: [...new Set(erros)].slice(0, 5),
  };
}

function preview(ctx, data) {
  const lang = Tpl.langOf(data.lang);
  const kind = String(data.kind || 'notice');
  const o = ctx.settings.public_origin;
  const urls = { settings: `${o}/configuracoes#email-e-celular`, unsubscribe: `${o}/api/mensagens/sair?t=exemplo`, report: `${o}/api/mensagens/denunciar?t=exemplo` };
  if (kind === 'digest') {
    const items = [
      { notice: SAMPLE, classified: { trust: 'server', area: 'arenas' } },
      { notice: { title: 'Nova mensagem de Ana', message: 'Vamos jogar amanhã às 19h?', link: '/chat' }, classified: { trust: 'user', area: 'social' } },
      { notice: { title: 'Vagas abertas no dia de jogo', message: 'Ainda há 3 vagas no Play de sexta.', link: '/dia-de-jogo' }, classified: { trust: 'server', area: 'jogos' } },
    ];
    return { email: Tpl.digestEmail({ items, language: lang, settings: ctx.settings, urls }) };
  }
  if (kind === 'password_reset' || kind === 'verify' || kind === 'test') {
    return { email: Tpl.systemEmail(kind, { language: lang, settings: ctx.settings, actionUrl: `${o}/login` }) };
  }
  const user = kind === 'notice_user';
  const notice = user
    ? { title: 'Convite para dupla', message: 'Oi! Quer fazer dupla comigo no torneio de sábado? Veja em www.exemplo.com', link: '/torneios', sent_by: 'exemplo' }
    : SAMPLE;
  const classified = { trust: user ? 'user' : 'server', area: user ? 'torneios' : 'arenas', essential: false, sender: user ? 'exemplo' : null };
  return {
    email: Tpl.noticeEmail({ notice, classified, language: lang, settings: ctx.settings, senderName: user ? 'Ana Souza' : '', urls }),
    whatsapp: Tpl.whatsappNotice({ notice, classified, language: lang }),
    sms: Tpl.smsNotice({ notice, classified, language: lang, settings: ctx.settings }),
  };
}

/* ------------------------------------------- por que não chegou? ------- */

async function resolveUid(deps, query) {
  const q = String(query || '').trim();
  if (!q) fail('Informe o e-mail ou o identificador da conta.', 'invalid-argument');
  if (q.includes('@')) {
    try { return (await deps.auth.getUserByEmail(q.toLowerCase())).uid; } catch (_) { fail('Nenhuma conta com esse e-mail.', 'not-found'); }
  }
  if (!/^[A-Za-z0-9]{6,128}$/.test(q)) fail('Identificador inválido.', 'invalid-argument');
  return q;
}

const outboxRow = (d) => {
  const x = d.data() || {};
  return {
    id: d.id, kind: x.kind || 'notice', channel: x.channel, status: x.status, reason: x.reason || '', area: x.area || '',
    to: x.to_masked || '', provider: x.provider || '', error: x.error || '', cost_brl: x.cost_brl || 0,
    created_at_ms: x.created_at_ms || null, updated_at_ms: x.updated_at_ms || null, user_id: x.user_id || '', trust: x.trust || '',
  };
};

async function explainUser(deps, ctx, actor, data, now) {
  const uid = await resolveUid(deps, data.query);
  const user = await M.loadUser(deps, uid);
  if (!user.exists) fail('Cadastro não encontrado.', 'not-found');
  const ready = M.readiness(ctx);
  const nSnap = await deps.db.collection('notifications').where('user_id', '==', uid).limit(150).get();
  const avisos = nSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
    .sort((a, b) => (Number(b.created_at_ms) || 0) - (Number(a.created_at_ms) || 0)).slice(0, 15);
  const decisions = avisos.map((n) => {
    const c = P.classifyNotice(n, { senderIsAdmin: Boolean(n.broadcast) });
    const porCanal = {};
    P.EXTERNAL_CHANNELS.forEach((ch) => {
      porCanal[ch] = c.trust === 'legacy' ? { action: 'skip', reason: 'legacy_notice' } : P.decideChannel(ch, c, {
        settings: ctx.settings, prefs: user.prefs, now, flagOn: ctx.flagOn, ready,
        user: { email: user.email, emailVerified: user.emailVerified, phoneVerified: Boolean(user.phone) },
      });
    });
    porCanal.push = P.pushAllowed(c, { settings: ctx.settings, prefs: user.prefs, now, flagOn: ctx.flagOn });
    return { id: n.id, title: String(n.title || '').slice(0, 120), area: c.area, trust: c.trust, created_at_ms: n.created_at_ms || null, read: n.read === true, channels: porCanal };
  });
  const oSnap = await deps.db.collection(M.OUTBOX).where('user_id', '==', uid).limit(200).get();
  const outbox = oSnap.docs.map(outboxRow).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0)).slice(0, 30);
  const sup = {};
  for (const ch of P.EXTERNAL_CHANNELS) {
    const dest = ch === 'email' ? user.email : user.phone;
    // eslint-disable-next-line no-await-in-loop
    sup[ch] = dest ? (await deps.db.collection(M.SUPPRESSIONS).doc(M.suppressionId(ch, dest)).get()).exists : false;
  }
  await deps.db.collection('admin_access_logs').add({
    admin_uid: actor.uid, admin_email: actor.email || '', target_uid: uid, target_name_snapshot: user.name || '',
    action: 'messaging_explain', fields: ['notifications', 'message_outbox'], reason_category: 'suporte',
    reason_text: 'Por que não chegou (Comunicações)', result: 'ok', at: new Date(now), at_ms: now,
  });
  return {
    uid,
    name: user.name,
    closed: user.closed,
    email: { masked: P.maskEmail(user.email), verified: user.emailVerified, suppressed: sup.email },
    phone: { masked: P.maskPhone(user.phone), verified: Boolean(user.phone), suppressed_whatsapp: sup.whatsapp, suppressed_sms: sup.sms },
    prefs: user.prefs,
    decisions,
    outbox,
  };
}

/* ----------------------------------------------- bloqueio, denúncias --- */

async function suppressionList(deps) {
  const s = await deps.db.collection(M.SUPPRESSIONS).orderBy('created_at_ms', 'desc').limit(150).get();
  return {
    items: s.docs.map((d) => {
      const x = d.data() || {};
      return { id: d.id, channel: x.channel, masked: x.masked || '', reason: x.reason || '', source: x.source || '', created_at_ms: x.created_at_ms || null };
    }),
  };
}

async function suppressionRemove(deps, ctx, actor, data, now) {
  const id = String(data.id || '');
  if (!/^[0-9a-f]{64}$/.test(id)) fail('Item inválido.', 'invalid-argument');
  const ref = deps.db.collection(M.SUPPRESSIONS).doc(id);
  const s = await ref.get();
  if (!s.exists) return { removed: false };
  const x = s.data() || {};
  if (x.channel === 'email' && x.address && ctx.settings.email.provider === 'ses') {
    await Prov.sesUnsuppress(providerCtx(deps, ctx), x.address).catch(() => null);
  }
  await ref.delete();
  await audit(deps.db, actor, 'messaging_suppression_removed', { channel: x.channel, masked: x.masked || '', reason: x.reason || '' }, now);
  return { removed: true };
}

async function nomes(db, uids) {
  const unicos = [...new Set(uids.filter(Boolean))].slice(0, 100);
  const out = {};
  if (!unicos.length) return out;
  const snaps = await db.getAll(...unicos.map((u) => db.collection('users').doc(u)));
  snaps.forEach((s) => { const d = s.exists ? s.data() || {} : {}; out[s.id] = d.platform_name || d.full_name || ''; });
  return out;
}

async function reportsList(deps) {
  const s = await deps.db.collection(M.REPORTS).orderBy('created_at_ms', 'desc').limit(100).get();
  const rows = s.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  const n = await nomes(deps.db, rows.flatMap((r) => [r.reporter_uid, r.sender_uid]));
  const porRemetente = {};
  rows.forEach((r) => { porRemetente[r.sender_uid] = (porRemetente[r.sender_uid] || 0) + 1; });
  return {
    items: rows.map((r) => ({
      id: r.id, status: r.status || 'open', channel: r.channel || 'email', created_at_ms: r.created_at_ms || null,
      reporter_uid: r.reporter_uid, reporter_name: n[r.reporter_uid] || '', sender_uid: r.sender_uid,
      sender_name: n[r.sender_uid] || '', sender_reports: porRemetente[r.sender_uid] || 1, note: r.note || '',
    })),
  };
}

async function reportResolve(deps, actor, data, now) {
  const id = String(data.id || '');
  const status = data.status === 'dismissed' ? 'dismissed' : 'resolved';
  if (!/^[0-9a-f]{40}$/.test(id)) fail('Denúncia inválida.', 'invalid-argument');
  const note = typeof data.note === 'string' ? data.note.trim().slice(0, 500) : '';
  await deps.db.collection(M.REPORTS).doc(id).set({ status, note, resolved_by: actor.uid, resolved_at_ms: now }, { merge: true });
  await audit(deps.db, actor, 'messaging_report_resolved', { id, status }, now);
  return { ok: true };
}

/* ---------------------------------------------------------- WhatsApp --- */

async function whatsappCheck(deps, ctx, now) {
  const pctx = providerCtx(deps, ctx);
  const out = { checked_at_ms: now };
  try { out.templates = await Prov.whatsappTemplateStatus(pctx); } catch (err) { out.templates_error = String(err.message).slice(0, 300); }
  try { out.number = await Prov.whatsappNumberStatus(pctx); } catch (err) { out.number_error = String(err.message).slice(0, 300); }
  const anterior = ctx.status.whatsapp || {};
  const whatsapp = {
    templates: out.templates || anterior.templates || [], number: out.number || anterior.number || null,
    checked_at_ms: now, templates_error: out.templates_error || null, number_error: out.number_error || null,
    webhook_confirmed_at_ms: anterior.webhook_confirmed_at_ms || null,
  };
  await statusRef(deps.db).set({ whatsapp }, { merge: true });
  M.resetCache();
  return { whatsapp };
}

async function whatsappTemplatesCreate(deps, ctx, actor, now) {
  const results = await Prov.whatsappCreateTemplates(providerCtx(deps, ctx), ctx.settings.public_origin);
  await audit(deps.db, actor, 'messaging_whatsapp_templates_created', { results: results.map((r) => `${r.name}/${r.language}:${r.status}`) }, now);
  const check = await whatsappCheck(deps, await M.loadContext(deps.db, { now, fresh: true }), now);
  return { results, ...check };
}

async function whatsappVerifyToken(deps, actor, now) {
  const token = crypto.randomBytes(18).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 24);
  await deps.db.collection('platform_secrets').doc('messaging').set({ whatsapp: { verify_token: token } }, { merge: true });
  await audit(deps.db, actor, 'messaging_whatsapp_verify_token', {}, now);
  M.resetCache();
  return { token };
}

async function outboxList(deps, data) {
  const { db } = deps;
  let docs;
  if (data.uid && /^[A-Za-z0-9]{6,128}$/.test(String(data.uid))) {
    docs = (await db.collection(M.OUTBOX).where('user_id', '==', String(data.uid)).limit(200).get()).docs;
  } else {
    docs = (await db.collection(M.OUTBOX).orderBy('created_at_ms', 'desc').limit(150).get()).docs;
  }
  let rows = docs.map(outboxRow);
  if (data.channel) rows = rows.filter((r) => r.channel === data.channel);
  if (data.status) rows = rows.filter((r) => r.status === data.status);
  rows.sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
  return { items: rows.slice(0, 100) };
}

/**
 * Painel admin → Comunicações. `actor`: { uid, email } do admin (conferido
 * pela função antes de chegar aqui).
 */
async function adminAction(deps, actor, data = {}) {
  const now = deps.now || Date.now();
  const ctx = await M.loadContext(deps.db, { now, fresh: true });
  switch (data.action) {
    case 'status': return statusAction(deps, ctx, now);
    case 'save_secrets': return saveSecrets(deps, ctx, actor, data, now);
    case 'email_domain_setup': return domainSetup(deps, ctx, actor, now);
    case 'email_domain_check': return domainCheck(deps, ctx, actor, now);
    case 'send_test': return sendTest(deps, ctx, actor, data, now);
    case 'push_test': return pushTest(deps, ctx, actor, data);
    case 'preview': return preview(ctx, data);
    case 'explain_user': return explainUser(deps, ctx, actor, data, now);
    case 'suppression_list': return suppressionList(deps);
    case 'suppression_remove': return suppressionRemove(deps, ctx, actor, data, now);
    case 'reports_list': return reportsList(deps);
    case 'report_resolve': return reportResolve(deps, actor, data, now);
    case 'whatsapp_check': return whatsappCheck(deps, ctx, now);
    case 'whatsapp_templates_create': return whatsappTemplatesCreate(deps, ctx, actor, now);
    case 'whatsapp_verify_token': return whatsappVerifyToken(deps, actor, now);
    case 'outbox_list': return outboxList(deps, data);
    default: return fail('Ação desconhecida.', 'invalid-argument');
  }
}

/* ------------------------------------------------------------ pessoa --- */

const CODE_TTL_MS = 10 * 60000;
const MAX_CODE_SENDS_DAY = 5;
const MAX_CODE_ATTEMPTS = 5;
const MAX_SYSTEM_EMAILS_DAY = 3;

const codeHash = (uid, code) => crypto.createHash('sha256').update(`${uid}|${code}`).digest('hex');

/** Por qual canal o código vai: o escolhido pelo admin, ou o primeiro pronto. */
function codeChannel(ctx, pedido) {
  const ready = M.readiness(ctx);
  const waOk = ready.whatsapp && Boolean(M.approvedWaLang(ctx, ctx.settings.whatsapp.template_codigo, 'pt'));
  const pref = ctx.settings.verification.channel;
  const ordem = pedido && ['whatsapp', 'sms'].includes(pedido) ? [pedido, pedido === 'whatsapp' ? 'sms' : 'whatsapp']
    : pref === 'sms' ? ['sms', 'whatsapp'] : ['whatsapp', 'sms'];
  return ordem.find((c) => (c === 'whatsapp' ? waOk : ready.sms)) || '';
}

async function countSystem(deps, uid, day, tipo) {
  try {
    return (await deps.db.collection(M.OUTBOX).where('k_system', '==', `${uid}|${day}|${tipo}`).count().get()).data().count || 0;
  } catch (_) { return 0; }
}

async function recordSystem(deps, { uid, channel, tipo, r, toMasked, now }) {
  const { day, month } = P.partesLocais(now);
  await deps.db.collection(M.OUTBOX).doc(`${tipo}_${uid}_${now}`).set({
    kind: tipo, channel, user_id: uid, status: 'sent', reason: tipo, provider: r.provider, provider_id: r.id || null,
    cost_brl: r.cost || 0, segments: r.segments || 0, counted: false, day, month, k_system: `${uid}|${day}|${tipo}`,
    k_day: `${day}|${channel}`, k_month: `${month}|${channel}`, to_masked: toMasked,
    created_at_ms: now, updated_at_ms: now, sent_at_ms: now, expire_at_ms: now + M.KEEP_MS,
  });
}

async function userStatus(deps, ctx, uid) {
  const user = await M.loadUser(deps, uid);
  const v = (await deps.db.collection('phone_verifications').doc(uid).get());
  const pend = v.exists ? v.data() || {} : null;
  const ready = M.readiness(ctx);
  return {
    flagOn: ctx.flagOn,
    ready: ctx.flagOn ? ready : { email: false, whatsapp: false, sms: false, push: false },
    code_channel: ctx.flagOn ? codeChannel(ctx) : '',
    email: { masked: P.maskEmail(user.email), verified: user.emailVerified },
    phone: { masked: P.maskPhone(user.phone), verified: Boolean(user.phone) },
    pending: pend && Number(pend.expires_ms) > (deps.now || Date.now()) ? { masked: P.maskPhone(pend.phone), channel: pend.channel, expires_ms: pend.expires_ms } : null,
  };
}

async function phoneSendCode(deps, ctx, uid, data, now) {
  if (!ctx.flagOn) fail('Os avisos por celular ainda não estão disponíveis.');
  const phone = P.normalizePhone(data.phone);
  if (!phone) fail('Informe um celular válido, com DDD (ex.: 51 99999-8888).', 'invalid-argument');
  const channel = codeChannel(ctx, data.channel);
  if (!channel) fail('O envio de código por celular ainda não está disponível.');
  const ref = deps.db.collection('phone_verifications').doc(uid);
  const s = await ref.get();
  const ant = s.exists ? s.data() || {} : {};
  const envios = (Array.isArray(ant.sends) ? ant.sends : []).filter((t) => now - Number(t) < 86400000);
  if (envios.length >= MAX_CODE_SENDS_DAY) fail('Você já pediu muitos códigos hoje. Tente de novo amanhã.', 'resource-exhausted');
  if (envios.length && now - Math.max(...envios) < 60000) fail('Espere um minuto antes de pedir outro código.', 'resource-exhausted');
  // Orçamento: o código também custa.
  try {
    // eslint-disable-next-line global-require
    const { AggregateField } = require('firebase-admin/firestore');
    const r = await deps.db.collection(M.OUTBOX).where('month', '==', P.partesLocais(now).month).aggregate({ total: AggregateField.sum('cost_brl') }).get();
    const unit = ctx.settings[channel].unit_cost_brl;
    if (unit > 0 && (Number(r.data().total) || 0) + unit > ctx.settings.limits.monthly_budget_brl) fail('O envio por celular está pausado no momento. Tente mais tarde.');
  } catch (err) { if (err instanceof ActionError) throw err; }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const user = await M.loadUser(deps, uid);
  const msg = channel === 'whatsapp'
    ? { to: phone, template: ctx.settings.whatsapp.template_codigo, lang: Tpl.langOf(user.language), params: [code], button: code }
    : { to: phone, body: Tpl.smsCode(code, user.language) };
  let r;
  try {
    r = await M.sendVia(deps, ctx, channel, msg);
  } catch (err) {
    fail(`Não foi possível mandar o código agora (${String(err.message || err).slice(0, 120)}).`, 'unavailable');
  }
  await ref.set({
    phone, phone_masked: P.maskPhone(phone), channel, code_hash: codeHash(uid, code), attempts: 0,
    expires_ms: now + CODE_TTL_MS, sends: [...envios, now].slice(-MAX_CODE_SENDS_DAY), created_at_ms: now,
  });
  await recordSystem(deps, { uid, channel, tipo: 'verification', r, toMasked: P.maskPhone(phone), now });
  return { channel, masked: P.maskPhone(phone), expires_ms: now + CODE_TTL_MS };
}

async function phoneConfirm(deps, uid, data, now) {
  const code = String(data.code || '').replace(/\D/g, '');
  if (code.length !== 6) fail('O código tem 6 números.', 'invalid-argument');
  const ref = deps.db.collection('phone_verifications').doc(uid);
  const s = await ref.get();
  if (!s.exists) fail('Peça um código primeiro.');
  const v = s.data() || {};
  if (Number(v.expires_ms) < now) fail('O código venceu. Peça outro.');
  if ((Number(v.attempts) || 0) >= MAX_CODE_ATTEMPTS) fail('Muitas tentativas. Peça outro código.', 'resource-exhausted');
  const a = Buffer.from(codeHash(uid, code));
  const b = Buffer.from(String(v.code_hash || ''));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await ref.set({ attempts: (Number(v.attempts) || 0) + 1 }, { merge: true });
    fail('Código errado. Confira e tente de novo.', 'invalid-argument');
  }
  await deps.db.collection('users').doc(uid).set({ phone_verified_number: v.phone, phone_verified_at: now }, { merge: true });
  await ref.delete();
  // Confirmar o número de novo é um novo "sim": o PARAR antigo deixa de valer.
  await Promise.all(['whatsapp', 'sms'].map((ch) => deps.db.collection(M.SUPPRESSIONS).doc(M.suppressionId(ch, v.phone)).delete().catch(() => null)));
  return { ok: true, masked: P.maskPhone(v.phone) };
}

async function phoneForget(deps, uid) {
  await deps.db.collection('users').doc(uid).set({
    phone_verified_number: FieldValue.delete(), phone_verified_at: FieldValue.delete(),
    notification_channels: { whatsapp: { on: false }, sms: { on: false } },
  }, { merge: true });
  await deps.db.collection('phone_verifications').doc(uid).delete().catch(() => null);
  return { ok: true };
}

/** E-mail de sistema pelo nosso provedor. `handled: false` ⇒ o app usa o do Firebase. */
async function systemMail(deps, ctx, { uid, email, language, tipo, actionUrl, now }) {
  if (!ctx.flagOn || !M.readiness(ctx).email) return { handled: false };
  const sup = await deps.db.collection(M.SUPPRESSIONS).doc(M.suppressionId('email', email)).get();
  if (sup.exists) return { handled: false };
  const { day } = P.partesLocais(now);
  if (await countSystem(deps, uid, day, tipo) >= MAX_SYSTEM_EMAILS_DAY) return { handled: true, limited: true };
  const m = Tpl.systemEmail(tipo === 'login' ? 'password_reset' : tipo === 'verify' ? 'verify' : 'test', { language, settings: ctx.settings, actionUrl });
  try {
    const r = await M.sendVia(deps, ctx, 'email', { ...m, to: email });
    await recordSystem(deps, { uid, channel: 'email', tipo, r, toMasked: P.maskEmail(email), now });
    return { handled: true };
  } catch (_) {
    return { handled: false };
  }
}

async function emailVerifySend(deps, ctx, uid, now) {
  const user = await M.loadUser(deps, uid);
  if (!user.email) fail('A sua conta não tem e-mail.');
  if (user.emailVerified) return { handled: true, already: true };
  const url = await deps.auth.generateEmailVerificationLink(user.email, { url: `${ctx.settings.public_origin}/configuracoes#email-e-celular` });
  return systemMail(deps, ctx, { uid, email: user.email, language: user.language, tipo: 'verify', actionUrl: url, now });
}

async function emailTest(deps, ctx, uid, now) {
  if (!ctx.flagOn || !M.readiness(ctx).email) fail('O envio de e-mails ainda não está disponível.');
  const user = await M.loadUser(deps, uid);
  if (!user.email || !user.emailVerified) fail('Confirme o seu e-mail primeiro.');
  const { day } = P.partesLocais(now);
  if (await countSystem(deps, uid, day, 'user_test') >= MAX_SYSTEM_EMAILS_DAY) fail('Você já mandou testes demais hoje.', 'resource-exhausted');
  const classified = { trust: 'server', area: 'arenas', essential: false };
  const m = Tpl.noticeEmail({ notice: SAMPLE, classified, language: user.language, settings: ctx.settings, urls: { settings: `${ctx.settings.public_origin}/configuracoes#email-e-celular` } });
  const r = await M.sendVia(deps, ctx, 'email', { ...m, subject: `[Teste] ${m.subject}`, to: user.email });
  await recordSystem(deps, { uid, channel: 'email', tipo: 'user_test', r, toMasked: P.maskEmail(user.email), now });
  return { ok: true, masked: P.maskEmail(user.email) };
}

async function userAction(deps, uid, data = {}) {
  const now = deps.now || Date.now();
  const ctx = await M.loadContext(deps.db, { now });
  switch (data.action) {
    case 'status': return userStatus(deps, ctx, uid);
    case 'phone_send_code': return phoneSendCode(deps, ctx, uid, data, now);
    case 'phone_confirm': return phoneConfirm(deps, uid, data, now);
    case 'phone_forget': return phoneForget(deps, uid);
    case 'email_verify_send': return emailVerifySend(deps, ctx, uid, now);
    case 'email_test': return emailTest(deps, ctx, uid, now);
    default: return fail('Ação desconhecida.', 'invalid-argument');
  }
}

/**
 * "Esqueci a senha" pelo nosso provedor, quando o admin ligou. Sem login.
 * Nunca diz se o e-mail existe: `handled: true` para conta inexistente também.
 */
async function authEmailAction(deps, data = {}) {
  const now = deps.now || Date.now();
  if (data.action !== 'password_reset') fail('Ação desconhecida.', 'invalid-argument');
  const ctx = await M.loadContext(deps.db, { now });
  if (!ctx.flagOn || !ctx.settings.email.login_emails || !M.readiness(ctx).email) return { handled: false };
  const email = P.normalizeEmailAddress(data.email);
  if (!email) return { handled: false };
  let u;
  try { u = await deps.auth.getUserByEmail(email); } catch (_) { return { handled: true }; }
  const url = await deps.auth.generatePasswordResetLink(email, { url: `${ctx.settings.public_origin}/login` });
  let language = data.lang || null;
  try {
    const s = await deps.db.collection('users').doc(u.uid).get();
    if (s.exists && s.data().language) language = s.data().language;
  } catch (_) { /* fica o idioma da tela */ }
  return systemMail(deps, ctx, { uid: u.uid, email, language, tipo: 'login', actionUrl: url, now });
}

module.exports = {
  ActionError,
  SECRET_FIELDS,
  secretsSummary,
  validateSecrets,
  codeChannel,
  adminAction,
  userAction,
  authEmailAction,
  preview,
};
