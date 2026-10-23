/**
 * RANKING OFICIAL da federação (módulo `ranking`). Lógica pura.
 *
 * Dois tempos, como num livro-caixa:
 *  1. LANÇAMENTO — cada categoria de torneio chancelado que o organizador
 *     envia (`federation_results`, colocação final por `modalityPlacement`)
 *     lança os pontos de cada atleta que pontua no histórico dele
 *     (`federation_points/{resultId}_{uid}`), com a tabela e o peso daquele
 *     dia (`awardPoints`). O ponto lançado fica gravado: mudar a tabela depois
 *     não reescreve o que já foi lançado.
 *  2. SOMA DO ANO — o ranking da temporada (`federation_rankings/{fed}_{ano}`)
 *     é a soma dos lançamentos daquele ano (`aggregateSeason`). Cada ano é
 *     IMUTÁVEL depois que fecha (`seasonClosed`: 31/01 do ano seguinte é o
 *     último dia para enviar ou corrigir um resultado de dezembro).
 *
 * Quem GRAVA é o servidor (`functions/federationRanking.js`), com a MESMA
 * conta — `functions/federationRanking.parity.test.js` trava a cópia.
 *
 * Regras (D12): só pontua quem era federado EM DIA na data do torneio
 * (`members_only`); pontos por colocação × peso do torneio; os `best_n`
 * melhores resultados da classe somam; a geral soma as classes.
 */
import { instanteEmMs } from '@/core/domain/instant.js';
import { t } from '@/core/i18n';
import { DEFAULT_RANKING_CONFIG, PLAN_TIER, POINTS_STATUS, SANCTION_TIER_LABELS } from './constants.js';

const num = (v, padrao) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : padrao);
const centavos = (v) => Math.round(v * 100) / 100;
const texto = (v, max) => String(v ?? '').trim().slice(0, max);

/* ------------------------------------------------ categorias de torneio -- */

/** Quantas colocações uma tabela de pontos pode ter, e quantas categorias uma federação. */
export const TIER_MAX_PLACES = 64;
export const TIER_MAX = 30;
const TIER_ID = /^[a-z0-9_-]{1,40}$/;

/**
 * Saneia UMA categoria de torneio (`ranking_config.tiers[]`): sigla e valor
 * (`code`, ex.: "FGP 1000"), grupo (`group`, ex.: "G1"), nome, a tabela de
 * pontos por colocação (até 64; colocação que falta no meio vale a de cima),
 * a participação (quem jogou e ficou fora da tabela) e os requisitos.
 * Id inválido = categoria descartada.
 */
export function normalizeTier(input = {}) {
  const id = String(input?.id || '');
  if (!TIER_ID.test(id)) return null;
  const bruto = input?.points_by_place || {};
  const chaves = Object.keys(bruto).map(Number).filter((k) => Number.isInteger(k) && k >= 1 && k <= TIER_MAX_PLACES && Number.isFinite(Number(bruto[k])) && Number(bruto[k]) >= 0);
  const places = chaves.length ? Math.max(...chaves) : 0;
  const tabela = {};
  let anterior = 0;
  for (let i = 1; i <= places; i += 1) {
    const v = bruto[i];
    anterior = Number.isFinite(Number(v)) && Number(v) >= 0 && v !== '' && v != null ? centavos(Number(v)) : anterior;
    tabela[i] = anterior;
  }
  const req = input?.requirements || {};
  return {
    id,
    code: texto(input?.code, 24),
    group: texto(input?.group, 12),
    name: texto(input?.name, 80),
    points_by_place: tabela,
    places,
    participation: centavos(num(input?.participation, 0)),
    requirements: { min_entrants: Math.floor(num(req.min_entrants, 0)), prize: texto(req.prize, 120), notes: texto(req.notes, 500) },
    // Taxa de chancela desta categoria, em centavos (0 = sem taxa; Bloco 2).
    sanction_fee_cents: Math.min(100000000, Math.max(0, Math.trunc(num(input?.sanction_fee_cents, 0)))),
    active: input?.active !== false,
    legacy: input?.legacy === true,
  };
}

