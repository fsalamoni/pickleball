/**
 * Serviço de reservas (bookings) da arena.
 *
 * Fluxo: o atleta solicita (avulsa ou recorrente) → a arena negocia valor →
 * confirma/recusa → marca pagamento → conclui. Cada transição notifica a outra
 * parte. Sem gateway de pagamento no cliente: o pagamento é acompanhado por
 * status manual (a cobrança/repasse real dependerá da fundação server-side).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { ARENA_COLLECTIONS, BOOKING_STATUS, BOOKING_KIND, PAYMENT_STATUS, BOOKING_STATUS_LABELS } from '../domain/constants.js';
import { expandRecurring, isValidSlot, canTransition, weekdayOf, hasConflictWithConfirmed } from '../domain/booking.js';
import { validateBookingRequest } from '../domain/booking_conflict.js';
import { listArenaCourtSchedules, listCourtSchedules } from './arenaService.js';
import { listArenaManagerIds } from './arenaService.js';

const COL = ARENA_COLLECTIONS;

function str(v) {
  return String(v ?? '').trim();
}
function displayName(user, profile) {
  return profile?.platform_name || profile?.full_name || user?.displayName || user?.email || 'Atleta';
}
function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

/**
 * Cria uma solicitação de reserva.
 * @param input { kind, date, start, end, recurring:{weekday,start,end,weeks,fromDate}, notes, proposed_price }
 */
export async function createBooking(arena, user, profile, input) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const kind = input.kind === BOOKING_KIND.RECURRING ? BOOKING_KIND.RECURRING : BOOKING_KIND.SINGLE;

  let slots = [];
  let recurrence = null;
  if (kind === BOOKING_KIND.RECURRING) {
    recurrence = {
      weekday: Math.trunc(Number(input.recurring?.weekday)),
      start: str(input.recurring?.start),
      end: str(input.recurring?.end),
      weeks: Math.max(1, Math.min(52, Math.trunc(Number(input.recurring?.weeks) || 0))),
      fromDate: str(input.recurring?.fromDate),
    };
    slots = expandRecurring(recurrence);
    if (slots.length === 0) throw new Error('Preencha o dia da semana, os horários e o número de semanas.');
  } else {
    const slot = { date: str(input.date), start: str(input.start), end: str(input.end) };
    if (!isValidSlot(slot)) throw new Error('Preencha a data e um horário válido (fim depois do início).');
    slots = [slot];
  }

  const existingBookings = await listArenaBookings(arena.id);
  // Validação ARE-07: usa validateBookingRequest que considera schedules,
  // court_id e status ativos (não só CONFIRMED). Erros vêm com reason
  // específico pra UI renderizar mensagem apropriada.
  if (kind === BOOKING_KIND.SINGLE && slots.length === 1) {
    const courtId = str(input.court_id);
    // Carrega schedules da quadra se informada, senão da arena toda
    let courtSchedules = [];
    try {
      courtSchedules = courtId
        ? await listCourtSchedules(courtId)
        : await listArenaCourtSchedules(arena.id);
    } catch (err) {
      // Não bloquear se falhar leitura de schedules (degrada gracefully)
      courtSchedules = [];
    }
    const v = validateBookingRequest({
      date: slots[0].date,
      start_time: slots[0].start,
      end_time: slots[0].end,
      court_id: courtId || null,
      existingBookings,
      court_schedules: courtSchedules,
    });
    if (!v.ok) throw new Error(v.message);
  } else if (hasConflictWithConfirmed(slots, existingBookings)) {
    // Recorrente ou edge case: fallback no validador legado
    throw new Error('Já existe uma reserva confirmada nesse horário. Escolha outro período.');
  }

  const id = doc(collection(db, COL.bookings)).id;
  const payload = {
    id,
    arena_id: arena.id,
    arena_name: str(arena.name),
    athlete_id: user.uid,
    athlete_name: displayName(user, profile),
    athlete_photo: profile?.photo_url || user.photoURL || '',
    kind,
    slots,
    recurrence,
    notes: str(input.notes).slice(0, 600),
    status: BOOKING_STATUS.REQUESTED,
    proposed_price: num(input.proposed_price),
    agreed_price: null,
    payment_status: PAYMENT_STATUS.NONE,
    created_by: user.uid,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL.bookings, id), payload);

  const managerIds = await listArenaManagerIds(arena.id).catch(() => []);
  notifyUsers(managerIds, {
    title: `Nova solicitação de reserva em "${str(arena.name).slice(0, 50)}"`,
    message: `${payload.athlete_name} solicitou ${kind === BOOKING_KIND.RECURRING ? `${slots.length} horários (recorrente)` : `${slots[0].date} ${slots[0].start}`}. Toque para responder.`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: `/arenas/${arena.id}/gerir`,
    actor: { uid: user.uid, displayName: payload.athlete_name },
  });
  await createAuditLog({ action: 'arena_booking_requested', actor: user, details: { arena_id: arena.id, booking_id: id, kind } });
  return id;
}

