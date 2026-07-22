/**
 * Serviço de Arenas — CRUD, gestores, fotos, preços, favoritos e avaliações.
 *
 * Padrões (iguais aos demais módulos):
 *  - IDs determinísticos onde faz sentido (gestor: arenaId_uid; favorito:
 *    uid_arenaId) para evitar duplicidade.
 *  - Contadores (rating_count) são cosméticos; a verdade é a coleção.
 *  - Auditoria e notificações são best-effort e nunca interrompem o fluxo.
 */

import {
  addDoc,
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
import { ARENA_COLLECTIONS, ARENA_MANAGER_ROLE, REVIEW_TYPE, REVIEW_TYPE_LABELS } from '../domain/constants.js';
import { normalizeArenaInput } from '../domain/arena.js';
import { normalizeCourtInput, nextSortOrder, renumberSortOrder } from '../domain/court.js';
import { normalizeScheduleInput } from '../domain/court_schedule.js';
import { normalizePriceRule, normalizePriceOverride } from '../domain/pricing.js';
import { normalizeReviewResponse } from '../domain/review_response.js';

const COL = ARENA_COLLECTIONS;

function managerId(arenaId, userId) {
  return `${arenaId}_${userId}`;
}
function favoriteId(userId, arenaId) {
  return `${userId}_${arenaId}`;
}
function str(v) {
  return String(v ?? '').trim();
}

function displayName(user, profile) {
  return profile?.platform_name || profile?.full_name || user?.displayName || user?.email || 'Atleta';
}

/* -------------------------------- Arenas -------------------------------- */

export async function createArena(user, profile, input) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const { valid, errors, value } = normalizeArenaInput(input);
  if (!valid) throw new Error(errors.name || 'Dados inválidos.');

  const id = doc(collection(db, COL.arenas)).id;
  const payload = {
    id,
    ...value,
    photos: [],
    cover_url: '',
    price_rules: [],
    price_overrides: [],
    rating_avg: null,
    rating_count: 0,
    owner_id: user.uid,
    owner_name: displayName(user, profile),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL.arenas, id), payload);
  try {
    await setDoc(doc(db, COL.managers, managerId(id, user.uid)), {
      id: managerId(id, user.uid),
      arena_id: id,
      user_id: user.uid,
      user_name: displayName(user, profile),
      user_photo: profile?.photo_url || user.photoURL || '',
      role: ARENA_MANAGER_ROLE.OWNER,
      created_at: serverTimestamp(),
    });
  } catch (err) {
    await deleteDoc(doc(db, COL.arenas, id)).catch(() => {});
    throw err;
  }
  await createAuditLog({ action: 'arena_created', actor: user, details: { arena_id: id, name: value.name } });
  logger.info('arena_created', { id });
  return id;
}

