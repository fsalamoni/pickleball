/**
 * Domínio puro de reserva instantânea.
 *
 * Sprint 2 (ARE-03) do roadmap arena — `docs/arena-roadmap.md`.
 *
 * Reserva "instantânea" pula a negociação: ao invés do manager aceitar
 * manualmente (status REQUESTED), o sistema confirma direto (status
 * CONFIRMED) desde que:
 * - O preço proposto é > 0
 * - A arena permite reserva instantânea (arena.allow_instant_booking)
 * - O slot é válido (formato) e tem horário disponível (via schedules)
 * - Não há conflito com reservas ativas
 *
 * Decisões:
 * - `is_instant: true` é gravado no booking pra audit/reporting
 * - Status inicial muda pra CONFIRMED (em vez de REQUESTED)
 * - `payment_method` é obrigatório (instant sempre tem que pagar)
 * - Mantém compatibilidade com reserva normal (is_instant: false)
 * - `instant_eligible: bool` no arena indica se a arena optou por permitir
 */

import { BOOKING_STATUS } from './constants.js';
import { PAYMENT_METHOD } from './pdv.js';
import { isValidSlot } from './booking.js';
import { validateBookingRequest } from './booking_conflict.js';

/**
 * Verifica se um slot candidato pode ser reservado instantaneamente.
 * @param {Object} input - { date, start_time, end_time, court_id, proposed_price, payment_method }
 * @param {Object} arena - arena com allow_instant_booking
 * @param {Array} existingBookings - pra checar conflito
 * @param {Array} courtSchedules - pra checar alinhamento
 * @returns {{ ok: boolean, reason?: string, message?: string }}
 */
export function canBeInstantBooking({ date, start_time, end_time, court_id, proposed_price, payment_method } = {}, arena = {}, existingBookings = [], courtSchedules = []) {
  // 1. Arena permite?
  if (arena.allow_instant_booking !== true) {
    return { ok: false, reason: 'arena_disabled', message: 'Esta arena não aceita reservas instantâneas.' };
  }
  // 2. Slot válido (formato)
  const slot = { date, start: start_time, end: end_time };
  if (!isValidSlot(slot)) {
    return { ok: false, reason: 'invalid_slot', message: 'Horário inválido.' };
  }
  // 3. Preço proposto > 0 (instant não pode ser grátis)
  const price = Number(proposed_price);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, reason: 'no_price', message: 'Reserva instantânea requer valor definido (> 0).' };
  }
  // 4. Payment method obrigatório e válido
  if (!Object.values(PAYMENT_METHOD).includes(payment_method)) {
    return { ok: false, reason: 'no_payment_method', message: 'Escolha um método de pagamento (PIX, cartão, etc).' };
  }
  // 5. Slot está dentro de uma janela de schedule + sem conflito
  const v = validateBookingRequest({
    date,
    start_time,
    end_time,
    court_id,
    existingBookings,
    court_schedules: courtSchedules,
  });
  if (!v.ok) {
    return { ok: false, reason: v.reason, message: v.message };
  }
  return { ok: true };
}

/**
 * Determina o status inicial de um booking baseado no `is_instant`.
 * @param {boolean} isInstant
 * @returns {string} status inicial
 */
export function getInitialBookingStatus(isInstant) {
  return isInstant ? BOOKING_STATUS.CONFIRMED : BOOKING_STATUS.REQUESTED;
}

/** Labels de UI para o toggle. */
export const INSTANT_BOOKING_LABELS = Object.freeze({
  TITLE: 'Como você quer reservar?',
  REQUEST: {
    key: 'request',
    title: 'Solicitar reserva',
    description: 'A arena confirma o valor. Pode levar horas/dias para responder.',
  },
  INSTANT: {
    key: 'instant',
    title: 'Reserva instantânea',
    description: 'Confirmada na hora, sem esperar. Requer pagamento adiantado.',
  },
});

/** Verifica se arena está habilitada pra instant booking. */
export function arenaSupportsInstant(arena) {
  return arena?.allow_instant_booking === true;
}
