/**
 * Os jogos recentes da pessoa, para o balanço do jogo: dias de jogo, torneios
 * e reservas de quadra. Cada fonte falha SOZINHA e o que não veio é dito
 * (`incompleto`) — sem ele a tela diria "nenhum jogo para fazer o balanço"
 * para quem jogou ontem.
 *
 * Os serviços dos outros módulos chegam por import dinâmico: o Centro de
 * Treino não carrega dia de jogo, torneio e arena só por existir.
 */

import { instanteEmMs } from '@/core/domain/instant.js';
import { isActiveRegistration } from '@/modules/tournament/domain/checkin.js';
import { addDays, todayLocal } from '../domain/dates.js';
import { DEBRIEF_LIMITS } from '../domain/debrief.js';
import { bookingEvents, gameDayEvent, tournamentEvent } from '../domain/debriefEvents.js';

/** Inscrição antiga não vira busca de torneio: um torneio dura dias, não meses. */
const INSCRICAO_RECENTE_DIAS = 120;
const MAX_TORNEIOS = 15;

async function diasDeJogo(uid, inicio, hoje) {
  const svc = await import('@/modules/games/services/gameDayService');
  const dias = (await svc.listMyGameDays(uid)).filter((gd) => gd.date && gd.date >= inicio && gd.date <= hoje);
  const lidos = await Promise.all(dias.map(async (gd) => {
    const [games, parts] = await Promise.all([svc.listGameDayGames(gd.id), svc.listGameDayParticipants(gd.id)]);
    return gameDayEvent(uid, gd, games, parts);
  }));
  return lidos.filter(Boolean);
}

async function torneios(uid, inicio, hoje, agoraMs) {
  const [{ listMyRegistrations }, { getTournament }] = await Promise.all([
    import('@/modules/tournament/services/registrationService'),
    import('@/modules/tournament/services/tournamentService'),
  ]);
  const corte = agoraMs - INSCRICAO_RECENTE_DIAS * 86_400_000;
  const ids = [...new Set((await listMyRegistrations(uid))
    .filter((r) => isActiveRegistration(r) && r.tournament_id)
    .filter((r) => {
      const quando = instanteEmMs(r.created_at);
      return !Number.isFinite(quando) || quando >= corte;
    })
    .map((r) => r.tournament_id))].slice(0, MAX_TORNEIOS);
  // Um torneio que não deu para ler (privado, removido) não derruba os outros.
  const lidos = await Promise.allSettled(ids.map((id) => getTournament(id)));
  return lidos
    .map((x, i) => (x.status === 'fulfilled' && x.value ? tournamentEvent({ ...x.value, id: ids[i] }) : null))
    .filter((e) => e && e.date >= inicio && e.date <= hoje);
}

async function reservas(uid, inicio, hoje) {
  const { listMyBookings } = await import('@/modules/arenas/services/bookingService');
  return (await listMyBookings(uid)).flatMap(bookingEvents).filter((e) => e.date >= inicio && e.date <= hoje);
}

/**
 * @returns {Promise<{ events: object[], incompleto: string[] }>}
 */
export async function listRecentPlay(uid, { today = todayLocal(), nowMs = Date.now() } = {}) {
  if (!uid) return { events: [], incompleto: [] };
  const inicio = addDays(today, -DEBRIEF_LIMITS.windowDays);
  const fontes = [
    ['Dias de jogo', () => diasDeJogo(uid, inicio, today)],
    ['Torneios', () => torneios(uid, inicio, today, nowMs)],
    ['Reservas de quadra', () => reservas(uid, inicio, today)],
  ];
  const r = await Promise.allSettled(fontes.map(([, ler]) => ler()));
  const events = [];
  const incompleto = [];
  r.forEach((x, i) => {
    if (x.status === 'fulfilled') events.push(...x.value);
    else incompleto.push(fontes[i][0]);
  });
  // Tudo falhou: é falha, não "nenhum jogo".
  if (incompleto.length === fontes.length) throw new Error('Não foi possível ler os seus jogos recentes.');
  return { events, incompleto };
}
