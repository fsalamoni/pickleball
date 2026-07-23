/**
 * Service I/O de Professores (Sprint 4 PRO-15).
 *
 * Coleções:
 * - coaches/{uid} — perfil do professor (uid = user id)
 * - coach_arenas/{coachId_arenaId} — residência (vínculo)
 * - coach_class_enrollments/{classId_userId} — inscrições (futuro)
 *
 * Permissões:
 * - Coach pode editar o próprio perfil
 * - Arena manager pode adicionar/remover coach residente
 * - Coaches públicos: read por qualquer autenticado
 */

import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs,
  limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeCoachProfile, normalizeCoachResidency } from '../domain/coach.js';

export const COACH_COLLECTIONS = {
  coaches: 'coaches',
  residencies: 'coach_arenas',
};

function residencyId(coachId, arenaId) { return `${coachId}_${arenaId}`; }
function str(v) { return String(v ?? '').trim(); }

/* ----------------------------- Profile ----------------------------- */

/** Cria ou atualiza perfil de coach. */
export async function upsertCoachProfile(coachId, input, actor) {
  if (!coachId) throw new Error('coachId é obrigatório.');
  // só o próprio coach (ou platform_admin) pode editar
  if (actor?.uid !== coachId && !actor?.isPlatformAdmin) {
    throw new Error('Sem permissão para editar este perfil.');
  }
  const { valid, error, value } = normalizeCoachProfile(input);
  if (!valid) throw new Error(error);
  await setDoc(doc(db, COACH_COLLECTIONS.coaches, coachId), {
    ...value,
    user_id: coachId,
    updated_at: serverTimestamp(),
    created_at: serverTimestamp(),
  }, { merge: true });
  await createAuditLog({
    action: 'coach_profile_updated',
    actor,
    details: { coach_id: coachId, display_name: value.display_name },
  });
  return coachId;
}

export async function getCoach(coachId) {
  if (!coachId) return null;
  const snap = await getDoc(doc(db, COACH_COLLECTIONS.coaches, coachId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Lista coaches (com filtros opcionais). */
export async function listCoaches({ limit: lim = 100, region, modality, activeOnly = true, acceptingOnly = true } = {}) {
  const filters = [];
  if (activeOnly) filters.push(where('active', '==', true));
  if (acceptingOnly) filters.push(where('accepting_students', '==', true));
  filters.push(limit(lim));
  const q = query(collection(db, COACH_COLLECTIONS.coaches), ...filters, orderBy('display_name', 'asc'));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // filtros client-side (region/modality) pq array-contains-any não combina com outras restrições
  if (region) {
    const r = region.toLowerCase();
    return list.filter((c) => (c.regions || []).some((x) => x.toLowerCase().includes(r)));
  }
  if (modality) {
    const m = modality.toLowerCase();
    return list.filter((c) => (c.modalities || []).some((x) => x.toLowerCase().includes(m)));
  }
  return list;
}

/* ----------------------------- Residencies ------------------------- */

/** Adiciona coach como residente de uma arena. */
export async function addCoachResidency(input, actor) {
  const { valid, error, value } = normalizeCoachResidency(input);
  if (!valid) throw new Error(error);
  // Permissão: coach OU arena manager OU platform_admin
  const isAuthorized = await isResidencyAuthorized(value.coach_id, value.arena_id, actor);
  if (!isAuthorized) {
    throw new Error('Sem permissão para criar essa residência.');
  }
  await setDoc(doc(db, COACH_COLLECTIONS.residencies, residencyId(value.coach_id, value.arena_id)), {
    ...value,
    added_at: serverTimestamp(),
    added_by: actor?.uid || null,
  });
  await createAuditLog({
    action: 'coach_residency_added',
    actor,
    details: { coach_id: value.coach_id, arena_id: value.arena_id },
  });
}

export async function removeCoachResidency(coachId, arenaId, actor) {
  const isAuthorized = await isResidencyAuthorized(coachId, arenaId, actor);
  if (!isAuthorized) {
    throw new Error('Sem permissão para remover essa residência.');
  }
  await deleteDoc(doc(db, COACH_COLLECTIONS.residencies, residencyId(coachId, arenaId)));
  await createAuditLog({
    action: 'coach_residency_removed',
    actor,
    details: { coach_id: coachId, arena_id: arenaId },
  });
}

/**
 * Atualiza campos editáveis de uma residência (status active/paused e notas),
 * preservando o restante. Autorizado para o coach, gestor da arena ou admin.
 */
export async function updateCoachResidency(coachId, arenaId, patch = {}, actor) {
  const isAuthorized = await isResidencyAuthorized(coachId, arenaId, actor);
  if (!isAuthorized) {
    throw new Error('Sem permissão para editar essa residência.');
  }
  const update = { updated_at: serverTimestamp() };
  if (patch.status !== undefined) update.status = patch.status === 'paused' ? 'paused' : 'active';
  if (patch.notes !== undefined) update.notes = str(patch.notes).slice(0, 500);
  await updateDoc(doc(db, COACH_COLLECTIONS.residencies, residencyId(coachId, arenaId)), update);
  await createAuditLog({
    action: 'coach_residency_updated',
    actor,
    details: { coach_id: coachId, arena_id: arenaId, status: update.status },
  });
}

async function isResidencyAuthorized(coachId, arenaId, actor) {
  if (!actor?.uid) return false;
  if (actor.isPlatformAdmin) return true;
  if (actor.uid === coachId) return true;
  // arena manager
  const mgrSnap = await getDoc(doc(db, 'arena_managers', `${arenaId}_${actor.uid}`));
  if (mgrSnap.exists()) return true;
  return false;
}

export async function listCoachResidencies(coachId) {
  if (!coachId) return [];
  const q = query(collection(db, COACH_COLLECTIONS.residencies), where('coach_id', '==', coachId), orderBy('added_at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listArenaCoaches(arenaId, { activeOnly = true } = {}) {
  if (!arenaId) return [];
  const filters = [where('arena_id', '==', arenaId)];
  const q = query(collection(db, COACH_COLLECTIONS.residencies), ...filters, orderBy('added_at', 'desc'));
  const snap = await getDocs(q);
  const residencies = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // filtra status
  const filtered = activeOnly ? residencies.filter((r) => r.status === 'active') : residencies;
  // hidrata com perfil
  const enriched = [];
  for (const r of filtered) {
    const profile = await getCoach(r.coach_id);
    if (profile) enriched.push({ ...profile, residency: r });
  }
  return enriched;
}
