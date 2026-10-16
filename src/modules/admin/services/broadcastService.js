/** Aviso em massa: grava os avisos (lotes) e audita quantos foram de fato gravados. */
import { notifyUsers } from '@/core/services/notificationService';
import { createAuditLog } from '@/core/services/auditService';

/**
 * `broadcast`: { kind: 'servico'|'novidade', channels: ['email'|'whatsapp'|'sms'] }
 * — por onde o aviso PODE sair além do sino (avisos por e-mail e celular).
 * Vai sempre: sem ele, o servidor trataria o aviso em massa como um aviso
 * comum e seguiria as escolhas de cada pessoa. Lista vazia = só o sino.
 */
export async function sendAdminBroadcast({ title, message, link, audience, detail, recipients, actor, broadcast }) {
  const massa = { kind: broadcast?.kind === 'novidade' ? 'novidade' : 'servico', channels: broadcast?.channels || [] };
  const sent = await notifyUsers(recipients, { title, message, link: link || null, actor, broadcast: massa });
  await createAuditLog({
    action: 'admin_broadcast_sent',
    actor,
    details: { title, audience, detail: detail || null, link: link || null, requested: recipients.length, sent, kind: massa.kind, channels: massa.channels },
  });
  return { sent, requested: recipients.length };
}
