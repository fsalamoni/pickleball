/**
 * AVISOS POR E-MAIL E CELULAR — a regra de QUEM recebe O QUÊ e POR ONDE.
 *
 * Domínio puro (sem I/O). Toda decisão de canal sai daqui: o gatilho que
 * entrega o aviso (`messaging.js`), a explicação do painel admin ("por que
 * fulano não recebeu?") e, pela CÓPIA em
 * `src/modules/messaging/domain/policy.js`, a tabela das Configurações da
 * pessoa. `messagingPolicy.parity.test.js` roda as duas cópias sobre os mesmos
 * casos e exige o mesmo resultado — mexer num lado só quebra o teste.
 *
 * Três camadas decidem, nesta ordem:
 *  1. o ADMIN (`platform_settings/messaging`): o canal está ligado e
 *     configurado? a área pode ir por ele (desligado / a pessoa escolhe /
 *     sempre)? qual é o padrão de quem nunca mexeu?
 *  2. a PESSOA (`users.notification_channels`): o que ela escolheu por canal
 *     e por área, o consentimento de novidades, o horário silencioso;
 *  3. o DESTINO: e-mail confirmado, telefone confirmado.
 * Tetos, supressão e orçamento dependem de contagem no banco e ficam no
 * gatilho, com a conta pura em `capReason`.
 */

const { noticeArea } = require('./notificationPrefs');

const AREAS = Object.freeze([
  'jogos', 'torneios', 'arenas', 'clubes', 'aulas', 'treino',
  'mercado', 'federacoes', 'social', 'promocoes', 'gamificacao', 'conta', 'outros',
]);
/** Canais que saem da plataforma (e-mail, WhatsApp, SMS). */
const EXTERNAL_CHANNELS = Object.freeze(['email', 'whatsapp', 'sms']);
/** Todos os canais com escolha por área (o push já existia; ganha área aqui). */
const CHANNELS = Object.freeze(['email', 'whatsapp', 'sms', 'push']);
const EMAIL_MODES = Object.freeze(['imediato', 'diario', 'semanal', 'nao']);
const AREA_MODES = Object.freeze(['off', 'optional', 'always']);
const EMAIL_PROVIDERS = Object.freeze(['ses', 'resend']);
const SMS_PROVIDERS = Object.freeze(['twilio', 'zenvia']);
const VERIFY_CHANNELS = Object.freeze(['auto', 'whatsapp', 'sms']);
const TIME_ZONE = 'America/Sao_Paulo';

/** Áreas de aviso com prazo ou dinheiro: são as que o padrão manda na hora. */
const IMPORTANT_AREAS = Object.freeze(['jogos', 'torneios', 'arenas', 'aulas', 'mercado', 'federacoes', 'conta']);

function defaultMatrix() {
  const m = {};
  AREAS.forEach((area) => {
    const importante = IMPORTANT_AREAS.includes(area);
    const emailPadrao = importante ? 'imediato'
      : { social: 'imediato', clubes: 'diario', treino: 'diario', gamificacao: 'semanal', promocoes: 'nao', outros: 'diario' }[area];
    m[area] = {
      email: { mode: 'optional', default: emailPadrao },
      whatsapp: { mode: importante ? 'optional' : 'off', default: importante },
      sms: { mode: ['jogos', 'arenas', 'aulas'].includes(area) ? 'optional' : 'off', default: ['jogos', 'arenas', 'aulas'].includes(area) },
      push: { mode: 'optional', default: true },
    };
  });
  return m;
}

const DEFAULT_SETTINGS = Object.freeze({
  public_origin: 'https://picklerush.web.app',
  email: {
    enabled: false,
    provider: 'ses',
    domain: '',
    from_local: 'avisos',
    from_name: 'PickleRush',
    reply_to: '',
    postal_address: '',
    footer_note: '',
    ses_region: 'sa-east-1',
    resend_region: 'sa-east-1',
    login_emails: false,
  },
  whatsapp: {
    enabled: false,
    graph_version: 'v23.0',
    phone_number_id: '',
    waba_id: '',
    template_aviso: 'picklerush_aviso',
    template_codigo: 'picklerush_codigo',
    unit_cost_brl: 0.035,
  },
  sms: {
    enabled: false,
    provider: 'twilio',
    sender: '',
    unit_cost_brl: 0.1,
    max_chars: 300,
  },
  push: { vapid_public_key: '' },
  verification: { channel: 'auto' },
  limits: {
    email_per_user_day: 20,
    email_per_sender_day: 300,
    per_pair_day: 5,
    whatsapp_per_user_day: 5,
    sms_per_user_day: 3,
    monthly_budget_brl: 100,
    complaint_alert_pct: 0.1,
  },
  quiet_hours: { start: '22:00', end: '07:00' },
  digest: { hour: 8, weekly_day: 1 },
  chat_delay_minutes: 15,
  matrix: defaultMatrix(),
});

