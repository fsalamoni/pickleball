/**
 * Serviço de reservas compartilhadas (multi-atleta) e reservas de aula.
 * Opera sobre a mesma coleção `arena_bookings`, de forma aditiva: uma reserva
 * ganha `participants`, `participant_ids`, `invited_ids`, `open_join`,
 * `max_participants`, `booking_type` e (para aulas) `coach_id`.
 *
 * Regras Firestore (arena_bookings): leem/escrevem o dono original, os
 * participantes (aceitos e convidados), o professor (coach_id), qualquer um
 * numa reserva aberta, o gestor da arena e o admin.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { ARENA_COLLECTIONS, BOOKING_STATUS, BOOKING_KIND, PAYMENT_STATUS } from '../domain/constants.js';
import { isValidSlot } from '../domain/booking.js';
import { validateBookingRequest } from '../domain/booking_conflict.js';
import { pickAvailableCourt } from '../domain/court_assignment.js';
import {
  BOOKING_TYPE, buildParticipants, ownerIds, invitedIds, addInvite,
  acceptInvite, declineInvite, joinOpen, removeParticipant, isOwner, isInvited, canJoin,
} from '../domain/shared_booking.js';
import { listArenaCourtSchedules, listArenaCourts } from './arenaService.js';
import { listArenaManagerIds } from './arenaService.js';

const COL = ARENA_COLLECTIONS;
const str = (v) => String(v ?? '').trim();
function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}
function displayName(user, profile) {
  return profile?.platform_name || profile?.full_name || user?.displayName || user?.email || 'Atleta';
}

/** Deriva os arrays denormalizados a partir dos participantes. */
function denorm(participants) {
  return {
    participants,
    participant_ids: ownerIds(participants),
    invited_ids: invitedIds(participants),
  };
}

async function listArenaBookings(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL.bookings), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function courtSchedulesFor(arenaId, courtId) {
  try {
    const all = await listArenaCourtSchedules(arenaId);
    return all.filter((s) => !s.court_id || s.court_id === courtId);
  } catch {
    return [];
  }
}

/* ------------------------------ Criação ------------------------------ */

/**
 * Cria uma reserva compartilhada (ou de aula). O solicitante é co-proprietário;
 * os convidados entram como convite pendente. Pode nascer aberta (open_join) com
 * ou sem limite (max_participants).
 *
 * @param {object} arena
 * @param {object} user solicitante autenticado
 * @param {object} profile perfil do solicitante
 * @param {{
 *   court_id, date, start, end, notes?,
 *   invitees?: Array<{athlete_id,name,photo?,slot?}>,
 *   open_join?: boolean, max_participants?: number|null,
 *   booking_type?: 'court'|'coach_lesson', coach_id?: string|null,
 *   as_coach?: boolean  // professor reservando (não entra como participante pagante)
 * }} input
 */
