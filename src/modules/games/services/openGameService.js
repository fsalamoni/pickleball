/**
 * Serviço de "Procura-se jogo" (coleção `open_games`).
 *
 * CRUD dos convites de partida social. A listagem usa apenas
 * `where('status','==','open')` (sem índice composto); filtros e ordenação são
 * aplicados no cliente pela lógica pura em `domain/openGames`.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import { normalizeOpenGameInput, OPEN_GAME_STATUS } from '../domain/openGames.js';

const COL = 'open_games';

/** Cria um convite de jogo aberto do usuário autenticado. */
export async function createOpenGame(input, actor) {
  const { valid, errors, value } = normalizeOpenGameInput(input);
  if (!valid) {
    const first = Object.values(errors)[0];
    throw new Error(first || 'Dados inválidos.');
  }
  if (!actor?.uid) throw new Error('É preciso estar autenticado.');

  const id = doc(collection(db, COL)).id;
  const payload = {
    id,
    ...value,
    created_by: actor.uid,
    creator_name: input.creator_name || actor.displayName || actor.email || 'Atleta',
    creator_photo: input.creator_photo || actor.photoURL || null,
    status: OPEN_GAME_STATUS.OPEN,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL, id), payload);
  await createAuditLog({ action: 'open_game_created', actor, details: { open_game_id: id } });
  return id;
}

/** Lista convites abertos (filtros/ordenação no cliente). */
export async function listOpenGames() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, COL), where('status', '==', OPEN_GAME_STATUS.OPEN)));
  return snap.docs.map((d) => d.data());
}

/** Lista os convites do próprio usuário (abertos e fechados). */
export async function listMyOpenGames(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL), where('created_by', '==', userId)));
  return snap.docs.map((d) => d.data());
}

/** Marca um convite como fechado (não aparece mais no mural). */
export async function closeOpenGame(id, actor) {
  await updateDoc(doc(db, COL, id), { status: OPEN_GAME_STATUS.CLOSED, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'open_game_closed', actor, details: { open_game_id: id } });
}

/** Remove um convite. */
export async function deleteOpenGame(id, actor) {
  await deleteDoc(doc(db, COL, id));
  await createAuditLog({ action: 'open_game_deleted', actor, details: { open_game_id: id } });
}
