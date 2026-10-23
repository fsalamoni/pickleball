/**
 * SEGURO: TERMO E CERTIFICADO (rodada 3, Bloco 5) — leituras e chamadas. O
 * aceite do termo e o certificado só o SERVIDOR grava (`federationInsurance`);
 * a régua pura é `domain/insurance.js`. A equipe consulta por `federation_id`
 * e quem gere a organização por `kind` + `org_id` (os campos que a regra confere).
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { chamar } from './federationService.js';

const recentes = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(b.updated_at_ms || 0) - Number(a.updated_at_ms || 0));

/** Uma ação do servidor (`term_accept`, `cert_request`, `cert_withdraw`, `cert_issue`, `cert_decline`, `cert_cancel`). */
export const insuranceAction = (federationId, action, payload = {}) => chamar('federationInsurance', { ...payload, federationId, action });

export const listInsuranceCertificates = async (fedId) => recentes(await getDocs(query(collection(db, C.insuranceCertificates), where('federation_id', '==', fedId))));

/** Os certificados de UMA organização, em todas as federações (quem a gere). */
export async function listOrgInsuranceCertificates(kind, orgId) {
  if (!kind || !orgId) return [];
  return recentes(await getDocs(query(collection(db, C.insuranceCertificates), where('kind', '==', kind), where('org_id', '==', orgId))));
}
