/**
 * AVATAR POR IA — a callable `avatarAi` (docs/58, flag `avatar_creator`).
 *
 * A pessoa escolhe opções do catálogo; o SERVIDOR escreve o pedido
 * (`avatarAiPolicy.js`), chama o provedor de imagens com a chave guardada em
 * `platform_secrets/avatar_ai` (o navegador não a lê) e devolve a imagem.
 *
 * O que não pode regredir:
 * 1. nenhum texto nem imagem do navegador chega ao provedor — só ids
 *    conferidos; a edição ("manter o rosto") usa a imagem-BASE que o próprio
 *    servidor guardou em `avatar-ia/{uid}/` (aceitar imagem enviada faria
 *    desta função um editor gratuito de fotos alheias);
 * 2. toda criação é RESERVADA numa transação antes de chamar o provedor
 *    (limite por pessoa, teto da plataforma, uma por vez) e devolvida se a
 *    chamada falhar;
 * 3. a chave nunca sai do servidor: nem na resposta, nem no log.
 *
 * Coleção `avatar_usage/{uid}` (sem regra: só o servidor lê e grava; o
 * documento `_platform` é o contador do mês da plataforma).
 */
const crypto = require('node:crypto');
const P = require('./avatarAiPolicy.js');

const FLAG = 'avatar_creator';
const API = 'https://api.openai.com/v1';
const PLATFORM = '_platform';
/** Uma criação por vez por pessoa; a trava vence sozinha se a função morrer. */
const BUSY_MS = 150 * 1000;
const PROVIDER_TIMEOUT_MS = 240 * 1000;

const baseFile = (uid) => `avatar-ia/${uid}/base.jpg`;
const lastFile = (uid) => `avatar-ia/${uid}/last.jpg`;

class AvatarAiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const falha = (code, message) => { throw new AvatarAiError(code, message); };

const LIMITE = {
  day: 'Você já criou os avatares de hoje. Amanhã tem mais.',
  month: 'Você já criou os avatares deste mês.',
  platform: 'O criador de avatar atingiu o limite do mês. Volte no mês que vem.',
};

const usageRef = (ctx, id) => ctx.db.collection('avatar_usage').doc(id);
const settingsRef = (ctx) => ctx.db.collection('platform_settings').doc('avatar_ai');
const secretRef = (ctx) => ctx.db.collection('platform_secrets').doc('avatar_ai');

/** Flag, configuração e chave — o que decide se dá para criar agora. */
async function situacao(ctx) {
  const [g, s, k] = await Promise.all([
    ctx.db.collection('platform_settings').doc('global').get(), settingsRef(ctx).get(), secretRef(ctx).get(),
  ]);
  const flags = (g.exists && g.data().feature_flags) || {};
  const config = P.normalizeConfig(s.exists ? s.data() : null);
  const key = k.exists ? String(k.data().api_key || '') : '';
  const flag = flags[FLAG] === true;
  return { flag, config, key, available: flag && config.enabled && Boolean(key) };
}

async function brandList(ctx) {
  const snap = await ctx.db.collection('platform_settings').doc('avatar_catalog').get();
  const list = snap.exists ? snap.data().brand_paddles : null;
  return Array.isArray(list) ? list : [];
}

/** O que a tela precisa para abrir o criador. */
async function status(ctx, actor) {
  const s = await situacao(ctx);
  const [u, p] = await Promise.all([usageRef(ctx, actor.uid).get(), usageRef(ctx, PLATFORM).get()]);
  const usage = u.exists ? u.data() : null;
  const lim = P.limitState(usage, p.exists ? p.data() : null, s.config, ctx.now);
  return {
    available: s.available,
    ...lim,
    per_day: s.config.per_day,
    per_month: s.config.per_month,
    last_ms: (usage && usage.last_ms) || 0,
    base_recipe: (usage && usage.base_recipe) || null,
  };
}

/* ----------------------------------------------------------- provedor -- */

