/**
 * Domínio puro de reservas compartilhadas (multi-atleta) — flag shared_bookings.
 *
 * Uma reserva de quadra pode ter VÁRIOS participantes, cada um com seu próprio
 * sub-horário dentro da janela reservada. O primeiro solicitante convida outros
 * atletas (ou deixa a reserva aberta, com ou sem limite). Quem aceita vira
 * co-proprietário com os mesmos poderes (editar, convidar, cancelar). O valor
 * da quadra é rateado entre os participantes, proporcional ao tempo de cada um.
 *
 * Também serve às reservas de aula (professor + alunos): o professor reserva a
 * quadra (booking_type = 'coach_lesson', coach_id) e adiciona alunos como
 * participantes — ou deixa aberto para alunos pedirem para entrar.
 *
 * Aditivo: campos novos são opcionais; reservas antigas (sem participants)
 * seguem funcionando como reserva de dono único. Sem I/O — testável.
 */

import { timeToMinutes } from './pricing.js';

export const BOOKING_TYPE = Object.freeze({
  COURT: 'court',
  COACH_LESSON: 'coach_lesson',
});

export const PARTICIPANT_STATUS = Object.freeze({
  INVITED: 'invited',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
});

export const PARTICIPANT_STATUS_LABELS = Object.freeze({
  [PARTICIPANT_STATUS.INVITED]: 'Convidado',
  [PARTICIPANT_STATUS.ACCEPTED]: 'Confirmado',
  [PARTICIPANT_STATUS.DECLINED]: 'Recusou',
});

const str = (v) => String(v ?? '').trim();

/** Sub-horário válido { start, end } dentro da janela? (ou null = janela toda). */
function validSubSlot(slot) {
  if (!slot) return true;
  const s = timeToMinutes(slot.start);
  const e = timeToMinutes(slot.end);
  return s != null && e != null && e > s;
}

/** Normaliza um participante (co-proprietário ou convidado). */
export function normalizeParticipant(input = {}) {
  const athlete_id = str(input.athlete_id);
  const status = Object.values(PARTICIPANT_STATUS).includes(str(input.status))
    ? str(input.status) : PARTICIPANT_STATUS.INVITED;
  const slot = input.slot && validSubSlot(input.slot)
    ? { start: str(input.slot.start), end: str(input.slot.end) }
    : null;
  return {
    athlete_id: athlete_id || null,
    name: str(input.name).slice(0, 120),
    photo: str(input.photo) || null,
    status,
    slot,
    is_initiator: input.is_initiator === true,
    invited_by: str(input.invited_by) || null,
  };
}

/** Participantes que aceitaram (co-proprietários). */
export function acceptedParticipants(participants = []) {
  return (participants || []).filter((p) => p.status === PARTICIPANT_STATUS.ACCEPTED);
}

/** ids dos co-proprietários (aceitos + com athlete_id). */
export function ownerIds(participants = []) {
  return acceptedParticipants(participants).map((p) => p.athlete_id).filter(Boolean);
}

/** ids dos convidados pendentes. */
export function invitedIds(participants = []) {
  return (participants || [])
    .filter((p) => p.status === PARTICIPANT_STATUS.INVITED && p.athlete_id)
    .map((p) => p.athlete_id);
}

/** Um usuário é co-proprietário (poderes plenos) da reserva? */
export function isOwner(booking = {}, uid) {
  if (!uid) return false;
  if (booking.athlete_id === uid) return true; // solicitante original
  return ownerIds(booking.participants).includes(uid);
}

/** Um usuário tem convite pendente nesta reserva? */
export function isInvited(booking = {}, uid) {
  return !!uid && invitedIds(booking.participants).includes(uid);
}

/** Contagem de vagas ocupadas (aceitos). */
export function occupiedCount(booking = {}) {
  return acceptedParticipants(booking.participants).length;
}

