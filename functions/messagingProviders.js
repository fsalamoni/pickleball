/**
 * Os PROVEDORES de e-mail, WhatsApp e SMS — só a conversa HTTP com cada um.
 *
 * Nenhuma dependência nova: tudo por `fetch` (Node 22). A Amazon (SES e SNS)
 * pede requisição assinada (AWS Signature V4), feita aqui mesmo em
 * `signV4` — conferida contra o exemplo publicado pela AWS no teste.
 *
 * Cada função recebe `{ secrets, settings, fetchImpl }` e devolve um objeto
 * simples; erro do provedor vira `ProviderError` com a mensagem que o painel
 * mostra (sem nunca carregar a chave).
 */
const crypto = require('node:crypto');

class ProviderError extends Error {
  constructor(message, { status = 0, code = '', retryable = false } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const sha256Hex = (data) => crypto.createHash('sha256').update(data, 'utf8').digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data, 'utf8').digest();
/** URI-encode do RFC 3986 (o que a AWS espera; `encodeURIComponent` deixa `!'()*`). */
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/* ------------------------------------------------- AWS Signature V4 ---- */

/**
 * Assina uma requisição para a AWS. Devolve os cabeçalhos a mandar (sem
 * `host`, que o `fetch` põe sozinho e que entra na assinatura do mesmo jeito).
 */
function signV4({ method, url, region, service, accessKeyId, secretAccessKey, body = '', headers = {}, now = new Date() }) {
  const u = new URL(url);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const hs = {};
  Object.entries(headers).forEach(([k, v]) => { hs[k.toLowerCase()] = String(v); });
  hs.host = u.host;
  hs['x-amz-date'] = amzDate;
  const nomes = Object.keys(hs).sort();
  const signedHeaders = nomes.join(';');
  const canonicalHeaders = nomes.map((k) => `${k}:${hs[k].trim().replace(/\s+/g, ' ')}\n`).join('');
  const canonicalQuery = [...u.searchParams.entries()]
    .map(([k, v]) => [enc(k), enc(v)])
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : (a[0] < b[0] ? -1 : 1)))
    .map(([k, v]) => `${k}=${v}`).join('&');
  // Fora do S3, cada segmento do caminho é codificado DUAS vezes: o que já
  // está codificado na URL é codificado de novo.
  const canonicalUri = u.pathname.split('/').map((seg) => enc(seg)).join('/') || '/';
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, sha256Hex(body)].join('\n');
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  const out = {};
  Object.entries(headers).forEach(([k, v]) => { out[k] = String(v); });
  out['x-amz-date'] = amzDate;
  out.Authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { headers: out, signature, canonicalRequest };
}

async function lerResposta(res) {
  const texto = await res.text();
  try { return { texto, json: texto ? JSON.parse(texto) : {} }; } catch (_) { return { texto, json: null }; }
}

function erroDoProvedor(nome, res, corpo) {
  const j = corpo.json || {};
  const msg = (j.error && (j.error.message || j.error.error_user_msg)) || j.message || j.Message
    || (j.errors && j.errors[0] && (j.errors[0].message || j.errors[0].title))
    || (corpo.texto && corpo.texto.match(/<Message>([^<]+)<\/Message>/) ? corpo.texto.match(/<Message>([^<]+)<\/Message>/)[1] : '')
    || `HTTP ${res.status}`;
  const code = (j.error && (j.error.code || j.error.type)) || j.code || j.__type || j.name || '';
  return new ProviderError(`${nome}: ${String(msg).slice(0, 300)}`, {
    status: res.status, code: String(code), retryable: res.status === 429 || res.status >= 500,
  });
}

/* ------------------------------------------------------------- SES ----- */

function credenciaisSes(secrets) {
  const s = (secrets && secrets.ses) || {};
  if (!s.access_key_id || !s.secret_access_key) throw new ProviderError('Amazon SES: falta a chave de acesso (Access key ID e Secret).', { code: 'no_credentials' });
  return s;
}

async function awsJson(ctx, { service = 'ses', method, path, body, query }) {
  const { settings, secrets, fetchImpl = fetch } = ctx;
  const cred = credenciaisSes(secrets);
  const region = settings.email.ses_region;
  const host = service === 'ses' ? `email.${region}.amazonaws.com` : `${service}.${region}.amazonaws.com`;
  const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
  const url = `https://${host}${path}${qs}`;
  const corpo = body === undefined ? '' : JSON.stringify(body);
  const { headers } = signV4({
    method, url, region, service, accessKeyId: cred.access_key_id, secretAccessKey: cred.secret_access_key,
    body: corpo, headers: body === undefined ? {} : { 'content-type': 'application/json' },
  });
  const res = await fetchImpl(url, { method, headers, body: body === undefined ? undefined : corpo });
  const lido = await lerResposta(res);
  if (!res.ok) throw erroDoProvedor('Amazon SES', res, lido);
  return lido.json || {};
}

