/**
 * Unificar o histórico de uma conta excluída — leitura da auditoria e a
 * chamada ao servidor (`adminMergeAccountHistory`, `functions/accountMerge.js`).
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/core/config/firebase';
import { deletionErrorMessage } from './accountDeletionService';

const NOME_DA_FUNCAO = 'adminMergeAccountHistory';

/**
 * As entradas da auditoria que dizem quem foi excluído e quem já foi
 * unificado. Só o admin lê `audit_logs` (a regra recusa os demais). Uma
 * consulta só, por igualdade em lista — sem índice composto.
 */
export async function listAccountLifecycleLogs() {
  if (!db) return [];
  const snap = await getDocs(query(
    collection(db, 'audit_logs'),
    where('action', 'in', ['admin_account_deleted', 'admin_account_history_merged']),
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function chamar(payload) {
  if (!functions) throw new Error('Firebase não está configurado neste ambiente.');
  const fn = httpsCallable(functions, NOME_DA_FUNCAO, { timeout: 540_000 });
  try {
    const { data } = await fn(payload);
    return data;
  } catch (err) {
    const e = new Error(deletionErrorMessage(err).replace('A exclusão roda', 'A unificação roda'));
    e.code = err?.code;
    throw e;
  }
}

/** Só LÊ: o que mudaria, quem era a conta excluída, e se há conflito. */
export function previewAccountMerge(fromUid, intoUid) {
  return chamar({ mode: 'preview', fromUid, intoUid });
}

/** Executa. O servidor refaz a análise antes de gravar. */
export function mergeAccountHistory(fromUid, intoUid, { reason, confirm }) {
  return chamar({ mode: 'execute', fromUid, intoUid, reason, confirm });
}