/**
 * As três categorias de antes (etapa regional, estadual e principal) como
 * categorias editáveis: tabela × peso da configuração antiga, com os MESMOS
 * ids (`regional`, `state`, `major`) — os torneios chancelados seguem achando
 * a sua. Sem `tiers` gravado, é isso que vale.
 */
export function legacyTiers(cfg) {
  return Object.keys(DEFAULT_RANKING_CONFIG.tier_multipliers).map((id) => {
    const peso = cfg.tier_multipliers[id] ?? 1;
    const tabela = {};
    for (let i = 1; i <= 8; i += 1) tabela[i] = centavos(cfg.points_by_place[i] * peso);
    return normalizeTier({ id, code: '', group: '', name: SANCTION_TIER_LABELS[id], points_by_place: tabela, participation: centavos(cfg.participation * peso), legacy: true });
  });
}

/** Completa e saneia a configuração gravada em `federations.ranking_config`. */
export function normalizeRankingConfig(input = {}) {
  const base = DEFAULT_RANKING_CONFIG;
  const pontos = {};
  for (let i = 1; i <= 8; i += 1) pontos[i] = num(input?.points_by_place?.[i], base.points_by_place[i]);
  const pesos = {};
  Object.keys(base.tier_multipliers).forEach((k) => { pesos[k] = num(input?.tier_multipliers?.[k], base.tier_multipliers[k]); });
  const cfg = {
    points_by_place: pontos,
    participation: num(input?.participation, base.participation),
    best_n: Math.floor(num(input?.best_n, base.best_n)),
    tier_multipliers: pesos,
    members_only: input?.members_only == null ? base.members_only : Boolean(input.members_only),
  };
  const vistos = new Set();
  const proprias = (Array.isArray(input?.tiers) ? input.tiers : []).filter((tt) => tt && tt.legacy !== true).map(normalizeTier)
    .filter((tt) => tt && !vistos.has(tt.id) && vistos.add(tt.id)).slice(0, TIER_MAX);
  cfg.tiers_explicit = proprias.length > 0;
  cfg.tiers = cfg.tiers_explicit ? proprias : legacyTiers(cfg);
  return cfg;
}

/** A categoria de um id (ou `null`). */
export const tierById = (config, id) => (normalizeRankingConfig(config).tiers.find((tt) => tt.id === id) || null);

/** "FGP 1000 · G1" — o que identifica a categoria num selo (sem sigla, o nome). */
export function tierShortLabel(tier) {
  if (!tier) return '';
  const curto = [tier.code, tier.group].filter(Boolean).join(' · ');
  return curto || t(tier.name || '');
}

/** "FGP 1000 · G1 · Etapa estadual" — a categoria por extenso. */
export function tierLabel(tier) {
  if (!tier) return '';
  return [tier.code, tier.group, tier.name ? t(tier.name) : ''].filter(Boolean).join(' · ');
}

/** As categorias que dá para escolher (ativas), e a atual mesmo que arquivada. */
export function tierOptions(config, atual = null) {
  return normalizeRankingConfig(config).tiers.filter((tt) => tt.active || tt.id === atual);
}

/**
 * A tabela gerada pelos pontos do CAMPEÃO, no padrão dos circuitos (ATP/WTA e
 * as federações que os seguem): campeão 100%, vice 60%, semifinal 36%,
 * quartas 18%, oitavas 9%, 16 avos 4,5% e 32 avos 2,25% — 1000 → 600 → 360 →
 * 360 → 180… A federação ajusta depois. A participação sugerida é 1%.
 */
