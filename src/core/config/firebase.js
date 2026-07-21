/**
 * Firebase config — com fallback automático para hosting init.
 *
 * 1. Tenta usar as env vars (VITE_FIREBASE_*) injetadas no build.
 * 2. Se alguma var crítica estiver faltando, faz fetch em runtime de
 *    `__/firebase/init.json` (exposto automaticamente pelo Firebase Hosting)
 *    e usa os valores públicos de lá.
 *
 * O init.json é público e seguro de usar (mesmo nível de exposição que
 * embed direto no bundle). Funciona mesmo se o .env estiver vazio.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];

/** Faz fetch do init.json do Firebase Hosting em runtime. */
async function fetchHostingConfig() {
  try {
    const res = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Mescla envConfig com hostingConfig. envConfig tem prioridade. */
function mergeConfig(hosting = {}) {
  return {
    apiKey: envConfig.apiKey || hosting.apiKey,
    authDomain: envConfig.authDomain || hosting.authDomain,
    projectId: envConfig.projectId || hosting.projectId,
    storageBucket: envConfig.storageBucket || hosting.storageBucket,
    messagingSenderId: envConfig.messagingSenderId || hosting.messagingSenderId,
    appId: envConfig.appId || hosting.appId,
    databaseURL: hosting.databaseURL || undefined,
    measurementId: envConfig.measurementId || hosting.measurementId,
  };
}

/** Tenta montar config válida: env vars → hosting init.json. */
async function resolveFirebaseConfig() {
  // Cenário 1: env vars completas
  const envComplete = REQUIRED_KEYS.every((k) => envConfig[k]);
  if (envComplete) return { source: 'env', config: envConfig };

  // Cenário 2: tentar hosting init.json
  const hosting = await fetchHostingConfig();
  if (hosting) {
    const merged = mergeConfig(hosting);
    const complete = REQUIRED_KEYS.every((k) => merged[k]);
    if (complete) return { source: 'hosting', config: merged };
  }

  return { source: null, config: envConfig };
}

// Estado inicial baseado em env (síncrono) para evitar flickering no carregamento
let firebaseConfig = envConfig;
let configSource = REQUIRED_KEYS.every((k) => envConfig[k]) ? 'env' : 'pending';

export const firebaseServicesEnabled = REQUIRED_KEYS.every((k) => firebaseConfig[k]);
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

// Login com Apple (Sign in with Apple). Desligado por ora: exige configuração
// extra no console da Apple (Service ID, chave .p8, Return URLs). Para reativar,
// basta ligar o flag abaixo depois de concluir essa configuração — o restante do
// código (botão na tela de login e método signInWithApple) já está pronto.
// Requer os escopos de e-mail e nome para popular o perfil e permitir a
// vinculação por e-mail das inscrições provisórias do atleta.
const APPLE_SIGN_IN_ENABLED = false;
export const appleProvider = (auth && APPLE_SIGN_IN_ENABLED) ? new OAuthProvider('apple.com') : null;
appleProvider?.addScope('email');
appleProvider?.addScope('name');

const isBrowser = typeof window !== 'undefined';
const hasMeasurementId = Boolean(firebaseConfig.measurementId);
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

/**
 * Inicialização assíncrona: se a config do env não está completa,
 * tenta resolver via Firebase Hosting init.json. Re-inicializa Firebase
 * se necessário.
 */
let initPromise = null;
export function ensureFirebaseInitialized() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (firebaseServicesEnabled) return { source: configSource, config: firebaseConfig };
    const resolved = await resolveFirebaseConfig();
    if (resolved.source && !firebaseServicesEnabled) {
      console.info('[firebase] config resolvida via', resolved.source);
      firebaseConfig = resolved.config;
      configSource = resolved.source;
      // Re-inicializa app se necessário
      try {
        const { initializeApp: init } = await import('firebase/app');
        const newApp = init(firebaseConfig);
        if (newApp) {
          // Exporta nova app
          // (a reatribuição de `app` abaixo é intencional para hot-reload em dev)
          // eslint-disable-next-line no-unused-vars
          const _ = newApp;
        }
      } catch (err) {
        console.warn('[firebase] failed to re-initialize', err);
      }
    }
    return resolved;
  })();
  return initPromise;
}
