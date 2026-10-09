/**
 * supplyMetrics — dos documentos que o professor, a arena e o clube JÁ têm para
 * os números que `supplyHealth` consome (saúde, sugestões, metas do mês).
 *
 * Pura: recebe listas já carregadas. A regra de ouro é a mesma do resto da
 * gamificação — fonte que não carregou é `undefined`, e o número que dependeria
 * dela fica `null` ("não deu para medir"), nunca zero. Quem mostra diz isso.
 */
import { instanteEmMs } from '@/core/domain/instant.js';
import { dayStartMs, platformMonthKey } from './missionDay.js';
import { isClinicPast } from '@/modules/coaches/domain/clinic.js';
import { computeClubActivity, evaluateClubGoals } from './supplyHealth.js';

const DIA = 86_400_000;
const lista = (v) => (Array.isArray(v) ? v : null);

/** Data civil ('YYYY-MM-DD') → ms (meia-noite de Brasília). */
function dataEmMs(texto) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(texto || ''));
  return m ? dayStartMs(m[1]) : NaN;
}

/** A janela [início, fim) do mês corrente, no fuso da plataforma. */
export function monthWindow(now = new Date()) {
  const chave = `${platformMonthKey(now)}-01`;
  const [y, m] = chave.split('-').map(Number);
  const prox = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { startMs: dayStartMs(chave), endMs: dayStartMs(prox), key: platformMonthKey(now) };
}

const criadoEm = (d) => instanteEmMs(d?.created_at_ms ?? d?.created_at ?? d?.createdAt);
const entre = (ms, a, b) => Number.isFinite(ms) && ms >= a && ms < b;
const contar = (itens, fn) => itens.filter(fn).length;

/* ================================ ARENA ================================ */

function dataDaReserva(b) {
  const slots = Array.isArray(b?.slots) ? b.slots : [];
  const primeiro = slots.find((s) => s?.date);
  const ms = dataEmMs(primeiro?.date || b?.date);
  return Number.isFinite(ms) ? ms : criadoEm(b);
}

/**
 * @param {{
 *   bookings?: Array<object>, reviews?: Array<object>, gameDays?: Array<object>, openSlots?: Array<object>,
 *   classes?: Array<object>, now?: Date,
 * }} src `undefined` = a fonte não carregou
 * @returns {{ health: object, actuals: Record<string, number|null>, unknown: string[] }}
 */
export function arenaMetrics({ bookings, reviews, gameDays, openSlots, classes, now = new Date() } = {}) {
  const agora = now.getTime();
  const reservas = lista(bookings);
  const unknown = [];
  if (!reservas) unknown.push('reservas');
  if (!lista(reviews)) unknown.push('avaliações');
  const eventosOk = lista(gameDays) && lista(openSlots);
  if (!eventosOk) unknown.push('eventos');

  const health = {};
  const mes = monthWindow(now);
  const actuals = { bookings: null, events: null, reviews: null, new_customers: null };

  if (reservas) {
    const feitas = reservas.filter((b) => ['confirmed', 'completed'].includes(b?.status));
    const decididas = feitas.filter((b) => b.status === 'completed' || dataDaReserva(b) < agora);
    const jogadas = decididas.filter((b) => b.no_show !== true);
    const emDias = (ini, fim) => contar(jogadas, (b) => entre(dataDaReserva(b), agora - ini * DIA, agora - fim * DIA));
    health.bookings7 = emDias(7, 0);
    health.bookingsPrev7 = emDias(14, 7);
    health.noShowRate = decididas.length >= 5
      ? Math.round((contar(decididas, (b) => b.no_show === true) / decididas.length) * 100) : null;
    health.pendingOver24h = contar(reservas, (b) => b?.status === 'requested' && agora - criadoEm(b) > DIA);

    const porCliente = new Map();
    feitas.forEach((b) => {
      const u = b.user_id;
      if (!u) return;
      const c = porCliente.get(u) || { n: 0, last: 0, first: Infinity };
      c.n += 1;
      const quando = dataDaReserva(b);
      if (Number.isFinite(quando)) { c.last = Math.max(c.last, quando); c.first = Math.min(c.first, quando); }
      porCliente.set(u, c);
    });
    const clientes = [...porCliente.values()];
    health.repeatRate = clientes.length >= 5 ? Math.round((contar(clientes, (c) => c.n >= 2) / clientes.length) * 100) : null;
    health.lapsedCustomers = contar(clientes, (c) => c.last > 0 && agora - c.last > 30 * DIA && c.n >= 2);

    actuals.bookings = contar(jogadas, (b) => entre(dataDaReserva(b), mes.startMs, mes.endMs));
    actuals.new_customers = contar(clientes, (c) => entre(c.first, mes.startMs, mes.endMs));
  }

  const avaliacoes = lista(reviews)?.filter((r) => (r?.type ?? 'review') === 'review' && Number(r?.rating) >= 1 && Number(r?.rating) <= 5);
  if (avaliacoes) {
    health.reviewsCount = avaliacoes.length;
    health.rating = avaliacoes.length ? Math.round((avaliacoes.reduce((s, r) => s + Number(r.rating), 0) / avaliacoes.length) * 10) / 10 : null;
    actuals.reviews = contar(avaliacoes, (r) => entre(criadoEm(r), mes.startMs, mes.endMs));
  }

  if (eventosOk) {
    const dd = (g) => dataEmMs(g?.date);
    const gd30 = contar(gameDays, (g) => g?.status !== 'archived' && entre(dd(g), agora - 30 * DIA, agora + DIA));
    const os30 = contar(openSlots, (s) => entre(instanteEmMs(s?.starts_at), agora - 30 * DIA, agora + DIA));
    const cl30 = lista(classes) ? contar(classes, (c) => entre(dataEmMs(c?.date), agora - 30 * DIA, agora + DIA)) : 0;
    health.eventsLast30 = gd30 + os30 + cl30;
    actuals.events = contar(gameDays, (g) => g?.status !== 'archived' && entre(dd(g), mes.startMs, mes.endMs))
      + contar(openSlots, (s) => entre(instanteEmMs(s?.starts_at), mes.startMs, mes.endMs));
  }

  return { health, actuals, unknown };
}

