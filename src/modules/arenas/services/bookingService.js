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
import { canBeInstantBooking, getInitialBookingStatus } from '../domain/instant_booking.js';
import { pickAvailableCourt } from '../domain/court_assignment.js';
import { listArenaCourtSchedules, listCourtSchedules, listArenaCourts } from './arenaService.js';
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

    // ARE-03: validação específica de reserva instantânea
    const isInstant = input.is_instant === true;
    if (isInstant) {
      const instant = canBeInstantBooking(
        {
          date: slots[0].date,
          start_time: slots[0].start,
          end_time: slots[0].end,
          court_id: courtId || null,
          proposed_price: input.proposed_price,
          payment_method: input.payment_method,
        },
        arena,
        existingBookings,
        courtSchedules,
      );
      if (!instant.ok) throw new Error(instant.message);
    }
  } else if (hasConflictWithConfirmed(slots, existingBookings)) {
    // Recorrente ou edge case: fallback no validador legado
    throw new Error('Já existe uma reserva confirmada nesse horário. Escolha outro período.');
  }

  // Resolve a quadra: usa a escolhida ou atribui automaticamente uma livre,
  // para a reserva sempre ficar vinculada a uma quadra específica no calendário.
  let assignedCourtId = str(input.court_id) || null;
  if (!assignedCourtId) {
    const courts = await listArenaCourts(arena.id).catch(() => []);
    if (courts.length > 0) {
      const allSchedules = await listArenaCourtSchedules(arena.id).catch(() => []);
      assignedCourtId = pickAvailableCourt(courts, slots[0], existingBookings, allSchedules);
    }
  }

  const isInstant = input.is_instant === true;
  const initialStatus = getInitialBookingStatus(isInstant);
  const id = doc(collection(db, COL.bookings)).id;
  const payload = {
    id,
    arena_id: arena.id,
    arena_name: str(arena.name),
    court_id: assignedCourtId,
    athlete_id: user.uid,
    athlete_name: displayName(user, profile),
    athlete_photo: profile?.photo_url || user.photoURL || '',
    kind,
    slots,
    recurrence,
    notes: str(input.notes).slice(0, 600),
    status: initialStatus,
    is_instant: isInstant,
    payment_method: str(input.payment_method) || null,
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

/**
 * Cria uma reserva MANUAL feita pelo admin/gestor da arena (ex.: cliente que
 * ligou ou apareceu no balcão). Diferente de `createBooking`:
 *  - nasce já CONFIRMED (o admin está confirmando na hora);
 *  - o "cliente" é um nome livre (`client_name`), sem conta vinculada;
 *  - exige `court_id` (a reserva ocupa o slot de uma quadra específica no
 *    calendário) e valida conflito com o mesmo validador testado (ARE-07).
 *
 * @param {object} arena
 * @param {object} actor - admin autenticado (precisa de `.uid`)
 * @param {{ court_id, date, start, end, client_name, agreed_price, paid, notes }} input
 * @returns {Promise<string>} id da reserva criada
 */
export async function createManualBooking(arena, actor, input) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const clientName = str(input.client_name);
  if (!clientName) throw new Error('Informe o nome do cliente da reserva.');

  const slot = { date: str(input.date), start: str(input.start), end: str(input.end) };
  if (!isValidSlot(slot)) throw new Error('Preencha a data e um horário válido (fim depois do início).');

  const existingBookings = await listArenaBookings(arena.id);
  // Quadra escolhida OU atribuição automática de uma quadra livre.
  let courtId = str(input.court_id);
  if (!courtId) {
    const courts = await listArenaCourts(arena.id).catch(() => []);
    const allSchedules = await listArenaCourtSchedules(arena.id).catch(() => []);
    courtId = pickAvailableCourt(courts, slot, existingBookings, allSchedules);
    if (!courtId) throw new Error('Nenhuma quadra livre neste horário. Escolha outro horário.');
  }
  // Mescla schedules da quadra + da arena (sem court_id), igual ao filtro do
  // calendário admin, para a validação de janela refletir o que o admin vê.
  let courtSchedules = [];
  try {
    const all = await listArenaCourtSchedules(arena.id);
    courtSchedules = all.filter((s) => !s.court_id || s.court_id === courtId);
  } catch (err) {
    courtSchedules = [];
  }
  const v = validateBookingRequest({
    date: slot.date,
    start_time: slot.start,
    end_time: slot.end,
    court_id: courtId,
    existingBookings,
    court_schedules: courtSchedules,
  });
  if (!v.ok) throw new Error(v.message);

  const agreedPrice = num(input.agreed_price);
  const id = doc(collection(db, COL.bookings)).id;
  const payload = {
    id,
    arena_id: arena.id,
    arena_name: str(arena.name),
    court_id: courtId,
    athlete_id: null,
    athlete_name: clientName,
    athlete_photo: '',
    kind: BOOKING_KIND.SINGLE,
    slots: [slot],
    recurrence: null,
    notes: str(input.notes).slice(0, 600),
    status: BOOKING_STATUS.CONFIRMED,
    is_instant: false,
    is_manual: true,
    payment_method: null,
    proposed_price: agreedPrice,
    agreed_price: agreedPrice,
    payment_status: input.paid ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.NONE,
    created_by: actor.uid,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL.bookings, id), payload);
  await createAuditLog({
    action: 'arena_booking_manual_created',
    actor,
    details: { arena_id: arena.id, booking_id: id, court_id: courtId },
  });
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