/** Reserva está cheia? (max_participants definido e atingido). */
export function isFull(booking = {}) {
  const max = Number(booking.max_participants);
  if (!Number.isFinite(max) || max <= 0) return false;
  return occupiedCount(booking) >= max;
}

/** Vagas restantes (ou null = ilimitado). */
export function remainingSlots(booking = {}) {
  const max = Number(booking.max_participants);
  if (!Number.isFinite(max) || max <= 0) return null;
  return Math.max(0, max - occupiedCount(booking));
}

/** Um usuário pode ingressar numa reserva aberta? */
export function canJoin(booking = {}, uid) {
  if (!uid) return false;
  if (!booking.open_join) return false;
  if (isOwner(booking, uid) || isInvited(booking, uid)) return false;
  if (isFull(booking)) return false;
  return true;
}

/**
 * Monta a lista de participantes a partir do solicitante e dos convidados.
 * @param {{athlete_id,name,photo?,slot?}} initiator
 * @param {Array<{athlete_id,name,photo?,slot?}>} invitees
 */
export function buildParticipants(initiator, invitees = []) {
  const list = [];
  if (initiator?.athlete_id) {
    list.push(normalizeParticipant({ ...initiator, status: PARTICIPANT_STATUS.ACCEPTED, is_initiator: true }));
  }
  (invitees || []).forEach((inv) => {
    if (!inv?.athlete_id || inv.athlete_id === initiator?.athlete_id) return;
    list.push(normalizeParticipant({ ...inv, status: PARTICIPANT_STATUS.INVITED, invited_by: initiator?.athlete_id || null }));
  });
  return dedupeParticipants(list);
}

/** Remove participantes duplicados por athlete_id (mantém o primeiro). */
export function dedupeParticipants(participants = []) {
  const seen = new Set();
  return (participants || []).filter((p) => {
    if (!p.athlete_id) return true;
    if (seen.has(p.athlete_id)) return false;
    seen.add(p.athlete_id);
    return true;
  });
}

/** Adiciona um convite (idempotente por athlete_id). */
export function addInvite(participants = [], invitee, invitedBy) {
  if (!invitee?.athlete_id) return participants;
  if ((participants || []).some((p) => p.athlete_id === invitee.athlete_id && p.status !== PARTICIPANT_STATUS.DECLINED)) {
    return participants;
  }
  return dedupeParticipants([
    ...(participants || []).filter((p) => p.athlete_id !== invitee.athlete_id),
    normalizeParticipant({ ...invitee, status: PARTICIPANT_STATUS.INVITED, invited_by: invitedBy || null }),
  ]);
}

/** Aceita o convite de um atleta (opcionalmente com sub-horário próprio). */
export function acceptInvite(participants = [], athleteId, slot = null) {
  return (participants || []).map((p) => (
    p.athlete_id === athleteId
      ? { ...p, status: PARTICIPANT_STATUS.ACCEPTED, slot: slot && validSubSlot(slot) ? { start: str(slot.start), end: str(slot.end) } : p.slot }
      : p
  ));
}

/** Recusa o convite de um atleta. */
export function declineInvite(participants = [], athleteId) {
  return (participants || []).map((p) => (
    p.athlete_id === athleteId ? { ...p, status: PARTICIPANT_STATUS.DECLINED } : p
  ));
}

/** Ingressa numa reserva aberta como co-proprietário. */
export function joinOpen(participants = [], athlete, slot = null) {
  if (!athlete?.athlete_id) return participants;
  if ((participants || []).some((p) => p.athlete_id === athlete.athlete_id && p.status === PARTICIPANT_STATUS.ACCEPTED)) {
    return participants;
  }
  return dedupeParticipants([
    ...(participants || []).filter((p) => p.athlete_id !== athlete.athlete_id),
    normalizeParticipant({ ...athlete, status: PARTICIPANT_STATUS.ACCEPTED, slot }),
  ]);
}