async function awsQuery(ctx, service, params) {
  const { settings, secrets, fetchImpl = fetch } = ctx;
  const cred = credenciaisSes(secrets);
  const region = settings.email.ses_region;
  const url = `https://${service}.${region}.amazonaws.com/`;
  const corpo = new URLSearchParams(params).toString();
  const { headers } = signV4({
    method: 'POST', url, region, service, accessKeyId: cred.access_key_id, secretAccessKey: cred.secret_access_key,
    body: corpo, headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
  });
  const res = await fetchImpl(url, { method: 'POST', headers, body: corpo });
  const lido = await lerResposta(res);
  if (!res.ok) throw erroDoProvedor('Amazon SNS', res, lido);
  return lido.texto;
}

const CONFIG_SET = 'picklerush';
const SNS_TOPIC = 'picklerush-email-events';

async function sesSend(ctx, msg) {
  const conteudo = {
    Simple: {
      Subject: { Data: msg.subject, Charset: 'UTF-8' },
      Body: { Html: { Data: msg.html, Charset: 'UTF-8' }, Text: { Data: msg.text, Charset: 'UTF-8' } },
      ...(msg.headers && Object.keys(msg.headers).length
        ? { Headers: Object.entries(msg.headers).map(([Name, Value]) => ({ Name, Value })) } : {}),
    },
  };
  const r = await awsJson(ctx, {
    method: 'POST',
    path: '/v2/email/outbound-emails',
    body: {
      FromEmailAddress: msg.from,
      Destination: { ToAddresses: [msg.to] },
      ...(msg.replyTo ? { ReplyToAddresses: [msg.replyTo] } : {}),
      Content: conteudo,
      ...(msg.tag ? { EmailTags: [{ Name: 'outbox', Value: msg.tag }] } : {}),
      ...(ctx.useConfigSet ? { ConfigurationSetName: CONFIG_SET } : {}),
    },
  });
  return { id: r.MessageId || '' };
}

/** Os registros de DNS que a Amazon pede para o domínio. */
function sesRecords(domain, tokens, region) {
  const out = (tokens || []).map((tk) => ({
    type: 'CNAME', name: `${tk}._domainkey.${domain}`, value: `${tk}.dkim.amazonses.com`, purpose: 'dkim',
  }));
  out.push({ type: 'MX', name: `mail.${domain}`, value: `feedback-smtp.${region}.amazonses.com`, priority: 10, purpose: 'mail_from' });
  out.push({ type: 'TXT', name: `mail.${domain}`, value: 'v=spf1 include:amazonses.com ~all', purpose: 'spf' });
  out.push({ type: 'TXT', name: `_dmarc.${domain}`, value: 'v=DMARC1; p=none;', purpose: 'dmarc' });
  return out;
}

const jaExiste = (err) => err instanceof ProviderError && (/AlreadyExists/i.test(err.code) || /already exists/i.test(err.message));

/**
 * Prepara o domínio na Amazon: identidade (DKIM), MAIL FROM, o conjunto de
 * configuração e o tópico SNS que traz devoluções e reclamações de volta.
 * Rodar de novo é seguro: o que já existe é lido, não recriado.
 */
