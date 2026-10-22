/**
 * REGULARIDADE do filiado — leituras e chamadas. O nível oficial, os
 * consentimentos e as ocorrências são escritos só pelo SERVIDOR
 * (`federationRegularity`); a apólice do seguro é da federação (o admin grava
 * no documento dela). A régua pura é `domain/regularity.js`.
 */
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { validateInsurance } from '../domain/regularity.js';
import { FederationError, chamar } from './federationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });
const recentes = (xs) => xs.sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));

/** Uma ação do servidor: `level_set`, `level_review`, `level_review_decide`, `consents`, `incident_create`, `incident_update`. */
export const regularityAction = (federationId, action, payload = {}) => chamar('federationRegularity', { ...payload, federationId, action });

/** As ocorrências de uma federação (equipe que atende). */
export async function listFederationIncidents(fedId) {
  return recentes((await getDocs(query(collection(db, C.incidents), where('federation_id', '==', fedId)))).docs.map(toDoc));
}

/** As ocorrências da pessoa (e dos dependentes) moram no serviço geral: a exportação da conta as lê de lá. */
export { listMyIncidents } from './federationService.js';

/** A apólice do seguro esportivo (permissão `admin`). `null` apaga o cadastro. */
export async function updateFederationInsurance(fedId, input, { uid } = {}) {
  let value = null;
  if (input) {
    const r = validateInsurance(input);
    if (!r.ok) throw new FederationError(Object.values(r.errors)[0], r.errors);
    value = r.value;
  }
  await updateDoc(doc(db, C.federations, fedId), { insurance: value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_insurance_update', actor: { uid }, details: { federation_id: fedId, insurer: value?.insurer || null, valid_until: value?.valid_until || null } });
  return value;
}
