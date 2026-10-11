/** Aviso em massa: grava os avisos (lotes) e audita quantos foram de fato gravados. */
import { notifyUsers } from '@/core/services/notificationService';
import { createAuditLog } from '@/core/services/auditService';

export async function sendAdminBroadcast({ title, message, link, audience, detail, recipients, actor }) {
  const sent = await notifyUsers(recipients, { title, message, link: link || null, actor });
  await createAuditLog({
    action: 'admin_broadcast_sent',
    actor,
    details: { title, audience, detail: detail || null, link: link || null, requested: recipients.length, sent },
  });
  return { sent, requested: recipients.length };
}
