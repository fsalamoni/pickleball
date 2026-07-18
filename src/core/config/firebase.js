import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const requiredFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
];

export const firebaseServicesEnabled = requiredFirebaseConfig.every(Boolean);
export const firebaseDisabledReason = firebaseServicesEnabled
  ? null
  : 'Firebase não está configurado neste ambiente local.';

export const app = firebaseServicesEnabled ? initializeApp(firebaseConfig) : null;

const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'pickleball';
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app, firestoreDatabaseId) : null;
export const functions = app ? getFunctions(app, 'southamerica-east1') : null;
export const storage = app ? getStorage(app) : null;

export const googleProvider = auth ? new GoogleAuthProvider() : null;
googleProvider?.setCustomParameters({ prompt: 'select_account' });

// Login com Apple (Sign in with Apple). Requer o provedor Apple habilitado no
// Firebase Auth (Service ID / chave configurados no console). Pedimos os
// escopos de e-mail e nome para popular o perfil e permitir a vinculação por
// e-mail das inscrições provisórias do atleta.
export const appleProvider = auth ? new OAuthProvider('apple.com') : null;
appleProvider?.addScope('email');
appleProvider?.addScope('name');

const isBrowser = typeof window !== 'undefined';
const hasMeasurementId = Boolean(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);
const analyticsEnabled = isBrowser && hasMeasurementId && import.meta.env.VITE_ENABLE_FIREBASE_ANALYTICS === 'true';
const performanceEnabled = isBrowser && import.meta.env.VITE_ENABLE_FIREBASE_PERFORMANCE === 'true';

export const analyticsPromise = app && analyticsEnabled
  ? import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => (await isSupported() ? getAnalytics(app) : null))
    .catch(() => null)
  : Promise.resolve(null);

export const performancePromise = app && performanceEnabled
  ? import('firebase/performance')
    .then(async ({ getPerformance, isSupported }) => (await isSupported() ? getPerformance(app) : null))
    .catch(() => null)
  : Promise.resolve(null);

if (app && auth && db && functions && import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
    if (storage) connectStorageEmulator(storage, 'localhost', 9199);
  } catch {
    // already connected
  }
}
