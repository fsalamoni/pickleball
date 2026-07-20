/**
 * Check-in do próprio atleta (flag athlete_self_checkin).
 *
 * Complementa o check-in feito pelo organizador (flag tournament_checkin):
 * quando o torneio está em andamento, o próprio inscrito confirma presença
 * com um toque. Puro — sem Firebase.
 */

import { REGISTRATION_STATUS, TOURNAMENT_STATUS } from './constants.js';

/**
 * O usuário pode fazer o self check-in desta inscrição?
 * Regras: torneio em andamento, inscrição confirmada (ainda sem check-in) e
 * o usuário é quem criou a inscrição ou o jogador A vinculado.
 */
export function canSelfCheckIn({ tournament, registration, uid } = {}) {
  if (!tournament || !registration || !uid) return false;
  if (tournament.status !== TOURNAMENT_STATUS.IN_PROGRESS) return false;
  if (registration.status !== REGISTRATION_STATUS.CONFIRMED) return false;
  return registration.created_by === uid || registration.player_a_user_id === uid;
}

/** A inscrição do usuário já está com check-in feito? */
export function hasCheckedIn(registration) {
  return registration?.status === REGISTRATION_STATUS.CHECKED_IN;
}
