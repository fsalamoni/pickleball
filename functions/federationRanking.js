/**
 * RANKING OFICIAL da federação — a conta do SERVIDOR (cópia de
 * `src/modules/federations/domain/officialRanking.js`; `federationRanking.parity.test.js`
 * trava as duas).
 *
 * Livro-caixa em dois tempos:
 *  1. LANÇAMENTO — toda escrita em `federation_results/{id}` (o organizador
 *     envia/reenvia, competições recusa/readmite, alguém retira) acerta os
 *     lançamentos daquele resultado em `federation_points/{resultId}_{uid}`:
 *     quem pontua ganha o lançamento (com a tabela e o peso de HOJE, que ficam
 *     gravados nele); quem sai é CANCELADO com o motivo — nada é apagado.
 *  2. SOMA DO ANO — a temporada é somada a partir dos lançamentos e gravada em
 *     `federation_rankings/{fed}_{ano}`.
 *
 * Temporada FECHADA (depois de 31/01 do ano seguinte) é imutável: o gatilho
 * não lança, não cancela e não regrava nada dela — e a regra do Firestore
 * (`fedSeasonOpen`) já recusa a escrita do resultado. Só o servidor grava
 * `federation_points` e `federation_rankings`.
 */
'use strict';

const DEFAULT_RANKING_CONFIG = Object.freeze({
  points_by_place: Object.freeze({ 1: 100, 2: 70, 3: 50, 4: 40, 5: 30, 6: 30, 7: 25, 8: 25 }),
  participation: 10,
  best_n: 6,
  tier_multipliers: Object.freeze({ regional: 1, state: 1.5, major: 2 }),
  members_only: true,
});

const POINTS_STATUS = Object.freeze({ AWARDED: 'awarded', CANCELLED: 'cancelled' });
const POINTS_CANCEL_REASON = Object.freeze({
  RESULT_REJECTED: 'result_rejected',
  RESULT_DELETED: 'result_deleted',
  NOT_IN_RESULT: 'not_in_result',
  ACCOUNT_DELETED: 'account_deleted',
});

const num = (v, padrao) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : padrao);
const centavos = (v) => Math.round(v * 100) / 100;
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

/* ------------------------------------------------ categorias de torneio -- */

const TIER_MAX_PLACES = 64;
const TIER_MAX = 30;
const TIER_ID = /^[a-z0-9_-]{1,40}$/;
/** Os nomes das três categorias de antes (a tela traduz; aqui só identificam). */
const LEGACY_TIER_NAMES = Object.freeze({ regional: 'Etapa regional', state: 'Etapa estadual', major: 'Campeonato principal' });

function normalizeTier(input = {}) {
  const id = String((input && input.id) || '');
  if (!TIER_ID.test(id)) return null;
  const bruto = (input && input.points_by_place) || {};
  const chaves = Object.keys(bruto).map(Number).filter((k) => Number.isInteger(k) && k >= 1 && k <= TIER_MAX_PLACES && Number.isFinite(Number(bruto[k])) && Number(bruto[k]) >= 0);
  const places = chaves.length ? Math.max(...chaves) : 0;
  const tabela = {};
  let anterior = 0;
  for (let i = 1; i <= places; i += 1) {
    const v = bruto[i];
    anterior = Number.isFinite(Number(v)) && Number(v) >= 0 && v !== '' && v != null ? centavos(Number(v)) : anterior;
    tabela[i] = anterior;
  }
  const req = (input && input.requirements) || {};
  return {
    id,
    code: texto(input.code, 24),
    group: texto(input.group, 12),
    name: texto(input.name, 80),
    points_by_place: tabela,
    places,
    participation: centavos(num(input.participation, 0)),
    requirements: { min_entrants: Math.floor(num(req.min_entrants, 0)), prize: texto(req.prize, 120), notes: texto(req.notes, 500) },
    // Taxa de chancela desta categoria, em centavos (0 = sem taxa; Bloco 2).
    sanction_fee_cents: Math.min(100000000, Math.max(0, Math.trunc(num(input.sanction_fee_cents, 0)))),
    active: input.active !== false,
    legacy: input.legacy === true,
  };
}

