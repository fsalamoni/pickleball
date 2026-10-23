/**
 * INTEGRAÇÃO OFICIAL COM O DUPR (RaaS) — vínculo da conta, rating por webhook e
 * assinatura (entitlements). Flag `dupr_official_sync` (padrão OFF); desligada,
 * o cadastro manual de ID/rating segue como está. Ver `docs/51-DUPR.md`.
 *
 * Regras do DUPR que o código cumpre:
 *  · a conta só se conecta pelo SSO — o ID digitado à mão não vale como
 *    vínculo; aqui o servidor CONFIRMA a identidade com o token do usuário
 *    (`/public/user/info`) e ignora qualquer `duprId` que o navegador mande;
 *  · só entra quem tem `BASIC_L1` (sem ele a pessoa está restrita/banida);
 *  · o rating chega por webhook (`RATING`, `RATING_SEED`) e é espelhado no
 *    perfil como "verificado".
 *
 * Armazenamento (nenhum campo novo em coleção existente além do espelho):
 *  · `dupr_links/{uid}`      resumo do vínculo (o dono lê; sem token);
 *  · `dupr_link_tokens/{uid}` tokens do SSO (SÓ o servidor lê e escreve);
 *  · `dupr_ids/{duprId}`     quem é o dono daquele ID (um ID, uma conta);
 *  · `platform_secrets/dupr` credenciais e o token do webhook (SÓ servidor).
 * O espelho em `users` / `athlete_profiles` (`dupr_id`, `dupr_rating`,
 * `dupr_verified`) é o que as telas de sempre já leem.
 */
const crypto = require('node:crypto');
const { createDuprClient, DuprError } = require('./duprClient');
const { normalizeDuprPolicy, DUPR_AUDIENCE } = require('./duprPolicy');

const FLAG = 'dupr_official_sync';
const DAY_MS = 24 * 60 * 60 * 1000;

class DuprServiceError extends Error {
  constructor(code, message) { super(message); this.name = 'DuprServiceError'; this.code = code; }
}
const falha = (code, message) => { throw new DuprServiceError(code, message); };
const texto = (v) => String(v == null ? '' : v).trim();

