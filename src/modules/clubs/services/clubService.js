/**
 * Serviço de Clubes — CRUD, membros, eventos e mural.
 *
 * Decisões de segurança/robustez:
 *  - Criação do clube e da primeira associação (admin) são escritas
 *    sequenciais (não em batch) para que a regra de segurança possa validar
 *    `clubs.created_by` ao criar o membro admin. Em caso de falha na segunda
 *    escrita, o clube é removido (rollback best-effort).
 *  - O contador `member_count` é apenas cosmético; nunca é fonte de verdade.
 *  - Sincronização do diretório de atletas é best-effort e nunca interrompe a
 *    operação principal.
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
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { syncAthleteProfile } from '@/modules/athletes/services/athleteService';
import {
  CLUB_COLLECTIONS,
  CLUB_ROLE,
  CLUB_EVENT_TYPE,
  GAME_DAY_LIMITS,
  EVENT_VISIBILITY,
  INVITE_STATUS,
  INVITE_SOURCE,
} from '../domain/constants.js';

const COL = CLUB_COLLECTIONS;

function eventInviteId(eventId, userId) {
  return `${eventId}_${userId}`;
}

function inviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function memberDocId(clubId, userId) {
  return `${clubId}_${userId}`;
}

function rsvpDocId(eventId, userId) {
  return `${eventId}_${userId}`;
}

function trimmed(value) {
  return String(value ?? '').trim();
}

/**
 * Executa um conjunto de operações de escrita em lotes de no máximo 450
 * (limite do Firestore é 500 por batch), de forma segura para grandes volumes.
 * @param {Array<{ type: 'set'|'delete', ref: any, data?: object }>} ops
 */
async function commitInChunks(ops) {
  const CHUNK = 450;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db);
    ops.slice(i, i + CHUNK).forEach((op) => {
      if (op.type === 'delete') batch.delete(op.ref);
      else batch.set(op.ref, op.data);
    });
    await batch.commit();
  }
}

function memberPayload(clubId, user, profile, role) {
  return {
    club_id: clubId,
    user_id: user.uid,
    user_name: profile?.platform_name || profile?.full_name || user.displayName || user.email || 'Atleta',
    user_email: user.email || '',
    photo_url: profile?.photo_url || user.photoURL || '',
    role,
    joined_at: serverTimestamp(),
  };
}

/* --------------------------------- Clubs -------------------------------- */

