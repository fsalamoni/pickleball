/**
 * Leitura de dados do torneio (estrutura imutável vista pelo cliente).
 * Escrita só via Cloud Functions / scripts admin.
 */
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/core/config/firebase';

export async function listTournaments() {
  const snap = await getDocs(collection(db, 'tournaments'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getTournament(tournamentId) {
  const snap = await getDoc(doc(db, 'tournaments', tournamentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listStages(tournamentId) {
  const snap = await getDocs(
    query(collection(db, 'stages'), where('tournament_id', '==', tournamentId), orderBy('sort_order', 'asc')),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listGroups(tournamentId) {
  const snap = await getDocs(query(collection(db, 'groups'), where('tournament_id', '==', tournamentId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listTeams() {
  const snap = await getDocs(collection(db, 'teams'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listMatches(tournamentId, stageCode = null) {
  let q;
  if (stageCode) {
    q = query(
      collection(db, 'matches'),
      where('tournament_id', '==', tournamentId),
      where('stage_code', '==', stageCode),
      orderBy('sequence_in_stage', 'asc'),
    );
  } else {
    q = query(
      collection(db, 'matches'),
      where('tournament_id', '==', tournamentId),
      orderBy('kickoff_at', 'asc'),
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listScoringTiers() {
  const snap = await getDocs(collection(db, 'scoring_tiers'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
