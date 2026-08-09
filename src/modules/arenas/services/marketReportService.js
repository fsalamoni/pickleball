/**
 * Serviço dos RELATÓRIOS do mercado (flag arena_market_reports).
 *
 * Coleção `arena_market_reports/{arenaId_periodType_periodKey}` — snapshot
 * "fechado" de um período, que fica na gestão financeira da arena. O relatório
 * ao vivo é calculado no cliente (buildAutoReport) a partir de entradas/saídas;
 * ao FECHAR, o snapshot é gravado aqui. Editar/excluir linhas mexe só neste
 * snapshot — os registros de entrada/saída permanecem intactos.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { ARENA_COLLECTIONS } from '../domain/constants.js';
import { reportDocId, computeReportTotals, REPORT_STATUS } from '../domain/marketReports.js';

const COL = ARENA_COLLECTIONS.market_reports;

/** Snapshots salvos da arena (ordenados por período desc, em memória). */
export async function listSavedReports(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.period_key || '').localeCompare(String(a.period_key || '')));
}

/** Um snapshot específico (ou null). */
export async function getSavedReport(arenaId, periodType, periodKey) {
  if (!db || !arenaId) return null;
  const ref = doc(db, COL, reportDocId(arenaId, periodType, periodKey));
  const s = await getDoc(ref);
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/**
 * Fecha/salva (ou re-gera) o snapshot de um período a partir do relatório
 * automático calculado no cliente. Sobrescreve o snapshot pelo automático —
 * usado ao fechar o período ou ao "regerar do zero".
 */
export async function saveReportSnapshot(arenaId, report, actor) {
  if (!db || !arenaId || !report) throw new Error('Dados inválidos.');
  const id = reportDocId(arenaId, report.period_type, report.period_key);
  const payload = {
    arena_id: arenaId,
    period_type: report.period_type,
    period_key: report.period_key,
    period_start: report.period_start,
    period_end: report.period_end,
    label: report.label,
    lines: report.lines || [],
    totals: report.totals || computeReportTotals(report.lines || []),
    status: report.status || REPORT_STATUS.CLOSED,
    edited: false,
    generated_at: serverTimestamp(),
    generated_by: actor?.uid || null,
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL, id), payload, { merge: false });
  await createAuditLog({
    action: 'arena_market_report_saved', actor,
    details: { arena_id: arenaId, period: report.period_key, result: payload.totals.result },
  }).catch(() => {});
  return { id };
}

/**
 * Salva EDIÇÕES manuais do snapshot (linhas alteradas/excluídas/adicionadas).
 * Marca `edited: true` — a UI avisa que o automático reflete o que foi feito na
 * plataforma. Não toca nos registros de entrada/saída.
 */
export async function saveReportEdits(arenaId, id, lines, actor, { note } = {}) {
  if (!db || !arenaId || !id) throw new Error('Relatório inválido.');
  const ref = doc(db, COL, id);
  await setDoc(ref, {
    lines,
    totals: computeReportTotals(lines),
    edited: true,
    note: note || '',
    updated_at: serverTimestamp(),
    updated_by: actor?.uid || null,
  }, { merge: true });
  await createAuditLog({ action: 'arena_market_report_edited', actor, details: { arena_id: arenaId, id } }).catch(() => {});
}

/** Exclui um snapshot salvo (não afeta entradas/saídas). */
export async function deleteSavedReport(arenaId, id, actor) {
  if (!db || !id) throw new Error('Relatório inválido.');
  await deleteDoc(doc(db, COL, id));
  await createAuditLog({ action: 'arena_market_report_deleted', actor, details: { arena_id: arenaId, id } }).catch(() => {});
}
