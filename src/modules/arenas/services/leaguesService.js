/**
 * Service: Leagues (Arena V3 — sprint 5).
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, increment, limit, arrayUnion,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeInternalTournamentInput, INTERNAL_TOURNAMENT_STATUS,
} from '../domain/leagues.js';

const COL_TOURNAMENTS = 'arena_internal_tournaments';
const COL_LADDERS = 'arena_ladders';

function displayName(u, p) {
  return p?.platform_name || p?.full_name || u?.displayName || u?.email || 'Atleta';
}

export async function listArenaTournaments(arenaId, { onlyFuture = false, lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  // `arena_id ==` + `date >=` + `orderBy(date)` sem indice composto:
  // `arena_internal_tournaments` nao tem nenhum. Os torneios internos da arena
  // nunca apareceram. Ordenacao e recorte em memoria (a colecao e pequena por
  // arena), com o corte DEPOIS de ordenar.
  const snap = await getDocs(query(collection(db, COL_TOURNAMENTS), where('arena_id', '==', arenaId)));
  const hoje = new Date().toISOString().slice(0, 10);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => !onlyFuture || String(x.date || '') >= hoje)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .slice(0, Math.max(1, Number(lim) || 50));
}

export async function createInternalTournament(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeInternalTournamentInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_TOURNAMENTS)).id;
  await setDoc(doc(db, COL_TOURNAMENTS, id), {
    id, arena_id: arenaId, ...value,
    enrolled: 0, participants: [],
    status: INTERNAL_TOURNAMENT_STATUS.SCHEDULED,
    created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_internal_tournament_created', actor, details: { arena_id: arenaId, name: value.name } });
  return id;
}

export async function joinTournament(tid, user, profile) {
  if (!tid || !user?.uid) throw new Error('Parâmetros obrigatórios.');
  const ref = doc(db, COL_TOURNAMENTS, tid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Torneio não encontrado.');
  const t = { id: snap.id, ...snap.data() };
  if (t.status !== INTERNAL_TOURNAMENT_STATUS.SCHEDULED) throw new Error('Torneio não disponível.');
  if ((t.participants || []).includes(user.uid)) throw new Error('Você já está inscrito.');
  if ((t.enrolled || 0) >= (t.max_participants || 1)) throw new Error('Torneio lotado.');
  await updateDoc(ref, {
    participants: arrayUnion(user.uid),
    enrolled: increment(1),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_internal_tournament_joined', actor: user, details: { tournament_id: tid } });
}

export async function getLadder(arenaId, period = 'current_week') {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(
    collection(db, COL_LADDERS),
    where('arena_id', '==', arenaId),
    where('period', '==', period),
    limit(1),
  ));
  if (snap.empty) return [];
  return snap.docs[0].data().rankings || [];
}