async function sesSetupDomain(ctx, { domain, webhookUrl }) {
  let ident;
  try {
    ident = await awsJson(ctx, { method: 'POST', path: '/v2/email/identities', body: { EmailIdentity: domain } });
  } catch (err) {
    if (!jaExiste(err)) throw err;
    ident = await awsJson(ctx, { method: 'GET', path: `/v2/email/identities/${encodeURIComponent(domain)}` });
  }
  await awsJson(ctx, {
    method: 'PUT',
    path: `/v2/email/identities/${encodeURIComponent(domain)}/mail-from`,
    body: { MailFromDomain: `mail.${domain}`, BehaviorOnMxFailure: 'USE_DEFAULT_VALUE' },
  });
  let topicArn = '';
  try {
    await awsJson(ctx, { method: 'POST', path: '/v2/email/configuration-sets', body: { ConfigurationSetName: CONFIG_SET } });
  } catch (err) { if (!jaExiste(err)) throw err; }
  const xml = await awsQuery(ctx, 'sns', { Action: 'CreateTopic', Name: SNS_TOPIC, Version: '2010-03-31' });
  topicArn = (xml.match(/<TopicArn>([^<]+)<\/TopicArn>/) || [])[1] || '';
  if (!topicArn) throw new ProviderError('Amazon SNS: não devolveu o tópico.');
  const conta = topicArn.split(':')[4];
  const politica = {
    Version: '2012-10-17',
    Statement: [{
      Sid: 'PermitirSES', Effect: 'Allow', Principal: { Service: 'ses.amazonaws.com' },
      Action: 'sns:Publish', Resource: topicArn, Condition: { StringEquals: { 'AWS:SourceAccount': conta } },
    }],
  };
  await awsQuery(ctx, 'sns', {
    Action: 'SetTopicAttributes', TopicArn: topicArn, AttributeName: 'Policy', AttributeValue: JSON.stringify(politica), Version: '2010-03-31',
  });
  await awsQuery(ctx, 'sns', {
    Action: 'Subscribe', TopicArn: topicArn, Protocol: 'https', Endpoint: webhookUrl, ReturnSubscriptionArn: 'true', Version: '2010-03-31',
  });
  const destino = {
    Enabled: true,
    MatchingEventTypes: ['BOUNCE', 'COMPLAINT', 'DELIVERY', 'REJECT'],
    SnsDestination: { TopicArn: topicArn },
  };
  try {
    await awsJson(ctx, {
      method: 'POST', path: `/v2/email/configuration-sets/${CONFIG_SET}/event-destinations`,
      body: { EventDestinationName: 'picklerush-sns', EventDestination: destino },
    });
  } catch (err) {
    if (!jaExiste(err)) throw err;
    await awsJson(ctx, {
      method: 'PUT', path: `/v2/email/configuration-sets/${CONFIG_SET}/event-destinations/picklerush-sns`,
      body: { EventDestination: destino },
    });
  }
  const tokens = (ident.DkimAttributes && ident.DkimAttributes.Tokens) || [];
  return { records: sesRecords(domain, tokens, ctx.settings.email.ses_region), topicArn };
}

async function sesDomainStatus(ctx, { domain }) {
  const i = await awsJson(ctx, { method: 'GET', path: `/v2/email/identities/${encodeURIComponent(domain)}` });
  const conta = await awsJson(ctx, { method: 'GET', path: '/v2/email/account' });
  const dkim = (i.DkimAttributes && i.DkimAttributes.Status) || 'NOT_STARTED';
  const mailFrom = (i.MailFromAttributes && i.MailFromAttributes.MailFromDomainStatus) || 'NOT_STARTED';
  const quota = conta.SendQuota || {};
  return {
    verified: i.VerifiedForSendingStatus === true,
    checks: { dkim, mail_from: mailFrom },
    records: sesRecords(domain, (i.DkimAttributes && i.DkimAttributes.Tokens) || [], ctx.settings.email.ses_region),
    account: {
      production: conta.ProductionAccessEnabled === true,
      sending_enabled: conta.SendingEnabled !== false,
      enforcement: conta.EnforcementStatus || '',
      max_24h: Number(quota.Max24HourSend) || 0,
      sent_24h: Number(quota.SentLast24Hours) || 0,
      max_rate: Number(quota.MaxSendRate) || 0,
    },
  };
}

async function sesListSuppressed(ctx) {
  const r = await awsJson(ctx, { method: 'GET', path: '/v2/email/suppression/addresses', query: { PageSize: '100' } });
  return (r.SuppressedDestinationSummaries || []).map((s) => ({
    email: s.EmailAddress, reason: s.Reason, at: s.LastUpdateTime ? Date.parse(s.LastUpdateTime) || null : null,
  }));
}

async function sesUnsuppress(ctx, email) {
  await awsJson(ctx, { method: 'DELETE', path: `/v2/email/suppression/addresses/${encodeURIComponent(email)}` });
  return true;
}

/* ---------------------------------------------------------- Resend ----- */