/* -------------------------------------------------------- utilidades --- */

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
function num(v, d, min, max) {
  const n = Number(v);
  if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, n));
}

/**
 * A chave pública do Web Push (VAPID) do Firebase: um ponto P-256 sem
 * compressão em base64url — 65 bytes, 87 letras começando por "B". Aceita a
 * colagem com espaços ou "=" no fim. A PRIVADA (43 letras) tem motivo
 * próprio: colada no lugar da pública, nenhum aparelho conseguiria ativar.
 */
function normalizeVapidKey(v) {
  return typeof v === 'string' ? v.replace(/\s+/g, '').replace(/=+$/, '') : '';
}

/** '' quando a chave serve; senão 'empty' | 'private_key' | 'format'. */
function vapidKeyProblem(v) {
  const k = normalizeVapidKey(v);
  if (!k) return 'empty';
  if (!/^[A-Za-z0-9_-]+$/.test(k)) return 'format';
  if (k.length === 43) return 'private_key';
  if (k.length !== 87 || k[0] !== 'B') return 'format';
  return '';
}
const oneOf = (v, lista, d) => (lista.includes(v) ? v : d);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmm = (v, d) => (typeof v === 'string' && HHMM.test(v) ? v : d);

/** Domínio de e-mail (`picklerush.com.br`): minúsculo, sem esquema, sem barra. */
function normalizeDomain(raw) {
  const d = str(raw, 253).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^\.+|\.+$/g, '');
  return /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d) ? d : '';
}

/** A parte antes do @ do remetente (`avisos`). */
function normalizeLocalPart(raw) {
  const l = str(raw, 64).toLowerCase();
  return /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(l) ? l : '';
}

function normalizeEmailAddress(raw) {
  const e = str(raw, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : '';
}

/** Origem pública (links do e-mail): só https, sem barra no fim. */
function normalizeOrigin(raw, d) {
  const o = str(raw, 200).replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o) ? o : d;
}

/* ------------------------------------------------ configuração do admin -- */

function normalizeAreaChannel(channel, raw, padrao) {
  const r = obj(raw);
  const mode = oneOf(r.mode, AREA_MODES, padrao.mode);
  let def;
  if (channel === 'email') def = oneOf(r.default, EMAIL_MODES, padrao.default);
  else def = bool(r.default, padrao.default);
  // "Sempre" com padrão "não" não quer dizer nada: vale "na hora".
  if (mode === 'always' && (def === 'nao' || def === false)) def = channel === 'email' ? 'imediato' : true;
  return { mode, default: def };
}

function normalizeMatrix(raw) {
  const r = obj(raw);
  const padrao = defaultMatrix();
  const m = {};
  AREAS.forEach((area) => {
    m[area] = {};
    CHANNELS.forEach((ch) => {
      m[area][ch] = normalizeAreaChannel(ch, obj(r[area])[ch], padrao[area][ch]);
    });
    // Novidade e promoção dependem de consentimento: nunca são "sempre".
    if (area === 'promocoes') CHANNELS.forEach((ch) => { if (m[area][ch].mode === 'always') m[area][ch].mode = 'optional'; });
  });
  return m;
}

