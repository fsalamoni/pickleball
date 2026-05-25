import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';

export const CREATOR_REQUEST_STATUS = {
  pending: 'pending',
  approved: 'approved',
  denied: 'denied',
};

function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => {
    const aTime = a.created_at?.toMillis?.() ?? 0;
    const bTime = b.created_at?.toMillis?.() ?? 0;
    return bTime - aTime;
  });
}

export function watchMyCreatorRequest(userId, onNext, onError) {
  if (!userId) return () => {};
  return onSnapshot(
    doc(db, 'pool_creator_requests', userId),
    (snap) => onNext(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

export function watchPendingCreatorRequests(onNext, onError) {
  const q = query(collection(db, 'pool_creator_requests'), where('status', '==', CREATOR_REQUEST_STATUS.pending));
  return onSnapshot(
    q,
    (snap) => onNext(sortByCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    onError,
  );
}

export async function requestPoolCreatorAuthorization(user, message = '') {
  if (!user) throw new Error('Faça login para solicitar autorização.');
  await setDoc(
    doc(db, 'pool_creator_requests', user.uid),
    {
      user_id: user.uid,
      user_email: user.email || '',
      user_name: user.displayName || user.email || 'Usuário',
      user_photo: user.photoURL || '',
      message: message.trim(),
      status: CREATOR_REQUEST_STATUS.pending,
      admin_response: '',
      reviewed_by: null,
      reviewed_at: null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function approvePoolCreatorRequest(request, adminUser, responseMessage = '') {
  await reviewPoolCreatorRequest(request, adminUser, CREATOR_REQUEST_STATUS.approved, responseMessage);
  await updateDoc(doc(db, 'users', request.user_id), {
    can_create_pools: true,
    updated_at: serverTimestamp(),
  });
}

export async function denyPoolCreatorRequest(request, adminUser, responseMessage = '') {
  await reviewPoolCreatorRequest(request, adminUser, CREATOR_REQUEST_STATUS.denied, responseMessage);
  await updateDoc(doc(db, 'users', request.user_id), {
    can_create_pools: false,
    updated_at: serverTimestamp(),
  });
}

async function reviewPoolCreatorRequest(request, adminUser, status, responseMessage) {
  const approved = status === CREATOR_REQUEST_STATUS.approved;
  const fallbackMessage = approved
    ? 'Sua solicitação para criar bolões foi aprovada.'
    : 'Sua solicitação para criar bolões foi recusada.';
  const message = responseMessage.trim() || fallbackMessage;

  await updateDoc(doc(db, 'pool_creator_requests', request.id), {
    status,
    admin_response: message,
    reviewed_by: adminUser.uid,
    reviewed_by_email: adminUser.email || '',
    reviewed_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  await setDoc(doc(collection(db, 'notifications')), {
    user_id: request.user_id,
    title: approved ? 'Autorização aprovada' : 'Autorização recusada',
    message,
    type: 'pool_creator_authorization',
    read: false,
    created_at: serverTimestamp(),
  });
}