async function resendCall(ctx, method, path, body) {
  const { secrets, fetchImpl = fetch } = ctx;
  const key = secrets && secrets.resend && secrets.resend.api_key;
  if (!key) throw new ProviderError('Resend: falta a chave da API (API key).', { code: 'no_credentials' });
  const res = await fetchImpl(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const lido = await lerResposta(res);
  if (!res.ok) throw erroDoProvedor('Resend', res, lido);
  return lido.json || {};
}

async function resendSend(ctx, msg) {
  const r = await resendCall(ctx, 'POST', '/emails', {
    from: msg.from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text,
    ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
    ...(msg.headers && Object.keys(msg.headers).length ? { headers: msg.headers } : {}),
    ...(msg.tag ? { tags: [{ name: 'outbox', value: msg.tag }] } : {}),
  });
  return { id: r.id || '' };
}

const recordsResend = (lista) => (lista || []).map((r) => ({
  type: r.type, name: r.name, value: r.value, priority: r.priority, status: r.status,
  purpose: String(r.record || '').toLowerCase(),
}));

async function resendSetupDomain(ctx, { domain }) {
  const lista = await resendCall(ctx, 'GET', '/domains');
  const existente = (lista.data || []).find((d) => d.name === domain);
  const d = existente
    ? await resendCall(ctx, 'GET', `/domains/${existente.id}`)
    : await resendCall(ctx, 'POST', '/domains', { name: domain, region: ctx.settings.email.resend_region });
  return { records: recordsResend(d.records), domainId: d.id };
}

async function resendDomainStatus(ctx, { domainId }) {
  if (!domainId) throw new ProviderError('Resend: o domínio ainda não foi preparado.', { code: 'no_domain' });
  await resendCall(ctx, 'POST', `/domains/${domainId}/verify`).catch(() => null);
  const d = await resendCall(ctx, 'GET', `/domains/${domainId}`);
  return { verified: d.status === 'verified', checks: { status: d.status || '' }, records: recordsResend(d.records), account: null };
}

/* -------------------------------------------------------- WhatsApp ----- */

async function graph(ctx, method, path, body) {
  const { settings, secrets, fetchImpl = fetch } = ctx;
  const token = secrets && secrets.whatsapp && secrets.whatsapp.access_token;
  if (!token) throw new ProviderError('WhatsApp: falta o token de acesso permanente.', { code: 'no_credentials' });
  const res = await fetchImpl(`https://graph.facebook.com/${settings.whatsapp.graph_version}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const lido = await lerResposta(res);
  if (!res.ok) throw erroDoProvedor('WhatsApp', res, lido);
  return lido.json || {};
}

/** Idioma do modelo na Meta para o idioma da pessoa. */
const WA_LANG = { pt: 'pt_BR', en: 'en_US', es: 'es' };
const waLang = (lang) => WA_LANG[lang] || WA_LANG.pt;

/** Manda um modelo aprovado. `params`: os textos do corpo; `button`: o sufixo do link. */
async function whatsappSendTemplate(ctx, { to, template, lang, langCode = '', params = [], button = null }) {
  const id = ctx.settings.whatsapp.phone_number_id;
  if (!id) throw new ProviderError('WhatsApp: falta o identificador do número (Phone number ID).', { code: 'no_config' });
  const components = [];
  if (params.length) components.push({ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text) })) });
  if (button !== null) components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: String(button) }] });
  const r = await graph(ctx, 'POST', `/${id}/messages`, {
    messaging_product: 'whatsapp',
    to: String(to).replace(/\D/g, ''),
    type: 'template',
    template: { name: template, language: { code: langCode || waLang(lang) }, components },
  });
  return { id: (r.messages && r.messages[0] && r.messages[0].id) || '' };
}

/** Os dois modelos da plataforma, nos três idiomas, como a Meta pede. */
function whatsappTemplateDefinitions(settings, origin) {
  const textos = {
    pt: {
      aviso: '*{{1}}*\n\n{{2}}\n\nAbra o PickleRush para ver os detalhes.', botao: 'Ver aviso',
      ex1: 'Reserva confirmada', ex2: 'Sua reserva na Arena Central para sábado, 18h, foi confirmada.', codigo: 'Copiar código',
    },
    en: {
      aviso: '*{{1}}*\n\n{{2}}\n\nOpen PickleRush to see the details.', botao: 'See notice',
      ex1: 'Booking confirmed', ex2: 'Your booking at Arena Central for Saturday, 6 pm, is confirmed.', codigo: 'Copy code',
    },
    es: {
      aviso: '*{{1}}*\n\n{{2}}\n\nAbre PickleRush para ver los detalles.', botao: 'Ver aviso',
      ex1: 'Reserva confirmada', ex2: 'Tu reserva en Arena Central para el sábado, 18 h, está confirmada.', codigo: 'Copiar código',
    },
  };
  const out = [];
  Object.entries(textos).forEach(([lang, t]) => {
    out.push({
      name: settings.whatsapp.template_aviso,
      language: waLang(lang),
      category: 'UTILITY',
      components: [
        { type: 'BODY', text: t.aviso, example: { body_text: [[t.ex1, t.ex2]] } },
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: t.botao, url: `${origin}/{{1}}`, example: [`${origin}/minhas-reservas`] }] },
      ],
    });
    out.push({
      name: settings.whatsapp.template_codigo,
      language: waLang(lang),
      category: 'AUTHENTICATION',
      components: [
        { type: 'BODY', add_security_recommendation: true },
        { type: 'FOOTER', code_expiration_minutes: 10 },
        { type: 'BUTTONS', buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: t.codigo }] },
      ],
    });
  });
  return out;
}

async function whatsappCreateTemplates(ctx, origin) {
  const waba = ctx.settings.whatsapp.waba_id;
  if (!waba) throw new ProviderError('WhatsApp: falta o identificador da conta (WhatsApp Business Account ID).', { code: 'no_config' });
  const resultados = [];
  for (const def of whatsappTemplateDefinitions(ctx.settings, origin)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await graph(ctx, 'POST', `/${waba}/message_templates`, def);
      resultados.push({ name: def.name, language: def.language, status: r.status || 'PENDING', ok: true });
    } catch (err) {
      const existe = /already exists|existe/i.test(err.message) || err.code === '100';
      resultados.push({ name: def.name, language: def.language, status: existe ? 'EXISTS' : 'ERROR', ok: existe, error: existe ? '' : err.message });
    }
  }
  return resultados;
}

async function whatsappTemplateStatus(ctx) {
  const waba = ctx.settings.whatsapp.waba_id;
  if (!waba) throw new ProviderError('WhatsApp: falta o identificador da conta (WhatsApp Business Account ID).', { code: 'no_config' });
  const nomes = [ctx.settings.whatsapp.template_aviso, ctx.settings.whatsapp.template_codigo];
  const r = await graph(ctx, 'GET', `/${waba}/message_templates?fields=name,status,language,category,rejected_reason&limit=200`);
  return (r.data || []).filter((t) => nomes.includes(t.name)).map((t) => ({
    name: t.name, language: t.language, status: t.status, category: t.category, rejected_reason: t.rejected_reason || '',
  }));
}

async function whatsappNumberStatus(ctx) {
  const id = ctx.settings.whatsapp.phone_number_id;
  if (!id) throw new ProviderError('WhatsApp: falta o identificador do número (Phone number ID).', { code: 'no_config' });
  const r = await graph(ctx, 'GET', `/${id}?fields=display_phone_number,verified_name,quality_rating,name_status`);
  return {
    display_phone: r.display_phone_number || '', verified_name: r.verified_name || '',
    quality: r.quality_rating || '', name_status: r.name_status || '',
  };
}

/* ------------------------------------------------------------- SMS ----- */

async function twilioSend(ctx, { to, body, statusCallback }) {
  const { settings, secrets, fetchImpl = fetch } = ctx;
  const s = (secrets && secrets.twilio) || {};
  if (!s.account_sid || !s.auth_token) throw new ProviderError('Twilio: falta o Account SID e o Auth Token.', { code: 'no_credentials' });
  const sender = settings.sms.sender;
  if (!sender) throw new ProviderError('Twilio: falta o remetente (número ou Messaging Service SID).', { code: 'no_config' });
  const form = new URLSearchParams({ To: to, Body: body });
  if (/^MG[0-9a-f]{32}$/i.test(sender)) form.set('MessagingServiceSid', sender); else form.set('From', sender);
  if (statusCallback) form.set('StatusCallback', statusCallback);
  const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(s.account_sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${s.account_sid}:${s.auth_token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const lido = await lerResposta(res);
  if (!res.ok) throw erroDoProvedor('Twilio', res, lido);
  return { id: (lido.json && lido.json.sid) || '' };
}

async function zenviaSend(ctx, { to, body }) {
  const { settings, secrets, fetchImpl = fetch } = ctx;
  const token = secrets && secrets.zenvia && secrets.zenvia.api_token;
  if (!token) throw new ProviderError('Zenvia: falta o token da API.', { code: 'no_credentials' });
  const sender = settings.sms.sender;
  if (!sender) throw new ProviderError('Zenvia: falta o remetente (a palavra-chave do canal SMS).', { code: 'no_config' });
  const res = await fetchImpl('https://api.zenvia.com/v2/channels/sms/messages', {
    method: 'POST',
    headers: { 'X-API-TOKEN': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: sender, to: String(to).replace(/\D/g, ''), contents: [{ type: 'text', text: body }] }),
  });
  const lido = await lerResposta(res);
  if (!res.ok) throw erroDoProvedor('Zenvia', res, lido);
  return { id: (lido.json && lido.json.id) || '' };
}

async function sendSms(ctx, msg) {
  return ctx.settings.sms.provider === 'zenvia' ? zenviaSend(ctx, msg) : twilioSend(ctx, msg);
}

async function sendEmail(ctx, msg) {
  return ctx.settings.email.provider === 'resend' ? resendSend(ctx, msg) : sesSend(ctx, msg);
}

/* ------------------------------------------- assinaturas dos webhooks -- */

const igualSeguro = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Meta: `X-Hub-Signature-256: sha256=<hmac do corpo com o App Secret>`. */
function verifyMetaSignature(rawBody, header, appSecret) {
  if (!appSecret || !header) return false;
  const esperado = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return igualSeguro(esperado, header);
}

/** Resend (Svix): `svix-signature: v1,<base64>` sobre `id.timestamp.corpo`. */
function verifySvixSignature(rawBody, headers, secret, now = Date.now()) {
  if (!secret) return false;
  const id = headers['svix-id'];
  const ts = headers['svix-timestamp'];
  const sig = headers['svix-signature'];
  if (!id || !ts || !sig) return false;
  if (Math.abs(now / 1000 - Number(ts)) > 5 * 60) return false;
  const chave = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const esperado = crypto.createHmac('sha256', chave).update(`${id}.${ts}.${rawBody.toString('utf8')}`).digest('base64');
  return String(sig).split(' ').some((parte) => {
    const [versao, valor] = parte.split(',');
    return versao === 'v1' && valor && igualSeguro(valor, esperado);
  });
}

/** Twilio: HMAC-SHA1 da URL + parâmetros em ordem alfabética, com o Auth Token. */
function verifyTwilioSignature(url, params, header, authToken) {
  if (!authToken || !header) return false;
  const dados = url + Object.keys(params).sort().map((k) => `${k}${params[k]}`).join('');
  const esperado = crypto.createHmac('sha1', authToken).update(dados, 'utf8').digest('base64');
  return igualSeguro(esperado, header);
}

/** A cadeia que a Amazon SNS assina, por tipo de mensagem. */
function snsStringToSign(m) {
  const campos = m.Type === 'Notification'
    ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
    : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
  return campos.filter((c) => m[c] !== undefined && m[c] !== null).map((c) => `${c}\n${m[c]}\n`).join('');
}

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/;

/** Endereço do certificado/confirmação é mesmo da Amazon? */
function isAmazonSnsUrl(raw) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && SNS_HOST.test(u.hostname);
  } catch (_) { return false; }
}

const certCache = new Map();

/** Confere a assinatura da SNS baixando o certificado da própria Amazon. */
async function verifySnsMessage(m, { fetchImpl = fetch } = {}) {
  if (!m || !m.Signature || !isAmazonSnsUrl(m.SigningCertURL)) return false;
  let pem = certCache.get(m.SigningCertURL);
  if (!pem) {
    const res = await fetchImpl(m.SigningCertURL);
    if (!res.ok) return false;
    pem = await res.text();
    if (certCache.size > 20) certCache.clear();
    certCache.set(m.SigningCertURL, pem);
  }
  try {
    return crypto.createVerify(m.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1')
      .update(snsStringToSign(m), 'utf8').verify(pem, m.Signature, 'base64');
  } catch (_) { return false; }
}

module.exports = {
  ProviderError,
  signV4,
  sendEmail,
  sesSend,
  sesRecords,
  sesSetupDomain,
  sesDomainStatus,
  sesListSuppressed,
  sesUnsuppress,
  resendSend,
  resendSetupDomain,
  resendDomainStatus,
  whatsappSendTemplate,
  whatsappTemplateDefinitions,
  whatsappCreateTemplates,
  whatsappTemplateStatus,
  whatsappNumberStatus,
  waLang,
  sendSms,
  twilioSend,
  zenviaSend,
  verifyMetaSignature,
  verifySvixSignature,
  verifyTwilioSignature,
  snsStringToSign,
  isAmazonSnsUrl,
  verifySnsMessage,
  CONFIG_SET,
};