/** A configuração do admin, completa e com tipos certos. Nunca lança. */
function normalizeSettings(raw) {
  const r = obj(raw);
  const D = DEFAULT_SETTINGS;
  const e = obj(r.email);
  const w = obj(r.whatsapp);
  const s = obj(r.sms);
  const l = obj(r.limits);
  const q = obj(r.quiet_hours);
  const dg = obj(r.digest);
  return {
    public_origin: normalizeOrigin(r.public_origin, D.public_origin),
    email: {
      enabled: bool(e.enabled, false),
      provider: oneOf(e.provider, EMAIL_PROVIDERS, D.email.provider),
      domain: normalizeDomain(e.domain),
      from_local: normalizeLocalPart(e.from_local) || D.email.from_local,
      from_name: str(e.from_name, 60).replace(/["<>\r\n]/g, '') || D.email.from_name,
      reply_to: normalizeEmailAddress(e.reply_to),
      postal_address: str(e.postal_address, 200),
      footer_note: str(e.footer_note, 300),
      ses_region: /^[a-z]{2}-[a-z]+-\d$/.test(str(e.ses_region)) ? str(e.ses_region) : D.email.ses_region,
      resend_region: oneOf(e.resend_region, ['us-east-1', 'eu-west-1', 'sa-east-1', 'ap-northeast-1'], D.email.resend_region),
      login_emails: bool(e.login_emails, false),
    },
    whatsapp: {
      enabled: bool(w.enabled, false),
      graph_version: /^v\d{2}\.0$/.test(str(w.graph_version)) ? str(w.graph_version) : D.whatsapp.graph_version,
      phone_number_id: str(w.phone_number_id, 40).replace(/\D/g, ''),
      waba_id: str(w.waba_id, 40).replace(/\D/g, ''),
      template_aviso: /^[a-z0-9_]{1,512}$/.test(str(w.template_aviso, 512)) ? str(w.template_aviso, 512) : D.whatsapp.template_aviso,
      template_codigo: /^[a-z0-9_]{1,512}$/.test(str(w.template_codigo, 512)) ? str(w.template_codigo, 512) : D.whatsapp.template_codigo,
      unit_cost_brl: num(w.unit_cost_brl, D.whatsapp.unit_cost_brl, 0, 10),
    },
    sms: {
      enabled: bool(s.enabled, false),
      provider: oneOf(s.provider, SMS_PROVIDERS, D.sms.provider),
      sender: str(s.sender, 40),
      unit_cost_brl: num(s.unit_cost_brl, D.sms.unit_cost_brl, 0, 10),
      max_chars: Math.round(num(s.max_chars, D.sms.max_chars, 70, 600)),
    },
    push: { vapid_public_key: vapidKeyProblem(obj(r.push).vapid_public_key) ? '' : normalizeVapidKey(obj(r.push).vapid_public_key) },
    verification: { channel: oneOf(obj(r.verification).channel, VERIFY_CHANNELS, 'auto') },
    limits: {
      email_per_user_day: Math.round(num(l.email_per_user_day, D.limits.email_per_user_day, 1, 500)),
      email_per_sender_day: Math.round(num(l.email_per_sender_day, D.limits.email_per_sender_day, 1, 100000)),
      per_pair_day: Math.round(num(l.per_pair_day, D.limits.per_pair_day, 1, 100)),
      whatsapp_per_user_day: Math.round(num(l.whatsapp_per_user_day, D.limits.whatsapp_per_user_day, 1, 100)),
      sms_per_user_day: Math.round(num(l.sms_per_user_day, D.limits.sms_per_user_day, 1, 100)),
      monthly_budget_brl: num(l.monthly_budget_brl, D.limits.monthly_budget_brl, 0, 1000000),
      complaint_alert_pct: num(l.complaint_alert_pct, D.limits.complaint_alert_pct, 0.01, 5),
    },
    quiet_hours: { start: hhmm(q.start, D.quiet_hours.start), end: hhmm(q.end, D.quiet_hours.end) },
    digest: { hour: Math.round(num(dg.hour, D.digest.hour, 0, 23)), weekly_day: Math.round(num(dg.weekly_day, D.digest.weekly_day, 0, 6)) },
    chat_delay_minutes: Math.round(num(r.chat_delay_minutes, D.chat_delay_minutes, 0, 240)),
    matrix: normalizeMatrix(r.matrix),
  };
}

/** Endereço do remetente (`avisos@picklerush.com.br`), ou '' sem domínio. */
function fromAddress(settings) {
  const e = settings.email;
  return e.domain ? `${e.from_local}@${e.domain}` : '';
}

/* --------------------------------------------------- escolha da pessoa --- */

const SENDER_ID = /^[A-Za-z0-9]{1,128}$/;

/** As escolhas da pessoa (`users.notification_channels`), com os padrões. */
function normalizeUserChannels(raw) {
  const r = obj(raw);
  const out = {};
  CHANNELS.forEach((ch) => {
    const c = obj(r[ch]);
    const areas = {};
    Object.entries(obj(c.areas)).forEach(([area, v]) => {
      if (!AREAS.includes(area)) return;
      if (ch === 'email') { if (EMAIL_MODES.includes(v)) areas[area] = v; } else if (typeof v === 'boolean') areas[area] = v;
    });
    // E-mail e push valem desde o começo; WhatsApp e SMS só com o "sim" da pessoa.
    out[ch] = { on: bool(c.on, ch === 'email' || ch === 'push'), areas };
  });
  const q = obj(r.quiet);
  out.marketing = bool(r.marketing, false);
  out.quiet = {
    on: bool(q.on, true),
    start: hhmm(q.start, ''),
    end: hhmm(q.end, ''),
    push: bool(q.push, false),
  };
  out.blocked_senders = Array.isArray(r.blocked_senders)
    ? [...new Set(r.blocked_senders.filter((u) => typeof u === 'string' && SENDER_ID.test(u)))].slice(0, 200) : [];
  return out;
}

/**
 * O valor que vale para a pessoa num canal e numa área, e se ela pode mudar.
 * `value`: no e-mail, um de `EMAIL_MODES`; nos outros, booleano.
 * `lock`: null (a pessoa escolhe) | 'admin_off' | 'admin_always' | 'needs_marketing'.
 */
function effectiveValue(settings, prefs, channel, area) {
  const cell = settings.matrix[area] && settings.matrix[area][channel];
  const off = channel === 'email' ? 'nao' : false;
  if (!cell || cell.mode === 'off') return { value: off, lock: 'admin_off' };
  if (area === 'promocoes' && channel !== 'push' && !prefs.marketing) return { value: off, lock: 'needs_marketing' };
  if (cell.mode === 'always') return { value: cell.default, lock: 'admin_always' };
  const escolhido = prefs[channel] && prefs[channel].areas[area];
  return { value: escolhido === undefined ? cell.default : escolhido, lock: null };
}

/* ------------------------------------------------------- o aviso ------- */

/**
 * O que o servidor sabe do aviso. `trust`:
 *  - 'server': gravado pelo próprio servidor (`origin: 'server'`, que a regra
 *    não deixa o navegador gravar);
 *  - 'user': gravado pelo navegador com `sent_by` (a regra exige que seja a
 *    conta logada) — tem um responsável conhecido, e os tetos valem por ele;
 *  - 'legacy': sem nenhum dos dois (aplicativo antigo) — fica só no sino/push.
 */
function classifyNotice(notice, { senderIsAdmin = false } = {}) {
  const n = obj(notice);
  const trust = n.origin === 'server' ? 'server' : (typeof n.sent_by === 'string' && n.sent_by ? 'user' : 'legacy');
  let area = noticeArea(n);
  if (!AREAS.includes(area)) area = 'outros';
  const essential = trust === 'server' && n.essential === true;
  let broadcast = null;
  const b = obj(n.broadcast);
  // Só o admin da plataforma escolhe canais num aviso em massa — de qualquer
  // outra conta, o campo é ignorado (o aviso segue as regras normais).
  if (trust === 'user' && senderIsAdmin && Object.keys(b).length) {
    broadcast = {
      kind: b.kind === 'novidade' ? 'novidade' : 'servico',
      channels: Array.isArray(b.channels) ? EXTERNAL_CHANNELS.filter((c) => b.channels.includes(c)) : [],
    };
    if (broadcast.kind === 'novidade') area = 'promocoes';
  }
  return { trust, area, essential, broadcast, sender: trust === 'user' ? n.sent_by : null };
}

/* ------------------------------------------------- relógio de Brasília -- */

function partesLocais(ms, tz = TIME_ZONE) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  });
  const p = {};
  f.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: `${p.year}-${p.month}-${p.day}`, month: `${p.year}-${p.month}`,
    minutes: Number(p.hour) * 60 + Number(p.minute), hour: Number(p.hour), weekday: dias[p.weekday],
  };
}

const aMinutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** Está dentro da janela [início, fim)? A janela pode virar a meia-noite. */
function inQuietWindow(minutes, start, end) {
  const a = aMinutos(start);
  const b = aMinutos(end);
  if (a === b) return false;
  return a < b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}

/** A janela silenciosa que vale para a pessoa (a dela, ou a padrão do admin). */
function quietWindow(settings, prefs) {
  return {
    start: prefs.quiet.start || settings.quiet_hours.start,
    end: prefs.quiet.end || settings.quiet_hours.end,
  };
}

/** Quando a janela silenciosa termina, a partir de `now` (ms). */
function quietEndsAt(now, start, end, tz = TIME_ZONE) {
  const { minutes } = partesLocais(now, tz);
  const b = aMinutos(end);
  const faltam = b > minutes ? b - minutes : 24 * 60 - minutes + b;
  return now + faltam * 60000;
}

/* ----------------------------------------------------- a decisão ------- */

/**
 * Por onde UM canal leva este aviso a esta pessoa.
 * @returns {{ action: 'send'|'digest_daily'|'digest_weekly'|'delay'|'skip', reason: string, sendAfter?: number }}
 */
function decideChannel(channel, notice, ctx) {
  const { settings, prefs, user = {}, now = Date.now(), flagOn = false } = ctx;
  const skip = (reason) => ({ action: 'skip', reason });
  if (!flagOn) return skip('flag_off');
  if (!settings[channel] || settings[channel].enabled !== true) return skip('channel_off');
  if (channel === 'email' && !settings.email.domain) return skip('no_domain');
  // `ready` (só no servidor): domínio verificado, chaves e modelos aprovados.
  if (ctx.ready && ctx.ready[channel] === false) return skip('not_ready');
  if (notice.trust === 'legacy') return skip('legacy_notice');
  if (notice.broadcast && !notice.broadcast.channels.includes(channel)) return skip('not_in_broadcast');

  if (channel === 'email') {
    if (!user.email) return skip('no_email');
    if (!user.emailVerified) return skip('email_unverified');
    if (notice.essential) return { action: 'send', reason: 'essential' };
  } else if (!user.phoneVerified) return skip('phone_unverified');

  const { value, lock } = effectiveValue(settings, prefs, channel, notice.area);
  if (lock === 'admin_off') return skip('area_off_admin');
  if (lock === 'needs_marketing') return skip('no_marketing_consent');
  if (lock !== 'admin_always') {
    if (prefs[channel].on !== true) return skip(channel === 'email' ? 'channel_off_user' : 'no_opt_in');
    if (value === 'nao' || value === false) return skip('area_off_user');
  }
  if (notice.sender && prefs.blocked_senders.includes(notice.sender)) return skip('sender_blocked');

  if (channel === 'email') {
    if (value === 'diario') return { action: 'digest_daily', reason: 'digest' };
    if (value === 'semanal') return { action: 'digest_weekly', reason: 'digest' };
    if (notice.area === 'social' && settings.chat_delay_minutes > 0) {
      return { action: 'delay', reason: 'wait_unread', sendAfter: now + settings.chat_delay_minutes * 60000 };
    }
    return { action: 'send', reason: lock === 'admin_always' ? 'admin_always' : 'chosen' };
  }
  if (prefs.quiet.on) {
    const w = quietWindow(settings, prefs);
    if (inQuietWindow(partesLocais(now).minutes, w.start, w.end)) {
      return { action: 'delay', reason: 'quiet_hours', sendAfter: quietEndsAt(now, w.start, w.end) };
    }
  }
  return { action: 'send', reason: lock === 'admin_always' ? 'admin_always' : 'chosen' };
}

