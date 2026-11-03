/**
 * Controle de linhas na QUADRA de um torneio (docs/53 §9). Um documento por
 * quadra, `tournament_line_courts/{torneio}_{quadra}`, com o liga/desliga e o
 * arranjo; embaixo, as mesmas `line_cams`/`line_calls` do dia de jogo. As
 * quadras são as do agendamento (`court-1`…, o maior `court_count` das
 * modalidades). Puro.
 */

import { buildCourts } from '@/modules/tournament/domain/scheduling';

export const TOURNAMENT_LINE_COL = 'tournament_line_courts';
const COURT_ID = /^court-\d{1,2}$/;

export const isTournamentCourtId = (id) => COURT_ID.test(String(id || ''));
export const tournamentLineDocId = (tid, courtId) => `${tid}_${courtId}`;
/** O "anfitrião" das câmeras e marcações (ver `hostPath` em lineCallSync). */
export const tournamentLineHost = (tid, courtId) => `${TOURNAMENT_LINE_COL}/${tournamentLineDocId(tid, courtId)}`;
/** A página da quadra (ou a lista de quadras, sem `courtId`). */
export const tournamentLinePage = (tid, courtId = null) => `/torneios/${tid}/linhas${courtId ? `?quadra=${encodeURIComponent(courtId)}` : ''}`;

/**
 * As quadras do torneio: o maior número de quadras configurado nas
 * modalidades (no mínimo 1), mais qualquer quadra que já tenha documento.
 * @param {Array<{ court_count?: number }>} modalities
 * @param {Array<{ court_id: string }>} [existing]
 */
export function tournamentCourts(modalities, existing = []) {
  const max = Math.max(1, ...(modalities || []).map((m) => Number(m?.court_count) || 0));
  const courts = buildCourts(max);
  const ids = new Set(courts.map((c) => c.id));
  for (const d of existing || []) {
    if (!isTournamentCourtId(d?.court_id) || ids.has(d.court_id)) continue;
    const n = Number(d.court_id.slice(6));
    courts.push({ id: d.court_id, name: d.court_name || `Quadra ${n}`, index: n });
    ids.add(d.court_id);
  }
  return courts.sort((a, b) => a.index - b.index);
}
