/**
 * clubGamesService — os jogos publicados de um clube (espelho `club_event_games`),
 * para a atividade do clube. Leitura pública na regra; a consulta é por igualdade
 * em `club_id` (sem índice composto). Teto de 800: a janela que a tela usa é o mês.
 */
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { gamificationDb } from './firestoreDb.js';

export async function listClubPublishedGames(clubId, max = 800) {
  if (!clubId) return [];
  const snap = await getDocs(query(collection(gamificationDb(), 'club_event_games'), where('club_id', '==', clubId), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
