/**
 * COMPETIÇÕES (Bloco 2) — leituras e chamadas. O relatório do diretor, os
 * convites da final e a conferência do pedido de chancela (prazo, diretor,
 * taxa) são escritos só pelo SERVIDOR (`federationCompetition` e o gatilho
 * `federationSanctionSync`). A régua pura é `domain/competitions.js`.
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { chamar } from './federationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });

/** Uma ação do servidor: `checklist`, `report`, `final_send`, `final_answer`, `final_cancel`. */
export const competitionAction = (federationId, action, payload = {}) => chamar('federationCompetition', { ...payload, federationId, action });

/** O relatório de um torneio chancelado (diretor, organizador, competições). `null` = ainda não existe. */
export async function getTournamentReport(tournamentId) {
  if (!tournamentId) return null;
  const snap = await getDoc(doc(db, C.tournamentReports, tournamentId));
  return snap.exists() ? toDoc(snap) : null;
}

/** Os relatórios dos torneios da federação (competições). */
export async function listFederationTournamentReports(fedId) {
  return (await getDocs(query(collection(db, C.tournamentReports), where('federation_id', '==', fedId)))).docs.map(toDoc);
}

/** Os convites da final de um torneio (competições). */
export async function listFinalInvites(fedId, tournamentId) {
  const q = query(collection(db, C.finalInvites), where('federation_id', '==', fedId), where('tournament_id', '==', tournamentId));
  return (await getDocs(q)).docs.map(toDoc).sort((a, b) => (a.position || 9999) - (b.position || 9999));
}

/** As taxas de chancela da federação (competições vê; a régua libera só `origin == 'sanction'`). */
export async function listSanctionFees(fedId) {
  const q = query(collection(db, C.charges), where('federation_id', '==', fedId), where('origin', '==', 'sanction'));
  return (await getDocs(q)).docs.map(toDoc);
}

/** A taxa de UM pedido, pelo id gravado no pedido (quem paga lê a própria cobrança). */
export async function getSanctionFee(chargeId) {
  if (!chargeId) return null;
  const snap = await getDoc(doc(db, C.charges, chargeId));
  return snap.exists() ? toDoc(snap) : null;
}

export { listMyFinalInvites, listMyDirectedReports } from './federationService.js';
