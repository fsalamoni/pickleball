/**
 * JOGO LIMPO (rodada 3, Bloco 1) — leituras e chamadas. A lista de
 * equipamentos só o SERVIDOR grava (`federationIntegrity`); a consulta filtra
 * por `federation_id` (o campo que a regra confere). O texto da antidopagem é
 * campo da federação, gravado pelo admin (`federations.antidoping`).
 */
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { t } from '@/core/i18n';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { validateAntidoping } from '../domain/integrity.js';
import { chamar, FederationError } from './federationService.js';

/** Uma ação do servidor (`equipment_save`, `equipment_status`, `equipment_delete`). */
export const integrityAction = (federationId, action, payload = {}) => chamar('federationIntegrity', { ...payload, federationId, action });

export async function listEquipment(fedId) {
  if (!fedId) return [];
  return (await getDocs(query(collection(db, C.equipment), where('federation_id', '==', fedId)))).docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** O texto, o contato e os links da antidopagem na página — permissão `admin`. */
export async function updateFederationAntidoping(id, input, { uid } = {}) {
  const r = validateAntidoping(input);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  await updateDoc(doc(db, C.federations, id), { antidoping: r.value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_antidoping_update', actor: { uid }, details: { federation_id: id, links: r.value.links.length } });
  return r.value;
}
