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
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import {
  REGISTRATION_STATUS,
  MODALITY_FORMAT,
  TOURNAMENT_VISIBILITY,
} from '../domain/constants.js';
import { countOccupiedRegistrations, isRegistrationCapacityReached } from '../domain/capacity.js';
import { buildPlaceholderRegistrationFields, neededPlaceholderCount } from '../domain/placeholders.js';
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
    competition_gender: profile.competition_gender || null,
    photo_url: profile.photo_url || user?.photoURL || null,
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
  const occupiedCount = countOccupiedRegistrations(existing);
  const capacityReached = isRegistrationCapacityReached(occupiedCount, modality.max_entries);
  // Lotada: bloqueia, salvo quando o fluxo de lista de espera é permitido
  // explicitamente (flag tournament_waitlist), caso em que entra como WAITLIST.
  if (capacityReached && !input.allow_waitlist) {
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
    player_a_competition_gender: player_a?.competition_gender || null,
    player_a_photo: player_a?.photo_url || null,
    player_a_provisional: Boolean(playerAEmail && !playerAUserId),
    player_b_user_id: playerBUserId,
    player_b_name: player_b?.name?.trim() || '',
    player_b_email: playerBEmail,
    player_b_email_lc: playerBEmail,
    player_b_level: player_b?.level || null,
    player_b_competition_gender: player_b?.competition_gender || null,
    player_b_photo: player_b?.photo_url || null,
    player_b_provisional: Boolean(playerBEmail && !playerBUserId),
    status: capacityReached
      ? REGISTRATION_STATUS.WAITLIST
      : ((modality.entry_fee_cents || 0) > 0 ? REGISTRATION_STATUS.PENDING_PAYMENT : REGISTRATION_STATUS.CONFIRMED),
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
    // Não apaga o gênero já informado (ex.: admin inseriu) se o perfil não tiver.
    updates.data.player_a_competition_gender = player.competition_gender || reg.player_a_competition_gender || null;
    updates.data.player_a_photo = player.photo_url;
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
    updates.data.player_b_competition_gender = player.competition_gender || reg.player_b_competition_gender || null;
    updates.data.player_b_photo = player.photo_url;
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

/**
 * Preenche as vagas faltantes de uma modalidade com atletas fictícios
 * ("Atleta N"), até o número exato de participantes (`max_entries`). Idempotente:
 * remove os fictícios existentes e recria a quantidade certa a partir da
 * contagem atual de inscritos reais confirmados. Só faz sentido quando a
 * modalidade tem um número exato de participantes definido.
 *
 * @param {object} modality modalidade (precisa ter max_entries finito)
 * @param {object} actor
 * @returns {Promise<{ created: number, cleared: number, total: number }>}
 */
export async function ensurePlaceholderRegistrations(modality, actor) {
  if (!db || !modality?.id) return { created: 0, cleared: 0, total: 0 };
  const max = Number(modality.max_entries);
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error('Defina um número exato de participantes na modalidade para preencher as vagas.');
  }
  const all = await listRegistrations(modality.id);
  const existingPlaceholders = all.filter((r) => r.is_placeholder);
  const realConfirmed = all.filter(
    (r) => !r.is_placeholder && r.status === REGISTRATION_STATUS.CONFIRMED,
  );
  const need = neededPlaceholderCount(realConfirmed.length, max);

  const ops = [];
  existingPlaceholders.forEach((p) => ops.push({ type: 'delete', ref: doc(db, COL, p.id) }));
  for (let i = 0; i < need; i += 1) {
    const id = doc(collection(db, COL)).id;
    ops.push({
      type: 'set',
      ref: doc(db, COL, id),
      payload: {
        id,
        tournament_id: modality.tournament_id,
        modality_id: modality.id,
        created_by: actor?.uid || null,
        created_by_role: 'admin',
        ...buildPlaceholderRegistrationFields(modality, realConfirmed.length + i + 1),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      },
    });
  }

  for (let i = 0; i < ops.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = writeBatch(db);
    ops.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach((op) => {
      if (op.type === 'delete') batch.delete(op.ref);
      else batch.set(op.ref, op.payload);
    });
    await batch.commit();
  }

  await createAuditLog({
    action: 'placeholder_registrations_filled',
    actor,
    details: { modality_id: modality.id, created: need, cleared: existingPlaceholders.length },
  });
  return { created: need, cleared: existingPlaceholders.length, total: need };
}