function legacyTiers(cfg) {
  return Object.keys(DEFAULT_RANKING_CONFIG.tier_multipliers).map((id) => {
    const peso = cfg.tier_multipliers[id] == null ? 1 : cfg.tier_multipliers[id];
    const tabela = {};
    for (let i = 1; i <= 8; i += 1) tabela[i] = centavos(cfg.points_by_place[i] * peso);
    return normalizeTier({ id, code: '', group: '', name: LEGACY_TIER_NAMES[id], points_by_place: tabela, participation: centavos(cfg.participation * peso), legacy: true });
  });
}

function normalizeRankingConfig(input = {}) {
  const base = DEFAULT_RANKING_CONFIG;
  const pontos = {};
  for (let i = 1; i <= 8; i += 1) pontos[i] = num(input && input.points_by_place && input.points_by_place[i], base.points_by_place[i]);
  const pesos = {};
  Object.keys(base.tier_multipliers).forEach((k) => { pesos[k] = num(input && input.tier_multipliers && input.tier_multipliers[k], base.tier_multipliers[k]); });
  const cfg = {
    points_by_place: pontos,
    participation: num(input && input.participation, base.participation),
    best_n: Math.floor(num(input && input.best_n, base.best_n)),
    tier_multipliers: pesos,
    members_only: input == null || input.members_only == null ? base.members_only : Boolean(input.members_only),
  };
  const vistos = new Set();
  const proprias = ((input && Array.isArray(input.tiers)) ? input.tiers : []).filter((tt) => tt && tt.legacy !== true).map(normalizeTier)
    .filter((tt) => tt && !vistos.has(tt.id) && vistos.add(tt.id)).slice(0, TIER_MAX);
  cfg.tiers_explicit = proprias.length > 0;
  cfg.tiers = cfg.tiers_explicit ? proprias : legacyTiers(cfg);
  return cfg;
}

/* ------------------------------------------------------ fechamento do ano -- */

function seasonClosesAtMs(season) {
  const ano = Number(season);
  return Number.isInteger(ano) ? Date.UTC(ano + 1, 1, 1, 3, 0, 0) : 0;
}

const seasonLastDay = (season) => `${Number(season) + 1}-01-31`;

function seasonClosed(season, nowMs = Date.now()) {
  const fim = seasonClosesAtMs(season);
  return !fim || Number(nowMs) >= fim;
}

function openSeasons(nowMs = Date.now()) {
  const ano = new Date(Number(nowMs) - 3 * 3600000).getUTCFullYear();
  return [ano - 1, ano].filter((s) => !seasonClosed(s, nowMs));
}

/* ------------------------------------------------------------ lançamento -- */

const rankingCategoryKey = (r = {}) => `${r.gender_category || 'open'}_${r.age_category || 'open'}_${r.format || 'doubles'}`;

function memberValidOn(member, dateISO) {
  if (!member || member.tier !== 'federated') return false;
  if (['suspended', 'cancelled', 'rejected', 'pending', 'awaiting_payment'].includes(member.status)) return false;
  if (!dateISO) return member.status === 'active';
  if (member.valid_from && String(member.valid_from) > dateISO) return false;
  if (member.valid_until && String(member.valid_until) < dateISO) return false;
  return Boolean(member.valid_until);
}

function basePoints({ position, played = 0 }, cfg) {
  if (position != null && position >= 1 && position <= 8) return cfg.points_by_place[position];
  return played > 0 ? cfg.participation : 0;
}

function tierTablePoints({ position, played = 0 }, tier) {
  if (position != null && position >= 1 && position <= tier.places) return tier.points_by_place[position];
  return played > 0 ? tier.participation : 0;
}

function contaDaCategoria(row, tierId, cfg) {
  const tier = cfg.tiers_explicit ? cfg.tiers.find((tt) => tt.id === tierId) || null : null;
  if (tier) return { base: tierTablePoints(row, tier), peso: 1, tier };
  return { base: basePoints(row, cfg), peso: cfg.tier_multipliers[tierId] == null ? 1 : cfg.tier_multipliers[tierId], tier: null };
}

function pointsFor({ position, played = 0 }, tier, config) {
  const cfg = normalizeRankingConfig(config);
  const conta = contaDaCategoria({ position, played }, tier, cfg);
  return centavos(conta.base * conta.peso);
}

