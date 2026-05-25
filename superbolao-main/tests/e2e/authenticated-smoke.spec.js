import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const authStatePath = path.resolve(process.env.E2E_AUTH_STATE || 'tests/.auth/user.json');
const hasAuthState = fs.existsSync(authStatePath);
const poolId = process.env.E2E_POOL_ID;
const shouldRunAdminSmoke = process.env.E2E_ADMIN_SMOKE === 'true';

const poolTabs = ['dashboard', 'calendario', 'jogos', 'cartao', 'pontuacao', 'ranking', 'regras'];
const adminRoutes = ['/admin', '/admin/solicitacoes', '/admin/jogos', '/admin/metricas', '/admin/seed', '/admin/boloes'];

test.describe('authenticated smoke', () => {
  test.describe.configure({ timeout: 90_000 });
  test.skip(!hasAuthState, `No auth state found at ${authStatePath}. Run npm run e2e:auth:admin or npm run e2e:auth:save first.`);

  test.use({ storageState: authStatePath });

  test('dashboard opens for a signed-in user', async ({ page }) => {
    await gotoAppPage(page, '/inicio');

    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.getByText(/Painel do jogador/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ola,|Olá,/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('configured pool tabs open for a member', async ({ page }) => {
    test.skip(!poolId, 'Set E2E_POOL_ID to smoke /boloes/:poolId tabs with real data.');

    for (const tab of poolTabs) {
      await gotoAppPage(page, `/boloes/${poolId}/${tab}`);

      await expect(page, `${tab} should stay inside the pool`).toHaveURL(new RegExp(`/boloes/${poolId}(/${tab})?$`));
      await expect(page.getByRole('tab', { name: /Dashboard/i })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test('platform admin routes open for an admin session', async ({ page }) => {
    test.skip(!shouldRunAdminSmoke, 'Set E2E_ADMIN_SMOKE=true for a platform_admin storage state.');

    for (const route of adminRoutes) {
      await gotoAppPage(page, route);
      await expect(page, `${route} should not redirect away for platform admin`).toHaveURL(new RegExp(`${route}$`));
      await expectNoHorizontalOverflow(page);
    }
  });
});

async function gotoAppPage(page, path) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
}

async function expectNoHorizontalOverflow(page) {
  const hasHorizontalOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  ));

  expect(hasHorizontalOverflow).toBe(false);
}
