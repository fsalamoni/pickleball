import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'bolao2026';
export const db = getFirestore(app, firestoreDatabaseId);
export const functions = getFunctions(app, 'southamerica-east1');

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const isBrowser = typeof window !== 'undefined';
const hasMeasurementId = Boolean(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);
const analyticsEnabled = isBrowser && hasMeasurementId && import.meta.env.VITE_ENABLE_FIREBASE_ANALYTICS === 'true';
const performanceEnabled = isBrowser && import.meta.env.VITE_ENABLE_FIREBASE_PERFORMANCE === 'true';

export const analyticsPromise = analyticsEnabled
  ? import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => (await isSupported() ? getAnalytics(app) : null))
    .catch(() => null)
  : Promise.resolve(null);

export const performancePromise = performanceEnabled
  ? import('firebase/performance')
    .then(async ({ getPerformance, isSupported }) => (await isSupported() ? getPerformance(app) : null))
    .catch(() => null)
  : Promise.resolve(null);

if (import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectFunctionsEmulator(functions, 'localhost', 5001);
  } catch (e) {
    // already connected
  }
}