export async function createClub(creator, profile, data) {
  if (!creator?.uid) throw new Error('Usuário não autenticado.');
  if (!trimmed(data.name)) throw new Error('Informe o nome do clube.');

  const id = doc(collection(db, COL.clubs)).id;
  const payload = {
    id,
    name: trimmed(data.name),
    description: trimmed(data.description),
    city: trimmed(data.city),
    state: trimmed(data.state),
    logo_url: trimmed(data.logo_url),
    contact_email: trimmed(data.contact_email),
    contact_phone: trimmed(data.contact_phone),
    instagram: trimmed(data.instagram),
    home_venue: trimmed(data.home_venue),
    invite_code: inviteCode(),
    member_count: 1,
    created_by: creator.uid,
    creator_name: profile?.platform_name || creator.displayName || creator.email || '',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  await setDoc(doc(db, COL.clubs, id), payload);
  try {
    await setDoc(doc(db, COL.members, memberDocId(id, creator.uid)), memberPayload(id, creator, profile, CLUB_ROLE.ADMIN));
  } catch (err) {
    // Rollback: evita clube órfão sem administrador.
    await deleteDoc(doc(db, COL.clubs, id)).catch(() => {});
    throw err;
  }

  await syncAthleteProfile(creator, profile);
  await createAuditLog({ action: 'club_created', actor: creator, details: { club_id: id, name: payload.name } });
  logger.info('club_created', { id });
  return id;
}

export async function getClub(id) {
  if (!db || !id) return null;
  const snap = await getDoc(doc(db, COL.clubs, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getClubByInviteCode(code) {
  if (!db) return null;
  const snap = await getDocs(query(collection(db, COL.clubs), where('invite_code', '==', trimmed(code).toUpperCase())));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function listClubs() {
  if (!db) return [];
  const snap = await getDocs(collection(db, COL.clubs));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listMyClubs(userId) {
  if (!db || !userId) return [];
  const memberSnap = await getDocs(query(collection(db, COL.members), where('user_id', '==', userId)));
  const memberships = memberSnap.docs.map((d) => d.data());
  const results = [];
  for (const membership of memberships) {
    const club = await getClub(membership.club_id);
    if (club) results.push({ ...club, my_role: membership.role });
  }
  return results;
}

export async function updateClub(id, updates, actor) {
  const allowed = ['name', 'description', 'city', 'state', 'logo_url', 'contact_email', 'contact_phone', 'instagram', 'home_venue'];
  const sanitized = {};
  allowed.forEach((key) => {
    if (updates[key] !== undefined) sanitized[key] = trimmed(updates[key]);
  });
  await updateDoc(doc(db, COL.clubs, id), { ...sanitized, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'club_updated', actor, details: { club_id: id, fields: Object.keys(sanitized) } });
}

export async function regenerateInviteCode(id, actor) {
  const code = inviteCode();
  await updateDoc(doc(db, COL.clubs, id), { invite_code: code, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'club_invite_regenerated', actor, details: { club_id: id } });
  return code;
}

export async function deleteClub(id, actor) {
  // Remove eventos e posts ANTES dos membros: a regra de segurança para
  // excluí-los exige que o ator ainda seja admin (sua associação precisa
  // existir). Membros são removidos por último, depois o clube.
  const subcollections = [
    { col: COL.events, field: 'club_id' },
    { col: COL.rsvps, field: 'club_id' },
    { col: COL.posts, field: 'club_id' },
    { col: COL.members, field: 'club_id' },
  ];
  for (const { col, field } of subcollections) {
    try {
      const snap = await getDocs(query(collection(db, col), where(field, '==', id)));
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (!snap.empty) await batch.commit();
    } catch (err) {
      logger.error(`Falha ao limpar ${col} do clube ${id}:`, err);
    }
  }
  await deleteDoc(doc(db, COL.clubs, id));
  await createAuditLog({ action: 'club_deleted', actor, details: { club_id: id } });
}

/* -------------------------------- Members ------------------------------- */

export async function listClubMembers(clubId) {
  if (!db || !clubId) return [];
  const snap = await getDocs(query(collection(db, COL.members), where('club_id', '==', clubId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getMembership(clubId, userId) {
  if (!db || !clubId || !userId) return null;
  const snap = await getDoc(doc(db, COL.members, memberDocId(clubId, userId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function joinClubByCode(code, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const club = await getClubByInviteCode(code);
  if (!club) throw new Error('Código de convite inválido.');

  const existing = await getMembership(club.id, user.uid);
  if (existing) return club;

  await setDoc(doc(db, COL.members, memberDocId(club.id, user.uid)), memberPayload(club.id, user, profile, CLUB_ROLE.MEMBER));
  // Atualização cosmética do contador (best-effort).
  await updateDoc(doc(db, COL.clubs, club.id), { member_count: increment(1), updated_at: serverTimestamp() }).catch(() => {});
  await syncAthleteProfile(user, profile);
  await createAuditLog({ action: 'club_member_joined', actor: user, details: { club_id: club.id } });
  return club;
}

export async function leaveClub(clubId, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const members = await listClubMembers(clubId);
  const me = members.find((m) => m.user_id === user.uid);
  if (!me) return;
  const admins = members.filter((m) => m.role === CLUB_ROLE.ADMIN);
  if (me.role === CLUB_ROLE.ADMIN && admins.length === 1 && members.length > 1) {
    throw new Error('Você é o único administrador. Promova outro membro a administrador antes de sair.');
  }

  await deleteDoc(doc(db, COL.members, memberDocId(clubId, user.uid)));
  await updateDoc(doc(db, COL.clubs, clubId), { member_count: increment(-1), updated_at: serverTimestamp() }).catch(() => {});
  await syncAthleteProfile(user, profile);
  await createAuditLog({ action: 'club_member_left', actor: user, details: { club_id: clubId } });
}

export async function setMemberRole(clubId, member, role, actor) {
  if (!member?.user_id) throw new Error('Membro inválido.');
  if (role !== CLUB_ROLE.ADMIN && member.role === CLUB_ROLE.ADMIN) {
    // Impede remover o último administrador.
    const members = await listClubMembers(clubId);
    const admins = members.filter((m) => m.role === CLUB_ROLE.ADMIN);
    if (admins.length <= 1) throw new Error('O clube precisa ter pelo menos um administrador.');
  }
  await updateDoc(doc(db, COL.members, memberDocId(clubId, member.user_id)), { role, updated_at: serverTimestamp() });
  await createAuditLog({
    action: role === CLUB_ROLE.ADMIN ? 'club_admin_added' : 'club_admin_removed',
    actor,
    details: { club_id: clubId, user_id: member.user_id },
  });
}

export async function removeMember(clubId, member, actor) {
  if (!member?.user_id) throw new Error('Membro inválido.');
  if (member.role === CLUB_ROLE.ADMIN) {
    const members = await listClubMembers(clubId);
    const admins = members.filter((m) => m.role === CLUB_ROLE.ADMIN);
    if (admins.length <= 1) throw new Error('Não é possível remover o último administrador.');
  }
  await deleteDoc(doc(db, COL.members, memberDocId(clubId, member.user_id)));
  await updateDoc(doc(db, COL.clubs, clubId), { member_count: increment(-1), updated_at: serverTimestamp() }).catch(() => {});
  await createAuditLog({ action: 'club_member_removed', actor, details: { club_id: clubId, user_id: member.user_id } });
}

/* -------------------------------- Events -------------------------------- */

function sortEvents(list) {
  return list.sort((a, b) => String(a.starts_at || '').localeCompare(String(b.starts_at || '')));
}

/**
 * Lista os eventos visíveis para o usuário em um clube:
 *  - tenta a consulta ampla (funciona para admins/criadores ou quando não há
 *    evento privado bloqueando a leitura);
 *  - se as regras bloquearem (há eventos privados que o usuário não pode ler),
 *    cai para: eventos públicos + eventos privados em que o usuário foi
 *    convidado (via event_invites).
 */
export async function listClubEvents(clubId, userId) {
  if (!db || !clubId) return [];
  try {
    const snap = await getDocs(query(collection(db, COL.events), where('club_id', '==', clubId)));
    return sortEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  } catch (err) {
    logger.info('listClubEvents: fallback para eventos públicos + convites', { clubId, err: err?.code });
    const byId = new Map();
    try {
      const pub = await getDocs(
        query(collection(db, COL.events), where('club_id', '==', clubId), where('visibility', '==', EVENT_VISIBILITY.PUBLIC)),
      );
      pub.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
    } catch (e) {
      logger.error('Falha ao listar eventos públicos do clube:', e);
    }
    if (userId) {
      const invites = await listMyEventInvites(userId).catch(() => []);
      for (const inv of invites.filter((i) => i.club_id === clubId)) {
        if (byId.has(inv.event_id)) continue;
        const ev = await getClubEvent(inv.event_id).catch(() => null);
        if (ev) byId.set(ev.id, ev);
      }
    }
    return sortEvents(Array.from(byId.values()));
  }
}

export async function getClubEvent(eventId) {
  if (!db || !eventId) return null;
  const snap = await getDoc(doc(db, COL.events, eventId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createClubEvent(clubId, data, user) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!trimmed(data.title)) throw new Error('Informe o título do evento.');
  const id = doc(collection(db, COL.events)).id;
  const visibility = data.visibility === EVENT_VISIBILITY.PRIVATE ? EVENT_VISIBILITY.PRIVATE : EVENT_VISIBILITY.PUBLIC;
  await setDoc(doc(db, COL.events, id), {
    id,
    club_id: clubId,
    title: trimmed(data.title),
    description: trimmed(data.description),
    type: data.type || CLUB_EVENT_TYPE.SOCIAL,
    location: trimmed(data.location),
    starts_at: data.starts_at || null,
    recurring: !!data.recurring,
    visibility,
    created_by: user.uid,
    created_by_name: data.created_by_name || user.displayName || user.email || '',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  // O criador já entra como participante confirmado do evento.
  try {
    await setDoc(doc(db, COL.eventInvites, eventInviteId(id, user.uid)), {
      id: eventInviteId(id, user.uid),
      event_id: id,
      club_id: clubId,
      user_id: user.uid,
      user_name: data.created_by_name || user.displayName || user.email || 'Atleta',
      user_photo: data.created_by_photo || user.photoURL || '',
      status: INVITE_STATUS.GOING,
      source: INVITE_SOURCE.CLUB,
      invited_by: user.uid,
      created_at: serverTimestamp(),
      created_at_ms: Date.now(),
      updated_at: serverTimestamp(),
    });
  } catch (err) {
    logger.error('Falha ao registrar o criador como participante do evento:', err);
  }
  // Semeia a primeira data do evento (quando informada) para que a página do
  // evento já mostre a data com local/horário e permita respostas por data.
  if (data.starts_at) {
    try {
      await addEventDate(id, { club_id: clubId, date_time: data.starts_at, location: trimmed(data.location) }, user);
    } catch (err) {
      logger.error('Falha ao criar a data inicial do evento:', err);
    }
  }
  await createAuditLog({ action: 'club_event_created', actor: user, details: { club_id: clubId, event_id: id } });
  return id;
}

export async function updateClubEvent(eventId, updates, actor) {
  const allowed = ['title', 'description', 'type', 'location', 'starts_at', 'recurring', 'visibility'];
  const sanitized = {};
  allowed.forEach((key) => {
    if (updates[key] === undefined) return;
    if (key === 'starts_at') sanitized[key] = updates[key] || null;
    else if (key === 'type') sanitized[key] = updates[key];
    else if (key === 'recurring') sanitized[key] = !!updates[key];
    else if (key === 'visibility') sanitized[key] = updates[key] === EVENT_VISIBILITY.PRIVATE ? EVENT_VISIBILITY.PRIVATE : EVENT_VISIBILITY.PUBLIC;
    else sanitized[key] = trimmed(updates[key]);
  });
  await updateDoc(doc(db, COL.events, eventId), { ...sanitized, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'club_event_updated', actor, details: { event_id: eventId } });
}

/* ----------------------- Event invites / participants ------------------- */

export async function listEventInvites(eventId) {
  if (!db || !eventId) return [];
  const snap = await getDocs(query(collection(db, COL.eventInvites), where('event_id', '==', eventId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
}

export async function listMyEventInvites(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL.eventInvites), where('user_id', '==', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Eventos disponíveis para o usuário na página inicial:
 *  - eventos públicos dos clubes em que o usuário é membro;
 *  - eventos (públicos ou privados) para os quais o usuário foi convidado, de
 *    qualquer clube.
 */
export async function listAvailableEvents(userId, clubIds = []) {
  if (!db || !userId) return [];
  const byId = new Map();
  for (const cid of clubIds) {
    try {
      const snap = await getDocs(
        query(collection(db, COL.events), where('club_id', '==', cid), where('visibility', '==', EVENT_VISIBILITY.PUBLIC)),
      );
      snap.docs.forEach((d) => byId.set(d.id, { id: d.id, ...d.data(), my_invite_status: null }));
    } catch (err) {
      logger.error('Falha ao listar eventos públicos para o início:', err);
    }
  }
  const invites = await listMyEventInvites(userId).catch(() => []);
  const statusByEvent = new Map(invites.map((i) => [i.event_id, i.status]));
  for (const inv of invites) {
    if (!byId.has(inv.event_id)) {
      const ev = await getClubEvent(inv.event_id).catch(() => null);
      if (ev) byId.set(ev.id, { ...ev, my_invite_status: inv.status });
    }
  }
  // Anota a resposta do usuário (quando houver) também nos públicos.
  const result = Array.from(byId.values()).map((ev) => ({
    ...ev,
    my_invite_status: ev.my_invite_status ?? statusByEvent.get(ev.id) ?? null,
  }));
  return result.sort((a, b) => String(a.starts_at || '').localeCompare(String(b.starts_at || '')));
}

export async function getMyEventInvite(eventId, userId) {
  if (!db || !eventId || !userId) return null;
  const snap = await getDoc(doc(db, COL.eventInvites, eventInviteId(eventId, userId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Convida um atleta (do clube ou da plataforma) para o evento e notifica-o.
 * `target` = { user_id, user_name, user_photo, source }.
 */
export async function inviteToEvent(event, target, inviter, profile) {
  if (!inviter?.uid) throw new Error('Usuário não autenticado.');
  if (!target?.user_id) throw new Error('Selecione um atleta para convidar.');
  const id = eventInviteId(event.id, target.user_id);
  const existing = await getDoc(doc(db, COL.eventInvites, id));
  if (existing.exists()) return existing.data(); // já é participante/convidado

  const payload = {
    id,
    event_id: event.id,
    club_id: event.club_id,
    user_id: target.user_id,
    user_name: target.user_name || 'Atleta',
    user_photo: target.user_photo || '',
    status: INVITE_STATUS.INVITED,
    source: target.source === INVITE_SOURCE.PLATFORM ? INVITE_SOURCE.PLATFORM : INVITE_SOURCE.CLUB,
    invited_by: inviter.uid,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL.eventInvites, id), payload);

  const inviterName = profile?.platform_name || inviter.displayName || inviter.email || 'Um atleta';
  notifyUsers([target.user_id], {
    title: `${inviterName} convidou você para "${trimmed(event.title).slice(0, 60)}"`,
    message: 'Toque para ver o evento e responder: Vou, Talvez ou Não vou.',
    type: NOTIFICATION_TYPE.EVENT_INVITE,
    link: `/clubes/${event.club_id}/eventos/${event.id}`,
    actor: { uid: inviter.uid, displayName: inviterName },
  });
  return payload;
}

/** Resposta do próprio usuário (Vou/Talvez/Não vou) — cria ou atualiza o convite. */
export async function setMyEventResponse(event, status, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const id = eventInviteId(event.id, user.uid);
  await setDoc(
    doc(db, COL.eventInvites, id),
    {
      id,
      event_id: event.id,
      club_id: event.club_id,
      user_id: user.uid,
      user_name: profile?.platform_name || user.displayName || user.email || 'Atleta',
      user_photo: profile?.photo_url || user.photoURL || '',
      status,
      source: INVITE_SOURCE.CLUB,
      updated_at: serverTimestamp(),
      created_at_ms: Date.now(),
    },
    { merge: true },
  );
}

export async function removeEventInvite(eventId, userId) {
  await deleteDoc(doc(db, COL.eventInvites, eventInviteId(eventId, userId)));
}

async function deleteSubcollection(eventId, sub) {
  try {
    const snap = await getDocs(collection(db, COL.events, eventId, sub));
    if (snap.empty) return;
    await commitInChunks(snap.docs.map((d) => ({ type: 'delete', ref: d.ref })));
  } catch (err) {
    logger.error(`Falha ao limpar subcoleção ${sub} do evento ${eventId}:`, err);
  }
}

export async function deleteClubEvent(eventId, actor) {
  // RSVPs legados e convites/participações (coleções de nível superior).
  for (const colName of [COL.rsvps, COL.eventInvites]) {
    try {
      const snap = await getDocs(query(collection(db, colName), where('event_id', '==', eventId)));
      if (!snap.empty) await commitInChunks(snap.docs.map((d) => ({ type: 'delete', ref: d.ref })));
    } catch (err) {
      logger.error(`Falha ao limpar ${colName} do evento:`, err);
    }
  }
  // Limpa as subcoleções do evento (best-effort) antes de remover o documento.
  for (const sub of [COL.eventDates, COL.eventDateRsvps, COL.eventMessages, COL.eventParticipants, COL.eventGames]) {
    await deleteSubcollection(eventId, sub);
  }
  await deleteDoc(doc(db, COL.events, eventId));
  await createAuditLog({ action: 'club_event_deleted', actor, details: { event_id: eventId } });
}

/* --------------------------- Event dates -------------------------------- */

export async function listEventDates(eventId) {
  if (!db || !eventId) return [];
  const snap = await getDocs(collection(db, COL.events, eventId, COL.eventDates));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.date_time || '').localeCompare(String(b.date_time || '')));
}

export async function addEventDate(eventId, data, user) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const ref = doc(collection(db, COL.events, eventId, COL.eventDates));
  await setDoc(ref, {
    id: ref.id,
    event_id: eventId,
    club_id: data.club_id || '',
    date_time: data.date_time || null,
    location: trimmed(data.location),
    note: trimmed(data.note),
    created_by: user.uid,
    created_at_ms: Date.now(),
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEventDate(eventId, dateId, updates) {
  const allowed = ['date_time', 'location', 'note'];
  const sanitized = {};
  allowed.forEach((key) => {
    if (updates[key] === undefined) return;
    sanitized[key] = key === 'date_time' ? (updates[key] || null) : trimmed(updates[key]);
  });
  await updateDoc(doc(db, COL.events, eventId, COL.eventDates, dateId), { ...sanitized, updated_at: serverTimestamp() });
}

export async function deleteEventDate(eventId, dateId) {
  await deleteDoc(doc(db, COL.events, eventId, COL.eventDates, dateId));
}

/* ------------------------- Per-date RSVP -------------------------------- */

export async function listEventDateRsvps(eventId) {
  if (!db || !eventId) return [];
  const snap = await getDocs(collection(db, COL.events, eventId, COL.eventDateRsvps));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setEventDateRsvp(eventId, dateId, status, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  await setDoc(doc(db, COL.events, eventId, COL.eventDateRsvps, `${dateId}_${user.uid}`), {
    event_id: eventId,
    date_id: dateId,
    user_id: user.uid,
    user_name: profile?.platform_name || user.displayName || user.email || 'Atleta',
    user_photo: profile?.photo_url || user.photoURL || '',
    status,
    updated_at: serverTimestamp(),
  });
}

/* --------------------------- Event chat --------------------------------- */

export async function listEventMessages(eventId) {
  if (!db || !eventId) return [];
  const snap = await getDocs(collection(db, COL.events, eventId, COL.eventMessages));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
}

export async function sendEventMessage(eventId, text, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const body = trimmed(text, GAME_DAY_LIMITS.MESSAGE_MAX);
  if (!body) throw new Error('Escreva uma mensagem.');
  const ref = doc(collection(db, COL.events, eventId, COL.eventMessages));
  await setDoc(ref, {
    id: ref.id,
    event_id: eventId,
    text: body,
    sender_id: user.uid,
    sender_name: profile?.platform_name || user.displayName || user.email || 'Atleta',
    sender_photo: profile?.photo_url || user.photoURL || '',
    edited: false,
    created_at_ms: Date.now(),
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEventMessage(eventId, messageId, text) {
  await updateDoc(doc(db, COL.events, eventId, COL.eventMessages, messageId), {
    text: trimmed(text, GAME_DAY_LIMITS.MESSAGE_MAX),
    edited: true,
    edited_at: serverTimestamp(),
  });
}

export async function deleteEventMessage(eventId, messageId) {
  await deleteDoc(doc(db, COL.events, eventId, COL.eventMessages, messageId));
}

/* ----------------------- Game day participants -------------------------- */

export async function listEventParticipants(eventId) {
  if (!db || !eventId) return [];
  const snap = await getDocs(collection(db, COL.events, eventId, COL.eventParticipants));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
}

export async function addEventParticipant(eventId, data, user) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const name = trimmed(data.name);
  if (!name) throw new Error('Informe o nome do participante.');
  const ref = doc(collection(db, COL.events, eventId, COL.eventParticipants));
  await setDoc(ref, {
    id: ref.id,
    event_id: eventId,
    name,
    user_id: data.user_id || null,
    photo_url: trimmed(data.photo_url),
    source: data.source || 'guest',
    added_by: user.uid,
    created_at_ms: Date.now(),
    created_at: serverTimestamp(),
  });
  return ref.id;
}

export async function removeEventParticipant(eventId, participantId) {
  await deleteDoc(doc(db, COL.events, eventId, COL.eventParticipants, participantId));
}

/* -------------------------- Game day games ------------------------------ */

export async function listEventGames(eventId) {
  if (!db || !eventId) return [];
  const snap = await getDocs(collection(db, COL.events, eventId, COL.eventGames));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.created_at_ms || 0) - (b.created_at_ms || 0));
}

function sanitizeGameSide(side) {
  return (Array.isArray(side) ? side : [])
    .filter((p) => p && (p.name || p.id))
    .slice(0, 2)
    .map((p) => ({ id: p.id || null, name: trimmed(p.name) || 'Jogador' }));
}

export async function addEventGame(eventId, data, user) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const ref = doc(collection(db, COL.events, eventId, COL.eventGames));
  await setDoc(ref, buildGamePayload(ref.id, eventId, data, user));
  return ref.id;
}

function buildGamePayload(id, eventId, data, user) {
  const side_a = sanitizeGameSide(data.side_a);
  const side_b = sanitizeGameSide(data.side_b);
  return {
    id,
    event_id: eventId,
    round: data.round ?? null,
    kind: data.kind === 'singles' ? 'singles' : 'doubles',
    side_a,
    side_b,
    score_a: Number.isFinite(data.score_a) ? data.score_a : null,
    score_b: Number.isFinite(data.score_b) ? data.score_b : null,
    order: Number.isFinite(data.order) ? data.order : Date.now(),
    created_by: user.uid,
    created_at_ms: Date.now(),
    created_at: serverTimestamp(),
  };
}

export async function updateEventGame(eventId, gameId, updates) {
  const sanitized = {};
  if (updates.side_a !== undefined) sanitized.side_a = sanitizeGameSide(updates.side_a);
  if (updates.side_b !== undefined) sanitized.side_b = sanitizeGameSide(updates.side_b);
  if (updates.round !== undefined) sanitized.round = updates.round;
  if (updates.kind !== undefined) sanitized.kind = updates.kind === 'singles' ? 'singles' : 'doubles';
  if (updates.score_a !== undefined) sanitized.score_a = Number.isFinite(updates.score_a) ? updates.score_a : null;
  if (updates.score_b !== undefined) sanitized.score_b = Number.isFinite(updates.score_b) ? updates.score_b : null;
  if (updates.order !== undefined) sanitized.order = updates.order;
  await updateDoc(doc(db, COL.events, eventId, COL.eventGames, gameId), { ...sanitized, updated_at: serverTimestamp() });
}

export async function deleteEventGame(eventId, gameId) {
  await deleteDoc(doc(db, COL.events, eventId, COL.eventGames, gameId));
}

/**
 * Substitui TODOS os jogos do evento por uma nova lista (usado pelo sorteio).
 * Apaga os jogos atuais e grava os novos em lote.
 */
export async function replaceEventGames(eventId, games, user) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const existing = await getDocs(collection(db, COL.events, eventId, COL.eventGames));
  const ops = existing.docs.map((d) => ({ type: 'delete', ref: d.ref }));
  games.forEach((g, i) => {
    const ref = doc(collection(db, COL.events, eventId, COL.eventGames));
    ops.push({ type: 'set', ref, data: buildGamePayload(ref.id, eventId, { ...g, order: i }, user) });
  });
  await commitInChunks(ops);
}

export async function clearEventGames(eventId) {
  await deleteSubcollection(eventId, COL.eventGames);
}

export async function listEventRsvps(eventId) {
  if (!db || !eventId) return [];
  const snap = await getDocs(query(collection(db, COL.rsvps), where('event_id', '==', eventId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function setEventRsvp(event, status, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  await setDoc(doc(db, COL.rsvps, rsvpDocId(event.id, user.uid)), {
    event_id: event.id,
    club_id: event.club_id,
    user_id: user.uid,
    user_name: profile?.platform_name || user.displayName || user.email || 'Atleta',
    status,
    updated_at: serverTimestamp(),
  });
}

/* --------------------------------- Posts -------------------------------- */

export async function listClubPosts(clubId) {
  if (!db || !clubId) return [];
  const snap = await getDocs(query(collection(db, COL.posts), where('club_id', '==', clubId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
}

export async function createClubPost(clubId, input, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  // Aceita string (mensagem) ou objeto { content, images }.
  const payload = typeof input === 'string' ? { content: input } : (input || {});
  const text = trimmed(payload.content);
  const images = Array.isArray(payload.images)
    ? payload.images
        .filter((img) => img && img.url)
        .slice(0, 10)
        .map((img) => ({
          url: img.url,
          path: img.path || '',
          name: img.name || 'imagem',
          content_type: img.contentType || img.content_type || '',
          size: img.size || 0,
        }))
    : [];

  if (!text && images.length === 0) throw new Error('Escreva uma mensagem ou anexe uma imagem.');

  const id = doc(collection(db, COL.posts)).id;
  await setDoc(doc(db, COL.posts, id), {
    id,
    club_id: clubId,
    author_id: user.uid,
    author_name: profile?.platform_name || user.displayName || user.email || 'Atleta',
    author_photo: profile?.photo_url || user.photoURL || '',
    content: text.slice(0, 2000),
    images,
    created_at_ms: Date.now(),
    created_at: serverTimestamp(),
  });
  return id;
}

export async function deleteClubPost(postId, actor) {
  await deleteDoc(doc(db, COL.posts, postId));
  await createAuditLog({ action: 'club_post_deleted', actor, details: { post_id: postId } });
}
