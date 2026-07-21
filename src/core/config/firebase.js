/**
 * Firebase config — com fallback automático para hosting init.json em RUNTIME.
 *
 * PROBLEMA RESOLVIDO NESTE COMMIT:
 * O bundle anterior exportava `app`/`auth`/`db` como `const` com valor `null`
 * (porque as env vars `VITE_FIREBASE_*` não estavam baked no build — elas
 * só existem nos secrets do GitHub Actions, não no bundle). Aí o tree-shaking
 * do Vite ELIMINAVA `ensureFirebaseInitialized` e `fetchHostingConfig` do
 * bundle (porque nenhum outro módulo os importava estaticamente) e o app
 * ficava com `app = null` exportado pra sempre. Resultado: usuário via
 * "Firebase não está configurado neste ambiente local." em /login.
 *
 * FIX (3 partes):
 *
 * 1. Exports viram `let` em vez de `const` (live bindings do ES modules).
 *    Quando o init completa (via env ou init.json), o módulo firebase.js
 *    REATRIBUI as variáveis `app`, `auth`, `db`, etc. Os importadores
 *    recebem o valor atualizado automaticamente, porque ES modules
 *    exportam bindings, não valores.
 *
 * 2. `_initializeFirebase()` é chamado como SIDE EFFECT no top-level do
 *    módulo (NÃO como função exportada). Isso impede o tree-shaking de
 *    eliminar o init — a chamada já está no módulo e não depende de
 *    ninguém importar a função.
 *
 * 3. `firebaseReady` (Promise exportada) é o que `App.jsx`/`main.jsx`
 *    esperam ANTES de renderizar. Garante que o Firebase tá inicializado
 *    (via env ou via fetch do init.json do Firebase Hosting) antes do
 *    React tentar usar.
 *
 * FALLBACK CHAIN:
 *   1. Tenta env vars (VITE_FIREBASE_*) — funciona em build local com .env
 *   2. Se faltarem, faz fetch em runtime de /__/firebase/init.json
 *      (exposto automaticamente pelo Firebase Hosting — config pública)
 *   3. Se nenhum funcionar, deixa app=null e firebaseServicesEnabled=false
 */

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];

// Login com Apple (Sign in with Apple). Desligado por ora: exige configuração
// extra no console da Apple (Service ID, chave .8, Return URLs). Para reativar,
// basta ligar a constante abaixo depois de concluir essa configuração — o
// restante do código (botão na tela de login e método signInWithApple) já
// está pronto. Requer os escopos de e-mail e nome para popular o perfil e
// permitir a vinculação por e-mail das inscrições provisórias do atleta.
const APPLE_SIGN_IN_ENABLED = false;

const firestoreDatabaseId = import.meta.env.VITE_FIRESTORE_DATABASE_ID || 'pickleball';

/** Faz fetch do init.json do Firebase Hosting em runtime (config pública). */
async function fetchHostingConfig() {
  try {
    const res = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Lê as env vars VITE_FIREBASE_*. */
function readEnvConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  };
}

/** Mescla envConfig com hostingConfig. envConfig tem prioridade. */
function mergeConfig(env, hosting = {}) {
  return {
    apiKey: env.apiKey || hosting.apiKey,
    authDomain: env.authDomain || hosting.authDomain,
    projectId: env.projectId || hosting.projectId,
    storageBucket: env.storageBucket || hosting.storageBucket,
    messagingSenderId: env.messagingSenderId || hosting.messagingSenderId,
    appId: env.appId || hosting.appId,
    databaseURL: hosting.databaseURL || undefined,
    measurementId: env.measurementId || hosting.measurementId,
  };
}

// =====================================================================
// Exports com LIVE BINDINGS (ES modules exportam bindings, não valores).
// Quando `_initializeFirebase` completa, estas variáveis são REATRIBUÍDAS
// e todos os importadores passam a ver o valor atualizado.
// =====================================================================

