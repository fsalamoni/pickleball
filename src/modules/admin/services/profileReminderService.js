/**
 * Pedido de completar o cadastro — o admin pede, pelo sino, que um recorte de
 * pessoas complete o que falta. O envio é o `notifyUsers` de sempre (lotes de
 * 400); a Auditoria guarda QUEM recebeu (um registro por lote de uids), e é
 * ela que a lista lê para dizer "pedido enviado em…" e não insistir. Zero
 * coleção nova.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { notifyUsers } from '@/core/services/notificationService';
import { createAuditLog } from '@/core/services/auditService';
import { reminderAuditChunks } from '../domain/userRecordsView.js';

export const PROFILE_REMINDER_ACTION = 'admin_profile_reminder_sent';
export const PROFILE_REMINDER_LINK = '/perfil/editar';

/** Os registros dos pedidos já enviados (só o admin lê a Auditoria). */
export async function listProfileReminderLogs() {
  if (!db) return [];
  // ponytail: lê todos os pedidos de sempre (uma igualdade, sem índice); com
  // centenas de envios, recortar por data pede o índice action + created_at_ms.
  const snap = await getDocs(query(collection(db, 'audit_logs'), where('action', '==', PROFILE_REMINDER_ACTION)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Envia e registra. `context` descreve o recorte (filtros) para a Auditoria.
 * @returns {Promise<{ sent: number, requested: number }>}
 */
export async function sendProfileReminder({ title, message, uids, actor, broadcast, context }) {
  // Mesma limpeza do `notifyUsers` (sem repetidos, sem o próprio admin), feita
  // aqui para saber QUAIS uids receberam: ele grava na ordem, em lotes, e para
  // no primeiro lote que falhar.
  const lista = [...new Set((uids || []).map((u) => String(u || '').trim()).filter((u) => u && u !== actor?.uid))];
  const massa = { kind: 'servico', channels: broadcast?.channels || [] };
  const sent = await notifyUsers(lista, { title, message, link: PROFILE_REMINDER_LINK, actor, broadcast: massa });
  const recebidos = lista.slice(0, sent);
  const lotes = reminderAuditChunks(recebidos);
  const envio = `${Date.now()}`;
  await Promise.all(lotes.map((lote, i) => createAuditLog({
    action: PROFILE_REMINDER_ACTION,
    actor,
    details: {
      send_id: envio, part: i + 1, parts: lotes.length, uids: lote,
      requested: lista.length, sent, title, channels: massa.channels, context: context || null,
    },
  })));
  return { sent, requested: lista.length };
}