/**
 * Remove todos os atletas fictícios de uma modalidade.
 * @param {string} modalityId
 * @param {object} actor
 * @returns {Promise<{ cleared: number }>}
 */
export async function clearPlaceholderRegistrations(modalityId, actor) {
  if (!db || !modalityId) return { cleared: 0 };
  const all = await listRegistrations(modalityId);
  const placeholders = all.filter((r) => r.is_placeholder);
  for (let i = 0; i < placeholders.length; i += SAFE_BATCH_WRITE_SIZE) {
    const batch = writeBatch(db);
    placeholders.slice(i, i + SAFE_BATCH_WRITE_SIZE).forEach((p) => batch.delete(doc(db, COL, p.id)));
    await batch.commit();
  }
  if (placeholders.length > 0) {
    await createAuditLog({
      action: 'placeholder_registrations_cleared',
      actor,
      details: { modality_id: modalityId, cleared: placeholders.length },
    });
  }
  return { cleared: placeholders.length };
}

export async function updateRegistration(id, updates, actor) {
  await updateDoc(doc(db, COL, id), { ...updates, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'registration_updated', actor, details: { registration_id: id, fields: Object.keys(updates) } });
}

/**
 * Edita os DADOS dos jogadores de uma inscrição (nome, e-mail, nível, gênero),
 * recompondo o rótulo. Os nomes aparecem por referência (id da inscrição) nos
 * grupos, jogos e ranking, então a edição reflete automaticamente em todos.
 *
 * @param {string} id
 * @param {{ format: string, player_a: object, player_b?: object|null }} input
 * @param {object} actor
 */
export async function updateRegistrationDetails(id, input, actor) {
  const { format, player_a = {}, player_b = null } = input;
  const aEmail = normalizeEmail(player_a.email);
  const updates = {
    player_a_name: String(player_a.name || '').trim(),
    player_a_email: aEmail,
    player_a_email_lc: aEmail,
    player_a_level: player_a.level || null,
    player_a_competition_gender: player_a.competition_gender || null,
  };
  if (format === MODALITY_FORMAT.DOUBLES) {
    const bEmail = normalizeEmail(player_b?.email);
    updates.player_b_name = String(player_b?.name || '').trim();
    updates.player_b_email = bEmail;
    updates.player_b_email_lc = bEmail;
    updates.player_b_level = player_b?.level || null;
    updates.player_b_competition_gender = player_b?.competition_gender || null;
  }
  updates.label = buildRegistrationLabel(updates, format);
  await updateDoc(doc(db, COL, id), { ...updates, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'registration_edited', actor, details: { registration_id: id } });
}

export async function confirmRegistrationPayment(id, actor) {
  await updateRegistration(id, { status: REGISTRATION_STATUS.CONFIRMED, payment_confirmed_at: serverTimestamp() }, actor);
}

/** Promove uma inscrição da lista de espera para confirmada (admin do torneio). */
export async function promoteFromWaitlist(id, actor) {
  await updateRegistration(id, { status: REGISTRATION_STATUS.CONFIRMED, promoted_at: serverTimestamp() }, actor);
}

export async function cancelRegistration(id, actor) {
  await updateRegistration(id, { status: REGISTRATION_STATUS.CANCELLED }, actor);
}

/**
 * Marca o check-in de uma inscrição confirmada (admin do torneio). O status
 * "Check-in feito" já era aceito pelo sorteio como equivalente a confirmado;
 * aqui apenas o registramos com carimbo de horário.
 */
export async function checkInRegistration(id, actor) {
  await updateRegistration(id, { status: REGISTRATION_STATUS.CHECKED_IN, checked_in_at: serverTimestamp() }, actor);
}

/** Desfaz o check-in, devolvendo a inscrição ao status confirmado. */
export async function undoRegistrationCheckIn(id, actor) {
  await updateRegistration(id, { status: REGISTRATION_STATUS.CONFIRMED, checked_in_at: null }, actor);
}

export async function deleteRegistration(id, actor) {
  await deleteDoc(doc(db, COL, id));
  await createAuditLog({ action: 'registration_deleted', actor, details: { registration_id: id } });
}

