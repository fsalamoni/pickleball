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
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { normalizeCoachProfile, normalizeCoachResidency } from '../domain/coach.js';
import { syncAthleteProfile } from '@/modules/athletes/services/athleteService';

export const COACH_COLLECTIONS = {
  coaches: 'coaches',
  residencies: 'coach_arenas',
};

function residencyId(coachId, arenaId) { return `${coachId}_${arenaId}`; }
function str(v) { return String(v ?? '').trim(); }
function toList(v) {
  if (Array.isArray(v)) return v.map((x) => str(x)).filter(Boolean);
  return str(v).split(',').map((x) => x.trim()).filter(Boolean);
}

/**
 * Espelha o resumo do perfil de professor em `users/{uid}` e no diretório
 * público de atletas, mantendo as duas fontes (coaches ↔ users) em sincronia.
 * Assim, editar em /coaches reflete no editor de perfil e no diretório, e
 * vice-versa. Best-effort: falhas não interrompem o fluxo principal.
 */
async function mirrorCoachToUser(coachId, value) {
  const mirror = {
    is_coach: value.active !== false,
    coach_bio: value.bio || '',
    coach_price: value.hourly_rate == null ? '' : String(value.hourly_rate),
    coach_regions: (value.regions || []).join(', '),
    coach_modalities: (value.modalities || []).join(', '),
    updated_at: serverTimestamp(),
  };
  try {
    const userRef = doc(db, 'users', coachId);
    const userSnap = await getDoc(userRef);
    await setDoc(userRef, mirror, { merge: true });
    const mergedProfile = { uid: coachId, ...(userSnap.exists() ? userSnap.data() : {}), ...mirror };
    await syncAthleteProfile(
      { uid: coachId, email: mergedProfile.email, photoURL: mergedProfile.photo_url },
      mergedProfile,
    );
  } catch (err) {
    logger.error('Falha ao espelhar perfil de professor no usuário/diretório:', err);
  }
}

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
  // Espelha o resumo em users/{uid} + diretório (mantém "Sou professor" do
  // editor de perfil em sincronia com o perfil completo).
  await mirrorCoachToUser(coachId, value);
  await createAuditLog({
    action: 'coach_profile_updated',
    actor,
    details: { coach_id: coachId, display_name: value.display_name },
  });
  return coachId;
}

/**
 * Sincroniza o documento de professor (`coaches/{uid}`) a partir dos campos
 * essenciais editados no "Sou professor" do perfil do usuário, PRESERVANDO os
 * campos avançados já cadastrados (certificações, fotos, contatos, modalidades
 * não informadas). Também espelha o resumo em users/diretório.
 *
 * - is_coach=false → apenas desativa o perfil (esconde do diretório) sem apagar.
 * - is_coach=true  → faz upsert (merge) do perfil, exigindo ao menos uma
 *   modalidade (informada ou já existente).
 *
 * @param {string} coachId
 * @param {{ is_coach, bio?, hourly_rate?, regions?, modalities?, display_name? }} essentials
 * @param {object} actor
 */
