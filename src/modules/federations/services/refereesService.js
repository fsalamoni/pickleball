/**
 * ARBITRAGEM da federação — leituras e chamadas. Toda escrita é do SERVIDOR
 * (`federationReferees`); o quadro público e quem apita passam por
 * `federationRefereesPublic` (também sem conta, sem valor, nota nem conflito).
 * A régua pura é `domain/referees.js`.
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { FED_COLLECTIONS as C } from '../domain/constants.js';
import { chamar } from './federationService.js';

const toDoc = (d) => ({ id: d.id, ...d.data() });

/** O quadro de uma federação (equipe de arbitragem). */
export async function listFederationReferees(fedId) {
  const q = query(collection(db, C.referees), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Todas as escalas de uma federação (equipe de arbitragem). */
export async function listFederationAssignments(fedId) {
  const q = query(collection(db, C.assignments), where('federation_id', '==', fedId));
  return (await getDocs(q)).docs.map(toDoc);
}

/**
 * A ficha da pessoa no quadro de arbitragem (`null` = não está no quadro).
 * Por CONSULTA, não por `get`: a regra lê `resource.data`, e o `get` de quem
 * não está no quadro (documento inexistente) seria recusado.
 */
export async function getRefereeEntry(fedId, uid) {
  if (!fedId || !uid) return null;
  const q = query(collection(db, C.referees), where('federation_id', '==', fedId), where('user_id', '==', uid));
  const docs = (await getDocs(q)).docs.map(toDoc);
  return docs[0] || null;
}

/** As escalas de uma pessoa nesta federação (a pasta do filiado). */
export async function listPersonAssignments(fedId, uid) {
  if (!fedId || !uid) return [];
  const q = query(collection(db, C.assignments), where('federation_id', '==', fedId), where('referee_uid', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

/** As notas internas da equipe sobre um árbitro (o árbitro não lê). */
export async function getRefereeNotes(fedId, uid) {
  const snap = await getDoc(doc(db, C.referees, `${fedId}_${uid}`, 'private', 'staff'));
  return snap.exists() ? snap.data().notes || '' : '';
}

/** Toda ação da arbitragem (equipe e árbitro): `{ action, federationId, ... }`. */
export const refereesAction = (payload) => chamar('federationReferees', payload);

/** O quadro público e quem apita (`{ federationId }`), ou só um torneio (`{ federationId, tournamentId }`). */
export const refereesPublic = (payload) => chamar('federationRefereesPublic', payload, { timeout: 30_000 });
