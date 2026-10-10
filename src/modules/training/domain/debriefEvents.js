/**
 * Os jogos que podem pedir um balanço, a partir do que a plataforma já sabe —
 * dia de jogo, torneio e reserva de quadra. Lógica pura: o serviço busca, aqui
 * se decide o que é "um jogo que a pessoa jogou e já terminou".
 *
 * Cada evento: `{ type, ref_id, title, date, ends_at_ms, games, wins }`.
 * `games`/`wins` nulos = não se sabe (o Play não grava placar, a reserva não
 * tem resultado) — nunca zero inventado.
 */

import { buildParticipantResolver, resolveSlotUid } from '@/modules/clubs/domain/rankingPublishing.js';
import { gameDayEndsAt } from '@/modules/games/domain/playDiscovery.js';
import { diaLocal, instanteLocal } from '@/modules/home/domain/freshness.js';
import { TOURNAMENT_STATUS } from '@/modules/tournament/domain/constants.js';
import { DEBRIEF_SOURCE } from './debrief.js';

/**
 * Dia de jogo: só vira evento se a pessoa entrou em quadra (organizar não é
 * jogar). Vitórias contam só os jogos com placar decidido.
 */
export function gameDayEvent(uid, gd, games = [], participants = []) {
  if (!uid || !gd?.id || !gd.date) return null;
  const resolver = buildParticipantResolver(participants);
  let jogos = 0;
  let decididos = 0;
  let vitorias = 0;
  (games || []).forEach((g) => {
    const a = (g.side_a || []).map((s) => resolveSlotUid(s, resolver));
    const b = (g.side_b || []).map((s) => resolveSlotUid(s, resolver));
    const lado = a.includes(uid) ? 'a' : (b.includes(uid) ? 'b' : null);
    if (!lado) return;
    jogos += 1;
    const sa = Number(g.score_a);
    const sb = Number(g.score_b);
    if (g.score_a == null || g.score_b == null || sa === sb) return;
    decididos += 1;
    if ((lado === 'a') === (sa > sb)) vitorias += 1;
  });
  if (!jogos) return null;
  return {
    type: DEBRIEF_SOURCE.DIA_DE_JOGO,
    ref_id: gd.id,
    title: gd.title || 'Dia de jogo',
    date: gd.date,
    ends_at_ms: gameDayEndsAt(gd),
    games: jogos,
    wins: decididos ? vitorias : null,
  };
}

/**
 * Torneio em que a pessoa jogou: vale a data de fim (ou de início). Encerrado
 * vale na hora; em andamento, só depois do último dia.
 */
export function tournamentEvent(t) {
  if (!t?.id || t.archived === true) return null;
  if ([TOURNAMENT_STATUS.DRAFT, TOURNAMENT_STATUS.CANCELLED].includes(t.status)) return null;
  const inicio = diaLocal(t.starts_at);
  const fim = diaLocal(t.ends_at) || inicio;
  if (!fim) return null;
  return {
    type: DEBRIEF_SOURCE.TORNEIO,
    ref_id: t.id,
    title: t.name || 'Torneio',
    date: fim,
    ends_at_ms: t.status === TOURNAMENT_STATUS.FINISHED ? 0 : instanteLocal(fim, null),
    games: null,
    wins: null,
  };
}

/** Reserva de quadra jogada: um evento por dia reservado (recorrente = vários). */
export function bookingEvents(b) {
  if (!b?.id || !['confirmed', 'completed'].includes(b.status) || b.no_show === true) return [];
  const slots = Array.isArray(b.slots) && b.slots.length ? b.slots : (b.date ? [{ date: b.date, end: b.end }] : []);
  const porDia = new Map();
  slots.forEach((s) => {
    if (!s?.date) return;
    const fim = instanteLocal(s.date, s.end);
    porDia.set(s.date, Math.max(porDia.get(s.date) || 0, Number.isFinite(fim) ? fim : 0));
  });
  return [...porDia.entries()].map(([date, fim]) => ({
    type: DEBRIEF_SOURCE.RESERVA,
    ref_id: `${b.id}_${date}`,
    title: b.arena_name ? `Jogo na ${b.arena_name}` : 'Jogo na arena',
    date,
    ends_at_ms: fim,
    games: null,
    wins: null,
  }));
}