async function chamarProvedor(ctx, { key, config, prompt, baseBytes, uid }) {
  const campos = {
    model: config.model, prompt, size: '1024x1024', quality: config.quality, output_format: 'jpeg', output_compression: 90,
    // Um identificador estável e embaralhado: o provedor barra abuso sem saber quem é a pessoa.
    safety_identifier: crypto.createHash('sha256').update(`picklerush-avatar:${uid}`).digest('hex').slice(0, 64),
  };
  const headers = { Authorization: `Bearer ${key}` };
  const signal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS);
  let res;
  try {
    if (baseBytes) {
      const form = new FormData();
      Object.entries(campos).forEach(([k, v]) => form.append(k, String(v)));
      form.append('image[]', new Blob([baseBytes], { type: 'image/jpeg' }), 'base.jpg');
      res = await ctx.fetch(`${API}/images/edits`, { method: 'POST', headers, body: form, signal });
    } else {
      res = await ctx.fetch(`${API}/images/generations`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(campos), signal,
      });
    }
  } catch (err) {
    ctx.logger.warn('avatarAi: o provedor não respondeu', { nome: err && err.name });
    falha('unavailable', 'O serviço de imagens não respondeu. Tente de novo em instantes.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const erro = (body && body.error) || {};
    // Só o código: a mensagem do provedor pode repetir o pedido, e a chave nunca vai ao log.
    ctx.logger.warn('avatarAi: o provedor recusou', { status: res.status, code: erro.code || '', type: erro.type || '' });
    if (erro.code === 'moderation_blocked') falha('failed-precondition', 'O serviço de imagens recusou esta combinação. Mude alguma escolha e tente de novo.');
    if (res.status === 401 || res.status === 403 || res.status === 404) falha('failed-precondition', 'O criador de avatar está com a configuração inválida. Avise o suporte.');
    if (res.status === 429) falha('unavailable', 'Muita gente criando avatar agora. Tente de novo em instantes.');
    falha('unavailable', 'O serviço de imagens falhou. Tente de novo em instantes.');
  }
  const b64 = body && body.data && body.data[0] && body.data[0].b64_json;
  if (!b64) falha('unavailable', 'O serviço de imagens não devolveu a imagem. Tente de novo em instantes.');
  return Buffer.from(b64, 'base64');
}

/* -------------------------------------------------------------- criar -- */

/** Reserva uma criação (ou diz por que não dá). Transação: ler tudo, depois gravar. */
async function reservar(ctx, uid, config) {
  const uRef = usageRef(ctx, uid);
  const pRef = usageRef(ctx, PLATFORM);
  return ctx.db.runTransaction(async (tx) => {
    const [u, p] = await tx.getAll(uRef, pRef);
    const usage = u.exists ? u.data() : null;
    const platform = p.exists ? p.data() : null;
    const lim = P.limitState(usage, platform, config, ctx.now);
    if (!lim.ok) return { motivo: lim.reason };
    if (usage && Number(usage.busy_until_ms) > ctx.now) return { motivo: 'busy' };
    tx.set(uRef, { uid, ...P.bumpUsage(usage, ctx.now, 1), busy_until_ms: ctx.now + BUSY_MS, updated_at_ms: ctx.now }, { merge: true });
    tx.set(pRef, { ...P.bumpUsage(platform, ctx.now, 1), updated_at_ms: ctx.now }, { merge: true });
    return { usage };
  });
}

/** Devolve a criação reservada (a chamada falhou: a pessoa não perde a vez). */
async function devolver(ctx, uid) {
  const uRef = usageRef(ctx, uid);
  const pRef = usageRef(ctx, PLATFORM);
  await ctx.db.runTransaction(async (tx) => {
    const [u, p] = await tx.getAll(uRef, pRef);
    tx.set(uRef, { ...P.bumpUsage(u.exists ? u.data() : null, ctx.now, -1), busy_until_ms: 0, updated_at_ms: ctx.now }, { merge: true });
    tx.set(pRef, { ...P.bumpUsage(p.exists ? p.data() : null, ctx.now, -1), updated_at_ms: ctx.now }, { merge: true });
  });
}

/**
 * Cria o avatar. `data.recipe`: ids do catálogo. `data.keep`: mantém a pessoa
 * da imagem-base e troca só o visual.
 */
async function generate(ctx, actor, data) {
  const s = await situacao(ctx);
  if (!s.flag) falha('failed-precondition', 'O criador de avatar não está disponível.');
  if (!s.available) falha('failed-precondition', 'O criador de avatar ainda não foi configurado.');
  if (!ctx.bucket) falha('unavailable', 'O armazenamento de imagens não respondeu. Tente de novo em instantes.');
  const uid = actor.uid;
  const keep = data.keep === true;
  const marcas = await brandList(ctx);
  const noAr = marcas.filter((b) => b && P.liveBrand(marcas, b.id, ctx.now)).map((b) => b.id);
  let recipe = P.normalizeRecipe(data.recipe, { brandIds: noAr });

  const reserva = await reservar(ctx, uid, s.config);
  if (reserva.motivo === 'busy') falha('resource-exhausted', 'Já há um avatar seu sendo criado. Espere terminar.');
  if (reserva.motivo) falha('resource-exhausted', LIMITE[reserva.motivo]);

  try {
    let baseBytes = null;
    if (keep) {
      const base = reserva.usage && reserva.usage.base_recipe;
      if (!base) falha('failed-precondition', 'Crie um avatar primeiro; depois dá para manter o rosto e mudar o resto.');
      try { [baseBytes] = await ctx.bucket.file(baseFile(uid)).download(); } catch { baseBytes = null; }
      if (!baseBytes) falha('failed-precondition', 'O avatar de origem não está mais guardado. Crie um avatar novo.');
      recipe = P.mergeKeepingIdentity(P.normalizeRecipe(base), recipe);
    }
    const prompt = P.buildPrompt(recipe, { keep, brand: P.liveBrand(marcas, recipe.paddleBrand, ctx.now) });
    const bytes = await chamarProvedor(ctx, { key: s.key, config: s.config, prompt, baseBytes, uid });
    const meta = { contentType: 'image/jpeg', resumable: false };
    await ctx.bucket.file(lastFile(uid)).save(bytes, meta);
    if (!keep) await ctx.bucket.file(baseFile(uid)).save(bytes, meta);
    await usageRef(ctx, uid).set({
      busy_until_ms: 0, last_ms: ctx.now, last_recipe: recipe, total: ctx.FieldValue.increment(1),
      ...(keep ? {} : { base_recipe: recipe, base_ms: ctx.now }),
    }, { merge: true });
    const depois = await status(ctx, actor);
    return { image: bytes.toString('base64'), mime: 'image/jpeg', recipe, kept: keep, status: depois };
  } catch (err) {
    await devolver(ctx, uid).catch((e) => ctx.logger.error('avatarAi: não devolveu a criação reservada', e));
    throw err;
  }
}

