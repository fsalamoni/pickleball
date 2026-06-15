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
import { syncAthleteProfile } from '@/modules/athletes/services/athleteService';
import { CLUB_COLLECTIONS, CLUB_ROLE, CLUB_EVENT_TYPE } from '../domain/constants.js';

const COL = CLUB_COLLECTIONS;

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

function memberPayload(clubId, user, profile, role) {
  return {
    club_id: clubId,
    user_id: user.uid,
    user_name: profile?.platform_name || profile?.full_name || user.displayName || user.email || 'Atleta',
    user_email: user.email || '',
    photo_url: user.photoURL || profile?.photo_url || '',
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

export async function listClubEvents(clubId) {
  if (!db || !clubId) return [];
  const snap = await getDocs(query(collection(db, COL.events), where('club_id', '==', clubId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.starts_at || '').localeCompare(String(b.starts_at || '')));
}

export async function createClubEvent(clubId, data, user) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  if (!trimmed(data.title)) throw new Error('Informe o título do evento.');
  const id = doc(collection(db, COL.events)).id;
  await setDoc(doc(db, COL.events, id), {
    id,
    club_id: clubId,
    title: trimmed(data.title),
    description: trimmed(data.description),
    type: data.type || CLUB_EVENT_TYPE.SOCIAL,
    location: trimmed(data.location),
    starts_at: data.starts_at || null,
    created_by: user.uid,
    created_by_name: data.created_by_name || user.displayName || user.email || '',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'club_event_created', actor: user, details: { club_id: clubId, event_id: id } });
  return id;
}

export async function updateClubEvent(eventId, updates, actor) {
  const allowed = ['title', 'description', 'type', 'location', 'starts_at'];
  const sanitized = {};
  allowed.forEach((key) => {
    if (updates[key] !== undefined) sanitized[key] = key === 'starts_at' ? (updates[key] || null) : (key === 'type' ? updates[key] : trimmed(updates[key]));
  });
  await updateDoc(doc(db, COL.events, eventId), { ...sanitized, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'club_event_updated', actor, details: { event_id: eventId } });
}

export async function deleteClubEvent(eventId, actor) {
  try {
    const snap = await getDocs(query(collection(db, COL.rsvps), where('event_id', '==', eventId)));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (!snap.empty) await batch.commit();
  } catch (err) {
    logger.error('Falha ao limpar RSVPs do evento:', err);
  }
  await deleteDoc(doc(db, COL.events, eventId));
  await createAuditLog({ action: 'club_event_deleted', actor, details: { event_id: eventId } });
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

export async function createClubPost(clubId, content, user, profile) {
  if (!user?.uid) throw new Error('Usuário não autenticado.');
  const text = trimmed(content);
  if (!text) throw new Error('Escreva uma mensagem.');
  const id = doc(collection(db, COL.posts)).id;
  await setDoc(doc(db, COL.posts, id), {
    id,
    club_id: clubId,
    author_id: user.uid,
    author_name: profile?.platform_name || user.displayName || user.email || 'Atleta',
    author_photo: user.photoURL || profile?.photo_url || '',
    content: text.slice(0, 2000),
    created_at_ms: Date.now(),
    created_at: serverTimestamp(),
  });
  return id;
}

export async function deleteClubPost(postId, actor) {
  await deleteDoc(doc(db, COL.posts, postId));
  await createAuditLog({ action: 'club_post_deleted', actor, details: { post_id: postId } });
}