export function tierTableFromChampion(champion, places = 32) {
  const c = num(champion, 0);
  const n = Math.min(TIER_MAX_PLACES, Math.max(1, Math.floor(num(places, 32))));
  const fator = (p) => (p === 1 ? 1 : p === 2 ? 0.6 : 0.36 / 2 ** Math.max(0, Math.ceil(Math.log2(p)) - 2));
  const tabela = {};
  for (let p = 1; p <= n; p += 1) tabela[p] = Math.round(c * fator(p));
  return { points_by_place: tabela, places: n, participation: Math.round(c * 0.01) };
}

/** Um id novo de categoria a partir da sigla, sem repetir os que já existem. */
export function newTierId(code, existentes = []) {
  const base = String(code || 'categoria').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'categoria';
  const usados = new Set(existentes);
  let id = base;
  for (let i = 2; usados.has(id); i += 1) id = `${base}_${i}`;
  return id;
}

/**
 * Confere as categorias antes de gravar. Erros por categoria (`{ [id]: msg }`)
 * e um geral: ao menos uma ativa, sigla ou nome, campeão com ponto, e a tabela
 * nunca SOBE de uma colocação para a seguinte.
 */
export function validateTiers(tiers = []) {
  const erros = {};
  const lista = (tiers || []).map(normalizeTier).filter(Boolean);
  if (!lista.length) return { ok: false, geral: t('Crie ao menos uma categoria.'), erros };
  if (lista.length > TIER_MAX) return { ok: false, geral: t('No máximo {n} categorias.', { n: TIER_MAX }), erros };
  if (!lista.some((tt) => tt.active)) return { ok: false, geral: t('Deixe ao menos uma categoria ativa.'), erros };
  const codigos = new Map();
  lista.forEach((tt) => {
    if (!tt.code && !tt.name) erros[tt.id] = t('Dê uma sigla ou um nome.');
    else if (!tt.places || !(tt.points_by_place[1] > 0)) erros[tt.id] = t('O campeão precisa de pontos.');
    else {
      for (let i = 2; i <= tt.places; i += 1) {
        if (tt.points_by_place[i] > tt.points_by_place[i - 1]) { erros[tt.id] = t('Os pontos não podem subir: o {p}º está acima do {a}º.', { p: i, a: i - 1 }); break; }
      }
      if (!erros[tt.id] && tt.participation > tt.points_by_place[tt.places]) erros[tt.id] = t('A participação não pode valer mais que a última colocação da tabela.');
    }
    const chave = [tt.code, tt.group].join('|').toLowerCase();
    if (tt.code && codigos.has(chave)) erros[tt.id] = t('Já existe outra categoria com esta sigla e grupo.');
    codigos.set(chave, tt.id);
  });
  return { ok: Object.keys(erros).length === 0, geral: Object.keys(erros).length ? t('Confira as categorias marcadas.') : '', erros };
}

/** A temporada de um torneio é o ANO em que ele termina (ou começa). */
export function resultSeason(tournament = {}) {
  const bruto = tournament.ends_at || tournament.starts_at || '';
  const iso = typeof bruto === 'string' ? bruto : (bruto?.toDate ? bruto.toDate().toISOString() : '');
  const ano = Number(String(iso).slice(0, 4));
  return Number.isFinite(ano) && ano > 2000 ? ano : new Date().getFullYear();
}

/** A data ISO (dia) do torneio para conferir a filiação. */
export function tournamentDay(tournament = {}) {
  const bruto = tournament.ends_at || tournament.starts_at || '';
  const iso = typeof bruto === 'string' ? bruto : (bruto?.toDate ? bruto.toDate().toISOString() : '');
  return String(iso).slice(0, 10);
}

/* ------------------------------------------------------ fechamento do ano -- */

/**
 * O instante em que a temporada FECHA: 1º de fevereiro do ano seguinte, 00:00
 * de Brasília (03:00 UTC). O mês de folga existe para o resultado de um
 * torneio de dezembro chegar; depois disso o ano não muda mais. A REGRA do
 * Firestore (`fedSeasonOpen`) usa a mesma data.
 */
