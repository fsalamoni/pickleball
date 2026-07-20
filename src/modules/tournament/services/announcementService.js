/**
 * Avisos do organizador aos inscritos (flag tournament_announcements).
 *
 * Envia a notificação in-app para todos os destinatários e registra o aviso
 * em `tournament_announcements` (histórico do torneio) + audit log.
 */

import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { validateAnnouncement } from '../domain/announcements.js';

const COL = 'tournament_announcements';

/**
 * @param {{
 *   tournament: { id: string, name?: string },
 *   modalityId?: string|null,
 *   modalityName?: string|null,
 *   title: string,
 *   message: string,
 *   recipients: string[],
 * }} input
 * @param {object} actor
 */
export async function sendTournamentAnnouncement(input, actor) {
  const { tournament, modalityId = null, modalityName = null, title, message, recipients = [] } = input;
  const validation = validateAnnouncement({ title, message });
  if (!validation.isValid) throw new Error(Object.values(validation.errors)[0]);
  if (recipients.length === 0) {
    throw new Error('Nenhum destinatário com conta vinculada para receber o aviso.');
  }

  await notifyUsers(recipients, {
    title: `Aviso do torneio: ${String(title).trim()}`,
    message: String(message).trim(),
    type: NOTIFICATION_TYPE.TOURNAMENT_ANNOUNCEMENT,
    link: `/torneios/${tournament.id}`,
    actor,
  });

  await addDoc(collection(db, COL), {
    tournament_id: tournament.id,
    modality_id: modalityId,
    modality_name: modalityName,
    title: String(title).trim().slice(0, 140),
    message: String(message).trim().slice(0, 1000),
    recipients_count: recipients.length,
    created_by: actor?.uid || null,
    created_by_name: actor?.displayName || null,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  });

  await createAuditLog({
    action: 'tournament_announcement_sent',
    actor,
    details: { tournament_id: tournament.id, modality_id: modalityId, recipients: recipients.length },
  });
}

/** Histórico de avisos do torneio (mais recentes primeiro). */
export async function listTournamentAnnouncements(tournamentId) {
  const snap = await getDocs(query(collection(db, COL), where('tournament_id', '==', tournamentId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
}