export async function syncCoachDocFromEssentials(coachId, essentials = {}, actor) {
  if (!coachId) throw new Error('coachId é obrigatório.');
  if (actor?.uid !== coachId && !actor?.isPlatformAdmin) {
    throw new Error('Sem permissão para editar este perfil.');
  }
  const existing = await getCoach(coachId);

  if (!essentials.is_coach) {
    if (existing && existing.active !== false) {
      await updateDoc(doc(db, COACH_COLLECTIONS.coaches, coachId), { active: false, updated_at: serverTimestamp() });
      await mirrorCoachToUser(coachId, { ...existing, active: false });
    }
    await createAuditLog({ action: 'coach_profile_deactivated', actor, details: { coach_id: coachId } });
    return coachId;
  }

  const regionsArr = essentials.regions !== undefined ? toList(essentials.regions) : (existing?.regions || []);
  const modalitiesArr = essentials.modalities !== undefined ? toList(essentials.modalities) : [];
  const merged = {
    display_name: existing?.display_name || str(essentials.display_name) || 'Professor',
    bio: essentials.bio !== undefined ? str(essentials.bio) : (existing?.bio || ''),
    hourly_rate: essentials.hourly_rate === '' || essentials.hourly_rate == null
      ? (existing?.hourly_rate ?? null)
      : Number(essentials.hourly_rate),
    regions: regionsArr,
    modalities: modalitiesArr.length ? modalitiesArr : (existing?.modalities || []),
    certifications: existing?.certifications || [],
    photos: existing?.photos || [],
    contact_whatsapp: existing?.contact_whatsapp || '',
    contact_email: existing?.contact_email || '',
    accepting_students: existing?.accepting_students !== false,
    active: true,
  };
  const { valid, error, value } = normalizeCoachProfile(merged);
  if (!valid) throw new Error(error);
  await setDoc(doc(db, COACH_COLLECTIONS.coaches, coachId), {
    ...value,
    user_id: coachId,
    updated_at: serverTimestamp(),
    created_at: existing?.created_at || serverTimestamp(),
  }, { merge: true });
  await mirrorCoachToUser(coachId, value);
  await createAuditLog({ action: 'coach_profile_synced_from_profile', actor, details: { coach_id: coachId } });
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
export async function addCoachResidency(input, actor, { requireAcceptance = false } = {}) {
  const { valid, error, value } = normalizeCoachResidency(input);
  if (!valid) throw new Error(error);
  // Permissão: coach OU arena manager OU platform_admin
  const isAuthorized = await isResidencyAuthorized(value.coach_id, value.arena_id, actor);
  if (!isAuthorized) {
    throw new Error('Sem permissão para criar essa residência.');
  }
  // Parceria mútua (flag): quando quem adiciona NÃO é o próprio professor, o
  // vínculo nasce pendente e só fica ativo após o professor aceitar.
  const managerAdded = actor?.uid && actor.uid !== value.coach_id;
  if (requireAcceptance && managerAdded) value.status = 'pending';
  await setDoc(doc(db, COACH_COLLECTIONS.residencies, residencyId(value.coach_id, value.arena_id)), {
    ...value,
    added_at: serverTimestamp(),
    added_by: actor?.uid || null,
  });
  // Se quem vinculou não foi o próprio professor (ex.: gestor da arena),
  // avisa o professor de que virou parceiro daquela arena.
  if (actor?.uid && actor.uid !== value.coach_id) {
    let arenaName = 'uma arena';
    try {
      const arenaSnap = await getDoc(doc(db, 'arenas', value.arena_id));
      if (arenaSnap.exists()) arenaName = arenaSnap.data().name || arenaName;
    } catch { /* nome é opcional */ }
    notifyUsers([value.coach_id], {
      title: value.status === 'pending' ? 'Convite de parceria de arena' : 'Você é professor parceiro de uma arena',
      message: value.status === 'pending'
        ? `${arenaName} convidou você como professor parceiro. Aceite ou recuse no seu painel.`
        : `${arenaName} adicionou você como professor parceiro. Veja no seu painel.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/aulas',
      actor: { uid: actor.uid },
    });
  }
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

/** O professor aceita um convite de parceria (status pending → active). */
export async function acceptCoachResidency(coachId, arenaId, actor) {
  if (!actor?.uid || actor.uid !== coachId) throw new Error('Apenas o professor pode aceitar a parceria.');
  const ref = doc(db, COACH_COLLECTIONS.residencies, residencyId(coachId, arenaId));
  await updateDoc(ref, { status: 'active', accepted_at: serverTimestamp(), updated_at: serverTimestamp() });
  // Avisa os gestores da arena.
  try {
    const mgrsSnap = await getDocs(query(collection(db, 'arena_managers'), where('arena_id', '==', arenaId)));
    const ids = mgrsSnap.docs.map((d) => d.data().user_id).filter(Boolean);
    if (ids.length > 0) {
      notifyUsers(ids, {
        title: 'Professor aceitou a parceria',
        message: 'O professor confirmou a parceria com a sua arena.',
        type: NOTIFICATION_TYPE.GENERIC,
        link: `/arenas/${arenaId}/gerir`,
        actor: { uid: actor.uid },
      });
    }
  } catch { /* notificação é best-effort */ }
  await createAuditLog({ action: 'coach_residency_accepted', actor, details: { coach_id: coachId, arena_id: arenaId } });
}

/** O professor recusa um convite de parceria (remove o vínculo pendente). */
export async function declineCoachResidency(coachId, arenaId, actor) {
  if (!actor?.uid || actor.uid !== coachId) throw new Error('Apenas o professor pode recusar a parceria.');
  await deleteDoc(doc(db, COACH_COLLECTIONS.residencies, residencyId(coachId, arenaId)));
  await createAuditLog({ action: 'coach_residency_declined', actor, details: { coach_id: coachId, arena_id: arenaId } });
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