export function seasonClosesAtMs(season) {
  const ano = Number(season);
  return Number.isInteger(ano) ? Date.UTC(ano + 1, 1, 1, 3, 0, 0) : 0;
}

/** O último dia (ISO) em que um resultado da temporada ainda entra ou muda. */
export const seasonLastDay = (season) => `${Number(season) + 1}-01-31`;

/** A temporada já fechou? (fechada = imutável: nada entra, nada sai, nada muda) */
export function seasonClosed(season, nowMs = Date.now()) {
  const fim = seasonClosesAtMs(season);
  return !fim || Number(nowMs) >= fim;
}

/** As temporadas que ainda aceitam mudança agora (a atual e, em janeiro, a anterior). */
export function openSeasons(nowMs = Date.now()) {
  const ano = new Date(Number(nowMs) - 3 * 3600_000).getUTCFullYear();
  return [ano - 1, ano].filter((s) => !seasonClosed(s, nowMs));
}

/**
 * Os anos que o ranking da federação oferece para consulta: do ano em que ela
 * foi criada até o atual (no máximo 15), do mais novo ao mais antigo. Sem data
 * de criação, os três últimos.
 */
export function rankingSeasons(federation = {}, nowMs = Date.now()) {
  const atual = new Date(Number(nowMs) - 3 * 3600_000).getUTCFullYear();
  const criada = instanteEmMs(federation?.created_at);
  const primeiro = criada ? new Date(criada - 3 * 3600_000).getUTCFullYear() : atual - 2;
  const de = Math.max(Math.min(primeiro, atual), atual - 14);
  const anos = [];
  for (let a = atual; a >= de; a -= 1) anos.push(a);
  return anos;
}

/* ------------------------------------------------------------ lançamento -- */

/** Chave da classe: gênero × faixa etária × formato. */
export const rankingCategoryKey = (r = {}) => `${r.gender_category || 'open'}_${r.age_category || 'open'}_${r.format || 'doubles'}`;

/** Era federado em dia naquele dia? (data em branco = vale a filiação de hoje) */
export function memberValidOn(member, dateISO) {
  if (!member || member.tier !== PLAN_TIER.FEDERATED) return false;
  if (['suspended', 'cancelled', 'rejected', 'pending', 'awaiting_payment'].includes(member.status)) return false;
  if (!dateISO) return member.status === 'active';
  if (member.valid_from && String(member.valid_from) > dateISO) return false;
  if (member.valid_until && String(member.valid_until) < dateISO) return false;
  return Boolean(member.valid_until);
}

/** Os pontos da TABELA (antes do peso): 1º…8º pela tabela; fora dos 8, a participação. */
function basePoints({ position, played = 0 }, cfg) {
  if (position != null && position >= 1 && position <= 8) return cfg.points_by_place[position];
  return played > 0 ? cfg.participation : 0;
}

/** Os pontos pela tabela PRÓPRIA da categoria: colocação na tabela; fora dela, a participação. */
function tierTablePoints({ position, played = 0 }, tier) {
  if (position != null && position >= 1 && position <= tier.places) return tier.points_by_place[position];
  return played > 0 ? tier.participation : 0;
}

/**
 * A conta de UMA colocação numa categoria: com categorias próprias gravadas,
 * a tabela da categoria (peso 1); sem elas — ou categoria que não existe
 * mais —, a tabela geral × peso, como sempre foi.
 * @returns {{ base: number, peso: number, tier: object|null }}
 */
function contaDaCategoria(row, tierId, cfg) {
  const tier = cfg.tiers_explicit ? cfg.tiers.find((tt) => tt.id === tierId) || null : null;
  if (tier) return { base: tierTablePoints(row, tier), peso: 1, tier };
  return { base: basePoints(row, cfg), peso: cfg.tier_multipliers[tierId] ?? 1, tier: null };
}

