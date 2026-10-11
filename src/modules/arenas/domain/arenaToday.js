/**
 * "Hoje" da Central da arena — a agenda do dia e as abas favoritas.
 *
 * Puro: recebe as reservas que a aba Reservas já carregou e devolve o que a
 * recepção precisa ver ao abrir a Central: quem joga hoje, em que quadra e a
 * que hora. Fonte que não chegou é `undefined`, nunca zero.
 */
import { BOOKING_STATUS } from './constants.js';
import { bookingSlots } from './booking.js';

const EM_QUADRA = new Set([BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED]);

/**
 * As reservas confirmadas de HOJE, uma linha por horário, em ordem.
 * @param {object[]|undefined} bookings
 * @param {{ hoje: string, courts?: {id:string,name?:string}[] }} ctx
 * @returns {{ id: string, start: string, end: string, courtName: string|null, athleteName: string, checkedIn: boolean }[]|undefined}
 */
export function arenaTodayAgenda(bookings, { hoje, courts = [] } = {}) {
  if (!Array.isArray(bookings)) return undefined;
  const nomeDaQuadra = new Map((courts || []).map((c) => [c.id, c.name || null]));
  const linhas = [];
  for (const b of bookings) {
    if (!b || !EM_QUADRA.has(b.status)) continue;
    for (const s of bookingSlots(b)) {
      if (String(s?.date || '') !== hoje) continue;
      linhas.push({
        id: `${b.id}_${s.start}`,
        start: String(s.start || ''),
        end: String(s.end || ''),
        courtName: b.court_id ? (nomeDaQuadra.get(b.court_id) ?? null) : null,
        athleteName: b.athlete_name || 'Reserva',
        checkedIn: Boolean(b.checked_in_at),
      });
    }
  }
  return linhas.sort((a, b) => a.start.localeCompare(b.start) || String(a.courtName).localeCompare(String(b.courtName)));
}

export const MAX_FAVORITAS = 5;

/** Lê a lista gravada, mantendo só as abas que existem hoje. */
export function parseFavoriteTabs(raw, validas = []) {
  if (!raw) return [];
  try {
    const lista = JSON.parse(raw);
    if (!Array.isArray(lista)) return [];
    const ok = new Set(validas);
    return [...new Set(lista.filter((v) => typeof v === 'string' && ok.has(v)))].slice(0, MAX_FAVORITAS);
  } catch {
    return [];
  }
}

/** Liga/desliga uma favorita; cheia, não acrescenta (devolve a mesma lista). */
export function toggleFavoriteTab(lista = [], value) {
  if (lista.includes(value)) return lista.filter((v) => v !== value);
  if (lista.length >= MAX_FAVORITAS) return lista;
  return [...lista, value];
}