/**
 * O push (que já existia) com as escolhas novas: área desligada pelo admin ou
 * pela pessoa, e o horário silencioso quando ela o estende ao push. Só vale
 * com a funcionalidade ligada — desligada, o push segue como sempre.
 */
function pushAllowed(notice, ctx) {
  const { settings, prefs, now = Date.now(), flagOn = false } = ctx;
  if (!flagOn) return { allowed: true, reason: 'flag_off' };
  const { value, lock } = effectiveValue(settings, prefs, 'push', notice.area);
  if (lock === 'admin_off') return { allowed: false, reason: 'area_off_admin' };
  if (lock !== 'admin_always' && (prefs.push.on === false || value === false)) return { allowed: false, reason: 'area_off_user' };
  if (prefs.quiet.on && prefs.quiet.push) {
    const w = quietWindow(settings, prefs);
    if (inQuietWindow(partesLocais(now).minutes, w.start, w.end)) return { allowed: false, reason: 'quiet_hours' };
  }
  return { allowed: true, reason: 'chosen' };
}

/**
 * O teto que este envio passaria, ou null.
 * `counts`: { user, sender, pair } (envios de HOJE) e `month_cost` (R$ já
 * gastos no mês com WhatsApp e SMS, somados).
 */
function capReason(channel, counts, settings, { trust = 'user' } = {}) {
  const L = settings.limits;
  const c = obj(counts);
  const porPessoa = { email: L.email_per_user_day, whatsapp: L.whatsapp_per_user_day, sms: L.sms_per_user_day }[channel];
  if (Number(c.user) >= porPessoa) return 'cap_user';
  if (trust === 'user') {
    if (channel === 'email' && Number(c.sender) >= L.email_per_sender_day) return 'cap_sender';
    if (Number(c.pair) >= L.per_pair_day) return 'cap_pair';
  }
  if (channel !== 'email') {
    const unit = settings[channel].unit_cost_brl;
    if (unit > 0 && (Number(c.month_cost) || 0) + unit > L.monthly_budget_brl) return 'budget';
  }
  return null;
}

