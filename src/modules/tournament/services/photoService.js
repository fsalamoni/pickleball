/**
 * Galeria de fotos do torneio (coleção `tournament_photos`).
 * Upload restrito a admins do torneio (reforçado pelas regras do Firestore).
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';

const COL = 'tournament_photos';

/** Adiciona uma foto à galeria do torneio. */
export async function addTournamentPhoto(tournamentId, url, actor) {
  if (!db || !tournamentId || !url) return null;
  const id = doc(collection(db, COL)).id;
  await setDoc(doc(db, COL, id), {
    id,
    tournament_id: tournamentId,
    url,
    uploaded_by: actor?.uid || null,
    created_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'tournament_photo_added', actor, details: { tournament_id: tournamentId, photo_id: id } });
  return id;
}

/** Lista as fotos de um torneio. */
export async function listTournamentPhotos(tournamentId) {
  if (!db || !tournamentId) return [];
  const snap = await getDocs(query(collection(db, COL), where('tournament_id', '==', tournamentId)));
  return snap.docs.map((d) => d.data());
}

/** Remove uma foto. */
export async function deleteTournamentPhoto(id, actor) {
  if (!db || !id) return;
  await deleteDoc(doc(db, COL, id));
  await createAuditLog({ action: 'tournament_photo_deleted', actor, details: { photo_id: id } });
}
