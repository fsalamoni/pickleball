/**
 * Agregação de status por dia (Sprint 5+ / sw-v73.5).
 *
 * Dado uma data + arena (schedules + bookings + unavailabilities), retorna
 * o status agregado do dia para exibição no calendário público MENSAL.
 *
 * Regras (PRD):
 * - Dia "fechado" cinza: arena sem schedule aberto naquele dia da semana
 *   (admin não definiu horário aberto) OU todos os slots são CLOSED.
 *   NÃO clicável.
 * - Dia "disponível" verde: tem pelo menos 1 slot AVAILABLE.
 * - Dia "ocupado" amber/vermelho: tem slots mas todos PENDING/CONFIRMED.
 *   Clicável para ver detalhe (sem seleção).
 * - Dia "indisponível" laranja: admin marcou indisponibilidade no dia todo.
 *
 * Implementação: gera todos os time slots de 1h do dia (filtrando por
 * weekday + court_id), calcula status de cada um via getSlotStatus,
 * e retorna o status mais "livre" (available > pending > confirmed >
 * unavailable > closed).
 *
 * ## A conta por QUADRA (`courts`)
 *
 * Sem `courts`, a arena inteira é contada como se fosse UMA quadra: basta
 * uma reserva às 19h numa quadra qualquer para as 19h inteiras contarem como
 * ocupadas. Numa arena com três quadras isso é **informação errada** — duas
 * seguem livres, e o mês aparecia mais cheio do que está.
 *
 * Informando `courts`, a conta passa a ser em HORAS-QUADRA: cada par
 * (quadra, horário) conta uma vez. `count` soma os pares, `freeTimes` diz em
 * quantos HORÁRIOS ainda há pelo menos uma quadra livre (é o que interessa a
 * quem procura horário) e `occupancy` é a fração ocupada do dia.
 *
 * Omitido `courts`, nada muda: o retorno é bit a bit o de antes, mais os
 * campos novos derivados dele.
 */

import { getSlotStatus, SLOT_STATUS } from './slot_status.js';
import { generateTimeSlots } from './slot_status.js';
import { weekdayOf } from './booking.js';

const STEP = 60; // min — 1 hora

function getDaySchedules(schedules, weekday) {
  return schedules.filter(
    (s) => s.is_active !== false && Array.isArray(s.weekdays) && s.weekdays.includes(weekday),
  );
}

function filterByCourt(schedules, courtId) {
  if (!courtId) return schedules;
  return schedules.filter((s) => !s.court_id || s.court_id === courtId);
}

function generateDayTimes(schedules) {
  const ranges = schedules.map((s) => ({ start: s.start_time, end: s.end_time }));
  const allTimes = new Set();
  for (const r of ranges) {
    generateTimeSlots(r.start, r.end, STEP).forEach((t) => allTimes.add(t));
  }
  return Array.from(allTimes).sort();
}

/** O retorno de um dia sem NENHUM horário aberto. */
function diaFechado() {
  return {
    dayStatus: SLOT_STATUS.CLOSED,
    hasAvailable: false,
    isAllClosed: true,
    count: 0,
    total: 0,
    occupancy: 0,
    freeTimes: 0,
    openTimes: 0,
  };
}

/**
 * Status de cada horário de UMA visão (uma quadra, ou a arena toda).
 * @returns {Map<string,string>|null} horário → status; `null` se fechado.
 */
function statusPorHorario({ date, courtId, schedules, bookings, unavailabilities }) {
  const weekday = weekdayOf(date);
  if (weekday == null) return null;

  const daySchedules = filterByCourt(getDaySchedules(schedules, weekday), courtId);
  if (daySchedules.length === 0) return null;

  const times = generateDayTimes(daySchedules);
  if (times.length === 0) return null;

  const bookingsDaQuadra = courtId
    ? bookings.filter((b) => !b.court_id || b.court_id === courtId)
    : bookings;
  const bloqueiosDaQuadra = courtId
    ? unavailabilities.filter((u) => !u.court_id || u.court_id === courtId)
    : unavailabilities;

  const mapa = new Map();
  for (const time of times) {
    const { status } = getSlotStatus({
      date, time, courtId,
      schedules: daySchedules,
      bookings: bookingsDaQuadra,
      unavailabilities: bloqueiosDaQuadra,
    });
    mapa.set(time, status);
  }
  return mapa;
}

/** Extrai os ids de uma lista que pode vir de objetos `{ id }` ou de strings. */
function idsDasQuadras(courts) {
  if (!Array.isArray(courts)) return [];
  return courts
    .map((c) => (typeof c === 'string' ? c : c?.id))
    .filter(Boolean);
}

/**
 * @param {Object} args
 * @param {string} args.date 'YYYY-MM-DD'
 * @param {string} [args.courtId] uma quadra só (filtro do calendário)
 * @param {Array} [args.courts] quadras ATIVAS da arena — liga a conta em
 *   horas-quadra. Ignorado quando `courtId` é informado (aí já é uma quadra).
 * @param {Array} [args.schedules] janelas de funcionamento
 * @param {Array} [args.bookings] reservas ativas (pode vir já filtrada pelo dia)
 * @param {Array} [args.unavailabilities] bloqueios do admin
 */
