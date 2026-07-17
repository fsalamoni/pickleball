import { collection, getDocs, deleteDoc, doc, orderBy, query, where, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { archiveTournament as serviceArchive, unarchiveTournament as serviceUnarchive } from '@/modules/tournament/services/tournamentService';

export async function listAllTournaments() {
  const snap = await getDocs(query(collection(db, 'tournaments'), orderBy('created_at', 'desc')));
  return snap.docs.map((d) => d.data());
}

/**
 * Lista todos os usuários (atletas) cadastrados na plataforma a partir da
 * coleção `users`, que só o admin da plataforma pode ler (reforçado pelas
 * regras do Firestore). Diferente do diretório público de atletas, aqui temos
 * acesso a e-mail e categoria de competição — o necessário para o admin
 * inscrever um atleta vinculando a inscrição à conta real dele.
 *
 * @returns {Promise<Array<{ uid: string } & Record<string, unknown>>>}
 */
export async function listAllPlatformUsers() {
  if (!db) return [];
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/**
 * @deprecated Prefira `archiveTournament` / `unarchiveTournament` de
 * `@/modules/tournament/services/tournamentService`. Esta função existe só
 * para retrocompatibilidade de imports legados (AdminTournaments V1).
 * Reexporta os novos helpers para que o caller continue funcionando.
 */
export async function setTournamentArchived(tournamentId, archived, actor) {
  if (archived) return serviceArchive(tournamentId, actor);
  return serviceUnarchive(tournamentId, actor);
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