function awardPoints({ result, members = [], config = {} } = {}) {
  if (!result) return [];
  const cfg = normalizeRankingConfig(config);
  const porUid = new Map();
  (members || []).forEach((m) => { if (m && m.user_id) porUid.set(m.user_id, m); });
  const melhor = new Map();
  (result.rows || []).forEach((row) => {
    if (!row || !row.uid) return;
    if (cfg.members_only && !memberValidOn(porUid.get(row.uid), result.date)) return;
    const { base, peso, tier } = contaDaCategoria(row, result.tier, cfg);
    const points = centavos(base * peso);
    if (points <= 0) return;
    const atual = melhor.get(row.uid);
    if (atual && atual.points >= points) return;
    melhor.set(row.uid, {
      uid: row.uid, name: String(row.name || '').slice(0, 120), photo_url: row.photo_url || null,
      position: row.position == null ? null : row.position, played: Number(row.played) || 0,
      base_points: base, multiplier: peso, points,
      ...(tier ? { tier_code: tier.code, tier_group: tier.group, tier_name: tier.name } : {}),
    });
  });
  return [...melhor.values()];
}

/* ---------------------------------------------------------- soma do ano -- */

const ordemDosResultados = (a, b) => b.points - a.points || String(a.date).localeCompare(String(b.date)) || String(a.entry_id).localeCompare(String(b.entry_id));

function classifica(mapa, bestN) {
  const linhas = [...mapa.values()].map((p) => {
    const ordenados = [...p.results].sort(ordemDosResultados);
    const contam = p.counting ? p.counting : (bestN > 0 ? ordenados.slice(0, bestN) : ordenados);
    const ids = new Set(contam.map((r) => r.entry_id));
    const total = centavos(contam.reduce((s, r) => s + r.points, 0));
    return { uid: p.uid, name: p.name, photo_url: p.photo_url, points: total, events: ordenados.length, titles: ordenados.filter((r) => r.position === 1).length, results: ordenados.map((r) => Object.assign({}, r, { counts: ids.has(r.entry_id) })) };
  }).filter((l) => l.points > 0 || l.events > 0);
  linhas.sort((a, b) => b.points - a.points || b.titles - a.titles || b.events - a.events || String(a.name).localeCompare(String(b.name)));
  let pos = 0;
  linhas.forEach((l, i) => {
    if (i === 0 || l.points !== linhas[i - 1].points) pos = i + 1;
    l.position = pos;
  });
  return linhas;
}

function contamPorClasse(results, bestN) {
  const porClasse = new Map();
  results.forEach((r) => { if (!porClasse.has(r.category)) porClasse.set(r.category, []); porClasse.get(r.category).push(r); });
  return [...porClasse.values()].flatMap((lista) => {
    const ord = [...lista].sort(ordemDosResultados);
    return bestN > 0 ? ord.slice(0, bestN) : ord;
  });
}

const regrasDoAno = (cfg) => ({ points_by_place: cfg.points_by_place, participation: cfg.participation, best_n: cfg.best_n, tier_multipliers: cfg.tier_multipliers, members_only: cfg.members_only });

