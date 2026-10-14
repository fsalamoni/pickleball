/**
 * Denúncias de conteúdo (`training_reports`): qualquer conta denuncia, só o
 * admin vê a fila e resolve.
 */

import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { TrainingItemError } from './trainingItemService.js';
import { t, tk } from '@/core/i18n';

export const TRAINING_REPORTS = 'training_reports';
export const REPORT_REASONS = Object.freeze({
  impreciso: tk('Informação técnica errada'),
  perigoso: tk('Pode causar lesão'),
  ofensivo: tk('Ofensivo ou desrespeitoso'),
  spam: tk('Propaganda ou spam'),
  direitos: tk('Copiado sem permissão (direitos autorais)'),
  outro: tk('Outro motivo'),
});
export const REPORT_STATUS_LABELS = Object.freeze({ aberta: tk('Aberta'), resolvida: tk('Resolvida'), descartada: tk('Descartada') });

export async function createReport(item, { reason, text = '' }, { identity }) {
  if (!identity?.uid) throw new TrainingItemError(t('Entre na sua conta.'));
  if (!REPORT_REASONS[reason]) throw new TrainingItemError(t('Escolha o motivo.'));
  const ref = await addDoc(collection(db, TRAINING_REPORTS), {
    reporter_uid: identity.uid,
    item_id: item.id,
    item_title: String(item.title || '').slice(0, 120),
    item_author_uid: item.author_uid || null,
    reason,
    text: String(text ?? '').trim().slice(0, 500),
    status: 'aberta',
    created_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'training_report_created', actor: identity.actor, details: { report_id: ref.id, item_id: item.id, reason } });
  return ref.id;
}

/** As denúncias que a pessoa fez (pelo campo que a regra confere). Usado na exportação de dados. */
export async function listMyReports(uid) {
  if (!uid) return [];
  return (await getDocs(query(collection(db, TRAINING_REPORTS), where('reporter_uid', '==', uid))))
    .docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Fila do admin. ponytail: lê a coleção inteira; filtrar por status no servidor se crescer. */
export async function listReports() {
  return (await getDocs(collection(db, TRAINING_REPORTS))).docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Resolve ou descarta, com uma nota. */
export async function resolveReport(report, status, resolution, { identity }) {
  if (!identity?.isAdmin) throw new TrainingItemError(t('Só a equipe da plataforma resolve denúncias.'));
  if (!['resolvida', 'descartada', 'aberta'].includes(status)) throw new TrainingItemError(t('Situação inválida.'));
  await updateDoc(doc(db, TRAINING_REPORTS, report.id), {
    status,
    resolution: String(resolution ?? '').trim().slice(0, 300),
    resolved_by: status === 'aberta' ? null : identity.uid,
    resolved_at: status === 'aberta' ? null : serverTimestamp(),
  });
  await createAuditLog({ action: 'training_report_resolved', actor: identity.actor, details: { report_id: report.id, item_id: report.item_id, status } });
}

/** Apaga a denúncia (só o admin; a regra confere) — e fica na auditoria. */
export async function deleteReport(report, { identity } = {}) {
  await deleteDoc(doc(db, TRAINING_REPORTS, report.id));
  await createAuditLog({ action: 'training_report_deleted', actor: identity?.actor, details: { report_id: report.id, item_id: report.item_id, reason: report.reason } });
}