function aggregateDayStatus({
  date,
  courtId = null,
  courts = null,
  schedules = [],
  bookings = [],
  unavailabilities = [],
} = {}) {
  const weekday = weekdayOf(date);
  if (weekday == null) return diaFechado();

  const ids = courtId ? [] : idsDasQuadras(courts);
  const visoes = ids.length > 0 ? ids : [courtId || null];

  const mapas = visoes
    .map((id) => statusPorHorario({ date, courtId: id, schedules, bookings, unavailabilities }))
    .filter(Boolean);

  if (mapas.length === 0) return diaFechado();

  let available = 0, unavailable = 0, pending = 0, confirmed = 0;
  const horariosComVaga = new Set();
  const horariosAbertos = new Set();

  for (const mapa of mapas) {
    for (const [time, status] of mapa) {
      horariosAbertos.add(time);
      if (status === SLOT_STATUS.AVAILABLE) {
        available += 1;
        horariosComVaga.add(time);
      } else if (status === SLOT_STATUS.UNAVAILABLE) unavailable += 1;
      else if (status === SLOT_STATUS.PENDING) pending += 1;
      else if (status === SLOT_STATUS.CONFIRMED) confirmed += 1;
    }
  }

  let dayStatus;
  if (available > 0) dayStatus = SLOT_STATUS.AVAILABLE;
  else if (pending > 0) dayStatus = SLOT_STATUS.PENDING;
  else if (confirmed > 0) dayStatus = SLOT_STATUS.CONFIRMED;
  else if (unavailable > 0) dayStatus = SLOT_STATUS.UNAVAILABLE;
  else dayStatus = SLOT_STATUS.CLOSED;

  const total = available + unavailable + pending + confirmed;

  return {
    dayStatus,
    hasAvailable: available > 0,
    isAllClosed: total === 0,
    count: { available, unavailable, pending, confirmed },
    /** Horas-quadra abertas no dia (o denominador da ocupação). */
    total,
    /** Fração ocupada (reservada, pendente ou bloqueada), de 0 a 1. */
    occupancy: total > 0 ? (total - available) / total : 0,
    /** Horários com PELO MENOS uma quadra livre — o que a pessoa procura. */
    freeTimes: horariosComVaga.size,
    /** Horários abertos no dia, livres ou não. */
    openTimes: horariosAbertos.size,
  };
}

/** Soma um número de dias a uma data 'YYYY-MM-DD' sem escorregar de fuso. */
function addDays(dateISO, dias) {
  const [y, m, d] = String(dateISO).split('-').map(Number);
  if (!y || !m || !d) return null;
  const base = new Date(y, m - 1, d, 12, 0, 0);
  base.setDate(base.getDate() + dias);
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${base.getFullYear()}-${mm}-${dd}`;
}

/**
 * Indexa as reservas por DATA.
 *
 * O calendário mensal faz 42 dias × quadras consultas de status, e cada uma
 * varria a lista inteira de reservas da arena. Com o índice, cada dia só olha
 * o que é dele. O filtro por data dentro de `getSlotStatus` é o mesmo, então o
 * resultado não muda — só o custo.
 */
function indexBookingsByDate(bookings = []) {
  const mapa = new Map();
  for (const b of bookings) {
    const slots = Array.isArray(b?.slots) ? b.slots : [];
    const datas = new Set(slots.map((s) => s?.date).filter(Boolean));
    for (const data of datas) {
      if (!mapa.has(data)) mapa.set(data, []);
      mapa.get(data).push(b);
    }
  }
  return mapa;
}

/** Indexa os bloqueios do admin por DATA (mesmo motivo do índice de reservas). */
function indexUnavailabilitiesByDate(unavailabilities = []) {
  const mapa = new Map();
  for (const u of unavailabilities) {
    if (!u?.date) continue;
    if (!mapa.has(u.date)) mapa.set(u.date, []);
    mapa.get(u.date).push(u);
  }
  return mapa;
}

/**
 * A primeira data, a partir de `from`, com pelo menos um horário livre.
 *
 * Serve ao beco sem saída do calendário: mês inteiro sem vaga e a pessoa
 * clicando "próximo mês" no escuro, sem saber se procura por mais um mês ou
 * por seis. Devolve `null` se não houver nada na janela.
 *
 * @returns {string|null} 'YYYY-MM-DD'
 */
function findFirstFreeDate({
  from,
  days = 180,
  courtId = null,
  courts = null,
  schedules = [],
  bookings = [],
  unavailabilities = [],
} = {}) {
  if (!from || !Array.isArray(schedules) || schedules.length === 0) return null;
  const porData = indexBookingsByDate(bookings);
  const bloqueiosPorData = indexUnavailabilitiesByDate(unavailabilities);
  const limite = Math.max(0, Math.min(Number(days) || 0, 400));

  for (let i = 0; i <= limite; i++) {
    const date = addDays(from, i);
    if (!date) return null;
    const r = aggregateDayStatus({
      date,
      courtId,
      courts,
      schedules,
      bookings: porData.get(date) || [],
      unavailabilities: bloqueiosPorData.get(date) || [],
    });
    if (r.hasAvailable) return date;
  }
  return null;
}

/** Gera a grade 7×6 de strings 'YYYY-MM-DD' começando pelo domingo da semana do dia 1. */
function buildMonthGrid(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const firstWeekday = first.getDay();
  const start = new Date(y, m - 1, 1 - firstWeekday);
  const grid = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    grid.push(d.toISOString().slice(0, 10));
  }
  return grid;
}

export {
  aggregateDayStatus,
  buildMonthGrid,
  indexBookingsByDate,
  indexUnavailabilitiesByDate,
  findFirstFreeDate,
};