/**
 * Altera o horário/quadra de uma reserva avulsa. Serve ao atleta/professor (na
 * própria reserva) e à arena (em qualquer). Valida conflito. Quando editada por
 * quem NÃO é gestor e a reserva já estava confirmada, volta para "solicitada"
 * (a arena reconfirma o novo horário) e limpa o valor acordado.
 *
 * @param {object} booking
 * @param {object} actor
 * @param {{ court_id?, date, start, end }} input
 * @param {{ byManager?: boolean }} opts
 */
export async function editBookingSlot(booking, actor, input, { byManager = false } = {}) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (booking.kind === BOOKING_KIND.RECURRING) {
    throw new Error('Reservas recorrentes não podem ser editadas aqui — cancele e crie novamente.');
  }
  if ([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.DECLINED, BOOKING_STATUS.COMPLETED].includes(booking.status)) {
    throw new Error('Esta reserva não pode mais ser alterada.');
  }
  let courtId = input.court_id !== undefined ? str(input.court_id) : (booking.court_id || '');
  const slot = { date: str(input.date), start: str(input.start), end: str(input.end) };
  if (!isValidSlot(slot)) throw new Error('Preencha a data e um horário válido (fim depois do início).');

  const existing = await listArenaBookings(booking.arena_id);
  const others = existing.filter((b) => b.id !== booking.id);
  // Sem quadra escolhida → atribui automaticamente uma livre.
  if (!courtId) {
    const courts = await listArenaCourts(booking.arena_id).catch(() => []);
    const allSchedules = await listArenaCourtSchedules(booking.arena_id).catch(() => []);
    courtId = pickAvailableCourt(courts, slot, others, allSchedules) || '';
  }
  let courtSchedules = [];
  try {
    const all = await listArenaCourtSchedules(booking.arena_id);
    courtSchedules = all.filter((s) => !s.court_id || s.court_id === courtId);
  } catch (err) {
    courtSchedules = [];
  }
  const v = validateBookingRequest({
    date: slot.date, start_time: slot.start, end_time: slot.end,
    court_id: courtId || null, existingBookings: others, court_schedules: courtSchedules,
  });
  if (!v.ok) throw new Error(v.message);

  const patch = {
    slots: [slot],
    court_id: courtId || null,
    updated_at: serverTimestamp(),
  };
  // Editada pelo cliente numa reserva já negociada/confirmada → volta a pendente.
  if (!byManager && [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.NEGOTIATING].includes(booking.status)) {
    patch.status = BOOKING_STATUS.REQUESTED;
    patch.agreed_price = null;
    patch.payment_status = PAYMENT_STATUS.NONE;
  }
  await updateDoc(doc(db, COL.bookings, booking.id), patch);

  // Notifica a contraparte.
  const recipients = byManager
    ? [booking.athlete_id, booking.coach_id].filter(Boolean)
    : (await listArenaManagerIds(booking.arena_id).catch(() => []));
  notifyUsers(recipients, {
    title: `Reserva alterada — "${str(booking.arena_name).slice(0, 40)}"`,
    message: `Novo horário: ${slot.date} ${slot.start}–${slot.end}.${patch.status === BOOKING_STATUS.REQUESTED ? ' Aguarda reconfirmação da arena.' : ''}`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: byManager ? '/minhas-reservas' : `/arenas/${booking.arena_id}/gerir`,
    actor,
  });
  await createAuditLog({ action: 'arena_booking_edited', actor, details: { booking_id: booking.id, court_id: courtId, date: slot.date } });
}

/**
 * Transfere o responsável de uma reserva (a arena reatribui a outro atleta da
 * plataforma ou a um cliente avulso por nome). Notifica o novo e o antigo
 * responsável. Autorizado ao gestor da arena/admin (via regras Firestore).
 *
 * @param {object} booking
 * @param {object} actor
 * @param {{ athlete_id?: string|null, athlete_name: string, athlete_photo?: string }} target
 */
export async function transferBooking(booking, actor, target) {
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const name = str(target.athlete_name);
  if (!name) throw new Error('Informe o novo responsável pela reserva.');
  const previousAthleteId = booking.athlete_id || null;
  await updateDoc(doc(db, COL.bookings, booking.id), {
    athlete_id: str(target.athlete_id) || null,
    athlete_name: name,
    athlete_photo: str(target.athlete_photo) || '',
    updated_at: serverTimestamp(),
  });
  const recipients = [];
  if (target.athlete_id) recipients.push(target.athlete_id);
  if (previousAthleteId && previousAthleteId !== target.athlete_id) recipients.push(previousAthleteId);
  if (recipients.length > 0) {
    notifyUsers(recipients, {
      title: `Responsável da reserva atualizado — "${str(booking.arena_name).slice(0, 40)}"`,
      message: `A reserva agora está no nome de ${name}.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-reservas',
      actor,
    });
  }
  await createAuditLog({ action: 'arena_booking_transferred', actor, details: { booking_id: booking.id, to: target.athlete_id || name } });
}

export { weekdayOf };
