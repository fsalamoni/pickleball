/**
 * Evolução: o que a pessoa TREINOU, contado com honestidade.
 *
 * Mostra volume (minutos), carga (sRPE = minutos × esforço), monotonia da
 * semana (Foster: média ÷ desvio-padrão da carga diária) e a distribuição por
 * habilidade. NUNCA afirma causa ("seu rating subiu porque treinou"): treino e
 * desempenho aparecem lado a lado, e a pessoa tira a conclusão.
 */

import { sessionLoad } from './session.js';
import { weekDates, addDays, todayLocal, daysBetween } from './dates.js';
import { SKILL_AREAS, skillArea } from './taxonomy.js';

export const ASSESSMENT_EVERY_DAYS = 28;
export const MASTERY = Object.freeze({ APRENDENDO: 'aprendendo', CONSISTENTE: 'consistente', DOMINADO: 'dominado' });
export const MASTERY_LABELS = Object.freeze({ aprendendo: 'Aprendendo', consistente: 'Consistente', dominado: 'Dominado' });

/** Série por semana, na ordem das chaves dadas. Semana sem registro = 0 minutos (é fato, não falha). */
export function weeklySeries(sessions = [], weekKeys = []) {
  return weekKeys.map((wk) => {
    const inWeek = sessions.filter((s) => s.week_key === wk);
    const loads = inWeek.map(sessionLoad).filter((x) => x !== null);
    return {
      weekKey: wk,
      count: inWeek.length,
      minutes: inWeek.reduce((a, s) => a + (s.duration_min || 0), 0),
      load: loads.length ? loads.reduce((a, b) => a + b, 0) : null,
    };
  });
}

/**
 * Monotonia da semana. `null` quando não dá para medir (menos de 2 dias com
 * carga, ou carga igual todo dia).
 */
export function weekMonotony(sessions = [], weekKey) {
  const days = weekDates(weekKey).map((d) => sessions
    .filter((s) => s.date === d)
    .map(sessionLoad)
    .filter((x) => x !== null)
    .reduce((a, b) => a + b, 0));
  if (days.filter((x) => x > 0).length < 2) return null;
  const mean = days.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(days.reduce((a, b) => a + (b - mean) ** 2, 0) / 7);
  if (sd === 0) return null;
  return Math.round((mean / sd) * 100) / 100;
}

/** Leitura da monotonia em palavras (≥ 2,0 é treino muito igual dia após dia). */
export function monotonyHint(m) {
  if (m === null || m === undefined) return '';
  if (m >= 2) return 'Sua semana ficou muito parecida dia a dia. Alternar dias leves e puxados ajuda a recuperar.';
  return 'Boa variação entre dias leves e puxados.';
}

/** Minutos por área de habilidade (das sessões e dos itens ligados a elas). */
export function minutesByArea(sessions = [], itemsById = {}) {
  const out = Object.fromEntries(SKILL_AREAS.map((a) => [a, 0]));
  for (const s of sessions) {
    const skills = new Set(s.skills || []);
    for (const id of s.item_ids || []) for (const sk of itemsById[id]?.skills || []) skills.add(sk);
    const areas = [...new Set([...skills].map(skillArea))].filter((a) => a in out);
    if (!areas.length) continue;
    const share = (s.duration_min || 0) / areas.length;
    for (const a of areas) out[a] += share;
  }
  for (const a of Object.keys(out)) out[a] = Math.round(out[a]);
  return out;
}

/** Autoavaliação: devida a cada 4 semanas. */
export function assessmentDue(assessments = [], today = todayLocal()) {
  const last = [...assessments].map((a) => a.date).filter(Boolean).sort().pop();
  if (!last) return { due: true, last: null, next: today };
  const next = addDays(last, ASSESSMENT_EVERY_DAYS);
  return { due: daysBetween(today, next) <= 0, last, next };
}

/** Notas 1–5 por área; área sem nota fica de fora. */
export function normalizeAssessment(scores = {}, date = todayLocal()) {
  const out = {};
  for (const a of SKILL_AREAS) {
    const n = Math.round(Number(scores[a]));
    if (Number.isFinite(n) && n >= 1 && n <= 5) out[a] = n;
  }
  return { date, scores: out };
}

/** Diferença entre as duas últimas autoavaliações, por área. */
export function assessmentDelta(assessments = []) {
  const sorted = [...assessments].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (sorted.length < 2) return {};
  const [prev, last] = sorted.slice(-2);
  const out = {};
  for (const a of SKILL_AREAS) {
    if (Number.isFinite(prev.scores?.[a]) && Number.isFinite(last.scores?.[a])) out[a] = last.scores[a] - prev.scores[a];
  }
  return out;
}

export function masteryCounts(mastery = {}) {
  const out = { aprendendo: 0, consistente: 0, dominado: 0 };
  for (const v of Object.values(mastery || {})) if (v in out) out[v] += 1;
  return out;
}
