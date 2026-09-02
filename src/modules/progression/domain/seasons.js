/**
 * Temporadas (lógica pura, sem I/O).
 *
 * Estrutura de tempo:
 *  - **Estações** (3 meses): Verão, Outono, Inverno, Primavera.
 *  - **Temporadas ranqueadas** (1 mês): começa todo dia 1º do mês.
 *  - **Hall da Fama**: top 3 por estado, top 3 geral, página pública.
 *
 * Aditivo. Sem I/O. Sem breaking change.
 */

import { tierFromXp } from './tiers.js';

const str = (v) => String(v ?? '').trim();

/**
 * Janela de estação (hemisfério sul).
 *  - Verão:  jan-mar
 *  - Outono:  abr-jun
 *  - Inverno: jul-set
 *  - Primavera: out-dez
 */
export const SEASON = Object.freeze({
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
  SPRING: 'spring',
});

export const SEASON_MONTHS = Object.freeze({
  [SEASON.SUMMER]:  [0, 1, 2],   // jan, fev, mar
  [SEASON.AUTUMN]:  [3, 4, 5],
  [SEASON.WINTER]:  [6, 7, 8],
  [SEASON.SPRING]:  [9, 10, 11],
});

/**
 * Calcula estação + ano de uma data.
 *
 * @param {Date} [date]
 * @returns {{ season: string, year: number, label: string }}
 */
export function getSeason(date = new Date()) {
  const m = date.getMonth();
  const y = date.getFullYear();
  const season = m <= 2 ? SEASON.SUMMER
    : m <= 5 ? SEASON.AUTUMN
    : m <= 8 ? SEASON.WINTER
    : SEASON.SPRING;
  return {
    season,
    year: y,
    label: `${season}-${y}`,
  };
}

/**
 * Range de uma estação (1º dia ao último dia, 3 meses).
 */
export function seasonRange(season, year) {
  const months = SEASON_MONTHS[season] || [];
  if (months.length === 0) return { startMs: 0, endMs: 0 };
  const start = new Date(year, months[0], 1, 0, 0, 0, 0);
  const end = new Date(year, months[months.length - 1] + 1, 1, 0, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

/**
 * Janela da temporada mensal (1º ao 1º do próximo).
 */
export function monthlySeasonRange(year, month) {
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 1, 0, 0, 0, 0);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

/**
 * Dias restantes na temporada mensal.
 */
export function daysRemainingInMonth(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  const ms = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/**
 * Calcula XP sazonal e tier do user.
 */
export function computeSeasonXp(user) {
  const xp = Number(user?.xp_total) || 0;
  return {
    xp,
    tier: tierFromXp(xp),
    position: Number(user?.position) || null,
  };
}

/**
 * Top N de uma lista de users sazonais.
 *
 * @param {Array<{ uid, xp_total, position? }>} users
 * @param {number} n
 * @returns {Array<{ uid, xp_total, position }>}
 */
export function topN(users, n = 10) {
  return (users || [])
    .filter((u) => u && (Number(u.xp_total) || 0) > 0)
    .sort((a, b) => (Number(b.xp_total) || 0) - (Number(a.xp_total) || 0))
    .slice(0, n)
    .map((u, i) => ({
      ...u,
      position: i + 1,
    }));
}

/**
 * Top 3 por estado + top 3 geral = Hall da Fama.
 *
 * @param {Array<{ uid, xp_total, state, display_name, photo_url }>} users
 * @returns {{ geral: Array, porEstado: Record<string, Array> }}
 */
export function buildHallOfFame(users = [], nPorEstado = 3, nGeral = 3) {
  const list = users || [];
  const geral = topN(list, nGeral);
  const porEstado = {};
  for (const u of list) {
    const st = str(u.state).toUpperCase();
    if (!st) continue;
    if (!porEstado[st]) porEstado[st] = [];
    porEstado[st].push(u);
  }
  for (const st of Object.keys(porEstado)) {
    porEstado[st] = topN(porEstado[st], nPorEstado);
  }
  return { geral, porEstado };
}

/**
 * Prêmios do top N da temporada mensal.
 */
export const MONTHLY_SEASON_PRIZES = Object.freeze({
  TOP_1: { label: 'Top 1% da temporada', xp: 1000, shareable: true },
  TOP_10: { label: 'Top 10% da temporada', xp: 500, shareable: true },
  PARTICIPATION: { label: 'Participou da temporada', xp: 50, shareable: false },
});
