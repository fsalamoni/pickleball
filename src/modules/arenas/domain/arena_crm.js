/**
 * Domínio puro do CRM leve da arena (flag arena_crm).
 *
 * Consolida os clientes a partir das reservas: agrupa por atleta (athlete_id) ou,
 * quando avulso, pelo nome. Conta reservas, soma o valor acordado, marca a última
 * data e conta no-shows. Sem I/O — recebe as reservas já carregadas.
 */

import { bookingSlots } from './booking.js';
import { BOOKING_STATUS } from './constants.js';

const CANCELLED = new Set([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.DECLINED]);

function clientKey(b) {
  if (b.athlete_id) return `id:${b.athlete_id}`;
  const name = String(b.athlete_name || '').trim().toLowerCase();
  return name ? `name:${name}` : null;
}

function lastDate(booking) {
  const slots = bookingSlots(booking) || [];
  return slots.reduce((max, s) => (s.date && s.date > max ? s.date : max), '');
}

/**
 * Agrega as reservas em clientes.
 * @param {Array} bookings
 * @returns {Array<{key, athlete_id, name, bookings, confirmed, cancelled, no_shows, total_value, last_date}>}
 *   ordenado por nº de reservas desc, depois última data desc.
 */
export function buildArenaClients(bookings = []) {
  const map = new Map();
  (bookings || []).forEach((b) => {
    const key = clientKey(b);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key,
        athlete_id: b.athlete_id || null,
        name: b.athlete_name || 'Cliente',
        bookings: 0, confirmed: 0, cancelled: 0, no_shows: 0,
        total_value: 0, last_date: '',
      });
    }
    const row = map.get(key);
    if (b.athlete_name && (row.name === 'Cliente' || !row.name)) row.name = b.athlete_name;
    row.bookings += 1;
    if (b.status === BOOKING_STATUS.CONFIRMED || b.status === BOOKING_STATUS.COMPLETED) row.confirmed += 1;
    if (CANCELLED.has(b.status)) row.cancelled += 1;
    if (b.no_show === true) row.no_shows += 1;
    const price = Number(b.agreed_price);
    if (Number.isFinite(price) && !CANCELLED.has(b.status)) row.total_value += price;
    const d = lastDate(b);
    if (d && d > row.last_date) row.last_date = d;
  });

  return Array.from(map.values()).sort((a, b) => (
    b.bookings - a.bookings
    || (b.last_date > a.last_date ? 1 : b.last_date < a.last_date ? -1 : 0)
  ));
}

/** Resumo agregado para o topo do CRM. */
export function arenaCrmSummary(clients = []) {
  return {
    clients: clients.length,
    bookings: clients.reduce((s, c) => s + c.bookings, 0),
    revenue: clients.reduce((s, c) => s + c.total_value, 0),
    no_shows: clients.reduce((s, c) => s + c.no_shows, 0),
  };
}
