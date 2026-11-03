/**
 * As quadras de torneio com controle de linhas (`tournament_line_courts`).
 * Uma consulta só, por `tournament_id` (o campo que a regra libera a todos os
 * logados; zero índice). Gravar é da equipe do torneio — a regra confere.
 */

import { collection, doc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { TOURNAMENT_LINE_COL, tournamentLineDocId } from '../domain/tournamentLine.js';
import { saveEach } from './saveEach.js';

export async function listTournamentLineCourts(tournamentId) {
  const snap = await getDocs(query(collection(db, TOURNAMENT_LINE_COL), where('tournament_id', '==', tournamentId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Liga/desliga ou troca o arranjo de uma quadra. Cria o documento na primeira vez.
 * @param {{ tournamentId: string, court: { id: string, name: string }, patch: object, uid: string, exists: boolean }} p
 */
export async function saveTournamentLineCourt({ tournamentId, court, patch, uid, exists }) {
  const base = exists ? {} : { tournament_id: tournamentId, court_id: court.id, line_control: false };
  await setDoc(
    doc(db, TOURNAMENT_LINE_COL, tournamentLineDocId(tournamentId, court.id)),
    { ...base, court_name: court.name, ...patch, updated_by: uid, updated_at: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Várias quadras do torneio de uma vez (ligar/desligar todas), uma escrita por
 * quadra — a que falhar não derruba as outras.
 * @param {{ tournamentId: string, uid: string, items: Array<{ court: { id: string, name: string }, patch: object, exists: boolean }> }} p
 */
export function saveTournamentLineCourts({ tournamentId, uid, items }) {
  return saveEach(items, (it) => saveTournamentLineCourt({ tournamentId, uid, ...it }));
}
