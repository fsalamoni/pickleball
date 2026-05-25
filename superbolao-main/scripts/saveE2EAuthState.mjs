import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.E2E_BASE_URL || 'https://superbolao.web.app';
const authStatePath = path.resolve(process.env.E2E_AUTH_STATE || 'tests/.auth/user.json');

await fs.mkdir(path.dirname(authStatePath), { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

console.log(`Opening ${baseURL}/login`);
console.log('Complete the Google sign-in in the opened browser window.');
console.log('The script will save storage state after the app leaves /login.');

await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 0 });
await context.storageState({ path: authStatePath, indexedDB: true });

console.log(`Saved auth state to ${authStatePath}`);
await browser.close();