/** Pontos de UMA colocação na categoria do torneio. */
export function pointsFor({ position, played = 0 }, tier, config) {
  const cfg = normalizeRankingConfig(config);
  const { base, peso } = contaDaCategoria({ position, played }, tier, cfg);
  return centavos(base * peso);
}

/**
 * O LANÇAMENTO de um resultado enviado: quem pontua e quanto, com a tabela de
 * hoje. Quem não tem conta, não era federado em dia na data (com
 * `members_only`) ou não somou ponto fica de fora. Uma pessoa = um lançamento
 * por categoria de torneio (se aparecer duas vezes, vale a melhor).
 * @returns {Array<{uid, name, photo_url, position, played, base_points, multiplier, points}>}
 */
export function awardPoints({ result, members = [], config = {} } = {}) {
  if (!result) return [];
  const cfg = normalizeRankingConfig(config);
  const porUid = new Map();
  (members || []).forEach((m) => { if (m?.user_id) porUid.set(m.user_id, m); });
  const melhor = new Map();
  (result.rows || []).forEach((row) => {
    if (!row?.uid) return;
    if (cfg.members_only && !memberValidOn(porUid.get(row.uid), result.date)) return;
    const { base, peso, tier } = contaDaCategoria(row, result.tier, cfg);
    const points = centavos(base * peso);
    if (points <= 0) return;
    const atual = melhor.get(row.uid);
    if (atual && atual.points >= points) return;
    melhor.set(row.uid, {
      uid: row.uid, name: String(row.name || '').slice(0, 120), photo_url: row.photo_url || null,
      position: row.position ?? null, played: Number(row.played) || 0,
      base_points: base, multiplier: peso, points,
      // A categoria do dia fica gravada no lançamento: renomear depois não reescreve o histórico.
      ...(tier ? { tier_code: tier.code, tier_group: tier.group, tier_name: tier.name } : {}),
    });
  });
  return [...melhor.values()];
}

/* ---------------------------------------------------------- soma do ano -- */

function classifica(mapa, bestN) {
  const linhas = [...mapa.values()].map((p) => {
    const ordenados = [...p.results].sort((a, b) => b.points - a.points || String(a.date).localeCompare(String(b.date)) || String(a.entry_id).localeCompare(String(b.entry_id)));
    const contam = p.counting ? p.counting : (bestN > 0 ? ordenados.slice(0, bestN) : ordenados);
    const ids = new Set(contam.map((r) => r.entry_id));
    const total = centavos(contam.reduce((s, r) => s + r.points, 0));
    return { uid: p.uid, name: p.name, photo_url: p.photo_url, points: total, events: ordenados.length, titles: ordenados.filter((r) => r.position === 1).length, results: ordenados.map((r) => ({ ...r, counts: ids.has(r.entry_id) })) };
  }).filter((l) => l.points > 0 || l.events > 0);
  linhas.sort((a, b) => b.points - a.points || b.titles - a.titles || b.events - a.events || String(a.name).localeCompare(String(b.name)));
  let pos = 0;
  linhas.forEach((l, i) => {
    if (i === 0 || l.points !== linhas[i - 1].points) pos = i + 1;
    l.position = pos;
  });
  return linhas;
}

/** Os N melhores lançamentos de CADA classe da pessoa (é o que soma na geral). */
function contamPorClasse(results, bestN) {
  const porClasse = new Map();
  results.forEach((r) => { if (!porClasse.has(r.category)) porClasse.set(r.category, []); porClasse.get(r.category).push(r); });
  return [...porClasse.values()].flatMap((lista) => {
    const ord = [...lista].sort((a, b) => b.points - a.points || String(a.date).localeCompare(String(b.date)) || String(a.entry_id).localeCompare(String(b.entry_id)));
    return bestN > 0 ? ord.slice(0, bestN) : ord;
  });
}