/** A última imagem criada (para quem fechou a tela antes de salvar). */
async function last(ctx, actor) {
  const u = await usageRef(ctx, actor.uid).get();
  const usage = u.exists ? u.data() : null;
  if (!usage || !usage.last_recipe || !ctx.bucket) return { image: null };
  try {
    const [bytes] = await ctx.bucket.file(lastFile(actor.uid)).download();
    return { image: bytes.toString('base64'), mime: 'image/jpeg', recipe: usage.last_recipe, last_ms: usage.last_ms || 0 };
  } catch {
    return { image: null };
  }
}

/* -------------------------------------------------------------- admin -- */

async function soAdmin(actor) {
  if (!(await actor.isPlatformAdmin())) falha('permission-denied', 'Só o admin da plataforma configura o criador de avatar.');
}

async function resumoDaConfig(ctx) {
  const [s, k, p] = await Promise.all([settingsRef(ctx).get(), secretRef(ctx).get(), usageRef(ctx, PLATFORM).get()]);
  const key = k.exists ? String(k.data().api_key || '') : '';
  const { month } = P.periodKeys(ctx.now);
  const plat = p.exists ? p.data() : null;
  return {
    config: P.normalizeConfig(s.exists ? s.data() : null),
    has_key: Boolean(key),
    // Só o fim da chave, para o admin reconhecer qual está salva.
    key_hint: key ? key.slice(-4) : '',
    month,
    month_count: plat && plat.month === month ? Number(plat.month_count) || 0 : 0,
  };
}

async function config(ctx, actor) {
  await soAdmin(actor);
  return resumoDaConfig(ctx);
}

async function configSave(ctx, actor, data) {
  await soAdmin(actor);
  const cfg = P.normalizeConfig(data.config);
  const nova = typeof data.api_key === 'string' ? data.api_key.trim() : '';
  if (nova && !/^[A-Za-z0-9_-]{20,300}$/.test(nova)) falha('invalid-argument', 'A chave do provedor não parece válida. Cole a chave inteira, sem espaços.');
  const atual = await secretRef(ctx).get();
  const limpar = data.clear_key === true && !nova;
  const temChave = limpar ? false : Boolean(nova || (atual.exists && atual.data().api_key));
  if (cfg.enabled && !temChave) falha('failed-precondition', 'Cole a chave do provedor antes de ligar o criador.');
  if (nova || limpar) await secretRef(ctx).set({ api_key: nova, updated_at_ms: ctx.now, updated_by: actor.uid }, { merge: true });
  // O documento público leva só o que a tela pode saber (nunca a chave).
  await settingsRef(ctx).set({ ...cfg, has_key: temChave, updated_at_ms: ctx.now, updated_by: actor.uid });
  await ctx.db.collection('audit_logs').add({
    log_number: Number(`${ctx.now}${Math.floor(Math.random() * 900 + 100)}`),
    action: 'avatar_ai_config_changed', action_label: 'avatar_ai_config_changed',
    actor_id: actor.uid, actor_name: actor.name || actor.uid, actor_email: actor.email || '',
    tournament_id: null, user_id: null, details: { ...cfg, key_changed: Boolean(nova || limpar) },
    created_at: ctx.Timestamp.fromMillis(ctx.now),
  });
  return resumoDaConfig(ctx);
}

const ACOES = { status, generate, last, config, config_save: configSave };

module.exports = { ACOES, AvatarAiError, baseFile, lastFile, FLAG };
