/**
 * Serviço de consentimento aos documentos legais (flag legal_center).
 *
 * Coleção `legal_consents/{uid_docKey}` (id determinístico) — 1 registro por
 * usuário × documento, guardando a última versão aceita. O histórico auditável
 * fica em `audit_logs`.
 */

import {
  collection, doc, getDocs, setDoc, query, where, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { consentDocId } from '../domain/consent.js';
import { t } from '@/core/i18n';

const COL = 'legal_consents';

/** Lista os consentimentos do usuário (para montar o consentMap). */
export async function listMyConsents(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, COL), where('user_id', '==', uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** O registro de aceite de um documento (o mesmo no aceite avulso e no em lote). */
function consentRecord(actor, docMeta) {
  if (!actor?.uid) throw new Error(t('É preciso estar autenticado.'));
  if (!docMeta?.key) throw new Error(t('Documento inválido.'));
  const id = consentDocId(actor.uid, docMeta.key);
  return {
    id,
    user_id: actor.uid,
    doc_key: docMeta.key,
    version: Number(docMeta.version || 1),
    doc_title: docMeta.title || docMeta.key,
    user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) ? String(navigator.userAgent).slice(0, 300) : null,
    accepted_at: serverTimestamp(),
    accepted_at_ms: Date.now(),
  };
}

function auditConsent(actor, record) {
  return createAuditLog({
    action: 'legal_consent_accepted',
    actor,
    details: { doc_key: record.doc_key, version: record.version },
  });
}

/**
 * Registra (ou atualiza) o aceite de UM documento na versão informada.
 * @param {object} actor - usuário autenticado (.uid)
 * @param {{ key: string, version: number, title?: string }} docMeta
 */
export async function recordConsent(actor, docMeta) {
  const record = consentRecord(actor, docMeta);
  await setDoc(doc(db, COL, record.id), record);
  await auditConsent(actor, record);
  return record.id;
}

/**
 * Registra o aceite de VÁRIOS documentos (os avisos de aceite) numa escrita só.
 * Antes eram duas idas ao servidor por documento, uma depois da outra: no
 * celular com rede fraca o botão ficava minutos em "Registrando…" e parecia
 * travado. A trilha de auditoria segue best-effort e não segura o aceite.
 * Devolve os registros gravados (o hook os põe no cache e o aviso fecha na hora).
 */
export async function recordConsents(actor, docsMeta) {
  const records = (docsMeta || []).map((meta) => consentRecord(actor, meta));
  if (records.length === 0) return [];
  const batch = writeBatch(db);
  records.forEach((r) => batch.set(doc(db, COL, r.id), r));
  await batch.commit();
  records.forEach((r) => { auditConsent(actor, r); });
  return records;
}
