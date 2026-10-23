/**
 * Cliente da API de PARCEIROS do DUPR (RaaS) — só servidor, sem Firebase.
 *
 * Duas camadas de autenticação, que NÃO se misturam (o DUPR recusa a troca):
 *  · TOKEN DE PARCEIRO — `POST /auth/v1.0/token` com `x-authorization:
 *    base64(ClientKey:ClientSecret)`. Vale 1 h e é sem estado, então fica em
 *    cache na instância. Serve a todas as chamadas `mydupr.com/api` (busca de
 *    jogador, partidas, webhooks, clube).
 *  · TOKEN DO USUÁRIO — vem do SSO (iframe) e é SOMENTE LEITURA. Serve só aos
 *    três endpoints do host `api.dupr.gg`: dados básicos (confirma a
 *    identidade), assinaturas (entitlements) e clubes do usuário. Troca-se por
 *    novo par com o refresh token (que também gira).
 *
 * O `clientSecret` nunca sai do servidor e nunca entra em log: o erro devolvido
 * traz o status e a mensagem do DUPR, jamais o cabeçalho da requisição.
 */

const HOSTS = Object.freeze({
  uat: {
    partner: 'https://uat.mydupr.com/api',
    user: 'https://api.uat.dupr.gg',
    sso: 'https://uat.dupr.gg/login-external-app/',
  },
  prod: {
    partner: 'https://prod.mydupr.com/api',
    user: 'https://api.dupr.gg',
    sso: 'https://dashboard.dupr.com/login-external-app/',
  },
});

const V = 'v1.0';
/** Renova com folga: o token dura 1 h, a gente troca aos 50 min. */
const TOKEN_TTL_MS = 50 * 60 * 1000;
const TIMEOUT_MS = 15000;

const texto = (v) => String(v == null ? '' : v).trim();
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

/** O ambiente é UAT a menos que esteja escrito `prod` — o erro seguro. */
function hostsFor(env) {
  return HOSTS[texto(env).toLowerCase() === 'prod' ? 'prod' : 'uat'];
}

/** Erro com o que o DUPR respondeu, sem credencial nenhuma. */
class DuprError extends Error {
  constructor(message, { status = 0, body = null, requestId = null } = {}) {
    super(message);
    this.name = 'DuprError';
    this.status = status;
    this.body = body;
    this.requestId = requestId;
  }
}

/**
 * @param {{ clientKey: string, clientSecret: string, env?: string,
 *   fetchImpl?: typeof fetch, now?: () => number }} cfg
 */
function createDuprClient(cfg) {
  const clientKey = texto(cfg.clientKey);
  const clientSecret = texto(cfg.clientSecret);
  if (!clientKey || !clientSecret) throw new DuprError('Credenciais do DUPR não configuradas.');
  const hosts = hostsFor(cfg.env);
  const doFetch = cfg.fetchImpl || fetch;
  const now = cfg.now || Date.now;
  let cache = null;

  async function call(url, { method = 'GET', headers = {}, body } = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await doFetch(url, {
        method,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
    } catch (err) {
      throw new DuprError(`Sem resposta do DUPR (${err && err.name === 'AbortError' ? 'tempo esgotado' : 'rede'}).`);
    } finally {
      clearTimeout(timer);
    }
    const requestId = (res.headers && res.headers.get && res.headers.get('x-request-id')) || null;
    let json = null;
    try { json = await res.json(); } catch { json = null; }
    if (!res.ok) {
      const msg = (json && (json.message || (json.errors && json.errors[0] && json.errors[0].message))) || `HTTP ${res.status}`;
      throw new DuprError(`DUPR recusou (${res.status}): ${msg}`, { status: res.status, body: json, requestId });
    }
    return json;
  }

  /** Token de parceiro, em cache. Chamado de novo, só vai à rede depois do prazo. */
  async function partnerToken({ force = false } = {}) {
    if (!force && cache && cache.expira > now()) return cache.token;
    const json = await call(`${hosts.partner}/auth/${V}/token`, {
      method: 'POST',
      headers: { 'x-authorization': b64(`${clientKey}:${clientSecret}`) },
    });
    const token = json && json.result && json.result.token;
    if (!token) throw new DuprError('O DUPR não devolveu o token de parceiro.');
    cache = { token, expira: now() + TOKEN_TTL_MS };
    return token;
  }

  async function partner(method, path, body) {
    const token = await partnerToken();
    try {
      return await call(`${hosts.partner}${path}`, { method, body, headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      // Token pode ter sido invalidado do lado de lá: uma renovação e uma nova tentativa.
      if (err.status === 401) {
        const novo = await partnerToken({ force: true });
        return call(`${hosts.partner}${path}`, { method, body, headers: { Authorization: `Bearer ${novo}` } });
      }
      throw err;
    }
  }

  const asUser = (userToken, path) => call(`${hosts.user}${path}`, { headers: { Authorization: `Bearer ${userToken}` } });

  return {
    hosts,
    /** O `clientKey` em base64 que entra na URL do iframe do SSO (NÃO é o segredo). */
    ssoUrl: () => `${hosts.sso}${b64(clientKey)}`,
    partnerToken,
    // ---- API de parceiro
    getUser: (duprId) => partner('GET', `/user/${V}/${encodeURIComponent(duprId)}`),
    getUsersBatch: (duprIds) => partner('POST', `/user/${V}/batch`, { duprIds }),
    /** Pré-gera o ID DUPR e convida (`fullName`, `email`, `isoCode`, `identifier`). Exige `USER::INVITE`. */
    inviteUser: (body) => partner('POST', `/user/${V}/invite`, body),
    registerWebhook: (webhookUrl, topics = ['RATING']) => partner('POST', `/${V}/webhook`, { webhookUrl, topics }),
    subscribeRating: (duprIds) => partner('POST', `/user/${V}/subscribe/webhook-event`, { duprIds, topic: 'RATING' }),
    unsubscribeRating: (duprIds) => partner('DELETE', `/user/${V}/subscribe/webhook-event`, { duprIds, topic: 'RATING' }),
    createMatch: (match) => partner('POST', `/match/${V}/create`, match),
    createMatchesBulk: (matches) => partner('POST', `/match/${V}/batch`, matches),
    updateMatch: (match) => partner('POST', `/match/${V}/update`, match),
    deleteMatch: (identifier, matchCode) => partner('DELETE', `/match/${V}/delete`, { identifier, matchCode }),
    // ---- API do usuário (token do SSO, somente leitura)
    basicUserInfo: (userToken) => asUser(userToken, '/public/user/info'),
    subscriptions: (userToken) => call(`${hosts.user}/subscription/active`, { method: 'POST', headers: { Authorization: `Bearer ${userToken}` } }),
    clubMemberships: (userToken) => asUser(userToken, '/user/club/membership'),
    refreshUserToken: (refreshToken) => call(`${hosts.user}/auth/${V}/refresh`, { headers: { 'x-refresh-token': refreshToken } }),
  };
}

module.exports = { createDuprClient, hostsFor, DuprError, HOSTS };