/** "4.125" → 4.125; "NR", vazio ou fora de 1–8,5 → null. */
function parseRating(v) {
  const n = Number(String(v == null ? '' : v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 1 || n > 8.5) return null;
  return Math.round(n * 1000) / 1000;
}

/** `{ tournaments: [...] }` do DUPR → lista de nomes do recurso `tournaments`. */
function tournamentEntitlements(resp) {
  const e = resp && resp.entitlements;
  const lista = e && Array.isArray(e.tournaments) ? e.tournaments : [];
  return lista.map((x) => texto(x).toUpperCase()).filter(Boolean);
}

/* -------------------------------------------------------------- acesso -- */

async function flagLigada(ctx) {
  const snap = await ctx.db.collection('platform_settings').doc('global').get();
  return Boolean(snap.exists && snap.data().feature_flags && snap.data().feature_flags[FLAG] === true);
}

/**
 * A integração vale para ESTA pessoa? Flag ligada e a pessoa no público da
 * política (`platform_settings/dupr_policy`): no piloto, só o admin da
 * plataforma. Mesma regra de `useDuprMode` no cliente.
 */
async function liberadaPara(ctx, actor) {
  if (!(await flagLigada(ctx))) return false;
  const snap = await ctx.db.collection('platform_settings').doc('dupr_policy').get();
  const policy = normalizeDuprPolicy(snap.exists ? snap.data() : null);
  return policy.audience === DUPR_AUDIENCE.ALL || Boolean(actor && actor.isPlatformAdmin);
}

async function segredos(ctx) {
  const snap = await ctx.db.collection('platform_secrets').doc('dupr').get();
  const d = snap.exists ? snap.data() : null;
  return d && texto(d.client_key) && texto(d.client_secret) ? d : null;
}

async function clienteDuprDe(ctx) {
  const s = await segredos(ctx);
  if (!s) falha('failed-precondition', 'A integração com o DUPR ainda não foi configurada pela plataforma.');
  const make = ctx.makeClient || createDuprClient;
  return { client: make({ clientKey: s.client_key, clientSecret: s.client_secret, env: s.env }), secrets: s };
}

async function exigeLigada(ctx, actor) {
  if (!(await liberadaPara(ctx, actor))) falha('failed-precondition', 'A integração oficial com o DUPR não está ligada nesta plataforma.');
}

/** Erro do DUPR → mensagem para a tela (sem vazar corpo nem cabeçalho). */
function traduz(err) {
  if (err instanceof DuprServiceError) return err;
  if (err instanceof DuprError) {
    if (err.status === 401 || err.status === 403) return new DuprServiceError('permission-denied', 'O DUPR não autorizou essa conexão. Entre de novo na sua conta DUPR.');
    if (err.status === 404) return new DuprServiceError('not-found', 'O DUPR não encontrou essa conta.');
    return new DuprServiceError('unavailable', 'O DUPR não respondeu agora. Tente de novo em instantes.');
  }
  return err;
}

async function auditoria(ctx, actor, action, details) {
  await ctx.db.collection('audit_logs').add({
    log_number: Number(`${ctx.now}${Math.floor(Math.random() * 900 + 100)}`),
    action, action_label: action, actor_id: actor.uid, actor_name: actor.name || actor.uid, actor_email: actor.email || '',
    tournament_id: null, user_id: details.user_id || null, details, created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
}

/* ------------------------------------------------------------- espelho -- */

/** O que as telas de sempre leem: ID, rating (duplas) e o selo "verificado". */
function mirrorFields(link, nowMs) {
  const out = {
    dupr_id: link.dupr_id,
    dupr_verified: true,
    dupr_verified_at_ms: link.linked_at_ms || nowMs,
  };
  if (link.ratings && link.ratings.doubles != null) out.dupr_rating = link.ratings.doubles;
  if (link.ratings && link.ratings.singles != null) out.dupr_rating_singles = link.ratings.singles;
  return out;
}

async function espelhar(ctx, uid, campos) {
  const u = ctx.db.collection('users').doc(uid);
  const dados = { ...campos, updated_at: ctx.Timestamp.fromMillis(ctx.now) };
  if ((await u.get()).exists) await u.update(dados); else await u.set(dados, { merge: true });
  const ap = ctx.db.collection('athlete_profiles').doc(uid);
  if ((await ap.get()).exists) await ap.update(campos);
}

/* --------------------------------------------------------------- ações -- */

/** O que a tela precisa para começar (ou mostrar o vínculo). */
async function config(ctx, actor) {
  const enabled = await liberadaPara(ctx, actor);
  const s = enabled ? await segredos(ctx) : null;
  const linkSnap = await ctx.db.collection('dupr_links').doc(actor.uid).get();
  const out = { enabled, configured: Boolean(s), env: s ? (texto(s.env).toLowerCase() === 'prod' ? 'prod' : 'uat') : null, linked: linkSnap.exists ? resumo(linkSnap.data()) : null };
  if (s) {
    const { client } = await clienteDuprDe(ctx);
    out.ssoUrl = client.ssoUrl();
  }
  return out;
}

function resumo(l) {
  return {
    duprId: l.dupr_id, name: l.name || '', ratings: l.ratings || {}, entitlements: l.entitlements || [],
    linkedAtMs: l.linked_at_ms || null, ratingUpdatedMs: l.rating_updated_ms || null, entitlementsCheckedMs: l.entitlements_checked_ms || null,
  };
}

/**
 * Vincula a conta DUPR de quem está logado. O navegador manda só os tokens que
 * o SSO devolveu; a identidade vem do DUPR.
 */
async function link(ctx, actor, data) {
  await exigeLigada(ctx, actor);
  const accessToken = texto(data.accessToken);
  const refreshToken = texto(data.refreshToken);
  if (!accessToken || accessToken.length > 4096 || refreshToken.length > 4096) falha('invalid-argument', 'Não recebi o login do DUPR. Tente de novo.');
  const { client, secrets } = await clienteDuprDe(ctx);
  try {
    const info = await client.basicUserInfo(accessToken);
    const quem = info && Array.isArray(info.results) ? info.results[0] : null;
    const duprId = texto(quem && quem.duprId).toUpperCase();
    if (!duprId) falha('permission-denied', 'O DUPR não confirmou a sua identidade.');
    if (texto(data.duprId) && texto(data.duprId).toUpperCase() !== duprId) falha('permission-denied', 'O ID informado não é o da conta que entrou no DUPR.');

    const entitlements = tournamentEntitlements(await client.subscriptions(accessToken));
    if (!entitlements.includes('BASIC_L1')) falha('permission-denied', 'A sua conta DUPR está restrita e não pode ser conectada. Fale com o suporte do DUPR.');

    const detalhe = await client.getUser(duprId);
    const r = (detalhe && detalhe.result && detalhe.result.ratings) || {};
    const ratings = { singles: parseRating(r.singles), doubles: parseRating(r.doubles) };
    const nome = texto(quem.fullName) || texto(detalhe && detalhe.result && detalhe.result.fullName);

    const linkRef = ctx.db.collection('dupr_links').doc(actor.uid);
    const idRef = ctx.db.collection('dupr_ids').doc(duprId);
    const anterior = await ctx.db.runTransaction(async (tx) => {
      const [idSnap, linkSnap] = await Promise.all([tx.get(idRef), tx.get(linkRef)]);
      if (idSnap.exists && idSnap.data().user_id !== actor.uid) falha('already-exists', 'Este ID DUPR já está vinculado a outra conta da plataforma.');
      const velho = linkSnap.exists ? linkSnap.data() : null;
      const registro = {
        user_id: actor.uid, dupr_id: duprId, name: nome, ratings, entitlements,
        entitlements_checked_ms: ctx.now, rating_updated_ms: ctx.now, linked_at_ms: velho && velho.dupr_id === duprId ? velho.linked_at_ms || ctx.now : ctx.now,
        env: texto(secrets.env) || 'uat', webhook_ok: false,
      };
      tx.set(idRef, { user_id: actor.uid, linked_at_ms: ctx.now });
      tx.set(linkRef, registro);
      if (velho && velho.dupr_id && velho.dupr_id !== duprId) tx.delete(ctx.db.collection('dupr_ids').doc(velho.dupr_id));
      return velho;
    });

    await ctx.db.collection('dupr_link_tokens').doc(actor.uid).set({ access_token: accessToken, refresh_token: refreshToken, updated_at_ms: ctx.now });
    const registro = (await linkRef.get()).data();
    await espelhar(ctx, actor.uid, mirrorFields(registro, ctx.now));

    // Inscreve para receber o rating (o DUPR responde com um RATING_SEED no webhook).
    let inscrito = true;
    try {
      if (anterior && anterior.dupr_id && anterior.dupr_id !== duprId) await client.unsubscribeRating([anterior.dupr_id]).catch(() => {});
      await client.subscribeRating([duprId]);
      await linkRef.update({ webhook_ok: true });
    } catch (err) {
      inscrito = false;
      ctx.logger.warn('dupr: inscrição no webhook de rating falhou', { uid: actor.uid, status: err && err.status });
    }
    await auditoria(ctx, actor, 'dupr_linked', { user_id: actor.uid, dupr_id: duprId, subscribed: inscrito });
    return { ...resumo({ ...registro, webhook_ok: inscrito }), webhookOk: inscrito };
  } catch (err) {
    throw traduz(err);
  }
}

/** Desfaz o vínculo: o ID e o rating ficam no perfil como informação comum (sem o selo). */
async function unlink(ctx, actor) {
  const linkRef = ctx.db.collection('dupr_links').doc(actor.uid);
  const snap = await linkRef.get();
  if (!snap.exists) return { unlinked: false };
  const l = snap.data();
  const s = await segredos(ctx);
  if (s) {
    try {
      const { client } = await clienteDuprDe(ctx);
      await client.unsubscribeRating([l.dupr_id]);
    } catch (err) {
      ctx.logger.warn('dupr: cancelar inscrição falhou (segue o desvínculo)', { uid: actor.uid });
    }
  }
  await ctx.db.collection('dupr_ids').doc(l.dupr_id).delete();
  await ctx.db.collection('dupr_link_tokens').doc(actor.uid).delete();
  await linkRef.delete();
  await espelhar(ctx, actor.uid, { dupr_verified: ctx.FieldValue.delete(), dupr_verified_at_ms: ctx.FieldValue.delete() });
  await auditoria(ctx, actor, 'dupr_unlinked', { user_id: actor.uid, dupr_id: l.dupr_id });
  return { unlinked: true };
}

/**
 * Situação do vínculo e das assinaturas (entitlements). O DUPR deixa guardar
 * por até 24 h; passado o prazo, busca de novo (renovando os tokens se preciso).
 */
async function status(ctx, actor) {
  const linkRef = ctx.db.collection('dupr_links').doc(actor.uid);
  const snap = await linkRef.get();
  if (!snap.exists) return { linked: null };
  let l = snap.data();
  if (ctx.now - (l.entitlements_checked_ms || 0) > DAY_MS) {
    try {
      const { client } = await clienteDuprDe(ctx);
      const tokRef = ctx.db.collection('dupr_link_tokens').doc(actor.uid);
      const tok = (await tokRef.get()).data() || {};
      let access = tok.access_token;
      let resp;
      try { resp = await client.subscriptions(access); } catch (err) {
        if (!(err instanceof DuprError) || err.status !== 401 || !tok.refresh_token) throw err;
        const novo = (await client.refreshUserToken(tok.refresh_token)).result || {};
        access = texto(novo.accessToken);
        if (!access) throw err;
        await tokRef.set({ access_token: access, refresh_token: texto(novo.refreshToken) || tok.refresh_token, updated_at_ms: ctx.now });
        resp = await client.subscriptions(access);
      }
      const entitlements = tournamentEntitlements(resp);
      await linkRef.update({ entitlements, entitlements_checked_ms: ctx.now });
      l = { ...l, entitlements, entitlements_checked_ms: ctx.now };
    } catch (err) {
      ctx.logger.warn('dupr: atualizar assinaturas falhou (vale o último valor)', { uid: actor.uid, status: err && err.status });
    }
  }
  return { linked: resumo(l) };
}

/* ------------------------------------------------------------- webhook -- */

const igual = (a, b) => {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

/**
 * Recebe os eventos do DUPR. Responde 200 depressa até para o que não usa
 * (o DUPR exige); só o token da URL (`?k=`) separa o DUPR de qualquer outro.
 */
async function webhook(ctx, req) {
  if (req.method !== 'POST') return { status: 200, body: { ok: true } };
  const s = await ctx.db.collection('platform_secrets').doc('dupr').get();
  const esperado = s.exists ? s.data().webhook_token : '';
  if (!igual(req.query && req.query.k, esperado)) return { status: 401, body: { ok: false } };

  const body = req.body || {};
  const evento = texto(body.event).toUpperCase();
  const msg = body.message || {};
  const duprId = texto(msg.duprId).toUpperCase();
  const rating = msg.rating;
  if (!['RATING', 'RATING_SEED'].includes(evento) || !duprId) return { status: 200, body: { ok: true, ignored: true } };

  const dono = await ctx.db.collection('dupr_ids').doc(duprId).get();
  if (!dono.exists) return { status: 200, body: { ok: true, ignored: true } };
  const uid = dono.data().user_id;
  const linkRef = ctx.db.collection('dupr_links').doc(uid);
  const snap = await linkRef.get();
  if (!snap.exists || !rating) return { status: 200, body: { ok: true, ignored: !snap.exists } };

  const ratings = { singles: parseRating(rating.singles), doubles: parseRating(rating.doubles) };
  const l = snap.data();
  await linkRef.update({ ratings, rating_updated_ms: ctx.now, webhook_ok: true });
  await espelhar(ctx, uid, mirrorFields({ ...l, ratings }, ctx.now));
  return { status: 200, body: { ok: true } };
}

module.exports = {
  FLAG, DuprServiceError, parseRating, tournamentEntitlements, config, link, unlink, status, webhook,
};
