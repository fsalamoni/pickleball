/**
 * RANKING OFICIAL da federação — a conta do SERVIDOR (cópia de
 * `src/modules/federations/domain/officialRanking.js`; `federationRanking.parity.test.js`
 * trava as duas). Gatilho: toda escrita em `federation_results/{id}` recalcula
 * `federation_rankings/{fed}_{temporada}` — só o servidor grava ali.
 */
'use strict';

const DEFAULT_RANKING_CONFIG = Object.freeze({
  points_by_place: Object.freeze({ 1: 100, 2: 70, 3: 50, 4: 40, 5: 30, 6: 30, 7: 25, 8: 25 }),
  participation: 10,
  best_n: 6,
  tier_multipliers: Object.freeze({ regional: 1, state: 1.5, major: 2 }),
  members_only: true,
  period: 'season',
  validity_months: 12,
});
const RANKING_VALIDITY_MAX = 36;
const ROLLING = 'rolling';
const hojeBR = (ms) => new Date(Number(ms) - 3 * 3600000).toISOString().slice(0, 10);

const num = (v, padrao) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : padrao);

function normalizeRankingConfig(input = {}) {
  const base = DEFAULT_RANKING_CONFIG;
  const pontos = {};
  for (let i = 1; i <= 8; i += 1) pontos[i] = num(input && input.points_by_place && input.points_by_place[i], base.points_by_place[i]);
  const pesos = {};
  Object.keys(base.tier_multipliers).forEach((k) => { pesos[k] = num(input && input.tier_multipliers && input.tier_multipliers[k], base.tier_multipliers[k]); });
  return {
    points_by_place: pontos,
    participation: num(input && input.participation, base.participation),
    best_n: Math.floor(num(input && input.best_n, base.best_n)),
    tier_multipliers: pesos,
    members_only: input == null || input.members_only == null ? base.members_only : Boolean(input.members_only),
    period: input && input.period === ROLLING ? ROLLING : 'season',
    validity_months: Math.min(RANKING_VALIDITY_MAX, Math.max(1, Math.floor(num(input && input.validity_months, base.validity_months)) || base.validity_months)),
  };
}

