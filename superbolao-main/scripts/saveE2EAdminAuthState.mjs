import { chromium } from 'playwright';
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectId = 'hocapp-44760';
const serviceAccountId = process.env.E2E_SERVICE_ACCOUNT_ID || 'firebase-adminsdk-fbsvc@hocapp-44760.iam.gserviceaccount.com';
const baseURL = process.env.E2E_BASE_URL || 'https://superbolao.web.app';
const authEmail = process.env.E2E_AUTH_EMAIL || 'fsalamoni@gmail.com';
const authStatePath = path.resolve(process.env.E2E_AUTH_STATE || 'tests/.auth/user.json');
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDFV2iOMhhg3EAwQ6J72Zpx2kfe4WyDLLw',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'hocapp-44760.firebaseapp.com',
  projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'hocapp-44760.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '143237037612',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:143237037612:web:5601b8d3647525e5031b89',
};

await fs.mkdir(path.dirname(authStatePath), { recursive: true });

if (!getAdminApps().length) {
  initializeAdminApp({ projectId, serviceAccountId });
}

const adminAuth = getAdminAuth();
const user = await adminAuth.getUserByEmail(authEmail);
const customToken = await adminAuth.createCustomToken(user.uid);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });

  await page.evaluate(async ({ config, token }) => {
    const [{ initializeApp, getApps }, authModule] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js'),
    ]);
    const app = getApps()[0] || initializeApp(config);
    const auth = authModule.getAuth(app);

    await authModule.setPersistence(auth, authModule.browserLocalPersistence);
    await authModule.signInWithCustomToken(auth, token);
  }, { config: firebaseConfig, token: customToken });

  await page.goto(`${baseURL}/inicio`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.waitForSelector('text=/Painel do jogador/i', { timeout: 30_000 });
  await context.storageState({ path: authStatePath, indexedDB: true });

  console.log(`Saved automated auth state for ${authEmail} to ${authStatePath}`);
} finally {
  await browser.close();
}
