/**
 * TORNEIOS DO CLUBE (Bloco E3b) — a leitura. O torneio é a coleção `tournaments` de sempre, com
 * `club_id` (a regra confere quem pode marcá-lo). Uma igualdade só e a ordem em memória: o
 * torneio novo nasce SEM `archived`, então filtrar `archived == false` no servidor escondia todos.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';

/** Os torneios (não arquivados) feitos em nome do clube. */
export async function listClubTournaments(clubId) {
  const snap = await getDocs(query(collection(db, 'tournaments'), where('club_id', '==', clubId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.archived !== true);
}
