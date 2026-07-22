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
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { listAthletes } from '@/modules/athletes/services/athleteService';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_ADMIN_ROLE,
  TOURNAMENT_VISIBILITY,
} from '../domain/constants.js';
import { DEFAULT_SCORING_CONFIG, normalizeScoringConfig } from '../domain/scoring.js';
import { isTournamentComplete } from '../domain/tournamentCompletion.js';
import {
  validateArchiveRequest,
  validateUnarchiveRequest,
} from '../domain/archiveValidation.js';

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
    visibility: data.visibility || TOURNAMENT_VISIBILITY.PRIVATE,
    invite_code: data.invite_code || inviteCode(),
    cover_image_url: data.cover_image_url || '',
    starts_at: data.starts_at || null,
    ends_at: data.ends_at || null,
    registration_deadline: data.registration_deadline || null,
    status: TOURNAMENT_STATUS.DRAFT,
    creator_uid: creator.uid,
    creator_name: creator.displayName || creator.email || '',
    // Sprint 4 ARE-14: arena vinculada (opcional)
    arena_id: data.arena_id || null,
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
  let previousStatus = null;
  let tournament = null;
  try {
    const snap = await getDoc(doc(db, COL.tournaments, id));
    if (snap.exists()) {
      tournament = snap.data();
      previousStatus = tournament.status;
    }
  } catch (err) {
    logger.error('Falha ao ler torneio antes de mudar status:', err);
  }

  await updateTournament(id, { status }, actor);

  // Aviso à comunidade quando um torneio PÚBLICO passa a aceitar inscrições.
  if (
    status === TOURNAMENT_STATUS.REGISTRATIONS_OPEN
    && previousStatus !== TOURNAMENT_STATUS.REGISTRATIONS_OPEN
    && tournament?.visibility === TOURNAMENT_VISIBILITY.PUBLIC
  ) {
    try {
      const athletes = await listAthletes();
      const ids = athletes.map((a) => a.id).filter(Boolean);
      notifyUsers(ids, {
        title: `Inscrições abertas: "${String(tournament.name || 'Novo torneio').slice(0, 60)}"`,
        message: 'Um torneio público está com inscrições abertas. Toque para ver e participar.',
        type: NOTIFICATION_TYPE.TOURNAMENT_OPEN,
        link: '/torneios/publicos',
        actor,
      });
    } catch (err) {
      logger.error('Falha ao avisar a comunidade sobre torneio aberto:', err);
    }
  }
}

export async function deleteTournament(id, actor) {
  await deleteDoc(doc(db, COL.tournaments, id));
  await createAuditLog({ action: 'tournament_deleted', actor, details: { tournament_id: id } });
}

/* --------------------- Arquivamento (criador + admin) ------------------- */

/**
 * Arquiva um torneio. Pré-condição: o torneio precisa estar com
 * `status: 'cancelled'` (é o caminho "limpar a casa" depois de explicar pra
 * galera por que o evento não rolou). O arquivamento esconde o torneio da
 * listagem pública (`/p/:id`, listas) e do `useMyTournaments` por padrão,
 * mas preserva todo o histórico (modalidades, jogos, ranking) para o criador
 * e o admin da plataforma, que continuam podendo consultar.
 *
 * Permissão: apenas o criador do torneio (`creator_uid`) e o admin master
 * da plataforma (`platform_admin`). A Firestore rule de `tournaments/{tid}`
 * reforça isso no servidor; este service valida a pré-condição de status
 * cliente-side (via `validateArchiveRequest`) e lança erro descritivo se
 * não for atendida.
 *
 * @param {string} tournamentId
 * @param {object} actor — precisa ter `.uid` (audit log)
 * @returns {Promise<{ tournamentId: string, archived: true, alreadyArchived?: boolean }>}
 * @throws {Error} se torneio não existir, se o status não for 'cancelled',
 *                 ou se a Firestore rule recusar.
 */
export async function archiveTournament(tournamentId, actor) {
  if (!tournamentId) throw new Error('ID do torneio é obrigatório.');
  if (!actor?.uid) throw new Error('Usuário não autenticado.');

  const snap = await getDoc(doc(db, COL.tournaments, tournamentId));
  if (!snap.exists()) throw new Error('Torneio não encontrado.');
  const tournament = snap.data();
  if (tournament.archived) {
    // idempotente: já está arquivado, nada a fazer
    return { tournamentId, archived: true, alreadyArchived: true };
  }
  const validation = validateArchiveRequest(tournament);
  if (!validation.ok) throw new Error(validation.reason);

  await updateDoc(doc(db, COL.tournaments, tournamentId), {
    archived: true,
    archived_at: serverTimestamp(),
    archived_by: actor.uid,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'tournament_archived',
    actor,
    tournamentId,
    userId: tournament.creator_uid,
    userName: tournament.creator_name,
    details: { tournament_id: tournamentId, previous_status: tournament.status },
  });
  logger.info('tournament_archived', { id: tournamentId, by: actor.uid });
  return { tournamentId, archived: true };
}

/**
 * Desarquiva um torneio. Volta a aparecer nas listagens (respeitando a
 * visibilidade) e na `Dashboard` do criador. Não exige pré-condição de
 * status (o criador pode desarquivar pra reabrir, ou pra mudar o status
 * depois). Idempotente: se já não está arquivado, não faz nada.
 *
 * @param {string} tournamentId
 * @param {object} actor — precisa ter `.uid` (audit log)
 * @returns {Promise<{ tournamentId: string, archived: false, alreadyUnarchived?: boolean }>}
 * @throws {Error} se torneio não existir, ou se a Firestore rule recusar.
 */
