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

/* ------------------------------------------------ clientes × membros ----- */

/**
 * Quantas reservas CONFIRMADAS fazem de alguém um cliente frequente — o
 * candidato natural a membro. Três é o ponto em que "veio uma vez" vira
 * "volta": abaixo disso, oferecer o programa de membros é empurrar.
 */
export const FREQUENT_CLIENT_MIN = 3;

/**
 * Junta os clientes (derivados das reservas) com os membros da arena.
 *
 * Antes eram dois mundos: a aba Clientes sai das reservas e `arena_members` é
 * outro cadastro — nenhum mostrava o outro. A chave é o uid
 * (`arena_bookings.athlete_id` = `arena_members.user_id`). Cliente avulso
 * (sem conta) nunca é membro nem candidato: não há a quem dar o benefício.
 *
 * @param {Array} clients   saída de `buildArenaClients`
 * @param {Array} members   documentos de `arena_members`
 * @returns {Array} os clientes com `member` (ou null) e `memberCandidate`
 */
export function attachMembership(clients = [], members = []) {
  const porUid = new Map((members || []).filter((m) => m?.user_id).map((m) => [m.user_id, m]));
  return (clients || []).map((c) => {
    const member = c.athlete_id ? porUid.get(c.athlete_id) || null : null;
    return {
      ...c,
      member,
      memberCandidate: Boolean(c.athlete_id) && !member && c.confirmed >= FREQUENT_CLIENT_MIN,
    };
  });
}

/** Quantos são membros e quantos são candidatos — o resumo do topo. */
export function membershipSummary(clientsWithMembership = []) {
  return {
    members: clientsWithMembership.filter((c) => c.member).length,
    candidates: clientsWithMembership.filter((c) => c.memberCandidate).length,
  };
}
