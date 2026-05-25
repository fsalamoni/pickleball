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
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { REGISTRATION_STATUS, MODALITY_FORMAT, MAX_REGISTRATIONS_PER_MODALITY } from '../domain/constants.js';
import { getModality } from './modalityService.js';

const COL = 'tournament_registrations';

function buildRegistrationLabel(reg, format) {
  if (format === MODALITY_FORMAT.DOUBLES) {
    return `${reg.player_a_name || '—'} / ${reg.player_b_name || '—'}`;
  }
  return reg.player_a_name || '—';
}

export async function createRegistration(input, actor) {
  const { tournament_id, modality_id, player_a, player_b } = input;
  const modality = await getModality(modality_id);
  if (!modality) throw new Error('Modalidade não encontrada.');
  if (modality.tournament_id !== tournament_id) throw new Error('Modalidade não pertence ao torneio.');

  const existing = await listRegistrations(modality_id);
  if (existing.length >= Math.min(modality.max_entries || MAX_REGISTRATIONS_PER_MODALITY, MAX_REGISTRATIONS_PER_MODALITY)) {
    throw new Error('Modalidade lotada.');
  }

  const id = doc(collection(db, COL)).id;
  const payload = {
    id,
    tournament_id,
    modality_id,
    format: modality.format,
    user_id: actor?.uid || null,
    player_a_user_id: player_a?.user_id || actor?.uid || null,
    player_a_name: player_a?.name?.trim() || actor?.displayName || actor?.email || '',
    player_a_level: player_a?.level || null,
    player_b_user_id: player_b?.user_id || null,
    player_b_name: player_b?.name?.trim() || '',
    player_b_level: player_b?.level || null,
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
  const q = query(collection(db, COL), where('user_id', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

export async function setRegistrationSeed(id, seed) {
  await updateDoc(doc(db, COL, id), { seed: Number(seed) || null, updated_at: serverTimestamp() });
}

export async function getRegistration(id) {
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? snap.data() : null;
}
