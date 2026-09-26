/**
 * Jogar e reservar, na tela inicial (lógica pura).
 *
 * - `openGamesForMe`: os convites abertos ("procura-se jogo") que ainda valem,
 *   perto de mim primeiro, sem os que eu mesmo publiquei.
 * - `pickHomeArena`: a "minha arena" — onde a pessoa costuma jogar — para
 *   mostrar os horários livres dela sem a pessoa precisar achá-la de novo.
 * - `upcomingFreeTimes`: os próximos horários livres (hoje, só os que ainda não
 *   passaram), a partir de `freeTimesOfDay` do calendário da arena.
 */
import { partitionOpenGamesByDate } from '../../games/domain/openGames.js';
import { bookingSlots } from '../../arenas/domain/booking.js';
import { mergeArenaBlocks } from '../../arenas/domain/arenaBlocks.js';
import { freeTimesOfDay } from '../../arenas/domain/calendar_aggregate.js';
import { BOOKING_STATUS } from '../../arenas/domain/constants.js';
import { proximidade } from './homeTournaments.js';
import { instanteLocal } from './freshness.js';

/**
 * Convites abertos que ainda valem, perto de mim primeiro.
 * @param {Array<object>} games `useOpenGames`
 * @param {{ hoje: string, perfil?: object, uid?: string, limite?: number }} ctx
 */
export function openGamesForMe(games = [], { hoje, perfil = {}, uid = null, limite = 4 } = {}) {
  const { upcoming } = partitionOpenGamesByDate(games || [], hoje);
  return upcoming
    .filter((g) => g?.id && g.created_by !== uid)
    .map((g, i) => ({ g, perto: proximidade(g, perfil), i }))
    // Estável: dentro da mesma proximidade, a ordem por data do domínio.
    .sort((a, b) => b.perto - a.perto || a.i - b.i)
    .slice(0, limite)
    .map(({ g, perto }) => ({ game: g, perto }));
}

/**
 * A arena da pessoa: a da reserva mais recente (confirmada ou concluída); sem
 * reserva, a primeira favorita. `null` quando não há nenhuma — e aí a seção
 * convida a procurar uma, em vez de adivinhar.
 *
 * @param {{ reservas?: Array<object>, favoritas?: Array<object> }} input
 * @returns {{ id: string, name: string|null, motivo: 'reserva'|'favorita' } | null}
 */
export function pickHomeArena({ reservas = [], favoritas = [] } = {}) {
  let melhor = null;
  (reservas || []).forEach((b) => {
    if (!b?.arena_id) return;
    if (b.status !== BOOKING_STATUS.CONFIRMED && b.status !== BOOKING_STATUS.COMPLETED) return;
    const ultimo = bookingSlots(b).map((s) => String(s?.date || '')).sort().pop() || '';
    if (!melhor || ultimo > melhor.dia) melhor = { id: b.arena_id, name: b.arena_name || 'Arena', dia: ultimo };
  });
  if (melhor) return { id: melhor.id, name: melhor.name, motivo: 'reserva' };
  // `listMyFavoriteArenas` devolve só os IDS; aceita também o documento.
  const fav = (favoritas || []).find((a) => (typeof a === 'string' ? a : (a?.arena_id || a?.id)));
  if (typeof fav === 'string') return { id: fav, name: null, motivo: 'favorita' };
  if (fav) return { id: fav.arena_id || fav.id, name: fav.arena_name || fav.name || null, motivo: 'favorita' };
  return null;
}

/**
 * Os próximos horários livres: hoje (só os que ainda não começaram) e os dias
 * seguintes, na ordem, até o limite.
 *
 * @param {Array<{ date: string, times: Array<{ time: string, freeCourts: number }> }>} dias
 * @param {{ agora?: number, limite?: number }} [ctx]
 * @returns {Array<{ date: string, time: string, freeCourts: number }>}
 */
export function upcomingFreeTimes(dias = [], { agora = Date.now(), limite = 6 } = {}) {
  const saida = [];
  (dias || []).forEach(({ date, times }) => {
    (times || []).forEach((t) => {
      if (instanteLocal(date, t.time) <= agora) return;
      saida.push({ date, time: t.time, freeCourts: t.freeCourts });
    });
  });
  return saida
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, limite);
}

const RESERVA_ATIVA = new Set([BOOKING_STATUS.REQUESTED, BOOKING_STATUS.NEGOTIATING, BOOKING_STATUS.CONFIRMED]);

/**
 * Os horários livres de uma arena em alguns dias, com a MESMA conta do
 * calendário da arena (`V2BookingCalendar`): reservas ativas + bloqueios
 * gravados + o que os dias de jogo, jogos abertos, aulas e torneios da casa
 * ocupam (`mergeArenaBlocks`), quadra a quadra (`freeTimesOfDay`).
 *
 * Um horário que o calendário mostra ocupado nunca aparece aqui como livre.
 *
 * @returns {Array<{ date: string, times: Array<{ time: string, freeCourts: number }> }>}
 */
export function arenaFreeTimesForDays(datas = [], {
  courts = [], schedules = [], bookings = [], unavailabilities = [],
  diasDeJogo = [], vagasAbertas = [], aulas = [], torneios = [],
} = {}) {
  const ativas = (courts || []).filter((c) => c && c.is_active !== false);
  const reservas = (bookings || []).filter((b) => RESERVA_ATIVA.has(b?.status));
  const bloqueios = mergeArenaBlocks({ gravados: unavailabilities, diasDeJogo, vagasAbertas, aulas, torneios });
  return (datas || []).map((date) => ({
    date,
    times: freeTimesOfDay({
      date,
      courts: ativas,
      schedules,
      bookings: reservas.filter((b) => bookingSlots(b).some((sl) => sl?.date === date)),
      unavailabilities: bloqueios.filter((u) => u?.date === date),
    }),
  }));
}
