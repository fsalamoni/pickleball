/**
 * Próximos jogos agendados do atleta (I/O).
 *
 * Reaproveita inscrições + jogos do torneio: encontra as modalidades do atleta,
 * filtra os jogos AGENDADOS futuros em que ele aparece e resolve o adversário.
 */

import { listMyRegistrations, listRegistrations } from './registrationService.js';
import { listAllMatchesForModality } from './matchService.js';
import { getTournament } from './tournamentService.js';
import { MATCH_STATUS } from '../domain/constants.js';

function toTime(value) {
  if (!value) return NaN;
  const d = typeof value === 'object' && value.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? NaN : d.getTime();
}

function regLabel(reg) {
  if (!reg) return '';
  return reg.label || `${reg.player_a_name || ''}${reg.player_b_name ? ' / ' + reg.player_b_name : ''}`.trim();
}

/**
 * Lista os próximos jogos agendados do atleta (ordenados por horário).
 * @param {string} uid
 * @param {{ limit?: number }} [options]
 */
export async function getMyUpcomingMatches(uid, options = {}) {
  if (!uid) return [];
  const limit = Number.isFinite(options.limit) ? options.limit : 6;
  const now = Date.now();

  const myRegs = await listMyRegistrations(uid);
  if (myRegs.length === 0) return [];
  const myRegIds = new Set(myRegs.map((r) => r.id));
  const modalityIds = [...new Set(myRegs.map((r) => r.modality_id).filter(Boolean))];
  const tournamentIds = [...new Set(myRegs.map((r) => r.tournament_id).filter(Boolean))];

  const tournaments = await Promise.all(tournamentIds.map((id) => getTournament(id).catch(() => null)));
  const tournamentName = new Map(tournaments.filter(Boolean).map((t) => [t.id, t.name]));

  const upcoming = [];
  for (const modalityId of modalityIds) {
    // eslint-disable-next-line no-await-in-loop
    const [matches, regs] = await Promise.all([
      listAllMatchesForModality(modalityId),
      listRegistrations(modalityId),
    ]);
    const labelById = new Map(regs.map((r) => [r.id, regLabel(r)]));
    matches.forEach((m) => {
      if (m.status !== MATCH_STATUS.SCHEDULED) return;
      const when = toTime(m.scheduled_at);
      if (Number.isNaN(when) || when < now) return;
      const aIds = m.side_a_ids || [];
      const bIds = m.side_b_ids || [];
      const inA = aIds.some((id) => myRegIds.has(id));
      const inB = bIds.some((id) => myRegIds.has(id));
      if (inA === inB) return;
      const oppIds = inA ? bIds : aIds;
      upcoming.push({
        matchId: m.id,
        tournamentId: m.tournament_id,
        tournamentName: tournamentName.get(m.tournament_id) || 'Torneio',
        scheduledAt: when,
        court: m.court || null,
        opponent: oppIds.map((id) => labelById.get(id) || id).join(' / ') || 'A definir',
      });
    });
  }

  return upcoming.sort((a, b) => a.scheduledAt - b.scheduledAt).slice(0, limit);
}