export async function unarchiveTournament(tournamentId, actor) {
  if (!tournamentId) throw new Error('ID do torneio é obrigatório.');
  if (!actor?.uid) throw new Error('Usuário não autenticado.');

  const snap = await getDoc(doc(db, COL.tournaments, tournamentId));
  if (!snap.exists()) throw new Error('Torneio não encontrado.');
  const tournament = snap.data();
  if (!tournament.archived) {
    return { tournamentId, archived: false, alreadyUnarchived: true };
  }
  const validation = validateUnarchiveRequest(tournament);
  if (!validation.ok) throw new Error(validation.reason);

  await updateDoc(doc(db, COL.tournaments, tournamentId), {
    archived: false,
    archived_at: null,
    archived_by: null,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'tournament_unarchived',
    actor,
    tournamentId,
    userId: tournament.creator_uid,
    userName: tournament.creator_name,
    details: { tournament_id: tournamentId },
  });
  logger.info('tournament_unarchived', { id: tournamentId, by: actor.uid });
  return { tournamentId, archived: false };
}

/* --------------------- Ciclo de vida (encerramento) --------------------- */

/**
 * Encerra o torneio automaticamente quando ele está concluído (todos os jogos
 * de todas as modalidades/fases decididos). Não faz nada se já encerrado, se as
 * alterações estiverem bloqueadas, ou se ainda houver jogos pendentes. Idempotente
 * e seguro para chamar após cada resultado.
 *
 * @param {string} tournamentId
 * @param {object} actor
 * @returns {Promise<{ closed: boolean, alreadyFinished?: boolean }>}
 */
export async function maybeAutoCloseTournament(tournamentId, actor) {
  if (!db || !tournamentId) return { closed: false };
  const tournament = await getTournament(tournamentId);
  if (!tournament) return { closed: false };
  if (tournament.status === TOURNAMENT_STATUS.FINISHED) return { closed: false, alreadyFinished: true };
  if (tournament.results_locked) return { closed: false };

  const [modsSnap, matchesSnap] = await Promise.all([
    getDocs(query(collection(db, COL.modalities), where('tournament_id', '==', tournamentId))),
    getDocs(query(collection(db, COL.matches), where('tournament_id', '==', tournamentId))),
  ]);
  const modalities = modsSnap.docs.map((d) => d.data());
  const matches = matchesSnap.docs.map((d) => d.data());
  if (!isTournamentComplete(modalities, matches)) return { closed: false };

  await updateTournament(tournamentId, {
    status: TOURNAMENT_STATUS.FINISHED,
    auto_closed_at: serverTimestamp(),
  }, actor);
  await createAuditLog({
    action: 'tournament_auto_closed',
    actor,
    details: { tournament_id: tournamentId },
  });
  return { closed: true };
}

/**
 * Bloqueia (ou desbloqueia) alterações no torneio encerrado. Enquanto bloqueado,
 * o admin não pode sortear/re-sortear; o objetivo é congelar o resultado oficial.
 *
 * @param {string} id
 * @param {boolean} locked
 * @param {object} actor
 */
export async function setResultsLocked(id, locked, actor) {
  await updateDoc(doc(db, COL.tournaments, id), {
    results_locked: Boolean(locked),
    results_locked_at: locked ? serverTimestamp() : null,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: locked ? 'tournament_results_locked' : 'tournament_results_unlocked',
    actor,
    details: { tournament_id: id },
  });
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

export async function listMyTournaments(userId, { includeArchived = false } = {}) {
  // torneios onde sou admin
  const q = query(collection(db, COL.admins), where('user_id', '==', userId));
  const adminSnap = await getDocs(q);
  const tournamentIds = adminSnap.docs.map((d) => d.data().tournament_id);
  // torneios onde sou inscrito
  const registrationQueries = [
    query(collection(db, COL.registrations), where('user_id', '==', userId)),
    query(collection(db, COL.registrations), where('player_a_user_id', '==', userId)),
    query(collection(db, COL.registrations), where('player_b_user_id', '==', userId)),
  ];
  const registrationSnaps = await Promise.all(registrationQueries.map((regQ) => getDocs(regQ)));
  registrationSnaps.forEach((regSnap) => {
    regSnap.docs.forEach((d) => tournamentIds.push(d.data().tournament_id));
  });

  const unique = Array.from(new Set(tournamentIds));
  const results = [];
  for (const id of unique) {
    const t = await getTournament(id);
    if (t) {
      // Filtra arquivados por padrão (a Dashboard do atleta mostra só ativos).
      if (!includeArchived && t.archived) continue;
      const adminDoc = adminSnap.docs.find((d) => d.data().tournament_id === id);
      results.push({
        ...t,
        my_role: adminDoc ? adminDoc.data().role : 'player',
      });
    }
  }
  return results;
}

export async function listAllTournaments({ includeArchived = false } = {}) {
  const snap = await getDocs(query(collection(db, COL.tournaments), orderBy('created_at', 'desc')));
  const docs = snap.docs.map((d) => d.data());
  if (includeArchived) return docs;
  // Filtro client-side: o Firestore já recusa leitura de arquivados para
  // não-criador/não-admin, mas se o caller for admin e passar
  // includeArchived=false, queremos garantir o contrato.
  return docs.filter((t) => !t.archived);
}

export async function listPublicTournaments() {
  if (!db) return [];
  const q = query(collection(db, COL.tournaments), where('visibility', '==', TOURNAMENT_VISIBILITY.PUBLIC));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// Sprint 4 ARE-14: lista tournaments vinculados a uma arena
export async function listArenaTournaments(arenaId) {
  if (!arenaId || !db) return [];
  const q = query(
    collection(db, COL.tournaments),
    where('arena_id', '==', arenaId),
    orderBy('starts_at', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
