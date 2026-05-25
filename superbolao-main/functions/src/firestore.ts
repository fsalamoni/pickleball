import { getFirestore } from 'firebase-admin/firestore';

export const FIRESTORE_DATABASE_ID = 'bolao2026';

export function getAppFirestore() {
  return getFirestore(FIRESTORE_DATABASE_ID);
}
