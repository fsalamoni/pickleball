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

export const TRAINING_REPORTS = 'training_reports';
export const REPORT_REASONS = Object.freeze({
  impreciso: 'Informação técnica errada',
  perigoso: 'Pode causar lesão',
  ofensivo: 'Ofensivo ou desrespeitoso',
  spam: 'Propaganda ou spam',
  direitos: 'Copiado sem permissão (direitos autorais)',
  outro: 'Outro motivo',
});
export const REPORT_STATUS_LABELS = Object.freeze({ aberta: 'Aberta', resolvida: 'Resolvida', descartada: 'Descartada' });

export async function createReport(item, { reason, text = '' }, { identity }) {
  if (!identity?.uid) throw new TrainingItemError('Entre na sua conta.');
  if (!REPORT_REASONS[reason]) throw new TrainingItemError('Escolha o motivo.');
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
  if (!identity?.isAdmin) throw new TrainingItemError('Só a equipe da plataforma resolve denúncias.');
  if (!['resolvida', 'descartada', 'aberta'].includes(status)) throw new TrainingItemError('Situação inválida.');
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
