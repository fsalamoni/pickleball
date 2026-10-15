import { defineConfig, devices } from '@playwright/test';

// Dois modos:
// - padrão (`npm run e2e`): o build DESTE código, servido pelo `vite preview`,
//   com Auth e Firestore nos emuladores (`scripts/e2e.sh`). É o que o CI roda.
// - `E2E_BASE_URL=https://…`: um site já publicado (o teste rápido depois do
//   deploy). Os testes que precisam de conta (@emuladores) ficam de fora.
const siteNoAr = Boolean(process.env.E2E_BASE_URL);
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  grepInvert: siteNoAr ? /@emuladores/ : undefined,
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: siteNoAr ? undefined : {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
