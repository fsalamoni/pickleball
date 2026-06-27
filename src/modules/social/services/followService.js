/**
 * Serviço de "seguir atletas" (coleção `follows`).
 *
 * Id determinista `followerUid_targetUid` (1 doc por par). Notifica o seguido.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createNotification } from '@/core/services/notificationService';

const COL = 'follows';

function followId(followerUid, targetUid) {
  return `${followerUid}_${targetUid}`;
}

/** Passa a seguir um atleta e notifica o seguido. */
export async function followAthlete(targetUid, actor, followerName) {
  if (!db || !actor?.uid || !targetUid || actor.uid === targetUid) return;
  const id = followId(actor.uid, targetUid);
  await setDoc(doc(db, COL, id), {
    id,
    follower_uid: actor.uid,
    target_uid: targetUid,
    follower_name: followerName || actor.displayName || actor.email || 'Atleta',
    created_at: serverTimestamp(),
  });
  await createNotification({
    userId: targetUid,
    title: 'Novo seguidor',
    message: `${followerName || 'Um atleta'} começou a seguir você.`,
    type: 'new_follower',
    link: `/atleta/${actor.uid}`,
    actor,
  });
}

/** Deixa de seguir um atleta. */
export async function unfollowAthlete(targetUid, actor) {
  if (!db || !actor?.uid || !targetUid) return;
  await deleteDoc(doc(db, COL, followId(actor.uid, targetUid)));
}

/** Indica se follower segue target. */
export async function isFollowing(followerUid, targetUid) {
  if (!db || !followerUid || !targetUid) return false;
  const snap = await getDoc(doc(db, COL, followId(followerUid, targetUid)));
  return snap.exists();
}

/** Lista os uids que o usuário segue. */
export async function listFollowing(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, COL), where('follower_uid', '==', uid)));
  return snap.docs.map((d) => d.data());
}

/** Lista os seguidores de um usuário. */
export async function listFollowers(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, COL), where('target_uid', '==', uid)));
  return snap.docs.map((d) => d.data());
}
