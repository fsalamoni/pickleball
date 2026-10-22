/**
 * SELEÇÃO E EDITAIS (Bloco 3) — leituras e chamadas. As quatro coleções só o
 * SERVIDOR grava (`federationSelection`); a régua pura é `domain/selection.js`.
 * As consultas filtram pelo campo que a regra confere (`federation_id` para a
 * equipe; `status in […]` para o público; `user_id` para a pessoa).
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, storage } from '@/core/config/firebase';
import { t } from '@/core/i18n';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { documentStoragePath, validateDocumentFile } from '../domain/privateData.js';
import { CALLUP_PUBLIC_STATUSES, GRANT_PUBLIC_STATUSES } from '../domain/selection.js';
import { chamar } from './federationService.js';

// As da PESSOA moram no serviço geral: a exportação (LGPD) as lê de lá.
export { listMyCallupInvites, listMyGrantApplications } from './federationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });
const lista = async (q) => (await getDocs(q)).docs.map(toDoc);
const recentes = (a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0);

/** Uma ação do servidor (`callup_*`, `grant_*`). */
export const selectionAction = (federationId, action, payload = {}) => chamar('federationSelection', { ...payload, federationId, action });

const um = async (col, id) => {
  if (!id) return null;
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? toDoc(snap) : null;
};
/** Uma convocação / um edital publicado (ou da equipe). `null` = não existe ou ainda é rascunho de outra pessoa. */
export const getCallup = (id) => um(C.callups, id);
export const getGrant = (id) => um(C.grants, id);

/* ---- convocações ---- */
export async function listCallups(fedId) {
  return (await lista(query(collection(db, C.callups), where('federation_id', '==', fedId)))).sort(recentes);
}
export async function listPublicCallups(fedId) {
  return (await lista(query(collection(db, C.callups), where('federation_id', '==', fedId), where('status', 'in', [...CALLUP_PUBLIC_STATUSES])))).sort(recentes);
}
export async function listCallupMembers(fedId, callupId) {
  return lista(query(collection(db, C.callupMembers), where('federation_id', '==', fedId), where('callup_id', '==', callupId)));
}
/* ---- editais ---- */
export async function listGrants(fedId) {
  return (await lista(query(collection(db, C.grants), where('federation_id', '==', fedId)))).sort(recentes);
}
export async function listPublicGrants(fedId) {
  return (await lista(query(collection(db, C.grants), where('federation_id', '==', fedId), where('status', 'in', [...GRANT_PUBLIC_STATUSES])))).sort(recentes);
}
export async function listGrantApplications(fedId, grantId) {
  return (await lista(query(collection(db, C.grantApplications), where('federation_id', '==', fedId), where('grant_id', '==', grantId))))
    .sort((a, b) => String(a.user_name || '').localeCompare(String(b.user_name || ''), 'pt-BR'));
}
/** Um arquivo da inscrição (a pessoa ou a equipe), pela mesma porta dos documentos. */
export const openGrantFile = (applicationId, fileKey) => chamar('federationDocument', { applicationId, fileKey });

/**
 * Sobe os arquivos da inscrição para a pasta de QUEM se inscreve (só ele lê no
 * Storage) e devolve `{ chave: { path, name, content_type, size } }` para o
 * `grant_apply`. Arquivo já enviado (sem `File`) passa como está.
 */
export async function uploadGrantFiles(uid, arquivos = {}) {
  const out = {};
  for (const [key, f] of Object.entries(arquivos)) {
    if (!f) continue;
    if (!(f instanceof Blob)) { out[key] = f; continue; }
    const erro = validateDocumentFile(f);
    if (erro) throw new Error(erro);
    if (!storage || !uid) throw new Error(t('Firebase não está configurado neste ambiente.'));
    const path = documentStoragePath(uid, doc(collection(db, C.grantApplications)).id, f.type);
    // eslint-disable-next-line no-await-in-loop
    await uploadBytes(storageRef(storage, path), f, { contentType: f.type });
    out[key] = { path, name: String(f.name || '').slice(0, 120), content_type: f.type, size: Number(f.size) || 0 };
  }
  return out;
}
