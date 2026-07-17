import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';

export const AUDIT_ACTION_LABELS = {
  user_profile_updated: 'Perfil atualizado',
  tournament_created: 'Torneio criado',
  tournament_updated: 'Torneio atualizado',
  tournament_status_changed: 'Status do torneio alterado',
  tournament_admin_added: 'Admin de torneio adicionado',
  tournament_admin_removed: 'Admin de torneio removido',
  modality_created: 'Modalidade criada',
  modality_updated: 'Modalidade atualizada',
  modality_deleted: 'Modalidade excluída',
  registration_created: 'Inscrição realizada',
  registration_updated: 'Inscrição atualizada',
  provisional_registrations_claimed: 'Inscrições provisórias vinculadas',
  registration_deleted: 'Inscrição removida',
  matches_generated: 'Jogos gerados (sorteio)',
  match_result_recorded: 'Resultado lançado',
  match_scheduled: 'Jogo agendado',
  match_deleted: 'Jogo excluído',
  club_created: 'Clube criado',
  club_updated: 'Clube atualizado',
  club_deleted: 'Clube excluído',
  club_invite_regenerated: 'Código de convite do clube renovado',
  club_member_joined: 'Ingressou no clube',
  club_member_left: 'Saiu do clube',
  club_member_removed: 'Membro removido do clube',
  club_admin_added: 'Admin de clube adicionado',
  club_admin_removed: 'Admin de clube removido',
  club_event_created: 'Evento de clube criado',
  club_event_updated: 'Evento de clube atualizado',
  club_event_deleted: 'Evento de clube excluído',
  club_post_deleted: 'Publicação do mural removida',
  platform_archive_tournament: 'Torneio arquivado (admin)',
  platform_unarchive_tournament: 'Torneio desarquivado (admin)',
  tournament_archived: 'Torneio arquivado',
  tournament_unarchived: 'Torneio desarquivado',
  athlete_profile_restored: 'Perfil de atleta restaurado pelo admin',
  registrations_bulk_removed: 'Inscrições provisórias removidas em massa',
  platform_owner_self_restored: 'Owner restaurou o próprio admin via rota de emergência',
  platform_delete_tournament: 'Torneio excluído (admin)',
  platform_feature_flag_changed: 'Feature flag alterada (admin)',
  tournament_groups_set: 'Grupos da fase definidos',
  tournament_phase_advanced: 'Fase avançada (classificados)',
};

export async function createAuditLog({
  action,
  actor,
  tournamentId = null,
  userId = null,
  userName = null,
  userEmail = null,
  details = {},
}) {
  if (!actor?.uid || !action) return;

  const actorName = actor.displayName || actor.email || actor.uid;
  const createdAtMs = Date.now();

  try {
    await addDoc(collection(db, 'audit_logs'), {
      log_number: Number(`${createdAtMs}${randomNumericSuffix()}`),
      action,
      action_label: AUDIT_ACTION_LABELS[action] || action,
      actor_id: actor.uid,
      actor_name: actorName,
      actor_email: actor.email || '',
      tournament_id: tournamentId || null,
      user_id: userId || actor.uid,
      user_name: userName || actorName,
      user_email: userEmail || actor.email || '',
      details,
      created_at_ms: createdAtMs,
      created_at: serverTimestamp(),
    });
  } catch (err) {
    logger.error('Audit log failed:', err);
  }
}

/**
 * Adds entropy to the millisecond timestamp so visible log numbers remain
 * unique when several records are created nearly simultaneously.
 */
function randomNumericSuffix() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint16Array(1);
    globalThis.crypto.getRandomValues(values);
    return String(values[0]).padStart(5, '0');
  }
  return String(performance.now()).replace(/\D/g, '').slice(-5).padStart(5, '0');
}

export function formatAuditDate(value, fallbackMs) {
  const date = toDate(value) || (fallbackMs ? new Date(fallbackMs) : null);
  if (!date) return '—';
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
