/**
 * MINHA CARREIRA — a POSIÇÃO no ranking da federação (`career_rank/{uid}_{id}`,
 * docs/54 §2.6). PURO.
 *
 *  - DIGITADA: a pessoa anota "Duplas mistas 4.0: 12º em 03/2026" de um
 *    ranking que não está na plataforma (só o dono lê e escreve);
 *  - OFICIAL: para quem pontua numa federação da plataforma, a posição sai do
 *    ranking que o SERVIDOR grava (`federation_rankings/{fed}_{ano}`) — sem
 *    digitar, e nada aqui é gravado.
 *
 * Na linha do tempo vira um gráfico por ranking (`rankSeries`). A posição
 * digitada é declarada: nunca entra em ranking, rating nem XP.
 */
import { t } from '@/core/i18n';
import { isISODate, todayLocal } from '@/modules/training/domain/dates.js';
import { AGE_CATEGORY_LABELS, GENDER_CATEGORY_LABELS, MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants.js';

export const CAREER_RANK = 'career_rank';
export const CAREER_RANK_LIMITS = Object.freeze({ federation: 120, label: 80, position: 100000, points: 10000000, perRanking: 60 });

const txt = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Normaliza a posição digitada. `{ valid, error, value }`. */
export function normalizeCareerRank(raw = {}, { uid = null, today = todayLocal(), nowMs = Date.now() } = {}) {
  const federation_name = txt(raw.federation_name, CAREER_RANK_LIMITS.federation);
  const ranking_label = txt(raw.ranking_label, CAREER_RANK_LIMITS.label);
  if (!federation_name && !ranking_label) return { valid: false, error: t('Diga de que ranking é a posição.'), value: null };
  const date = String(raw.date || '');
  if (!isISODate(date) || date > today) return { valid: false, error: t('Escolha a data da posição (até hoje).'), value: null };
  const position = Math.round(Number(raw.position));
  if (!Number.isFinite(position) || position < 1 || position > CAREER_RANK_LIMITS.position) return { valid: false, error: t('A posição é um número a partir de 1.'), value: null };
  const value = {
    uid: uid || raw.uid || null,
    federation_id: typeof raw.federation_id === 'string' && raw.federation_id ? raw.federation_id.slice(0, 128) : null,
    federation_name,
    ranking_label,
    date,
    position,
    created_at_ms: Number(raw.created_at_ms) || nowMs,
    updated_at_ms: nowMs,
  };
  const pts = Number(raw.points_total);
  if (raw.points_total !== '' && raw.points_total != null && Number.isFinite(pts) && pts >= 0 && pts <= CAREER_RANK_LIMITS.points) value.points_total = Math.round(pts);
  return { valid: true, error: '', value };
}

/** "Geral" ou "Masculina · 40+ · Duplas" — a classe do ranking oficial. */
export function officialClassLabel(c) {
  if (!c) return t('Geral');
  return [GENDER_CATEGORY_LABELS[c.gender_category], AGE_CATEGORY_LABELS[c.age_category], MODALITY_FORMAT_LABELS[c.format]]
    .filter(Boolean).join(' · ') || String(c.key || '');
}

/**
 * As posições OFICIAIS da pessoa: uma por ranking (geral e cada classe) e
 * temporada em que ela aparece. A data é o fim da temporada (fechada) ou hoje
 * (aberta — a posição de agora). `rankings`: `{ federation_id, acronym, season, doc }`.
 */
export function officialRankPoints(rankings, uid, today = todayLocal()) {
  if (!uid) return [];
  const anoAtual = Number(today.slice(0, 4));
  const out = [];
  (rankings || []).forEach(({ federation_id: fid, acronym, season, doc }) => {
    if (!doc || !Number.isFinite(Number(season))) return;
    const date = Number(season) >= anoAtual ? today : `${season}-12-31`;
    const blocos = [{ rows: doc.general || [], label: t('Geral') }, ...(doc.categories || []).map((c) => ({ rows: c.rows || [], label: officialClassLabel(c) }))];
    blocos.forEach(({ rows, label }) => {
      const r = rows.find((x) => x?.uid === uid);
      if (!r || !Number.isFinite(Number(r.position))) return;
      out.push({ id: `of:${fid}:${season}:${label}`, official: true, federation_id: fid, federation_name: acronym || '', ranking_label: label, date, position: Number(r.position), points_total: Number(r.points) || null });
    });
  });
  return out;
}

/** O nome do ranking (a chave do gráfico): "FPP · Duplas mistas 4.0". */
export const rankKeyLabel = (p) => [p.federation_name, p.ranking_label].filter(Boolean).join(' · ');

/**
 * As séries para o gráfico: uma por ranking (digitadas e oficiais NUNCA se
 * misturam na mesma linha), pontos da data mais antiga à mais nova. A mais
 * recentemente atualizada vem primeiro.
 */
export function rankSeries(manual = [], official = []) {
  const series = new Map();
  [...(manual || []).map((p) => ({ ...p, official: false })), ...(official || [])].forEach((p) => {
    if (!p || !isISODate(p.date)) return;
    const label = rankKeyLabel(p);
    const key = `${p.official ? 'of' : 'dig'}:${label.toLowerCase()}`;
    if (!series.has(key)) series.set(key, { key, label, official: Boolean(p.official), points: [] });
    series.get(key).points.push(p);
  });
  return [...series.values()].map((s) => ({
    ...s,
    points: s.points.sort((a, b) => a.date.localeCompare(b.date)).slice(-CAREER_RANK_LIMITS.perRanking),
  })).sort((a, b) => b.points[b.points.length - 1].date.localeCompare(a.points[a.points.length - 1].date));
}

/** "Subiu 4 posições" / "Caiu 2" / "Igual" entre os dois últimos pontos. `null` com um só. */
export function rankTrend(series) {
  const p = series?.points || [];
  if (p.length < 2) return null;
  const delta = p[p.length - 2].position - p[p.length - 1].position;
  return { delta, text: delta > 0 ? t('Subiu {n}', { n: delta }) : delta < 0 ? t('Caiu {n}', { n: -delta }) : t('Igual') };
}
