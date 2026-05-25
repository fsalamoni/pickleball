import { HttpsError } from 'firebase-functions/v2/https';
import { getAppFirestore } from './firestore';

export async function assertPlatformAdmin(uid?: string): Promise<void> {
  if (!uid) throw new HttpsError('unauthenticated', 'Login required.');
  if (!(await isPlatformAdmin(uid))) {
    throw new HttpsError('permission-denied', 'Only platform admins can perform this action.');
  }
}

export async function assertPoolAdmin(uid: string | undefined, poolId: string): Promise<void> {
  if (!uid) throw new HttpsError('unauthenticated', 'Login required.');
  if (await isPlatformAdmin(uid)) return;

  const db = getAppFirestore();
  const [poolSnap, membershipSnap] = await Promise.all([
    db.collection('pools').doc(poolId).get(),
    db.collection('pool_memberships').doc(`${uid}_${poolId}`).get(),
  ]);

  if (!poolSnap.exists) throw new HttpsError('not-found', 'Pool not found.');
  const ownerUserId = (poolSnap.data() as any)?.owner_user_id;
  if (ownerUserId === uid) return;

  const role = membershipSnap.exists ? (membershipSnap.data() as any)?.role : null;
  if (role === 'owner' || role === 'admin') return;

  throw new HttpsError('permission-denied', 'Only pool admins can perform this action.');
}

async function isPlatformAdmin(uid: string): Promise<boolean> {
  const snap = await getAppFirestore().collection('users').doc(uid).get();
  const role = snap.exists ? (snap.data() as any)?.role : null;
  return role === 'platform_admin';
}
