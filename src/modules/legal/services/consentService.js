/**
 * Serviço de consentimento aos documentos legais (flag legal_center).
 *
 * Coleção `legal_consents/{uid_docKey}` (id determinístico) — 1 registro por
 * usuário × documento, guardando a última versão aceita. O histórico auditável
 * fica em `audit_logs`.
 */

import {
  collection, doc, getDocs, setDoc, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { consentDocId } from '../domain/consent.js';

const COL = 'legal_consents';

/** Lista os consentimentos do usuário (para montar o consentMap). */
export async function listMyConsents(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, COL), where('user_id', '==', uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Registra (ou atualiza) o aceite de UM documento na versão informada.
 * @param {object} actor - usuário autenticado (.uid)
 * @param {{ key: string, version: number, title?: string }} docMeta
 */
export async function recordConsent(actor, docMeta) {
  if (!actor?.uid) throw new Error('É preciso estar autenticado.');
  if (!docMeta?.key) throw new Error('Documento inválido.');
  const id = consentDocId(actor.uid, docMeta.key);
  await setDoc(doc(db, COL, id), {
    id,
    user_id: actor.uid,
    doc_key: docMeta.key,
    version: Number(docMeta.version || 1),
    doc_title: docMeta.title || docMeta.key,
    user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) ? String(navigator.userAgent).slice(0, 300) : null,
    accepted_at: serverTimestamp(),
    accepted_at_ms: Date.now(),
  });
  await createAuditLog({
    action: 'legal_consent_accepted',
    actor,
    details: { doc_key: docMeta.key, version: Number(docMeta.version || 1) },
  });
  return id;
}

/** Registra o aceite de VÁRIOS documentos (portão de consentimento). */
export async function recordConsents(actor, docsMeta) {
  const ids = [];
  for (const meta of docsMeta || []) {
    // eslint-disable-next-line no-await-in-loop
    ids.push(await recordConsent(actor, meta));
  }
  return ids;
}