export async function createSharedBooking(arena, user, profile, input) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const slot = { date: str(input.date), start: str(input.start), end: str(input.end) };
  if (!isValidSlot(slot)) throw new Error('Preencha a data e um horário válido (fim depois do início).');

  const existing = await listArenaBookings(arena.id);
  // Quadra escolhida OU atribuição automática de uma quadra livre.
  let courtId = str(input.court_id);
  if (!courtId) {
    const courts = await listArenaCourts(arena.id).catch(() => []);
    const allSchedules = await listArenaCourtSchedules(arena.id).catch(() => []);
    courtId = pickAvailableCourt(courts, slot, existing, allSchedules);
    if (!courtId) throw new Error('Nenhuma quadra livre neste horário. Escolha outro horário.');
  }
  const v = validateBookingRequest({
    date: slot.date, start_time: slot.start, end_time: slot.end,
    court_id: courtId, existingBookings: existing, court_schedules: await courtSchedulesFor(arena.id, courtId),
  });
  if (!v.ok) throw new Error(v.message);

  const bookingType = input.booking_type === BOOKING_TYPE.COACH_LESSON ? BOOKING_TYPE.COACH_LESSON : BOOKING_TYPE.COURT;
  const asCoach = input.as_coach === true;

  // O solicitante entra como participante, exceto quando é o professor
  // reservando a quadra (ele é coach_id, não participante pagante).
  const initiator = asCoach ? null : {
    athlete_id: user.uid,
    name: displayName(user, profile),
    photo: profile?.photo_url || user.photoURL || '',
    slot: input.self_slot && isValidSlot({ date: slot.date, ...input.self_slot }) ? input.self_slot : null,
  };
  const participants = buildParticipants(initiator, input.invitees || []);

  const id = doc(collection(db, COL.bookings)).id;
  const maxP = num(input.max_participants);
  const payload = {
    id,
    arena_id: arena.id,
    arena_name: str(arena.name),
    court_id: courtId,
    athlete_id: asCoach ? null : user.uid,
    athlete_name: asCoach ? (str(input.coach_name) || displayName(user, profile)) : displayName(user, profile),
    athlete_photo: profile?.photo_url || user.photoURL || '',
    kind: BOOKING_KIND.SINGLE,
    slots: [slot],
    recurrence: null,
    notes: str(input.notes).slice(0, 600),
    status: BOOKING_STATUS.REQUESTED,
    is_instant: false,
    shared: true,
    booking_type: bookingType,
    coach_id: bookingType === BOOKING_TYPE.COACH_LESSON ? (str(input.coach_id) || user.uid) : null,
    open_join: input.open_join === true,
    max_participants: maxP,
    ...denorm(participants),
    payment_method: null,
    proposed_price: num(input.proposed_price),
    agreed_price: null,
    payment_status: PAYMENT_STATUS.NONE,
    created_by: user.uid,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL.bookings, id), payload);

  // Notifica convidados e gestores.
  const inviteeIds = invitedIds(participants);
  if (inviteeIds.length > 0) {
    notifyUsers(inviteeIds, {
      title: 'Convite para dividir uma quadra',
      message: `${payload.athlete_name} convidou você para ${slot.date} ${slot.start}–${slot.end} em ${str(arena.name).slice(0, 40)}.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-reservas',
      actor: { uid: user.uid, displayName: payload.athlete_name },
    });
  }
  const managerIds = await listArenaManagerIds(arena.id).catch(() => []);
  notifyUsers(managerIds, {
    title: `Nova reserva${bookingType === BOOKING_TYPE.COACH_LESSON ? ' de aula' : ' compartilhada'} — "${str(arena.name).slice(0, 40)}"`,
    message: `${payload.athlete_name} solicitou ${slot.date} ${slot.start}. Toque para responder.`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: `/arenas/${arena.id}/gerir`,
    actor: { uid: user.uid, displayName: payload.athlete_name },
  });
  await createAuditLog({ action: 'arena_booking_shared_created', actor: user, details: { arena_id: arena.id, booking_id: id, type: bookingType } });
  return id;
}

/* --------------------------- Participação --------------------------- */

async function reload(bookingId) {
  const snap = await getDoc(doc(db, COL.bookings, bookingId));
  if (!snap.exists()) throw new Error('Reserva não encontrada.');
  return { id: snap.id, ...snap.data() };
}

/** Aceita um convite (opcionalmente com sub-horário próprio). */
export async function acceptBookingInvite(booking, user, profile, { slot = null } = {}) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!isInvited(booking, user.uid)) throw new Error('Você não tem convite para esta reserva.');
  // Garante que o participante tem nome/foto atualizados.
  let participants = booking.participants.map((p) => (
    p.athlete_id === user.uid
      ? { ...p, name: p.name || displayName(user, profile), photo: p.photo || profile?.photo_url || '' }
      : p
  ));
  participants = acceptInvite(participants, user.uid, slot);
  await updateDoc(doc(db, COL.bookings, booking.id), { ...denorm(participants), updated_at: serverTimestamp() });
  notifyUsers([booking.athlete_id, booking.coach_id].filter(Boolean), {
    title: 'Convite de reserva aceito',
    message: `${displayName(user, profile)} entrou na reserva de ${booking.arena_name}.`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: '/minhas-reservas',
    actor: { uid: user.uid },
  });
  await createAuditLog({ action: 'arena_booking_invite_accepted', actor: user, details: { booking_id: booking.id } });
}

/** Recusa um convite. */
export async function declineBookingInvite(booking, user) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!isInvited(booking, user.uid)) throw new Error('Você não tem convite para esta reserva.');
  const participants = declineInvite(booking.participants, user.uid);
  await updateDoc(doc(db, COL.bookings, booking.id), { ...denorm(participants), updated_at: serverTimestamp() });
  await createAuditLog({ action: 'arena_booking_invite_declined', actor: user, details: { booking_id: booking.id } });
}

/** Ingressa numa reserva aberta como co-proprietário. */
export async function joinOpenBooking(booking, user, profile, { slot = null } = {}) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!canJoin(booking, user.uid)) throw new Error('Não é possível entrar nesta reserva.');
  const participants = joinOpen(booking.participants, {
    athlete_id: user.uid, name: displayName(user, profile), photo: profile?.photo_url || user.photoURL || '',
  }, slot);
  await updateDoc(doc(db, COL.bookings, booking.id), { ...denorm(participants), updated_at: serverTimestamp() });
  notifyUsers([booking.athlete_id, booking.coach_id].filter(Boolean), {
    title: 'Alguém entrou na sua reserva aberta',
    message: `${displayName(user, profile)} entrou na reserva de ${booking.arena_name}.`,
    type: NOTIFICATION_TYPE.GENERIC,
    link: '/minhas-reservas',
    actor: { uid: user.uid },
  });
  await createAuditLog({ action: 'arena_booking_joined', actor: user, details: { booking_id: booking.id } });
}

/** Sai da reserva (remove-se dos participantes). Qualquer participante pode. */
export async function leaveBooking(booking, user) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const participants = removeParticipant(booking.participants || [], user.uid);
  const patch = { ...denorm(participants), updated_at: serverTimestamp() };
  // Se era o dono original, transfere a titularidade nominal para outro dono.
  if (booking.athlete_id === user.uid) {
    patch.athlete_id = ownerIds(participants)[0] || null;
  }
  await updateDoc(doc(db, COL.bookings, booking.id), patch);
  await createAuditLog({ action: 'arena_booking_left', actor: user, details: { booking_id: booking.id } });
}

/** Convida mais atletas (qualquer co-proprietário ou o professor). */
export async function inviteToBooking(booking, user, invitees = []) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!isOwner(booking, user.uid) && booking.coach_id !== user.uid) throw new Error('Sem permissão para convidar.');
  let participants = booking.participants || [];
  invitees.forEach((inv) => { participants = addInvite(participants, inv, user.uid); });
  await updateDoc(doc(db, COL.bookings, booking.id), { ...denorm(participants), updated_at: serverTimestamp() });
  const newIds = invitees.map((i) => i.athlete_id).filter(Boolean);
  if (newIds.length > 0) {
    notifyUsers(newIds, {
      title: 'Convite para dividir uma quadra',
      message: `Você foi convidado para uma reserva em ${str(booking.arena_name).slice(0, 40)}.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-reservas',
      actor: { uid: user.uid },
    });
  }
  await createAuditLog({ action: 'arena_booking_invited', actor: user, details: { booking_id: booking.id, count: newIds.length } });
}