export async function getBooking(id) {
  if (!db || !id) return null;
  const snap = await getDoc(doc(db, COL.bookings, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listMyBookings(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL.bookings), where('athlete_id', '==', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listArenaBookings(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL.bookings), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Atualiza o status de uma reserva (com guarda de transição) e, opcionalmente,
 * o valor acordado. `byManager` define quem é notificado.
 */
export async function updateBookingStatus(booking, nextStatus, actor, { agreedPrice, byManager = true } = {}) {
  if (!canTransition(booking.status, nextStatus)) {
    throw new Error(`Transição inválida (${BOOKING_STATUS_LABELS[booking.status]} → ${BOOKING_STATUS_LABELS[nextStatus] || nextStatus}).`);
  }
  if (nextStatus === BOOKING_STATUS.CONFIRMED) {
    const existingBookings = await listArenaBookings(booking.arena_id);
    const others = existingBookings.filter((item) => item.id !== booking.id);
    if (hasConflictWithConfirmed(booking.slots || [], others)) {
      throw new Error('Não é possível confirmar: já existe outra reserva confirmada em conflito com este horário.');
    }
  }
  const patch = { status: nextStatus, updated_at: serverTimestamp() };
  if (agreedPrice !== undefined) patch.agreed_price = num(agreedPrice);
  if (nextStatus === BOOKING_STATUS.CONFIRMED && num(agreedPrice ?? booking.agreed_price ?? booking.proposed_price) != null) {
    patch.payment_status = booking.payment_status === PAYMENT_STATUS.PAID ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PENDING;
  }
  await updateDoc(doc(db, COL.bookings, booking.id), patch);

  const recipient = byManager ? [booking.athlete_id] : (await listArenaManagerIds(booking.arena_id).catch(() => []));
  notifyUsers(recipient, {
    title: `Reserva ${BOOKING_STATUS_LABELS[nextStatus].toLowerCase()} — "${str(booking.arena_name).slice(0, 40)}"`,
    message: byManager
      ? 'A arena atualizou sua solicitação de reserva. Toque para ver.'
      : `${booking.athlete_name} atualizou a reserva.`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: byManager ? '/minhas-reservas' : `/arenas/${booking.arena_id}/gerir`,
    actor,
  });
  await createAuditLog({ action: 'arena_booking_status', actor, details: { booking_id: booking.id, status: nextStatus } });
}

/** Proposta/contraproposta de valor (mantém a reserva em negociação). */
export async function proposeBookingPrice(booking, price, actor, { byManager = true } = {}) {
  const value = num(price);
  const patch = {
    proposed_price: value,
    updated_at: serverTimestamp(),
  };
  if (booking.status === BOOKING_STATUS.REQUESTED) patch.status = BOOKING_STATUS.NEGOTIATING;
  await updateDoc(doc(db, COL.bookings, booking.id), patch);

  const recipient = byManager ? [booking.athlete_id] : (await listArenaManagerIds(booking.arena_id).catch(() => []));
  notifyUsers(recipient, {
    title: `Proposta de valor — "${str(booking.arena_name).slice(0, 40)}"`,
    message: 'Há uma nova proposta de valor para a reserva. Toque para ver.',
    type: NOTIFICATION_TYPE.GENERIC,
    link: byManager ? '/minhas-reservas' : `/arenas/${booking.arena_id}/gerir`,
    actor,
  });
  await createAuditLog({ action: 'arena_booking_price', actor, details: { booking_id: booking.id, price: value } });
}

/** Marca o status de pagamento (manual). */
export async function setBookingPayment(booking, paymentStatus, actor) {
  const status = Object.values(PAYMENT_STATUS).includes(paymentStatus) ? paymentStatus : PAYMENT_STATUS.PENDING;
  await updateDoc(doc(db, COL.bookings, booking.id), { payment_status: status, updated_at: serverTimestamp() });
  notifyUsers([booking.athlete_id], {
    title: `Pagamento atualizado — "${str(booking.arena_name).slice(0, 40)}"`,
    message: status === PAYMENT_STATUS.PAID ? 'A arena confirmou o pagamento da sua reserva.' : 'O status de pagamento da sua reserva mudou.',
    type: NOTIFICATION_TYPE.GENERIC,
    link: '/minhas-reservas',
    actor,
  });
  await createAuditLog({ action: 'arena_booking_payment', actor, details: { booking_id: booking.id, payment_status: status } });
}

export async function deleteBooking(booking, actor) {
  await deleteDoc(doc(db, COL.bookings, booking.id));
  await createAuditLog({ action: 'arena_booking_deleted', actor, details: { booking_id: booking.id } });
}

export { weekdayOf };
