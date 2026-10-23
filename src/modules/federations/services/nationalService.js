/**
 * CAMADA NACIONAL (Bloco 6) — leituras e chamadas. Vínculos e anuidades só o
 * SERVIDOR grava (`federationNational`); a homologação de transferência é
 * ação de `federationTransfer`. Cada consulta filtra pelo campo que a regra
 * confere (`federation_id`, `conf_id`, `homologation_by`).
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { collection as _c, doc, getDoc } from 'firebase/firestore';
import { FED_COLLECTIONS as C, FEDERATION_STATUS } from '../domain/constants.js';
import { nationalRankingDocId } from '../domain/national.js';
import { chamar } from './federationService.js';

const ler = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
const porCampo = (col, campo, valor) => ler(query(collection(db, col), where(campo, '==', valor)));
const recentes = (a, b) => (b.updated_at_ms || 0) - (a.updated_at_ms || 0);

/** Uma ação do servidor (`link_*`, `config_save`, `dues_*`). */
export const nationalAction = (federationId, action, payload = {}) => chamar('federationNational', { ...payload, federationId, action });

/** Os vínculos do lado da estadual (o atual e o histórico). */
export async function listMyNationalLinks(fedId) {
  return (await porCampo(C.nationalLinks, 'federation_id', fedId)).sort(recentes);
}
/** Os vínculos do lado da confederação (filiadas, pedidos, convites, histórico). */
export async function listConfederationLinks(confId) {
  return (await porCampo(C.nationalLinks, 'conf_id', confId)).sort(recentes);
}

const porAno = (a, b) => (b.year || 0) - (a.year || 0) || String(a.federation_name || '').localeCompare(String(b.federation_name || ''), 'pt-BR');
/** As anuidades que a estadual deve à confederação. */
export async function listDuesOwed(fedId) {
  return (await porCampo(C.dues, 'federation_id', fedId)).sort(porAno);
}
/** As anuidades que a confederação recebe das filiadas. */
export async function listDuesReceivable(confId) {
  return (await porCampo(C.dues, 'conf_id', confId)).sort(porAno);
}

/** As transferências que esperam (ou esperaram) a homologação desta confederação. */
export async function listHomologations(confId) {
  return (await porCampo(C.transfers, 'homologation_by', confId)).sort(recentes);
}

/** O ranking nacional de um ano (`federation_rankings/{conf}_nacional_{ano}`, leitura pública), ou `null`. */
export async function getNationalRanking(confId, season) {
  if (!confId || !season) return null;
  const snap = await getDoc(doc(db, C.rankings, nationalRankingDocId(confId, season)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** As filiadas PUBLICADAS de uma confederação (a lista pública sai do espelho `national_body`). */
export async function listAffiliatedFederations(confId) {
  const q = query(collection(db, C.federations), where('national_body.id', '==', confId), where('status', '==', FEDERATION_STATUS.APPROVED), where('published', '==', true));
  return (await ler(q)).sort((a, b) => String(a.state || a.name || '').localeCompare(String(b.state || b.name || ''), 'pt-BR'));
}