/** O dia em que o resultado deixa de contar no ranking corrido (data + meses, com o dia limitado ao fim do mês). */
function resultExpiry(dateISO, meses) {
  const m = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + Math.floor(Number(meses) || 0);
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(Number(m[3]), ultimo)).padStart(2, '0')}`;
}

const rankingCategoryKey = (r = {}) => `${r.gender_category || 'open'}_${r.age_category || 'open'}_${r.format || 'doubles'}`;

function memberValidOn(member, dateISO) {
  if (!member || member.tier !== 'federated') return false;
  if (['suspended', 'cancelled', 'rejected', 'pending', 'awaiting_payment'].includes(member.status)) return false;
  if (!dateISO) return member.status === 'active';
  if (member.valid_from && String(member.valid_from) > dateISO) return false;
  if (member.valid_until && String(member.valid_until) < dateISO) return false;
  return Boolean(member.valid_until);
}

function pointsFor({ position, played = 0 }, tier, config) {
  const cfg = normalizeRankingConfig(config);
  const base = position != null && position >= 1 && position <= 8 ? cfg.points_by_place[position] : (played > 0 ? cfg.participation : 0);
  const peso = cfg.tier_multipliers[tier] == null ? 1 : cfg.tier_multipliers[tier];
  return Math.round(base * peso * 100) / 100;
}

function classifica(mapa, bestN) {
  const linhas = [...mapa.values()].map((p) => {
    const ordenados = [...p.results].sort((a, b) => b.points - a.points || String(a.date).localeCompare(String(b.date)));
    const contam = p.counting ? p.counting : (bestN > 0 ? ordenados.slice(0, bestN) : ordenados);
    const total = Math.round(contam.reduce((s, r) => s + r.points, 0) * 100) / 100;
    return { uid: p.uid, name: p.name, photo_url: p.photo_url, points: total, events: ordenados.length, titles: ordenados.filter((r) => r.position === 1).length, results: ordenados };
  }).filter((l) => l.points > 0 || l.events > 0);
  linhas.sort((a, b) => b.points - a.points || b.titles - a.titles || b.events - a.events || String(a.name).localeCompare(String(b.name)));
  let pos = 0;
  linhas.forEach((l, i) => {
    if (i === 0 || l.points !== linhas[i - 1].points) pos = i + 1;
    l.position = pos;
  });
  return linhas;
}

function computeOfficialRanking({ results = [], members = [], config = {}, season, asOf } = {}) {
  const cfg = normalizeRankingConfig(config);
  const porUid = new Map();
  (members || []).forEach((m) => { if (m && m.user_id) porUid.set(m.user_id, m); });
  const classes = new Map();
  const geral = new Map();
  const entra = (mapa, row, pontos, r) => {
    if (!mapa.has(row.uid)) mapa.set(row.uid, { uid: row.uid, name: row.name || '', photo_url: row.photo_url || null, results: [] });
    const p = mapa.get(row.uid);
    if (row.name) p.name = row.name;
    if (row.photo_url) p.photo_url = row.photo_url;
    p.results.push({ points: pontos, position: row.position == null ? null : row.position, tournament_id: r.tournament_id, tournament_name: r.tournament_name || '', modality_name: r.modality_name || '', date: r.date || '', category: rankingCategoryKey(r), ...(asOf ? { expires_on: resultExpiry(r.date, cfg.validity_months) } : {}) });
  };
  let usados = 0;
  (results || [])
    .filter((r) => r && r.status === 'sent' && (asOf
      ? Boolean(r.date) && r.date <= asOf && resultExpiry(r.date, cfg.validity_months) > asOf
      : (season == null || Number(r.season) === Number(season))))
    .forEach((r) => {
      usados += 1;
      const key = rankingCategoryKey(r);
      if (!classes.has(key)) classes.set(key, { key, gender_category: r.gender_category || 'open', age_category: r.age_category || 'open', format: r.format || 'doubles', pessoas: new Map() });
      const classe = classes.get(key);
      (r.rows || []).forEach((row) => {
        if (!row || !row.uid) return;
        if (cfg.members_only && !memberValidOn(porUid.get(row.uid), r.date)) return;
        const pontos = pointsFor(row, r.tier, cfg);
        if (pontos <= 0) return;
        entra(classe.pessoas, row, pontos, r);
        entra(geral, row, pontos, r);
      });
    });
  const categorias = [...classes.values()]
    .map((c) => ({ key: c.key, gender_category: c.gender_category, age_category: c.age_category, format: c.format, rows: classifica(c.pessoas, cfg.best_n) }))
    .filter((c) => c.rows.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
  const geralLinhas = classifica(new Map([...geral].map(([uid, p]) => {
    const porClasse = new Map();
    p.results.forEach((r) => { if (!porClasse.has(r.category)) porClasse.set(r.category, []); porClasse.get(r.category).push(r); });
    const contam = [...porClasse.values()].flatMap((lista) => {
      const ord = [...lista].sort((a, b) => b.points - a.points);
      return cfg.best_n > 0 ? ord.slice(0, cfg.best_n) : ord;
    });
    return [uid, { ...p, counting: contam }];
  })), 0);
  return { season: asOf ? null : (season == null ? null : season), as_of: asOf || null, categories: categorias, general: geralLinhas, results_count: usados, config: cfg };
}

/* ---------------------------------------------------------------- gatilho -- */

/** O documento gravado em `federation_rankings` (sem o detalhe de cada resultado — fica leve e público). */
function rankingDocument(fedId, calc, agoraMs) {
  const enxuga = (rows) => rows.map((l) => ({ uid: l.uid, name: l.name, photo_url: l.photo_url || null, points: l.points, events: l.events, titles: l.titles, position: l.position, results: l.results.slice(0, 12).map((r) => ({ points: r.points, position: r.position, tournament_id: r.tournament_id, tournament_name: r.tournament_name, modality_name: r.modality_name, date: r.date, ...(r.expires_on ? { expires_on: r.expires_on } : {}) })) }));
  return {
    federation_id: fedId,
    season: calc.season,
    ...(calc.as_of ? { period: ROLLING, as_of: calc.as_of, validity_months: calc.config.validity_months } : {}),
    categories: calc.categories.map((c) => ({ key: c.key, gender_category: c.gender_category, age_category: c.age_category, format: c.format, rows: enxuga(c.rows) })),
    general: enxuga(calc.general),
    results_count: calc.results_count,
    config: calc.config,
    updated_at_ms: agoraMs,
  };
}

/**
 * Recalcula a temporada de UMA federação a partir do banco e grava
 * `federation_rankings/{fed}_{temporada}`. Idempotente.
 */
async function recomputeSeason(ctx, fedId, season) {
  const { db } = ctx;
  if (!fedId || !Number.isFinite(Number(season))) return null;
  const fedSnap = await db.collection('federations').doc(fedId).get();
  const fed = fedSnap.exists ? fedSnap.data() : {};
  const [resSnap, memSnap] = await Promise.all([
    db.collection('federation_results').where('federation_id', '==', fedId).where('season', '==', Number(season)).get(),
    db.collection('federation_members').where('federation_id', '==', fedId).get(),
  ]);
  const results = resSnap.docs.map((d) => d.data());
  const members = memSnap.docs.map((d) => d.data());
  const calc = computeOfficialRanking({ results, members, config: fed.ranking_config || {}, season: Number(season) });
  const docRef = db.collection('federation_rankings').doc(`${fedId}_${season}`);
  await docRef.set(rankingDocument(fedId, calc, Number(ctx.now) || Date.now()));
  if (ctx.logger) ctx.logger.info('federationRanking: temporada recalculada', { fedId, season, results: results.length, categorias: calc.categories.length });
  return calc;
}

/**
 * O ranking CORRIDO (`ranking_config.period == 'rolling'`): os resultados dos
 * últimos `validity_months` meses, contados em `hoje` (Brasília), em
 * `federation_rankings/{fed}_rolling`. Com a federação de volta à temporada, o
 * documento sai. Idempotente; a varredura diária refaz porque resultado VENCE
 * com o tempo, sem nenhuma escrita que dispare o gatilho.
 */
async function recomputeRolling(ctx, fedId, fedData) {
  const { db } = ctx;
  if (!fedId) return null;
  let fed = fedData;
  if (!fed) {
    const s = await db.collection('federations').doc(fedId).get();
    fed = s.exists ? s.data() : {};
  }
  const cfg = normalizeRankingConfig(fed.ranking_config || {});
  const docRef = db.collection('federation_rankings').doc(`${fedId}_${ROLLING}`);
  if (cfg.period !== ROLLING) {
    const atual = await docRef.get();
    if (atual.exists) await docRef.delete();
    return null;
  }
  const agora = Number(ctx.now) || Date.now();
  const [resSnap, memSnap] = await Promise.all([
    db.collection('federation_results').where('federation_id', '==', fedId).get(),
    db.collection('federation_members').where('federation_id', '==', fedId).get(),
  ]);
  const calc = computeOfficialRanking({ results: resSnap.docs.map((d) => d.data()), members: memSnap.docs.map((d) => d.data()), config: cfg, asOf: hojeBR(agora) });
  await docRef.set(rankingDocument(fedId, calc, agora));
  return calc;
}

/** Gatilho: antes/depois de `federation_results/{id}` — recalcula a(s) temporada(s) tocadas e o corrido. */
async function onResultWritten(ctx, antes, depois) {
  const alvos = new Map();
  const feds = new Set();
  [antes, depois].forEach((r) => {
    if (r && r.federation_id && r.season != null) alvos.set(`${r.federation_id}_${r.season}`, { fedId: r.federation_id, season: Number(r.season) });
    if (r && r.federation_id) feds.add(r.federation_id);
  });
  for (const { fedId, season } of alvos.values()) await recomputeSeason(ctx, fedId, season);
  for (const fedId of feds) await recomputeRolling(ctx, fedId);
}

/** Gatilho: a configuração do ranking da federação mudou — recalcula as temporadas que têm resultado e o corrido. */
async function onFederationWritten(ctx, fedId, antes, depois) {
  const a = JSON.stringify((antes && antes.ranking_config) || null);
  const d = JSON.stringify((depois && depois.ranking_config) || null);
  if (a === d) return;
  const snap = await ctx.db.collection('federation_results').where('federation_id', '==', fedId).get();
  const temporadas = new Set(snap.docs.map((x) => Number(x.data().season)).filter((n) => Number.isFinite(n)));
  for (const season of temporadas) await recomputeSeason(ctx, fedId, season);
  await recomputeRolling(ctx, fedId, depois || {});
}

/** Varredura diária: refaz o ranking corrido de toda federação que o usa (resultado vence sozinho). */
async function rollingSweep(ctx) {
  const snap = await ctx.db.collection('federations').where('ranking_config.period', '==', ROLLING).get();
  let n = 0;
  for (const d of snap.docs) {
    try {
      await recomputeRolling(ctx, d.id, d.data());
      n += 1;
    } catch (err) {
      if (ctx.logger) ctx.logger.warn('federationRanking: corrido falhou', { fedId: d.id, err: String(err && err.message) });
    }
  }
  return { federations: n };
}

module.exports = {
  DEFAULT_RANKING_CONFIG, normalizeRankingConfig, rankingCategoryKey, memberValidOn, pointsFor, computeOfficialRanking,
  resultExpiry, rankingDocument, recomputeSeason, recomputeRolling, rollingSweep, onResultWritten, onFederationWritten,
};