/** Remove um participante (sair da reserva). */
export function removeParticipant(participants = [], athleteId) {
  return (participants || []).filter((p) => p.athlete_id !== athleteId);
}

/** Remove um participante por índice (útil p/ responsáveis avulsos sem id). */
export function removeParticipantAt(participants = [], index) {
  return (participants || []).filter((_, i) => i !== index);
}

/**
 * Semeia a lista de participantes a partir do dono original da reserva, quando
 * ela ainda não é compartilhada. Assim, ao adicionar co-responsáveis a uma
 * reserva antiga (dono único), o dono vira o primeiro co-proprietário aceito.
 */
export function seedParticipantsFromOwner(booking = {}) {
  if (Array.isArray(booking.participants) && booking.participants.length > 0) {
    return booking.participants;
  }
  if (booking.athlete_id || str(booking.athlete_name)) {
    return [normalizeParticipant({
      athlete_id: booking.athlete_id || null,
      name: booking.athlete_name || '',
      photo: booking.athlete_photo || '',
      status: PARTICIPANT_STATUS.ACCEPTED,
      is_initiator: true,
    })];
  }
  return [];
}

/**
 * Adiciona um co-responsável avulso (sem conta na plataforma) já como aceito.
 * Não faz dedup por id (não há id). Ignora nome vazio.
 */
export function addManualParticipant(participants = [], name, invitedBy) {
  const nm = str(name);
  if (!nm) return participants;
  return [
    ...(participants || []),
    normalizeParticipant({
      athlete_id: null, name: nm, status: PARTICIPANT_STATUS.ACCEPTED, invited_by: invitedBy || null,
    }),
  ];
}

/** Sub-horário efetivo de um participante (o próprio ou a janela toda). */
export function effectiveSlot(participant, window) {
  return participant?.slot || window;
}

/**
 * Rateia o valor da quadra entre os participantes aceitos, minuto a minuto,
 * proporcional ao tempo de presença. Minutos sem ninguém são rateados entre
 * todos (a quadra ficou reservada). Garante que a soma feche com totalPrice.
 *
 * @param {{start,end}} window janela reservada
 * @param {Array} participants
 * @param {number|null} totalPrice preço total da quadra na janela
 * @returns {{ perParticipant: Record<string, number>, total: number, minutes: number }}
 */
export function computeSplit(window = {}, participants = [], totalPrice) {
  const ws = timeToMinutes(window.start);
  const we = timeToMinutes(window.end);
  const accepted = acceptedParticipants(participants).filter((p) => p.athlete_id);
  const price = Number(totalPrice);
  const empty = { perParticipant: {}, total: 0, minutes: 0 };
  if (ws == null || we == null || we <= ws || !Number.isFinite(price) || price < 0) return empty;
  if (accepted.length === 0) return { perParticipant: {}, total: price, minutes: we - ws };

  const totalMinutes = we - ws;
  const perMinute = price / totalMinutes;
  const acc = {};
  accepted.forEach((p) => { acc[p.athlete_id] = 0; });

  for (let m = ws; m < we; m += 1) {
    const present = accepted.filter((p) => {
      const s = effectiveSlot(p, window);
      const ps = timeToMinutes(s.start);
      const pe = timeToMinutes(s.end);
      if (ps == null || pe == null) return true; // sem sub-horário = janela toda
      return m >= ps && m < pe;
    });
    const share = present.length > 0 ? present : accepted; // minuto vazio: todos
    const cost = perMinute / share.length;
    share.forEach((p) => { acc[p.athlete_id] += cost; });
  }

  // Arredonda para centavos preservando o total.
  const rounded = {};
  Object.entries(acc).forEach(([id, v]) => { rounded[id] = Math.round(v * 100) / 100; });
  return { perParticipant: rounded, total: price, minutes: totalMinutes };
}

/** Rótulo de status do participante. */
export function participantStatusLabel(status) {
  return PARTICIPANT_STATUS_LABELS[status] || status;
}