/* =============================== PROFESSOR ============================== */

/**
 * @param {{ lessons?: Array<object>, students?: Array<object>, packages?: Array<object>, clinics?: Array<object>,
 *   contents?: Array<object>, validations?: Array<object>, now?: Date }} src
 */
export function coachMetrics({ lessons, students, packages, clinics, contents, validations, now = new Date() } = {}) {
  const agora = now.getTime();
  const mes = monthWindow(now);
  const unknown = [];
  const aulas = lista(lessons);
  const alunos = lista(students);
  if (!aulas) unknown.push('aulas');
  if (!alunos) unknown.push('alunos');
  const health = {};
  const actuals = { lessons: null, new_students: null, clinics: null, validations: null };

  const quandoAula = (l) => {
    const slots = Array.isArray(l?.slots) ? l.slots : [];
    const s = slots.find((x) => x?.date);
    const ms = dataEmMs(s?.date || l?.date);
    return Number.isFinite(ms) ? ms : criadoEm(l);
  };

  if (aulas) {
    const dadas = aulas.filter((l) => l?.status === 'completed');
    const em = (a, b) => dadas.filter((l) => entre(quandoAula(l), agora - a * DIA, agora - b * DIA));
    const d30 = em(30, 0);
    health.lessons30 = d30.length;
    health.lessonsPrev30 = em(60, 30).length;
    health.pendingOver24h = contar(aulas, (l) => l?.status === 'requested' && agora - criadoEm(l) > DIA);
    health.activeStudents30 = new Set(d30.map((l) => l.student_id).filter(Boolean)).size;
    actuals.lessons = contar(dadas, (l) => entre(quandoAula(l), mes.startMs, mes.endMs));
  }
  if (alunos) {
    const ativos = alunos.filter((s) => s?.status !== 'paused' && s?.status !== 'ended');
    health.totalStudents = ativos.length;
    health.newStudents30 = contar(ativos, (s) => entre(criadoEm(s), agora - 30 * DIA, agora + DIA));
    actuals.new_students = contar(ativos, (s) => entre(criadoEm(s), mes.startMs, mes.endMs));
  }
  const ofertasOk = lista(packages) && lista(clinics) && lista(contents);
  if (ofertasOk) {
    health.offers = contar(packages, (p) => p?.active !== false)
      + contar(clinics, (c) => c?.status !== 'cancelled' && !isClinicPast(c, now))
      + contar(contents, (c) => c?.status !== 'draft');
    actuals.clinics = contar(clinics, (c) => c?.status !== 'cancelled' && entre(criadoEm(c), mes.startMs, mes.endMs));
  }
  if (lista(validations)) {
    health.validatedStudents = new Set(validations.map((v) => v?.student_id).filter(Boolean)).size;
    actuals.validations = contar(validations, (v) => entre(criadoEm(v), mes.startMs, mes.endMs));
  }
  return { health, actuals, unknown };
}

/* ================================ CLUBE ================================= */

/**
 * @param {{ games?: Array<object>, members?: Array<object>, events?: Array<object>, now?: Date }} src
 *   `games`: espelho `club_event_games` do clube; `events`: eventos do clube
 * @returns {{ week: object|null, month: object|null, goalsWeek: Array<object>, goalsMonth: Array<object>,
 *   actuals: Record<string, number|null>, unknown: string[] }}
 */
export function clubMetrics({ games, members, events, now = new Date() } = {}) {
  const agora = now.getTime();
  const mes = monthWindow(now);
  const unknown = [];
  const jogos = lista(games);
  const membros = lista(members);
  if (!jogos) unknown.push('jogos');
  if (!membros) unknown.push('membros');
  const eventos = lista(events);
  if (!eventos) unknown.push('eventos');

  const actuals = { games: null, new_members: null, events: null, active_rate: null };
  let week = null;
  let month = null;
  if (jogos && membros) {
    const g = jogos.map((x) => ({
      at: instanteEmMs(x?.result_recorded_at ?? x?.created_at_ms ?? x?.created_at),
      side_a_ids: x?.side_a_ids, side_b_ids: x?.side_b_ids, winner_side: x?.winner_side,
    }));
    const m = membros.map((x) => ({ user_id: x?.user_id, joined_at_ms: criadoEm(x) }));
    week = computeClubActivity({ games: g, members: m, startMs: agora - 7 * DIA, endMs: agora + DIA });
    month = computeClubActivity({ games: g, members: m, startMs: mes.startMs, endMs: mes.endMs });
    actuals.games = month.games;
    actuals.new_members = month.newMembers;
    actuals.active_rate = month.activeRate;
  }
  if (eventos) {
    actuals.events = contar(eventos, (e) => entre(dataEmMs(e?.date ?? e?.start_date) || criadoEm(e), mes.startMs, mes.endMs));
  }
  return {
    week, month,
    goalsWeek: week ? evaluateClubGoals(week, 'week') : [],
    goalsMonth: month ? evaluateClubGoals(month, 'month') : [],
    actuals, unknown,
  };
}
