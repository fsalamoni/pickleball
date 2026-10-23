/**
 * REDE E DESENVOLVIMENTO (rodada 3, Bloco 3) — leituras e chamadas. As duas
 * coleções só o SERVIDOR grava (`federationDevelopment`); a régua pura é
 * `domain/development.js`. Cada consulta filtra pelo campo que a regra
 * confere: `federation_id` (equipe), `user_id` (a pessoa) e `kind` + `org_id`
 * (quem gere o clube ou a arena). As evidências do selo sobem para a pasta de
 * quem envia (`federacao/{uid}/`), como os arquivos dos editais. As REGRAS dos
 * dois programas são campos da federação, gravados pelo admin.
 */
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { t } from '@/core/i18n';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { ambassadorRulesToSave, validateSealRules } from '../domain/development.js';
import { chamar, FederationError } from './federationService.js';
import { uploadGrantFiles } from './selectionService.js';

// A da PESSOA mora no serviço geral: a exportação (LGPD) a lê de lá.
export { listMyAmbassadorships } from './federationService.js';

const lista = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
const recentes = (xs) => xs.sort((a, b) => Number(b.updated_at_ms || 0) - Number(a.updated_at_ms || 0));

/** Uma ação do servidor (`amb_*`, `seal_*`). */
export const developmentAction = (federationId, action, payload = {}) => chamar('federationDevelopment', { ...payload, federationId, action }, { timeout: 120_000 });

export const listAmbassadors = async (fedId) => recentes(await lista(query(collection(db, C.ambassadors), where('federation_id', '==', fedId))));
export const listClubSeals = async (fedId) => recentes(await lista(query(collection(db, C.clubSeals), where('federation_id', '==', fedId))));

/** Os pedidos de selo de UMA organização, em todas as federações (quem a gere). */
export async function listOrgSeals(kind, orgId) {
  if (!kind || !orgId) return [];
  return lista(query(collection(db, C.clubSeals), where('kind', '==', kind), where('org_id', '==', orgId)));
}

/** Sobe os arquivos das evidências (`{ criterio: File }`) e devolve `{ criterio: { path, name } }`. */
export const uploadSealFiles = (uid, arquivos = {}) => uploadGrantFiles(uid, arquivos);

/** As regras do programa de embaixadores (`federations.ambassador_rules`) — permissão `admin`. */
export async function saveAmbassadorRules(federation, input, { uid } = {}) {
  const value = ambassadorRulesToSave(input, federation.ambassador_rules);
  await updateDoc(doc(db, C.federations, federation.id), { ambassador_rules: value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_ambassador_rules_update', actor: { uid }, details: { federation_id: federation.id, conduct_version: value.conduct_version, open: value.open } });
  return value;
}

/** As regras do selo (`federations.club_seal`) — permissão `admin`. */
export async function saveSealRules(federationId, input, { uid } = {}) {
  const r = validateSealRules(input);
  if (!r.ok) throw new FederationError(t('Confira os campos destacados.'), r.errors);
  await updateDoc(doc(db, C.federations, federationId), { club_seal: r.value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'federation_seal_rules_update', actor: { uid }, details: { federation_id: federationId, criteria: r.value.criteria.length, open: r.value.open } });
  return r.value;
}
