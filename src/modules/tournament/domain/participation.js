/**
 * Lógica pura de agregação do histórico de participações do usuário.
 *
 * Recebe as inscrições já carregadas e os mapas de torneios/modalidades/ranking
 * e produz a estrutura agrupada por torneio usada no perfil. Sem I/O.
 */

import { REGISTRATION_STATUS } from './constants.js';

/** Timestamp comparável (ms) a partir de campos de data variados (Date, ISO, Firestore Timestamp). */
export function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const d = value.toDate();
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Nome do parceiro de dupla (o outro jogador), quando aplicável. */
export function partnerNameFor(reg, userId) {
  const isPlayerB = reg.player_b_user_id === userId;
  const isPlayerA = reg.player_a_user_id === userId || reg.user_id === userId;
  if (isPlayerB) return reg.player_a_name || null;
  if (isPlayerA) return reg.player_b_name || null;
  return reg.player_b_name || null;
}

/** Foto do parceiro de dupla (o outro jogador), quando aplicável. */
export function partnerPhotoFor(reg, userId) {
  const isPlayerB = reg.player_b_user_id === userId;
  const isPlayerA = reg.player_a_user_id === userId || reg.user_id === userId;
  if (isPlayerB) return reg.player_a_photo || null;
  if (isPlayerA) return reg.player_b_photo || null;
  return reg.player_b_photo || null;
}

function isInactiveStatus(status) {
  return status === REGISTRATION_STATUS.CANCELLED || status === REGISTRATION_STATUS.WITHDRAWN;
}

/** Da inscrição que mais "vale" para a que menos vale (para resumir várias). */
const ORDEM_DO_MEU_STATUS = [
  REGISTRATION_STATUS.CHECKED_IN,
  REGISTRATION_STATUS.CONFIRMED,
  REGISTRATION_STATUS.PENDING_PAYMENT,
  REGISTRATION_STATUS.WAITLIST,
];

/**
 * Resume as MINHAS inscrições num torneio: estou nele como jogador? Com que
 * status? (Várias modalidades ⇒ vale a que mais "vale": com check-in, depois
 * confirmada, depois pagamento pendente, depois lista de espera.)
 *
 * Cancelada e desistência não contam: quem saiu não está "inscrito". Inscrição
 * sem status conhecido conta como inscrição (é o caso conservador — melhor
 * mostrar o torneio do que escondê-lo).
 *
 * @param {Array<{ status?: string }>} registrations  as minhas, de um torneio
 * @returns {{ isPlayer: boolean, status: string|null }}
 */
export function summarizeMyRegistrations(registrations = []) {
  const valendo = (registrations || []).filter((r) => r && !isInactiveStatus(r.status));
  if (valendo.length === 0) return { isPlayer: false, status: null };
  const melhor = ORDEM_DO_MEU_STATUS.find((st) => valendo.some((r) => r.status === st));
  return { isPlayer: true, status: melhor || valendo[0].status || null };
}

/**
 * Monta o histórico agrupado por torneio.
 *
 * @param {Array<object>} registrations inscrições do usuário
 * @param {{
 *   userId: string,
 *   tournamentById: Map<string, object>,
 *   modalityById: Map<string, object>,
 *   rankingByModality: Map<string, Array<object>>,
 * }} ctx
 * @returns {Array<object>}
 */
export function buildParticipationHistory(registrations, ctx) {
  const { userId, tournamentById, modalityById, rankingByModality } = ctx;
  const groups = new Map();

  (registrations || []).forEach((reg) => {
    const tid = reg.tournament_id;
    if (!groups.has(tid)) {
      const tournament = tournamentById.get(tid) || null;
      groups.set(tid, {
        tournamentId: tid,
        tournament,
        startsAtMillis: toMillis(tournament?.starts_at) || toMillis(reg.created_at),
        entries: [],
      });
    }

    const ranking = rankingByModality.get(reg.modality_id) || [];
    const started = ranking.some((e) => (e.played || 0) > 0);
    const entry = ranking.find((e) => e.participant_id === reg.id) || null;

    groups.get(tid).entries.push({
      registration: reg,
      modality: modalityById.get(reg.modality_id) || null,
      partnerName: partnerNameFor(reg, userId),
      partnerPhoto: partnerPhotoFor(reg, userId),
      ranking:
        entry && started
          ? {
              position: entry.position,
              total: ranking.length,
              played: entry.played || 0,
              wins: entry.wins || 0,
              losses: entry.losses || 0,
              started: true,
            }
          : null,
    });
  });

  const result = Array.from(groups.values());
  result.forEach((g) => {
    g.entries.sort(
      (a, b) =>
        Number(isInactiveStatus(a.registration.status)) - Number(isInactiveStatus(b.registration.status)) ||
        (a.modality?.name || '').localeCompare(b.modality?.name || ''),
    );
  });
  result.sort(
    (a, b) =>
      b.startsAtMillis - a.startsAtMillis ||
      (a.tournament?.name || '').localeCompare(b.tournament?.name || ''),
  );
  return result;
}
