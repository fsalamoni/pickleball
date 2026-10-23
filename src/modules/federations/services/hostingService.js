/**
 * SEDES E COPA (rodada 3, Bloco 3) — leituras e chamadas. As cinco coleções só
 * o SERVIDOR grava (`federationHosting`); a régua pura é `domain/hosting.js`.
 * Cada consulta filtra pelo campo que a regra confere: `federation_id` (a
 * equipe; o público junto com os estados publicados), `kind` + `org_id` (quem
 * gere o clube ou a arena) e `conf_id` (a confederação, no elenco da Copa). Os
 * arquivos da proposta sobem para a pasta de quem envia (`federacao/{uid}/`).
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { CUP_PUBLIC, HOST_BID_PUBLIC } from '../domain/hosting.js';
import { chamar } from './federationService.js';
import { uploadGrantFiles } from './selectionService.js';

// A da PESSOA mora no serviço geral: a exportação (LGPD) a lê de lá.
export { listMyCupTeams } from './federationService.js';

const lista = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
const recentes = (xs) => xs.sort((a, b) => Number(b.created_at_ms || 0) - Number(a.created_at_ms || 0));

/** Uma ação do servidor (`bid_*`, `entry_*`, `cup_*`, `team_*`). */
export const hostingAction = (federationId, action, payload = {}) => chamar('federationHosting', { ...payload, federationId, action }, { timeout: 120_000 });

/** Os editais da federação: a equipe vê todos (rascunho incluído); o público, os publicados. */
export const listHostBids = async (fedId, { equipe = false } = {}) => recentes(await lista(equipe
  ? query(collection(db, C.hostBids), where('federation_id', '==', fedId))
  : query(collection(db, C.hostBids), where('federation_id', '==', fedId), where('status', 'in', [...HOST_BID_PUBLIC]))));

export const listBidEntries = async (fedId, bidId) => lista(query(collection(db, C.hostEntries), where('bid_id', '==', bidId), where('federation_id', '==', fedId)));
export const listBidScores = async (fedId, bidId) => lista(query(collection(db, C.hostScores), where('bid_id', '==', bidId), where('federation_id', '==', fedId)));

/** As candidaturas de UMA organização, em todos os editais (quem a gere). */
export async function listOrgHostEntries(kind, orgId) {
  if (!kind || !orgId) return [];
  return lista(query(collection(db, C.hostEntries), where('kind', '==', kind), where('org_id', '==', orgId)));
}

/** As Copas da confederação: a equipe vê o rascunho; o público e as estaduais, as abertas. */
export const listCups = async (confId, { equipe = false } = {}) => recentes(await lista(equipe
  ? query(collection(db, C.cups), where('federation_id', '==', confId))
  : query(collection(db, C.cups), where('federation_id', '==', confId), where('status', 'in', [...CUP_PUBLIC]))));

export const listCupTeams = async (confId) => lista(query(collection(db, C.cupTeams), where('conf_id', '==', confId)));
export const listMyFederationCupTeams = async (fedId) => lista(query(collection(db, C.cupTeams), where('federation_id', '==', fedId)));

/** Sobe os arquivos da proposta (`[File]`) e devolve `[{ path, name }]`. */
export async function uploadProposalFiles(uid, arquivos = []) {
  const subidos = await uploadGrantFiles(uid, Object.fromEntries(arquivos.map((f, i) => [`f${i}`, f])));
  return arquivos.map((_, i) => subidos[`f${i}`]).filter(Boolean).map((f) => ({ path: f.path, name: f.name }));
}

/** Abre um arquivo da proposta (o servidor confere quem pode e registra o acesso da equipe). */
export const openProposalFile = (federationId, entryId, index) => hostingAction(federationId, 'entry_file', { entryId, index });
