/**
 * CONTRATOS DE PATROCÍNIO e PATRIMÔNIO (Bloco 5) — leituras e chamadas. As
 * duas coleções só o SERVIDOR grava (`federationManagement`); a régua pura é
 * `domain/management.js`. As consultas filtram por `federation_id` (o campo
 * que a regra confere).
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { chamar } from './federationService.js';

const lista = async (col, fedId) => (await getDocs(query(collection(db, col), where('federation_id', '==', fedId)))).docs.map((d) => ({ id: d.id, ...d.data() }));

/** Uma ação do servidor (`contract_*`, `asset_*`). */
export const managementAction = (federationId, action, payload = {}) => chamar('federationManagement', { ...payload, federationId, action });

export async function listSponsorContracts(fedId) {
  return (await lista(C.sponsorContracts, fedId)).sort((a, b) => String(b.end || '').localeCompare(String(a.end || '')));
}
export async function listAssets(fedId) {
  return (await lista(C.assets, fedId)).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}