/**
 * Remove em lote inscrições provisórias e/ou placeholder, com filtros finos.
 * Use com cuidado: o audit log é gerado UMA VEZ (com a contagem), não por
 * registration deletada, para não inundar `audit_logs` em operações grandes.
 *
 * Permissão: `platform_admin` (Firestore rule atual de `tournament_registrations`
 * já permite `delete` por admin OU tournament_admin; aqui restringimos no
 * service para evitar que admins de torneio limpem atletas de outros).
 *
 * @param {object} options
 * @param {string} [options.tournamentId] — escopo (null = todos os torneios)
 * @param {string} [options.modalityId] — escopo adicional
 * @param {boolean} [options.onlyProvisional=true] — `is_provisional: true`
 * @param {boolean} [options.onlyPlaceholder=false] — `is_placeholder: true`
 * @param {RegExp|string} [options.namePattern] — regex ou string; bate em
 *   `player_a_name` e `player_b_name` (case-insensitive). Útil pra remover
 *   "A", "B", "C" etc.
 * @param {string} [options.email] — remove só registrations com esse email
 *   (em player_a_email_lc ou player_b_email_lc). Use pra desvincular o seu
 *   próprio email de registrations provisórias que você cadastrou.
 * @param {boolean} [options.dryRun=false] — se true, não deleta; só conta
 * @param {object} actor
 * @returns {Promise<{ scanned: number, deleted: number, dryRun: boolean,
 *                     ids: string[] }>}
 */
export async function bulkRemoveProvisionalRegistrations(options = {}, actor) {
  const {
    tournamentId = null,
    modalityId = null,
    onlyProvisional = true,
    onlyPlaceholder = false,
    namePattern = null,
    email = null,
    dryRun = false,
  } = options;

  if (!actor?.uid) throw new Error('Usuário não autenticado.');
  const callerIsAdmin = await checkIsPlatformAdmin(actor.uid);
  if (!callerIsAdmin) {
    throw new Error('Apenas o admin da plataforma pode executar limpeza em massa.');
  }

  const filters = [];
  if (tournamentId) filters.push(where('tournament_id', '==', tournamentId));
  if (modalityId) filters.push(where('modality_id', '==', modalityId));
  // Firestore não aceita `OR` em campos diferentes; tratamos `is_provisional`
  // OU `is_placeholder` no client (filtro adicional). Para `namePattern` e
  // `email` também é client-side.
  if (onlyProvisional && !onlyPlaceholder) {
    filters.push(where('is_provisional', '==', true));
  } else if (onlyPlaceholder && !onlyProvisional) {
    filters.push(where('is_placeholder', '==', true));
  } else if (onlyProvisional && onlyPlaceholder) {
    // AND entre campos; se quiser OU, faz 2 queries. Por enquanto, ambos
    // verdadeiros = placeholder (geralmente são exclusivos; é o suficiente).
    filters.push(where('is_placeholder', '==', true));
  }

  const snap = await getDocs(query(collection(db, COL), ...filters));
  let docsToDelete = snap.docs;

  if (namePattern) {
    const re = namePattern instanceof RegExp ? namePattern : new RegExp(namePattern, 'i');
    docsToDelete = docsToDelete.filter((d) => {
      const data = d.data();
      return re.test(data.player_a_name || '') || re.test(data.player_b_name || '');
    });
  }
  if (email) {
    const target = String(email).trim().toLowerCase();
    docsToDelete = docsToDelete.filter((d) => {
      const data = d.data();
      return data.player_a_email_lc === target || data.player_b_email_lc === target;
    });
  }

  const ids = docsToDelete.map((d) => d.id);
  if (dryRun) {
    return { scanned: snap.size, deleted: 0, dryRun: true, ids };
  }

  // Batches respeitando o limite do Firestore (500 operações por batch).
  let deleted = 0;
  for (let i = 0; i < docsToDelete.length; i += SAFE_BATCH_WRITE_SIZE) {
    const slice = docsToDelete.slice(i, i + SAFE_BATCH_WRITE_SIZE);
    const batch = writeBatch(db);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += slice.length;
  }

  await createAuditLog({
    action: 'registrations_bulk_removed',
    actor,
    details: {
      scanned: snap.size,
      deleted,
      filters: {
        tournamentId, modalityId, onlyProvisional, onlyPlaceholder,
        namePattern: namePattern ? String(namePattern) : null,
        email: email ? String(email).trim().toLowerCase() : null,
      },
    },
  });

  return { scanned: snap.size, deleted, dryRun: false, ids };
}

async function checkIsPlatformAdmin(uid) {
  if (!uid || !db) return false;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() && snap.data()?.role === 'platform_admin';
  } catch (err) {
    logger.error('Falha ao verificar role do caller em bulkRemoveProvisionalRegistrations:', err);
    return false;
  }
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