/* ------------------------------------------------------ telefone ------- */

/** Telefone em E.164 (`+5551999998888`). Sem DDI, vale o Brasil. Inválido ⇒ ''. */
function normalizePhone(raw) {
  const s = str(raw, 40);
  if (!s) return '';
  let d = s.replace(/\D/g, '');
  if (s.startsWith('+')) return d.length >= 10 && d.length <= 15 ? `+${d}` : '';
  if (d.startsWith('00')) { d = d.slice(2); return d.length >= 10 && d.length <= 15 ? `+${d}` : ''; }
  if (d.length >= 11 && d.length <= 12 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return `+${d}`;
  return '';
}

/** `+5551999998888` → `+55 51 •••••-8888`. */
function maskPhone(e164) {
  const d = String(e164 || '').replace(/\D/g, '');
  if (d.length < 8) return '';
  const fim = d.slice(-4);
  if (d.startsWith('55') && d.length >= 12) return `+55 ${d.slice(2, 4)} •••••-${fim}`;
  return `+${d.slice(0, 2)} •••• ${fim}`;
}

/** `ana.souza@gmail.com` → `a•••a@gmail.com`. */
function maskEmail(email) {
  const e = String(email || '');
  const at = e.indexOf('@');
  if (at < 1) return '';
  const u = e.slice(0, at);
  return `${u[0]}•••${u.length > 1 ? u[u.length - 1] : ''}${e.slice(at)}`;
}

/* -------------------------------------------------------- o texto ------ */

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const DOMINIO_RE = /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|br|io|me|ly|co|app|xyz|info|link|site|online|store|shop|top|click|gg|tk|ru|cn)(?:\.[a-z]{2})?(?:\/[^\s<>"']*)?/gi;

/**
 * Texto escrito por uma PESSOA não leva link para fora da plataforma: o
 * e-mail sai com o nome do PickleRush, e um link ali vira golpe com a nossa
 * assinatura. O único botão é o do próprio aviso, dentro do site.
 */
function defangText(text) {
  return String(text || '').replace(URL_RE, '[link]').replace(DOMINIO_RE, '[link]');
}

/** Caracteres do alfabeto GSM-7 (o SMS "barato", 160 por parte). */
const GSM7 = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà]*$/;

/** Quantas partes um SMS ocupa (é por parte que o provedor cobra). */
function smsSegments(text) {
  const t = String(text || '');
  if (!t) return 0;
  if (GSM7.test(t)) return t.length <= 160 ? 1 : Math.ceil(t.length / 153);
  const n = [...t].length;
  return n <= 70 ? 1 : Math.ceil(n / 67);
}

module.exports = {
  AREAS,
  CHANNELS,
  EXTERNAL_CHANNELS,
  EMAIL_MODES,
  AREA_MODES,
  EMAIL_PROVIDERS,
  SMS_PROVIDERS,
  VERIFY_CHANNELS,
  IMPORTANT_AREAS,
  TIME_ZONE,
  DEFAULT_SETTINGS,
  defaultMatrix,
  normalizeSettings,
  normalizeVapidKey,
  vapidKeyProblem,
  normalizeDomain,
  normalizeEmailAddress,
  fromAddress,
  normalizeUserChannels,
  effectiveValue,
  classifyNotice,
  partesLocais,
  inQuietWindow,
  quietEndsAt,
  decideChannel,
  pushAllowed,
  capReason,
  normalizePhone,
  maskPhone,
  maskEmail,
  defangText,
  smsSegments,
};
