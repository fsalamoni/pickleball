/**
 * Validação pura do arquivamento e desarquivamento de torneios.
 *
 * Lógica testável sem Firestore, usada por `tournamentService` antes do
 * `updateDoc`. A Firestore rule de `tournaments/{tid}` reforça a mesma
 * invariante no servidor (campo `archived` só pode ir para `true` se o
 * status atual for `cancelled`).
 *
 * Mantida em `domain/` porque é pura e determinística.
 */

import { TOURNAMENT_STATUS } from './constants.js';

/**
 * @param {object|null|undefined} tournament — doc do torneio (precisa ter
 *   `status` e opcionalmente `archived`).
 * @returns {{ ok: true } | { ok: false, reason: string, code: string }}
 */
export function validateArchiveRequest(tournament) {
  if (!tournament) {
    return { ok: false, reason: 'Torneio não encontrado.', code: 'NOT_FOUND' };
  }
  if (tournament.archived) {
    return { ok: false, reason: 'Torneio já está arquivado.', code: 'ALREADY_ARCHIVED' };
  }
  if (tournament.status !== TOURNAMENT_STATUS.CANCELLED) {
    return {
      ok: false,
      reason:
        'Para arquivar, o torneio precisa estar cancelado. '
        + 'Cancele o torneio primeiro (status → "Cancelado") e só depois arquive.',
      code: 'NOT_CANCELLED',
    };
  }
  return { ok: true };
}

/**
 * @param {object|null|undefined} tournament
 * @returns {{ ok: true } | { ok: false, reason: string, code: string }}
 */
export function validateUnarchiveRequest(tournament) {
  if (!tournament) {
    return { ok: false, reason: 'Torneio não encontrado.', code: 'NOT_FOUND' };
  }
  if (!tournament.archived) {
    return { ok: false, reason: 'Torneio não está arquivado.', code: 'NOT_ARCHIVED' };
  }
  return { ok: true };
}
