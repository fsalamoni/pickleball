/**
 * REGULARIDADE DA PRÓPRIA FEDERAÇÃO (rodada 3, Bloco 2) — leituras e
 * chamadas. As duas coleções só o SERVIDOR grava (`federationInstitutional`);
 * a régua pura é `domain/institutional.js`. As consultas filtram por
 * `federation_id` (o campo que a regra confere). O arquivo da certidão sobe
 * pela pasta das contas (`uploadAccountFile`) e o servidor o guarda fechado.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { chamar } from './federationService.js';

const lista = async (col, fedId) => (await getDocs(query(collection(db, col), where('federation_id', '==', fedId)))).docs.map((d) => ({ id: d.id, ...d.data() }));

/** Uma ação do servidor (`cert_*`, `project_*`). */
export const institutionalAction = (federationId, action, payload = {}) => chamar('federationInstitutional', { ...payload, federationId, action }, { timeout: 120_000 });

export async function listCertificates(fedId) {
  return (await lista(C.certificates, fedId)).sort((a, b) => String(b.valid_until || '').localeCompare(String(a.valid_until || '')));
}
export async function listIncentiveProjects(fedId) {
  return (await lista(C.incentiveProjects, fedId)).sort((a, b) => Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0));
}
