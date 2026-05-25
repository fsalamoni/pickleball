/**
 * Serviço de torneios — CRUD e operações de alto nível.
 *
 * Coleções Firestore:
 *  - tournaments
 *  - tournament_admins (subcoleção lógica via documentos por torneio)
 *  - tournament_modalities
 *  - tournament_registrations
 *  - tournament_matches
 *  - tournament_groups
 *  - tournament_rankings (materializado pelo client após cada resultado)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_ADMIN_ROLE,
} from '../domain/constants.js';
import { DEFAULT_SCORING_CONFIG, normalizeScoringConfig } from '../domain/scoring.js';

const COL = {
  tournaments: 'tournaments',
  admins: 'tournament_admins',
  modalities: 'tournament_modalities',
  registrations: 'tournament_registrations',
  matches: 'tournament_matches',
  groups: 'tournament_groups',
  rankings: 'tournament_rankings',
};

function inviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function adminDocId(tournamentId, userId) {
  return `${tournamentId}_${userId}`;
}

/* --------------------------------- CRUD --------------------------------- */

export async function createTournament(creator, data) {
  if (!creator?.uid) throw new Error('Usuário não autenticado.');
  const id = doc(collection(db, COL.tournaments)).id;
  const payload = {
    id,
    name: data.name?.trim() || 'Torneio',
    description: data.description?.trim() || '',
    city: data.city?.trim() || '',
    state: data.state?.trim() || '',
    venue: data.venue?.trim() || '',
    ruleset: data.ruleset || 'cbp',
    scoring: normalizeScoringConfig(data.scoring || DEFAULT_SCORING_CONFIG),
    invite_code: data.invite_code || inviteCode(),
    cover_image_url: data.cover_image_url || '',
    starts_at: data.starts_at || null,
    ends_at: data.ends_at || null,
    registration_deadline: data.registration_deadline || null,
    status: TOURNAMENT_STATUS.DRAFT,
    creator_uid: creator.uid,
    creator_name: creator.displayName || creator.email || '',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  const batch = writeBatch(db);
  batch.set(doc(db, COL.tournaments, id), payload);
  batch.set(doc(db, COL.admins, adminDocId(id, creator.uid)), {
    tournament_id: id,
    user_id: creator.uid,
    user_email: creator.email || '',
    user_name: creator.displayName || creator.email || '',
    role: TOURNAMENT_ADMIN_ROLE.OWNER,
    created_at: serverTimestamp(),
  });
  await batch.commit();
  await createAuditLog({
    action: 'tournament_created',
    actor: creator,
    details: { tournament_id: id, name: payload.name },
  });
  logger.info('tournament_created', { id });
  return id;
}

export async function getTournament(id) {
  const snap = await getDoc(doc(db, COL.tournaments, id));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function getTournamentByInviteCode(code) {
  const q = query(collection(db, COL.tournaments), where('invite_code', '==', String(code).toUpperCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

export async function updateTournament(id, updates, actor) {
  await updateDoc(doc(db, COL.tournaments, id), { ...updates, updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'tournament_updated',
    actor,
    details: { tournament_id: id, fields: Object.keys(updates) },
  });
}

export async function setTournamentStatus(id, status, actor) {
  await updateTournament(id, { status }, actor);
}

export async function deleteTournament(id, actor) {
  await deleteDoc(doc(db, COL.tournaments, id));
  await createAuditLog({ action: 'tournament_deleted', actor, details: { tournament_id: id } });
}

/* --------------------------- Admin (compartilhado) ---------------------- */

export async function addTournamentAdmin(tournamentId, targetUser, actor) {
  if (!targetUser?.uid) throw new Error('Usuário alvo inválido.');
  await setDoc(doc(db, COL.admins, adminDocId(tournamentId, targetUser.uid)), {
    tournament_id: tournamentId,
    user_id: targetUser.uid,
    user_email: targetUser.email || '',
    user_name: targetUser.displayName || targetUser.email || '',
    role: TOURNAMENT_ADMIN_ROLE.ADMIN,
    created_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'tournament_admin_added',
    actor,
    details: { tournament_id: tournamentId, user_id: targetUser.uid },
  });
}

export async function removeTournamentAdmin(tournamentId, userId, actor) {
  await deleteDoc(doc(db, COL.admins, adminDocId(tournamentId, userId)));
  await createAuditLog({
    action: 'tournament_admin_removed',
    actor,
    details: { tournament_id: tournamentId, user_id: userId },
  });
}

export async function listTournamentAdmins(tournamentId) {
  const q = query(collection(db, COL.admins), where('tournament_id', '==', tournamentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function isTournamentAdmin(tournamentId, userId) {
  if (!userId) return false;
  const snap = await getDoc(doc(db, COL.admins, adminDocId(tournamentId, userId)));
  return snap.exists();
}

/* --------------------------- Listagens ---------------------------------- */

export async function listMyTournaments(userId) {
  // torneios onde sou admin
  const q = query(collection(db, COL.admins), where('user_id', '==', userId));
  const adminSnap = await getDocs(q);
  const tournamentIds = adminSnap.docs.map((d) => d.data().tournament_id);
  // torneios onde sou inscrito
  const regQ = query(collection(db, COL.registrations), where('user_id', '==', userId));
  const regSnap = await getDocs(regQ);
  regSnap.docs.forEach((d) => tournamentIds.push(d.data().tournament_id));

  const unique = Array.from(new Set(tournamentIds));
  const results = [];
  for (const id of unique) {
    const t = await getTournament(id);
    if (t) {
      const adminDoc = adminSnap.docs.find((d) => d.data().tournament_id === id);
      results.push({
        ...t,
        my_role: adminDoc ? adminDoc.data().role : 'player',
      });
    }
  }
  return results;
}

export async function listAllTournaments() {
  const snap = await getDocs(query(collection(db, COL.tournaments), orderBy('created_at', 'desc')));
  return snap.docs.map((d) => d.data());
}