/** @type {import('firebase/app').FirebaseApp | null} */
export let app = null;
/** @type {import('firebase/auth').Auth | null} */
export let auth = null;
/** @type {import('firebase/firestore').Firestore | null} */
export let db = null;
/** @type {import('firebase/functions').Functions | null} */
export let functions = null;
/** @type {import('firebase/storage').FirebaseStorage | null} */
export let storage = null;
/** @type {GoogleAuthProvider | null} */
export let googleProvider = null;
/** @type {OAuthProvider | null} */
export let appleProvider = null;

export let firebaseServicesEnabled = false;
export let firebaseDisabledReason = 'Firebase não está configurado neste ambiente local.';
export let analyticsPromise = Promise.resolve(null);
export let performancePromise = Promise.resolve(null);

let _initSource = 'pending'; // 'env' | 'hosting' | 'none' | 'pending'
let _initPromise = null;

/** Inicializa Firebase a partir de uma config válida. Reatribui as exports. */
function _initializeFromConfig(config) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app, firestoreDatabaseId);
  functions = getFunctions(app, 'southamerica-east1');
  storage = getStorage(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  if (APPLE_SIGN_IN_ENABLED) {
    appleProvider = new OAuthProvider('apple.com');
    appleProvider.addScope('email');
    appleProvider.addScope('name');
  }
  firebaseServicesEnabled = true;
  firebaseDisabledReason = null;

  // Emuladores (opcional, dev local)
  if (import.meta.env.VITE_FIREBASE_USE_EMULATORS === 'true' && auth && db && functions) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectFunctionsEmulator(functions, 'localhost', 5001);
      if (storage) connectStorageEmulator(storage, 'localhost', 9199);
    } catch {
      // already connected
    }
  }

  // Analytics e Performance (lazy, só liga se measurementId existir)
  const isBrowser = typeof window !== 'undefined';
  const hasMeasurementId = Boolean(config.measurementId);
  const analyticsEnabled =
    isBrowser && hasMeasurementId && import.meta.env.VITE_ENABLE_FIREBASE_ANALYTICS === 'true';
  const performanceEnabled =
    isBrowser && import.meta.env.VITE_ENABLE_FIREBASE_PERFORMANCE === 'true';

  if (app && analyticsEnabled) {
    analyticsPromise = import('firebase/analytics')
      .then(async ({ getAnalytics, isSupported }) => (await isSupported() ? getAnalytics(app) : null))
      .catch(() => null);
  } else {
    analyticsPromise = Promise.resolve(null);
  }

  if (app && performanceEnabled) {
    performancePromise = import('firebase/performance')
      .then(async ({ getPerformance, isSupported }) => (await isSupported() ? getPerformance(app) : null))
      .catch(() => null);
  } else {
    performancePromise = Promise.resolve(null);
  }
}

/**
 * Tenta resolver a config (env → hosting init.json) e inicializar.
 * Idempotente: múltiplas chamadas retornam a mesma Promise.
 */
export function ensureFirebaseInitialized() {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const env = readEnvConfig();
    const envComplete = REQUIRED_KEYS.every((k) => env[k]);
    if (envComplete) {
      _initializeFromConfig(env);
      _initSource = 'env';
      // eslint-disable-next-line no-console
      console.info('[firebase] config resolvida via env vars');
      return;
    }
    const hosting = await fetchHostingConfig();
    if (hosting) {
      const merged = mergeConfig(env, hosting);
      const complete = REQUIRED_KEYS.every((k) => merged[k]);
      if (complete) {
        _initializeFromConfig(merged);
        _initSource = 'hosting';
        // eslint-disable-next-line no-console
        console.info('[firebase] config resolvida via /__/firebase/init.json');
        return;
      }
    }
    _initSource = 'none';
    // eslint-disable-next-line no-console
    console.warn('[firebase] config não resolvida (env nem init.json disponíveis)');
  })();
  return _initPromise;
}

/**
 * Promise que resolve quando Firebase está inicializado.
 * O `App.jsx`/`main.jsx` esperam essa Promise antes de renderizar.
 */
export const firebaseReady = ensureFirebaseInitialized();

/** De onde veio a config (env / hosting / none / pending). Útil pra debug. */
export function getFirebaseConfigSource() {
  return _initSource;
}