/**
 * A SOMA da temporada a partir dos lançamentos (`federation_points`): só os
 * `awarded` daquele ano entram. Sai a classificação por classe e a geral; cada
 * resultado da pessoa diz se `counts` (está entre os `best_n` melhores).
 * @param {{ entries: object[], config?: object, season: number }} p
 */
/** As regras que o ranking do ano grava (sem as tabelas das categorias, que ficam na federação). */
const regrasDoAno = (cfg) => ({ points_by_place: cfg.points_by_place, participation: cfg.participation, best_n: cfg.best_n, tier_multipliers: cfg.tier_multipliers, members_only: cfg.members_only });

export function aggregateSeason({ entries = [], config = {}, season } = {}) {
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
      const item = { entry_id: e.id || `${e.result_id}_${e.uid}`, result_id: e.result_id || null, points: Number(e.points), position: e.position ?? null, tournament_id: e.tournament_id || null, tournament_name: e.tournament_name || '', modality_name: e.modality_name || '', date: e.date || '', category: key, federation_acronym: e.federation_acronym || '' };
      entra(classes.get(key).pessoas, e, item);
      entra(geral, e, item);
    });
  const categorias = [...classes.values()]
    .map((c) => ({ key: c.key, gender_category: c.gender_category, age_category: c.age_category, format: c.format, rows: classifica(c.pessoas, cfg.best_n) }))
    .filter((c) => c.rows.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
  // Na geral, os melhores N de CADA classe somam (quem joga duas classes soma as duas).
  const geralLinhas = classifica(new Map([...geral].map(([uid, p]) => [uid, { ...p, counting: contamPorClasse(p.results, cfg.best_n) }])), 0);
  return { season: season ?? null, categories: categorias, general: geralLinhas, results_count: resultados.size, entries_count: usados, config: regrasDoAno(cfg) };
}

/**
 * O HISTÓRICO de uma pessoa numa federação, ano a ano: os lançamentos (até os
 * cancelados, com o motivo), quanto soma em cada ano (com a configuração
 * GRAVADA no ranking daquele ano, quando há) e o total de todos os anos.
 * @param {{ entries: object[], uid: string, rankings?: Object<number, object>, config?: object, nowMs?: number }} p
 *  `rankings`: `{ [ano]: documento de federation_rankings }` — dá a posição e a configuração do ano.
 */
export function personPointsHistory({ entries = [], uid, rankings = {}, config = {}, nowMs = Date.now() } = {}) {
  const meus = (entries || []).filter((e) => e && e.uid === uid);
  const anos = [...new Set(meus.map((e) => Number(e.season)).filter(Number.isFinite))].sort((a, b) => b - a);
  const seasons = anos.map((season) => {
    const doAno = meus.filter((e) => Number(e.season) === season);
    const ranking = rankings?.[season] || null;
    const calc = aggregateSeason({ entries: doAno, config: ranking?.config || config, season });
    const minha = calc.general[0] || null;
    const conta = new Map((minha?.results || []).map((r) => [r.entry_id, r.counts]));
    const linhaOficial = ranking ? (ranking.general || []).find((l) => l.uid === uid) : null;
    const lista = [...doAno]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.tournament_name).localeCompare(String(b.tournament_name)))
      .map((e) => ({ ...e, counts: e.status === POINTS_STATUS.AWARDED ? Boolean(conta.get(e.id || `${e.result_id}_${e.uid}`)) : false }));
    return {
      season,
      closed: seasonClosed(season, nowMs),
      points: minha?.points || 0,
      awarded: lista.filter((e) => e.status === POINTS_STATUS.AWARDED).length,
      position: linhaOficial?.position ?? null,
      field: ranking ? (ranking.general || []).length : null,
      entries: lista,
    };
  });
  return { seasons, total: centavos(seasons.reduce((s, x) => s + x.points, 0)) };
}
