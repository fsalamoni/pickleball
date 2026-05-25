import { collection, getDocs, deleteDoc, doc, orderBy, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';

export async function listAllTournaments() {
  const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('created_at', 'desc')));
  return snap.docs.map((d) => d.data());
}

export async function setTournamentArchived(tournamentId, archived, actor) {
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    archived: !!archived,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: archived ? 'platform_archive_tournament' : 'platform_unarchive_tournament',
    actor,
    details: { tournament_id: tournamentId },
  });
}

export async function deleteTournamentCascading(tournamentId, actor) {
  // Apaga o documento principal — subcoleções/jogos são limpos preguiçosamente
  // pelas regras Firestore (que negam leitura órfã) e por job de manutenção.
  for (const col of ['tournament_admins', 'tournament_modalities', 'tournament_registrations', 'tournament_matches', 'tournament_groups']) {
    const snap = await getDocs(query(collection(db, col), where('tournament_id', '==', tournamentId)));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
  await deleteDoc(doc(db, 'tournaments', tournamentId));
  await createAuditLog({ action: 'platform_delete_tournament', actor, details: { tournament_id: tournamentId } });
}
