/**
 * Quadras (courts) de um torneio. Suporta agendamento na aba de jogos.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { COURT_STATUS } from '../domain/constants.js';

const COL = 'tournament_courts';

export async function listCourts(tournamentId) {
  const q = query(
    collection(db, COL),
    where('tournament_id', '==', tournamentId),
    orderBy('order', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function addCourt(tournamentId, data, actor) {
  const id = doc(collection(db, COL)).id;
  const payload = {
    id,
    tournament_id: tournamentId,
    name: data.name?.trim() || 'Quadra',
    surface: data.surface || '',
    indoor: !!data.indoor,
    status: data.status || COURT_STATUS.AVAILABLE,
    order: typeof data.order === 'number' ? data.order : 0,
    notes: data.notes || '',
    created_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL, id), payload);
  await createAuditLog({
    action: 'court_added',
    actor,
    details: { tournament_id: tournamentId, court_id: id },
  });
  return id;
}

export async function updateCourt(id, updates, actor) {
  await updateDoc(doc(db, COL, id), { ...updates, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'court_updated', actor, details: { court_id: id } });
}

export async function deleteCourt(id, actor) {
  await deleteDoc(doc(db, COL, id));
  await createAuditLog({ action: 'court_deleted', actor, details: { court_id: id } });
}
