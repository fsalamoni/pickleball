/**
 * Domínio puro do "telão" (modo TV) do torneio — flag tournament_tv_mode.
 *
 * Recebe os jogos já normalizados (com status, horário e rótulos dos lados) e os
 * separa em três faixas para exibição no telão: em andamento, próximos e
 * resultados recentes. Sem I/O — a coleta dos dados é feita na camada de página.
 */

import { MATCH_STATUS } from './constants.js';

function toTime(value) {
  if (!value) return NaN;
  const d = typeof value === 'object' && value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? NaN : d.getTime();
}

const FINISHED = [MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER];

/**
 * Separa os jogos para o telão.
 * @param {Array} matches jogos com { status, scheduled_at, result_recorded_at, updated_at, ... }
 * @param {{ upcomingLimit?: number, recentLimit?: number }} [opts]
 * @returns {{ inProgress: Array, upcoming: Array, recent: Array }}
 */
export function categorizeBoardMatches(matches = [], opts = {}) {
  const upcomingLimit = Number.isFinite(opts.upcomingLimit) ? opts.upcomingLimit : 8;
  const recentLimit = Number.isFinite(opts.recentLimit) ? opts.recentLimit : 8;
  const list = Array.isArray(matches) ? matches : [];

  const inProgress = list
    .filter((m) => m.status === MATCH_STATUS.IN_PROGRESS)
    .sort((a, b) => (Number(a.court) || 999) - (Number(b.court) || 999));

  const upcoming = list
    .filter((m) => m.status === MATCH_STATUS.SCHEDULED)
    .sort((a, b) => {
      const ta = toTime(a.scheduled_at);
      const tb = toTime(b.scheduled_at);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb;
    })
    .slice(0, upcomingLimit);

  const recent = list
    .filter((m) => FINISHED.includes(m.status))
    .sort((a, b) => {
      const ta = toTime(a.result_recorded_at) || toTime(a.updated_at) || 0;
      const tb = toTime(b.result_recorded_at) || toTime(b.updated_at) || 0;
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    })
    .slice(0, recentLimit);

  return { inProgress, upcoming, recent };
}
