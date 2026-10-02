/**
 * xpGrantService — o XP que o servidor concedeu à pessoa (`user_xp_grants`).
 * Só leitura: a escrita é do servidor, e a regra recusa qualquer cliente.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { gamificationDb } from './firestoreDb.js';

/** @returns {Promise<Array<{ id: string, uid: string, kind: string, xp: number, label?: string, refId?: string, at?: number }>>} */
export async function listXpGrants(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(collection(gamificationDb(), 'user_xp_grants'), where('uid', '==', uid)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
