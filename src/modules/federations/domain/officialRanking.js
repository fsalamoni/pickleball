/**
 * RANKING OFICIAL da federação (módulo `ranking`). Lógica pura.
 *
 * Entra o que o organizador ENVIOU de cada categoria de torneio chancelado
 * (`federation_results`, colocação final por `modalityPlacement`); sai a
 * classificação da temporada por classe (gênero × faixa etária × formato) e a
 * geral. Quem GRAVA é o servidor (`functions/federationRanking.js`), com a
 * MESMA conta — `functions/federationRanking.parity.test.js` trava a cópia.
 *
 * Regras (D12): só pontua quem era federado EM DIA na data do torneio
 * (`members_only`); pontos por colocação × peso do torneio; os `best_n`
 * melhores resultados da classe somam; a geral soma as classes.
 */
import { DEFAULT_RANKING_CONFIG, PLAN_TIER, RESULT_STATUS } from './constants.js';

const num = (v, padrao) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : padrao);

/** Completa e saneia a configuração gravada em `federations.ranking_config`. */
export function normalizeRankingConfig(input = {}) {
  const base = DEFAULT_RANKING_CONFIG;
  const pontos = {};
  for (let i = 1; i <= 8; i += 1) pontos[i] = num(input?.points_by_place?.[i], base.points_by_place[i]);
  const pesos = {};
  Object.keys(base.tier_multipliers).forEach((k) => { pesos[k] = num(input?.tier_multipliers?.[k], base.tier_multipliers[k]); });
  return {
    points_by_place: pontos,
    participation: num(input?.participation, base.participation),
    best_n: Math.floor(num(input?.best_n, base.best_n)),
    tier_multipliers: pesos,
    members_only: input?.members_only == null ? base.members_only : Boolean(input.members_only),
  };
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

/** Pontos de UMA colocação: tabela × peso do torneio; fora dos 8, a participação. */
export function pointsFor({ position, played = 0 }, tier, config) {
  const cfg = normalizeRankingConfig(config);
  const base = position != null && position >= 1 && position <= 8 ? cfg.points_by_place[position] : (played > 0 ? cfg.participation : 0);
  const peso = cfg.tier_multipliers[tier] ?? 1;
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

/**
 * @param {{ results: object[], members?: object[], config?: object, season: number }} p
 *  `results`: documentos `federation_results` (só `status: 'sent'` da temporada contam);
 *  `members`: `federation_members` da federação (para `members_only`).
 */
export function computeOfficialRanking({ results = [], members = [], config = {}, season } = {}) {
  const cfg = normalizeRankingConfig(config);
  const porUid = new Map();
  (members || []).forEach((m) => { if (m?.user_id) porUid.set(m.user_id, m); });
  const classes = new Map();
  const geral = new Map();
  const entra = (mapa, row, pontos, r) => {
    if (!mapa.has(row.uid)) mapa.set(row.uid, { uid: row.uid, name: row.name || '', photo_url: row.photo_url || null, results: [] });
    const p = mapa.get(row.uid);
    if (row.name) p.name = row.name;
    if (row.photo_url) p.photo_url = row.photo_url;
    p.results.push({ points: pontos, position: row.position ?? null, tournament_id: r.tournament_id, tournament_name: r.tournament_name || '', modality_name: r.modality_name || '', date: r.date || '', category: rankingCategoryKey(r) });
  };
  let usados = 0;
  (results || [])
    .filter((r) => r && r.status === RESULT_STATUS.SENT && (season == null || Number(r.season) === Number(season)))
    .forEach((r) => {
      usados += 1;
      const key = rankingCategoryKey(r);
      if (!classes.has(key)) classes.set(key, { key, gender_category: r.gender_category || 'open', age_category: r.age_category || 'open', format: r.format || 'doubles', pessoas: new Map() });
      const classe = classes.get(key);
      (r.rows || []).forEach((row) => {
        if (!row?.uid) return;
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
  // Na geral, os melhores N de CADA classe somam (quem joga duas classes soma as duas).
  const geralLinhas = classifica(new Map([...geral].map(([uid, p]) => {
    const porClasse = new Map();
    p.results.forEach((r) => { if (!porClasse.has(r.category)) porClasse.set(r.category, []); porClasse.get(r.category).push(r); });
    const contam = [...porClasse.values()].flatMap((lista) => {
      const ord = [...lista].sort((a, b) => b.points - a.points);
      return cfg.best_n > 0 ? ord.slice(0, cfg.best_n) : ord;
    });
    return [uid, { ...p, counting: contam }];
  })), 0);
  return { season: season ?? null, categories: categorias, general: geralLinhas, results_count: usados, config: cfg };
}