function aggregateSeason({ entries = [], config = {}, season } = {}) {
  const cfg = normalizeRankingConfig(config);
  const classes = new Map();
  const geral = new Map();
  const resultados = new Set();
  const entra = (mapa, e, item) => {
    if (!mapa.has(e.uid)) mapa.set(e.uid, { uid: e.uid, name: e.name || '', photo_url: e.photo_url || null, results: [] });
    const p = mapa.get(e.uid);
    if (e.name) p.name = e.name;
    if (e.photo_url) p.photo_url = e.photo_url;
    p.results.push(item);
  };
  let usados = 0;
  (entries || [])
    .filter((e) => e && e.uid && e.status === POINTS_STATUS.AWARDED && Number(e.points) > 0 && (season == null || Number(e.season) === Number(season)))
    .forEach((e) => {
      usados += 1;
      if (e.result_id) resultados.add(e.result_id);
      const key = e.category || rankingCategoryKey(e);
      if (!classes.has(key)) classes.set(key, { key, gender_category: e.gender_category || 'open', age_category: e.age_category || 'open', format: e.format || 'doubles', pessoas: new Map() });
      const item = { entry_id: e.id || `${e.result_id}_${e.uid}`, result_id: e.result_id || null, points: Number(e.points), position: e.position == null ? null : e.position, tournament_id: e.tournament_id || null, tournament_name: e.tournament_name || '', modality_name: e.modality_name || '', date: e.date || '', category: key, federation_acronym: e.federation_acronym || '' };
      entra(classes.get(key).pessoas, e, item);
      entra(geral, e, item);
    });
  const categorias = [...classes.values()]
    .map((c) => ({ key: c.key, gender_category: c.gender_category, age_category: c.age_category, format: c.format, rows: classifica(c.pessoas, cfg.best_n) }))
    .filter((c) => c.rows.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
  const geralLinhas = classifica(new Map([...geral].map(([uid, p]) => [uid, Object.assign({}, p, { counting: contamPorClasse(p.results, cfg.best_n) })])), 0);
  return { season: season == null ? null : season, categories: categorias, general: geralLinhas, results_count: resultados.size, entries_count: usados, config: regrasDoAno(cfg) };
}

/* ------------------------------------------------- acerto dos lançamentos -- */

/** Os dados do resultado que todo lançamento carrega (o histórico se lê sozinho). */
function dadosDoResultado(resultId, r) {
  return {
    federation_id: r.federation_id, federation_acronym: r.federation_acronym || '', season: Number(r.season), result_id: resultId,
    tournament_id: r.tournament_id || null, tournament_name: r.tournament_name || '', modality_id: r.modality_id || null, modality_name: r.modality_name || '',
    date: r.date || '', tier: r.tier || 'regional', category: rankingCategoryKey(r),
    gender_category: r.gender_category || 'open', age_category: r.age_category || 'open', format: r.format || 'doubles',
  };
}

/**
 * Compara o que o resultado manda AGORA com os lançamentos que já existem e
 * diz o que gravar. Regras:
 *  - quem continua com a MESMA colocação mantém o lançamento como está (o
 *    ponto lançado não muda nem se a tabela ou a filiação mudarem depois);
 *  - colocação revista = lançamento refeito, com o ponto anterior em `previous`;
 *  - quem pontua e não tinha (ou tinha cancelado) ganha o lançamento;
 *  - quem não pontua mais é CANCELADO, com o motivo — nunca apagado;
 *  - lançamento sem uid (conta excluída) não é tocado.
 * @returns {Array<{ id: string, data: object }>}
 */
function ledgerDiff({ resultId, antes, depois, awards = [], existing = [], nowMs }) {
  const r = depois || antes;
  const base = dadosDoResultado(resultId, r);
  const linhas = new Map();
  ((depois && depois.status === 'sent' && depois.rows) || []).forEach((row) => { if (row && row.uid && !linhas.has(row.uid)) linhas.set(row.uid, row); });
  const porUid = new Map();
  existing.forEach((e) => { if (e && e.uid) porUid.set(e.uid, e); });
  const escritas = [];
  const vistos = new Set();
  // Quem já tinha lançamento e segue com a mesma colocação: fica como está.
  porUid.forEach((e, uid) => {
    const row = linhas.get(uid);
    if (e.status === POINTS_STATUS.AWARDED && row && (row.position == null ? null : row.position) === e.position && (Number(row.played) || 0) === (Number(e.played) || 0)) vistos.add(uid);
  });
  awards.forEach((a) => {
    if (vistos.has(a.uid)) return;
    vistos.add(a.uid);
    const e = porUid.get(a.uid);
    const id = `${resultId}_${a.uid}`;
    const revisto = e && e.status === POINTS_STATUS.AWARDED;
    escritas.push({
      id,
      data: Object.assign({}, base, a, {
        status: POINTS_STATUS.AWARDED,
        awarded_at_ms: revisto ? (e.awarded_at_ms || nowMs) : nowMs,
        revised_at_ms: revisto ? nowMs : null,
        previous: revisto ? { position: e.position == null ? null : e.position, points: Number(e.points) || 0 } : null,
        cancelled_at_ms: null, cancel_reason: null, updated_at_ms: nowMs,
      }),
    });
  });
  let motivo = POINTS_CANCEL_REASON.NOT_IN_RESULT;
  if (!depois) motivo = POINTS_CANCEL_REASON.RESULT_DELETED;
  else if (depois.status !== 'sent') motivo = POINTS_CANCEL_REASON.RESULT_REJECTED;
  porUid.forEach((e, uid) => {
    if (vistos.has(uid) || e.status !== POINTS_STATUS.AWARDED) return;
    escritas.push({ id: `${resultId}_${uid}`, data: Object.assign({}, e, { status: POINTS_STATUS.CANCELLED, cancel_reason: motivo, cancelled_at_ms: nowMs, updated_at_ms: nowMs }) });
  });
  return escritas.map((w) => { const data = Object.assign({}, w.data); delete data.id; return { id: w.id, data }; });
}

/* ---------------------------------------------------------------- gatilho -- */

/** O documento gravado em `federation_rankings` (sem o detalhe de cada resultado além de 12 — fica leve e público). */
function rankingDocument(fedId, calc, agoraMs) {
  const enxuga = (rows) => rows.map((l) => ({ uid: l.uid, name: l.name, photo_url: l.photo_url || null, points: l.points, events: l.events, titles: l.titles, position: l.position, results: l.results.slice(0, 12).map((r) => ({ entry_id: r.entry_id, points: r.points, position: r.position, counts: r.counts, tournament_id: r.tournament_id, tournament_name: r.tournament_name, modality_name: r.modality_name, date: r.date, ...(r.federation_acronym ? { federation_acronym: r.federation_acronym } : {}) })) }));
  return {
    federation_id: fedId,
    season: calc.season,
    categories: calc.categories.map((c) => ({ key: c.key, gender_category: c.gender_category, age_category: c.age_category, format: c.format, rows: enxuga(c.rows) })),
    general: enxuga(calc.general),
    // Quem aparece no ano: a exclusão de conta acha o documento por aqui (e tira o nome até de um ano fechado).
    uids: calc.general.map((l) => l.uid).filter(Boolean),
    results_count: calc.results_count,
    entries_count: calc.entries_count,
    config: calc.config,
    closes_at_ms: seasonClosesAtMs(calc.season),
    last_day: seasonLastDay(calc.season),
    updated_at_ms: agoraMs,
  };
}

/**
 * Soma a temporada de UMA federação a partir dos lançamentos e grava
 * `federation_rankings/{fed}_{temporada}`. Idempotente. Temporada fechada não
 * é regravada (devolve `null`).
 */
async function recomputeSeason(ctx, fedId, season) {
  const { db } = ctx;
  const agora = Number(ctx.now) || Date.now();
  if (!fedId || !Number.isInteger(Number(season))) return null;
  if (seasonClosed(Number(season), agora)) {
    if (ctx.logger) ctx.logger.info('federationRanking: temporada fechada — não muda', { fedId, season });
    return null;
  }
  const fedSnap = await db.collection('federations').doc(fedId).get();
  const fed = fedSnap.exists ? fedSnap.data() : {};
  const snap = await db.collection('federation_points').where('federation_id', '==', fedId).where('season', '==', Number(season)).get();
  const entries = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  // Resultado enviado antes do livro de pontos existir (ou cujo gatilho se
  // perdeu) ainda não tem lançamento: é lançado agora, com a tabela de agora —
  // uma vez só, porque depois disso já tem.
  const comLancamento = new Set(entries.map((e) => e.result_id));
  const resSnap = await db.collection('federation_results').where('federation_id', '==', fedId).where('season', '==', Number(season)).get();
  const cfg = normalizeRankingConfig(fed.ranking_config || {});
  for (const d of resSnap.docs) {
    const res = d.data() || {};
    if (res.status !== 'sent' || comLancamento.has(d.id)) continue;
    const members = cfg.members_only ? await filiacoesDe(db, fedId, res.rows) : [];
    const escritas = ledgerDiff({ resultId: d.id, antes: null, depois: res, awards: awardPoints({ result: res, members, config: cfg }), existing: [], nowMs: agora });
    if (!escritas.length) continue;
    const lote = db.batch();
    escritas.forEach((w) => { lote.set(db.collection('federation_points').doc(w.id), w.data); entries.push(Object.assign({ id: w.id }, w.data)); });
    await lote.commit();
  }
  const calc = aggregateSeason({ entries, config: fed.ranking_config || {}, season: Number(season) });
  const ref = db.collection('federation_rankings').doc(`${fedId}_${season}`);
  // Ano sem lançamento nenhum e sem ranking gravado: não cria um ranking vazio.
  if (!entries.length && !(await ref.get()).exists) return calc;
  await ref.set(rankingDocument(fedId, calc, agora));
  if (ctx.logger) ctx.logger.info('federationRanking: temporada somada', { fedId, season, lancamentos: calc.entries_count, categorias: calc.categories.length });
  // Filiada a uma confederação (ou a própria): o ranking NACIONAL do ano soma de novo. require tardio: o nacional usa este arquivo.
  await require('./federationNational.js').afterSeason(ctx, fed, fedId, Number(season));
  return calc;
}

/** As filiações de quem aparece no resultado (`federation_members/{fed}_{uid}`). */
async function filiacoesDe(db, fedId, rows) {
  const uids = [...new Set((rows || []).map((r) => r && r.uid).filter(Boolean))];
  const snaps = await Promise.all(uids.map((uid) => db.collection('federation_members').doc(`${fedId}_${uid}`).get()));
  return snaps.filter((s) => s.exists).map((s) => s.data());
}

/**
 * Gatilho: antes/depois de `federation_results/{resultId}` — acerta os
 * lançamentos daquele resultado e soma a temporada de novo. Temporada fechada:
 * nada muda.
 */
async function onResultWritten(ctx, antes, depois, resultId) {
  const { db } = ctx;
  const r = depois || antes;
  if (!r || !r.federation_id || !Number.isInteger(Number(r.season))) return null;
  const fedId = r.federation_id;
  const season = Number(r.season);
  const agora = Number(ctx.now) || Date.now();
  const id = resultId || `${fedId}_${r.tournament_id}_${r.modality_id}`;
  if (seasonClosed(season, agora)) {
    if (ctx.logger) ctx.logger.info('federationRanking: resultado de temporada fechada — nada muda', { fedId, season, resultId: id });
    return null;
  }
  const fedSnap = await db.collection('federations').doc(fedId).get();
  const fed = fedSnap.exists ? fedSnap.data() : {};
  const config = fed.ranking_config || {};
  const existSnap = await db.collection('federation_points').where('result_id', '==', id).get();
  const existing = existSnap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  let awards = [];
  if (depois && depois.status === 'sent') {
    const cfg = normalizeRankingConfig(config);
    const members = cfg.members_only ? await filiacoesDe(db, fedId, depois.rows) : [];
    awards = awardPoints({ result: depois, members, config: cfg });
  }
  const escritas = ledgerDiff({ resultId: id, antes, depois, awards, existing, nowMs: agora });
  for (let i = 0; i < escritas.length; i += 400) {
    const lote = db.batch();
    escritas.slice(i, i + 400).forEach((w) => lote.set(db.collection('federation_points').doc(w.id), w.data));
    await lote.commit();
  }
  if (ctx.logger) ctx.logger.info('federationRanking: lançamentos acertados', { fedId, season, resultId: id, escritas: escritas.length });
  return recomputeSeason(ctx, fedId, season);
}

/**
 * Gatilho: a configuração do ranking da federação mudou. O que já foi lançado
 * NÃO muda (o ponto lançado é o daquele dia); só as temporadas ABERTAS são
 * somadas de novo, porque o "melhores N" vale para o ano em curso. Ano fechado
 * não se mexe.
 */
async function onFederationWritten(ctx, fedId, antes, depois) {
  const a = JSON.stringify((antes && antes.ranking_config) || null);
  const d = JSON.stringify((depois && depois.ranking_config) || null);
  if (a === d || !depois) return;
  const agora = Number(ctx.now) || Date.now();
  for (const season of openSeasons(agora)) await recomputeSeason(ctx, fedId, season);
}

module.exports = {
  DEFAULT_RANKING_CONFIG, POINTS_STATUS, POINTS_CANCEL_REASON, TIER_MAX_PLACES, TIER_MAX, normalizeTier, normalizeRankingConfig, rankingCategoryKey, memberValidOn, pointsFor,
  awardPoints, aggregateSeason, seasonClosesAtMs, seasonLastDay, seasonClosed, openSeasons, ledgerDiff,
  rankingDocument, recomputeSeason, onResultWritten, onFederationWritten,
};