/** Edita configurações da reserva (aberta/limite/notas). Qualquer co-proprietário. */
export async function updateSharedBookingSettings(booking, user, patch = {}) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!isOwner(booking, user.uid) && booking.coach_id !== user.uid) throw new Error('Sem permissão para editar.');
  const update = { updated_at: serverTimestamp() };
  if (patch.open_join !== undefined) update.open_join = patch.open_join === true;
  if (patch.max_participants !== undefined) update.max_participants = num(patch.max_participants);
  if (patch.notes !== undefined) update.notes = str(patch.notes).slice(0, 600);
  await updateDoc(doc(db, COL.bookings, booking.id), update);
  await createAuditLog({ action: 'arena_booking_settings', actor: user, details: { booking_id: booking.id } });
}

/** Define/atualiza o sub-horário de um participante (self ou, se dono, de outro). */
export async function setParticipantSlot(booking, user, athleteId, slot) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const target = athleteId || user.uid;
  if (target !== user.uid && !isOwner(booking, user.uid) && booking.coach_id !== user.uid) {
    throw new Error('Sem permissão.');
  }
  const participants = (booking.participants || []).map((p) => (
    p.athlete_id === target ? { ...p, slot: slot && slot.start && slot.end ? { start: str(slot.start), end: str(slot.end) } : null } : p
  ));
  await updateDoc(doc(db, COL.bookings, booking.id), { ...denorm(participants), updated_at: serverTimestamp() });
  await createAuditLog({ action: 'arena_booking_participant_slot', actor: user, details: { booking_id: booking.id, athlete_id: target } });
}

/* ------------------------------ Consultas ------------------------------ */

/** Reservas em que o usuário é convidado pendente. */
export async function listMyInvites(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL.bookings), where('invited_ids', 'array-contains', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Reservas em que o usuário é co-proprietário (participante aceito). */
export async function listMyParticipations(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL.bookings), where('participant_ids', 'array-contains', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Reservas de aula de um professor (coach_id). */
export async function listCoachBookings(coachId) {
  if (!db || !coachId) return [];
  const snap = await getDocs(query(collection(db, COL.bookings), where('coach_id', '==', coachId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export { reload as reloadBooking };
