import { expect, test } from '@playwright/test';

const publicPages = [
  { path: '/', heading: /Copa do Mundo 2026/i },
  { path: '/regras', heading: /Regras do Bolao|Regras do Bolão/i },
  { path: '/politica-uso', heading: /Politica de Uso|Política de Uso/i },
  { path: '/aviso-jogos', heading: /Aviso sobre Uso Responsável/i },
  { path: '/login', heading: /Entrar no Bolao Copa 2026|Entrar no Bolão Copa 2026/i },
];

const routeChunks = [
  { path: '/regras', heading: /Regras do Bolao|Regras do Bolão/i, chunkPattern: /PublicRules-.*\.js$/ },
  { path: '/politica-uso', heading: /Politica de Uso|Política de Uso/i, chunkPattern: /PrivacyPolicy-.*\.js$/ },
  { path: '/login', heading: /Entrar no Bolao Copa 2026|Entrar no Bolão Copa 2026/i, chunkPattern: /Login-.*\.js$/ },
];

test.describe('public production smoke', () => {
  for (const publicPage of publicPages) {
    test(`${publicPage.path} loads without runtime errors`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      const response = await gotoPublicPage(page, publicPage.path);

      expect(response?.status(), `${publicPage.path} should respond successfully`).toBeLessThan(400);
      await expect(page.getByRole('heading', { name: publicPage.heading }).first()).toBeVisible();
      expect(pageErrors).toEqual([]);
    });
  }

  for (const publicPage of publicPages) {
    test(`${publicPage.path} has no horizontal overflow`, async ({ page }) => {
      await gotoPublicPage(page, publicPage.path);

      const hasHorizontalOverflow = await page.evaluate(() => (
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      ));

      expect(hasHorizontalOverflow).toBe(false);
    });
  }

  for (const routeChunk of routeChunks) {
    test(`${routeChunk.path} loads its lazy route chunk`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'Route chunk filenames are validated once on desktop.');

      await gotoPublicPage(page, routeChunk.path);
      await expect(page.getByRole('heading', { name: routeChunk.heading }).first()).toBeVisible();

      const loadedAssets = await page.evaluate(() => performance
        .getEntriesByType('resource')
        .map((entry) => entry.name.split('/assets/')[1])
        .filter(Boolean));

      expect(loadedAssets.some((asset) => routeChunk.chunkPattern.test(asset))).toBe(true);
    });
  }
});

async function gotoPublicPage(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
  return response;
}
