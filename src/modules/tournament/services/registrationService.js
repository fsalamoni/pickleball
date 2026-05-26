/**
 * Inscrições em modalidades.
 *
 * Para Simples → 1 jogador por inscrição.
 * Para Duplas  → 2 jogadores (pode ser convidado por nome se ainda não tem conta).
 * Para Americana → 1 jogador por inscrição (as duplas são geradas por rotação).
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
import { createAuditLog } from '@/core/services/auditService';
import {
  REGISTRATION_STATUS,
  MODALITY_FORMAT,
  MAX_REGISTRATIONS_PER_MODALITY,
  TOURNAMENT_VISIBILITY,
} from '../domain/constants.js';
import { getModality } from './modalityService.js';
import { getTournament, isTournamentAdmin } from './tournamentService.js';

const COL = 'tournament_registrations';
const SAFE_BATCH_WRITE_SIZE = 450; // abaixo do limite de 500 operações por batch do Firestore

function buildRegistrationLabel(reg, format) {
  if (format === MODALITY_FORMAT.DOUBLES) {
    return `${reg.player_a_name || '—'} / ${reg.player_b_name || '—'}`;
  }
  return reg.player_a_name || '—';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function officialPlayerData(user, profile = {}) {
  const name = profile.platform_name || profile.full_name || user?.displayName || user?.email || '';
  return {
    user_id: user?.uid || null,
    name,
    email: user?.email || profile.email || '',
    level: profile.level || profile.leveling_level || null,
  };
}

export async function createRegistration(input, actor) {
  const { tournament_id, modality_id, player_a, player_b } = input;
  const modality = await getModality(modality_id);
  if (!modality) throw new Error('Modalidade não encontrada.');
  if (modality.tournament_id !== tournament_id) throw new Error('Modalidade não pertence ao torneio.');
  const tournament = await getTournament(tournament_id);
  if (!tournament) throw new Error('Torneio não encontrado.');
  const actorIsAdmin = await isTournamentAdmin(tournament_id, actor?.uid);
  if (
    tournament.visibility === TOURNAMENT_VISIBILITY.PRIVATE &&
    !actorIsAdmin &&
    String(input.invite_code || '').trim().toUpperCase() !== String(tournament.invite_code || '').toUpperCase()
  ) {
    throw new Error('Este torneio é privado. Informe o código de acesso para se inscrever.');
  }

  const existing = await listRegistrations(modality_id);
  if (existing.length >= Math.min(modality.max_entries || MAX_REGISTRATIONS_PER_MODALITY, MAX_REGISTRATIONS_PER_MODALITY)) {
    throw new Error('Modalidade lotada.');
  }

  const id = doc(collection(db, COL)).id;
  const playerAEmail = normalizeEmail(player_a?.email || actor?.email);
  const playerBEmail = normalizeEmail(player_b?.email);
  const playerAUserId = player_a?.user_id || (!actorIsAdmin ? actor?.uid : null) || null;
  const playerBUserId = player_b?.user_id || null;
  const payload = {
    id,
    tournament_id,
    modality_id,
    format: modality.format,
    created_by: actor?.uid || null,
    created_by_role: actorIsAdmin ? 'admin' : 'player',
    is_provisional: Boolean(
      (playerAEmail && !playerAUserId) ||
      (selectedModalityIsDoubles(modality.format) && playerBEmail && !playerBUserId),
    ),
    user_id: playerAUserId,
    player_a_user_id: playerAUserId,
    player_a_name: player_a?.name?.trim() || actor?.displayName || actor?.email || '',
    player_a_email: playerAEmail,
    player_a_email_lc: playerAEmail,
    player_a_level: player_a?.level || null,
    player_a_provisional: Boolean(playerAEmail && !playerAUserId),
    player_b_user_id: playerBUserId,
    player_b_name: player_b?.name?.trim() || '',
    player_b_email: playerBEmail,
    player_b_email_lc: playerBEmail,
    player_b_level: player_b?.level || null,
    player_b_provisional: Boolean(playerBEmail && !playerBUserId),
    status: (modality.entry_fee_cents || 0) > 0 ? REGISTRATION_STATUS.PENDING_PAYMENT : REGISTRATION_STATUS.CONFIRMED,
    seed: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  payload.label = buildRegistrationLabel(payload, modality.format);

  await setDoc(doc(db, COL, id), payload);
  await createAuditLog({
    action: 'registration_created',
    actor,
    details: { tournament_id, modality_id, registration_id: id },
  });
  return id;
}

function selectedModalityIsDoubles(format) {
  return format === MODALITY_FORMAT.DOUBLES;
}

export async function claimProvisionalRegistrationsForUser(user, profile = {}) {
  const email = normalizeEmail(user?.email || profile.email);
  if (!user?.uid || !email) return 0;

  const [playerASnap, playerBSnap] = await Promise.all([
    // Keep matching by email even after claiming so later profile edits refresh tournament data.
    getDocs(query(collection(db, COL), where('player_a_email_lc', '==', email))),
    getDocs(query(collection(db, COL), where('player_b_email_lc', '==', email))),
  ]);
  const player = officialPlayerData(user, profile);
  const updatesById = new Map();

  playerASnap.docs.forEach((docSnap) => {
    const reg = docSnap.data();
    const updates = updatesById.get(docSnap.id) || { ref: docSnap.ref, data: { ...reg } };
    updates.data.player_a_user_id = user.uid;
    updates.data.user_id = user.uid;
    updates.data.player_a_name = player.name;
    updates.data.player_a_email = player.email;
    updates.data.player_a_email_lc = email;
    updates.data.player_a_level = player.level;
    updates.data.player_a_provisional = false;
    updatesById.set(docSnap.id, updates);
  });

  playerBSnap.docs.forEach((docSnap) => {
    const reg = docSnap.data();
    const updates = updatesById.get(docSnap.id) || { ref: docSnap.ref, data: { ...reg } };
    updates.data.player_b_user_id = user.uid;
    updates.data.player_b_name = player.name;
    updates.data.player_b_email = player.email;
    updates.data.player_b_email_lc = email;
    updates.data.player_b_level = player.level;
    updates.data.player_b_provisional = false;
    updatesById.set(docSnap.id, updates);
  });

  if (updatesById.size === 0) return 0;

  const batchUpdates = [];
  updatesById.forEach(({ ref, data }) => {
    data.is_provisional = Boolean(data.player_a_provisional || data.player_b_provisional);
    data.label = buildRegistrationLabel(data, data.format);
    batchUpdates.push({
      ref,
      payload: {
        ...data,
        claimed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
    });
  });

  for (let i = 0; i < batchUpdates.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = writeBatch(db);
    batchUpdates.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach(({ ref, payload }) => {
      batch.update(ref, payload);
    });
    await batch.commit();
  }
  await createAuditLog({
    action: 'provisional_registrations_claimed',
    actor: user,
    details: { user_id: user.uid, email, count: updatesById.size },
  });
  return updatesById.size;
}

export async function updateRegistration(id, updates, actor) {
  await updateDoc(doc(db, COL, id), { ...updates, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'registration_updated', actor, details: { registration_id: id, fields: Object.keys(updates) } });
}

export async function confirmRegistrationPayment(id, actor) {
  await updateRegistration(id, { status: REGISTRATION_STATUS.CONFIRMED, payment_confirmed_at: serverTimestamp() }, actor);
}

export async function cancelRegistration(id, actor) {
  await updateRegistration(id, { status: REGISTRATION_STATUS.CANCELLED }, actor);
}

export async function deleteRegistration(id, actor) {
  await deleteDoc(doc(db, COL, id));
  await createAuditLog({ action: 'registration_deleted', actor, details: { registration_id: id } });
}

export async function listRegistrations(modalityId) {
  const q = query(
    collection(db, COL),
    where('modality_id', '==', modalityId),
    orderBy('created_at', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function listRegistrationsByTournament(tournamentId) {
  const q = query(collection(db, COL), where('tournament_id', '==', tournamentId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function listMyRegistrations(userId) {
  const registrationQueries = [
    query(collection(db, COL), where('user_id', '==', userId)),
    query(collection(db, COL), where('player_a_user_id', '==', userId)),
    query(collection(db, COL), where('player_b_user_id', '==', userId)),
  ];
  const snaps = await Promise.all(registrationQueries.map((regQ) => getDocs(regQ)));
  const byId = new Map();
  snaps.forEach((snap) => {
    snap.docs.forEach((d) => byId.set(d.id, d.data()));
  });
  return Array.from(byId.values());
}

export async function setRegistrationSeed(id, seed) {
  await updateDoc(doc(db, COL, id), { seed: Number(seed) || null, updated_at: serverTimestamp() });
}

export async function getRegistration(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? snap.data() : null;
}