export async function getArena(id) {
  if (!db || !id) return null;
  const snap = await getDoc(doc(db, COL.arenas, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listArenas() {
  if (!db) return [];
  const snap = await getDocs(collection(db, COL.arenas));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listMyManagedArenas(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL.managers), where('user_id', '==', userId)));
  const arenas = [];
  for (const m of snap.docs.map((d) => d.data())) {
    const arena = await getArena(m.arena_id);
    if (arena) arenas.push({ ...arena, my_role: m.role });
  }
  return arenas;
}

export async function updateArena(id, updates, actor) {
  const { value } = normalizeArenaInput({ ...updates });
  const allowed = [
    'name', 'description', 'city', 'state', 'address', 'neighborhood',
    'contact_phone', 'contact_whatsapp', 'contact_email', 'instagram',
    'website', 'hours', 'court_count', 'base_price', 'active',
    'house_rules_md', 'allow_instant_booking', // Sprint 3 ARE-18 + ARE-03
  ];
  const sanitized = {};
  allowed.forEach((key) => {
    if (updates[key] !== undefined) sanitized[key] = value[key];
  });
  await updateDoc(doc(db, COL.arenas, id), { ...sanitized, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'arena_updated', actor, details: { arena_id: id, fields: Object.keys(sanitized) } });
}

export async function setArenaPhotos(id, photos, actor) {
  const clean = (Array.isArray(photos) ? photos : [])
    .filter((p) => p && p.url)
    .slice(0, 20)
    .map((p) => ({ url: p.url, path: p.path || '', name: p.name || 'foto' }));
  await updateDoc(doc(db, COL.arenas, id), {
    photos: clean,
    cover_url: clean[0]?.url || '',
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_photos_updated', actor, details: { arena_id: id, count: clean.length } });
}

export async function saveArenaPricing(id, { base_price, price_rules, price_overrides }, actor) {
  const rules = (Array.isArray(price_rules) ? price_rules : [])
    .map((r) => normalizePriceRule(r))
    .filter((r) => r.valid)
    .map((r) => r.value)
    .slice(0, 40);
  const overrides = (Array.isArray(price_overrides) ? price_overrides : [])
    .map((o) => normalizePriceOverride(o))
    .filter((o) => o.valid)
    .map((o) => o.value)
    .slice(0, 60);
  const base = base_price === '' || base_price == null ? null : Math.max(0, Number(base_price) || 0);
  await updateDoc(doc(db, COL.arenas, id), {
    base_price: base,
    price_rules: rules,
    price_overrides: overrides,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_pricing_updated', actor, details: { arena_id: id, rules: rules.length, overrides: overrides.length } });
}

export async function deleteArena(id, actor) {
  for (const col of [COL.bookings, COL.reviews, COL.managers]) {
    try {
      const snap = await getDocs(query(collection(db, col), where('arena_id', '==', id)));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      logger.error(`Falha ao limpar ${col} da arena ${id}:`, err);
    }
  }
  await deleteDoc(doc(db, COL.arenas, id));
  await createAuditLog({ action: 'arena_deleted', actor, details: { arena_id: id } });
}

/* -------------------------------- Managers ------------------------------ */

export async function listArenaManagers(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL.managers), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listArenaManagerIds(arenaId) {
  return (await listArenaManagers(arenaId)).map((m) => m.user_id).filter(Boolean);
}

export async function addArenaManager(arena, target, actor) {
  if (!target?.user_id) throw new Error('Selecione um atleta para adicionar.');
  await setDoc(doc(db, COL.managers, managerId(arena.id, target.user_id)), {
    id: managerId(arena.id, target.user_id),
    arena_id: arena.id,
    user_id: target.user_id,
    user_name: target.user_name || 'Atleta',
    user_photo: target.user_photo || '',
    role: ARENA_MANAGER_ROLE.MANAGER,
    created_at: serverTimestamp(),
  });
  notifyUsers([target.user_id], {
    title: `Você agora administra a arena "${str(arena.name).slice(0, 50)}"`,
    message: 'Toque para gerenciar reservas, preços e informações da arena.',
    type: NOTIFICATION_TYPE.GENERIC,
    link: `/arenas/${arena.id}/gerir`,
    actor,
  });
  await createAuditLog({ action: 'arena_manager_added', actor, details: { arena_id: arena.id, user_id: target.user_id } });
}

export async function removeArenaManager(arenaId, userId, actor) {
  await deleteDoc(doc(db, COL.managers, managerId(arenaId, userId)));
  await createAuditLog({ action: 'arena_manager_removed', actor, details: { arena_id: arenaId, user_id: userId } });
}

/* ------------------------------- Favorites ------------------------------ */

export async function listMyFavoriteArenas(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL.favorites), where('user_id', '==', userId)));
  return snap.docs.map((d) => d.data().arena_id).filter(Boolean);
}

export async function favoriteArena(user, arena) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  await setDoc(doc(db, COL.favorites, favoriteId(user.uid, arena.id)), {
    id: favoriteId(user.uid, arena.id),
    user_id: user.uid,
    arena_id: arena.id,
    arena_name: str(arena.name),
    created_at: serverTimestamp(),
  });
}

export async function unfavoriteArena(userId, arenaId) {
  await deleteDoc(doc(db, COL.favorites, favoriteId(userId, arenaId)));
}

/* -------------------------------- Reviews ------------------------------- */

export async function listArenaReviews(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL.reviews), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
}

