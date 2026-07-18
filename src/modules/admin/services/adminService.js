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

/**
 * Atalho: cancela (status: cancelled) E arquiva (archived: true) em uma
 * única escrita. A invariante do PR #33 é que só dá pra arquivar se o
 * status for 'cancelled' (validação cliente + server), o que força um
 * fluxo de 2 cliques quando o admin quer esconder um torneio. Aqui a
 * gente combina os dois num write só — usado pelo Painel Admin
 * (/admin/painel) quando o user clica em 'Arquivar' num torneio com
 * status != 'cancelled'.
 */
export async function cancelAndArchiveTournament(tournamentId, actor) {
  if (!tournamentId) throw new Error('ID do torneio é obrigatório.');
  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  if (!db) throw new Error('Firestore indisponível.');
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    status: 'cancelled',
    archived: true,
    archived_at: serverTimestamp(),
    archived_by: actor.uid,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'platform_cancel_and_archive_tournament',
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
