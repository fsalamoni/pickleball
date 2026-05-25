import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';

export const AUDIT_ACTION_LABELS = {
  user_profile_updated: 'Perfil atualizado',
  pool_created: 'Bolão criado',
  pool_updated: 'Bolão atualizado',
  participation_info_updated: 'Informações de participação atualizadas',
  payment_reported: 'Pagamento informado',
  payment_confirmed: 'Pagamento confirmado',
  bets_created: 'Palpites registrados',
  bets_updated: 'Palpites atualizados',
  special_bet_created: 'Palpite especial registrado',
  special_bet_updated: 'Palpite especial atualizado',
  pool_deleted: 'Bolão excluído',
};

export async function createAuditLog({
  action,
  actor,
  poolId = null,
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
      pool_id: poolId,
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