export async function addArenaReview(arena, user, profile, input) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const type = Object.values(REVIEW_TYPE).includes(input.type) ? input.type : REVIEW_TYPE.REVIEW;
  const comment = str(input.comment).slice(0, 1000);
  const rating = type === REVIEW_TYPE.REVIEW ? Math.max(1, Math.min(5, Math.round(Number(input.rating) || 0))) : null;
  if (type === REVIEW_TYPE.REVIEW && !rating) throw new Error('Escolha uma nota de 1 a 5.');
  if (type !== REVIEW_TYPE.REVIEW && !comment) throw new Error('Escreva sua mensagem.');

  const id = doc(collection(db, COL.reviews)).id;
  await setDoc(doc(db, COL.reviews, id), {
    id,
    arena_id: arena.id,
    user_id: user.uid,
    user_name: displayName(user, profile),
    user_photo: profile?.photo_url || user.photoURL || '',
    type,
    rating,
    comment,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  });

  // Recalcula a média (cosmética) só das avaliações.
  try {
    const reviews = await listArenaReviews(arena.id);
    const ratings = reviews.filter((r) => (r.type ?? 'review') === 'review' && Number.isFinite(r.rating));
    const avg = ratings.length ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10 : null;
    await updateDoc(doc(db, COL.arenas, arena.id), { rating_avg: avg, rating_count: ratings.length }).catch(() => {});
  } catch (err) {
    logger.info('Falha ao recalcular média da arena (cosmético)', { err: err?.code });
  }

  // Notifica os gestores da arena sobre a nova manifestação.
  try {
    const managerIds = await listArenaManagerIds(arena.id);
    notifyUsers(managerIds, {
      title: `Nova ${REVIEW_TYPE_LABELS[type].toLowerCase()} em "${str(arena.name).slice(0, 50)}"`,
      message: type === REVIEW_TYPE.REVIEW ? `Nota ${rating}★${comment ? `: ${comment.slice(0, 80)}` : ''}` : comment.slice(0, 100),
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/arenas/${arena.id}/gerir`,
      actor: { uid: user.uid, displayName: displayName(user, profile) },
    });
  } catch (err) {
    logger.info('Falha ao notificar gestores da arena', { err: err?.code });
  }
  return id;
}

export async function deleteArenaReview(review, actor) {
  await deleteDoc(doc(db, COL.reviews, review.id));
  await createAuditLog({ action: 'arena_review_deleted', actor, details: { arena_id: review.arena_id, review_id: review.id } });
}

/* ---------------------- Review responses (Sprint 3 ARE-09) ---------- */

/**
 * Manager responde (ou atualiza) a uma review. Valida tamanho, atualiza
 * `response` + `responded_at` + `responded_by`. Audit log best-effort.
 */
export async function respondToArenaReview(reviewId, responseText, actor) {
  if (!db || !reviewId) throw new Error('Review inválida.');
  const { valid, error, value } = normalizeReviewResponse({ response: responseText });
  if (!valid) throw new Error(error);
  await updateDoc(doc(db, COL.reviews, reviewId), {
    response: value,
    responded_at: serverTimestamp(),
    responded_by: actor?.uid || null,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_review_responded',
    actor,
    details: { review_id: reviewId, response_length: value.length },
  });
}

/** Manager remove sua resposta (volta o review ao estado sem response). */
export async function deleteArenaReviewResponse(reviewId, actor) {
  if (!db || !reviewId) throw new Error('Review inválida.');
  await updateDoc(doc(db, COL.reviews, reviewId), {
    response: null,
    responded_at: null,
    responded_by: null,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_review_response_deleted',
    actor,
    details: { review_id: reviewId },
  });
}

/* ---------------------- Courts (ARE-01, Sprint 1) -------------------- */

/**
 * Lista as quadras de uma arena. Retorna array vazio se não houver quadras
 * (não confundir com erro).
 */
export async function listArenaCourts(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL.courts), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Cria uma quadra nova em uma arena. Valida input, escolhe sort_order
 * automático (max+1), faz audit log. Lança erro se input inválido.
 */
export async function createArenaCourt(arenaId, input, actor) {
  if (!db || !arenaId) throw new Error('Arena inválida.');
  const { valid, errors, value } = normalizeCourtInput(input);
  if (!valid) {
    const first = Object.values(errors)[0];
    throw new Error(first || 'Dados da quadra inválidos.');
  }
  const existing = await listArenaCourts(arenaId);
  const ref = doc(collection(db, COL.courts));
  const payload = {
    arena_id: arenaId,
    ...value,
    sort_order: Number.isFinite(input.sort_order) ? value.sort_order : nextSortOrder(existing),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  await setDoc(ref, payload);
  await createAuditLog({
    action: 'arena_court_created',
    actor,
    details: { arena_id: arenaId, court_id: ref.id, name: value.name },
  });
  return ref.id;
}

/**
 * Atualiza uma quadra. Merge com normalização. Audit log best-effort.
 */
export async function updateArenaCourt(courtId, input, actor) {
  if (!db || !courtId) throw new Error('Quadra inválida.');
  const { valid, errors, value } = normalizeCourtInput(input);
  if (!valid) {
    const first = Object.values(errors)[0];
    throw new Error(first || 'Dados da quadra inválidos.');
  }
  await updateDoc(doc(db, COL.courts, courtId), { ...value, updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'arena_court_updated',
    actor,
    details: { court_id: courtId, arena_id: input.arena_id, name: value.name },
  });
}

/**
 * Remove uma quadra. Não remove bookings existentes que referenciam essa
 * quadra (Firestore não tem constraint; fica como `court_id` órfão no
 * histórico, o que é OK porque UI mostra o nome congelado).
 */
export async function deleteArenaCourt(courtId, actor) {
  if (!db || !courtId) throw new Error('Quadra inválida.');
  const ref = doc(db, COL.courts, courtId);
  const snap = await getDoc(ref);
  const arenaId = snap.exists() ? snap.data().arena_id : null;
  await deleteDoc(ref);
  await createAuditLog({
    action: 'arena_court_deleted',
    actor,
    details: { court_id: courtId, arena_id: arenaId },
  });
}

/**
 * Reordena quadras: recebe array de {id, sort_order} e aplica.
 * Usa batch write (all-or-nothing) pra evitar estado intermediário.
 */
export async function reorderArenaCourts(arenaId, orderedIds, actor) {
  if (!db || !arenaId) throw new Error('Arena inválida.');
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  // Valida que todos os IDs são strings não-vazias e sem duplicatas
  const seen = new Set();
  for (const id of orderedIds) {
    if (typeof id !== 'string' || !id) throw new Error('IDs de quadra inválidos.');
    if (seen.has(id)) throw new Error('IDs de quadra duplicados.');
    seen.add(id);
  }
  // Aplica via setDoc merge (Firestore não tem batch.updateDoc no Web SDK
  // sem import extra; setDoc merge é equivalente e atômico por doc).
  await Promise.all(
    orderedIds.map((id, idx) =>
      setDoc(
        doc(db, COL.courts, id),
        { sort_order: idx, arena_id: arenaId, updated_at: serverTimestamp() },
        { merge: true },
      ),
    ),
  );
  await createAuditLog({
    action: 'arena_courts_reordered',
    actor,
    details: { arena_id: arenaId, count: orderedIds.length },
  });
}

/**
 * Renumera sort_order sequencialmente baseado na ordem atual (helper
 * idempotente, útil pra "normalizar" depois de várias edições manuais).
 */
export async function normalizeArenaCourtsOrder(arenaId, actor) {
  if (!db || !arenaId) throw new Error('Arena inválida.');
  const courts = await listArenaCourts(arenaId);
  const renumbered = renumberSortOrder(courts);
  const orderedIds = renumbered.map((c) => c.id);
  await reorderArenaCourts(arenaId, orderedIds, actor);
}

/* ---------------------- Court Schedules (ARE-04, Sprint 1) ---------- */

/**
 * Lista schedules (janelas de horário recorrentes) de uma arena.
 * Retorna array vazio se não houver schedules.
 */
export async function listArenaCourtSchedules(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(
    query(collection(db, COL.court_schedules), where('arena_id', '==', arenaId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Lista schedules de UMA quadra específica. Útil pra UI que expande
 * a quadra e mostra os horários dela.
 */
export async function listCourtSchedules(courtId) {
  if (!db || !courtId) return [];
  const snap = await getDocs(
    query(collection(db, COL.court_schedules), where('court_id', '==', courtId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Cria uma janela de horário recorrente. Audit log best-effort.
 */
export async function createCourtSchedule(arenaId, courtId, input, actor) {
  if (!db || !arenaId || !courtId) throw new Error('Arena ou quadra inválida.');
  const { valid, errors, value } = normalizeScheduleInput(input);
  if (!valid) {
    const first = Object.values(errors)[0];
    throw new Error(first || 'Dados do horário inválidos.');
  }
  const ref = doc(collection(db, COL.court_schedules));
  await setDoc(ref, {
    arena_id: arenaId,
    court_id: courtId,
    ...value,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_court_schedule_created',
    actor,
    details: { arena_id: arenaId, court_id: courtId, schedule_id: ref.id, weekdays: value.weekdays },
  });
  return ref.id;
}

/**
 * Atualiza uma janela de horário. Audit log best-effort.
 */
export async function updateCourtSchedule(scheduleId, input, actor) {
  if (!db || !scheduleId) throw new Error('Horário inválido.');
  const { valid, errors, value } = normalizeScheduleInput(input);
  if (!valid) {
    const first = Object.values(errors)[0];
    throw new Error(first || 'Dados do horário inválidos.');
  }
  await updateDoc(doc(db, COL.court_schedules, scheduleId), {
    ...value,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_court_schedule_updated',
    actor,
    details: { schedule_id: scheduleId, arena_id: input.arena_id, court_id: input.court_id, weekdays: value.weekdays },
  });
}

/**
 * Remove uma janela de horário. Bookings existentes que referenciam
 * implicitamente esse slot continuam no histórico (a referência é por
 * arena_id+court_id+date, não por schedule_id).
 */
export async function deleteCourtSchedule(scheduleId, actor) {
  if (!db || !scheduleId) throw new Error('Horário inválido.');
  const ref = doc(db, COL.court_schedules, scheduleId);
  const snap = await getDoc(ref);
  const meta = snap.exists() ? snap.data() : null;
  await deleteDoc(ref);
  await createAuditLog({
    action: 'arena_court_schedule_deleted',
    actor,
    details: { schedule_id: scheduleId, arena_id: meta?.arena_id, court_id: meta?.court_id },
  });
}


/* ---------------------- Unavailabilities (Sprint 5) ----------------- */

export async function addArenaUnavailability(arenaId, input, actor) {
  if (!db || !arenaId) throw new Error('Arena inválida.');
  if (!input.date || !input.start_time || !input.end_time) {
    throw new Error('Data, hora início e fim são obrigatórios.');
  }
  const ref = await addDoc(collection(db, COL.unavailabilities), {
    arena_id: arenaId,
    court_id: input.court_id || null,
    date: input.date,
    start_time: input.start_time,
    end_time: input.end_time,
    notes: str(input.notes || '').slice(0, 500),
    created_by: actor?.uid || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_unavailability_added',
    actor,
    details: { arena_id: arenaId, court_id: input.court_id, date: input.date },
  });
  return ref.id;
}

export async function deleteArenaUnavailability(unavId, actor) {
  if (!db || !unavId) throw new Error('Indisponibilidade inválida.');
  const snap = await getDoc(doc(db, COL.unavailabilities, unavId));
  const meta = snap.exists() ? snap.data() : null;
  await deleteDoc(doc(db, COL.unavailabilities, unavId));
  await createAuditLog({
    action: 'arena_unavailability_deleted',
    actor,
    details: { unavailability_id: unavId, arena_id: meta?.arena_id },
  });
}

export async function listArenaUnavailabilities(arenaId, { from, to } = {}) {
  if (!arenaId || !db) return [];
  const filters = [where('arena_id', '==', arenaId)];
  if (from) filters.push(where('date', '>=', from));
  if (to) filters.push(where('date', '<=', to));
  filters.push(orderBy('date', 'asc'));
  const snap = await getDocs(query(collection(db, COL.unavailabilities), ...filters));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
