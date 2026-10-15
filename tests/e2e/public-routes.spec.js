import { test, expect } from '@playwright/test';

// O que quem NÃO tem conta vê. Roda no build do PR (emuladores) e, depois de
// cada deploy, contra o site no ar (`npm run e2e:producao`).

test('a página inicial abre para quem não tem conta', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PickleRush/);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.getByText(/Algo deu errado|Não conseguimos abrir/i)).toHaveCount(0);
});

test('o login oferece e-mail e senha', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('tela que exige conta leva ao login', async ({ page }) => {
  await page.goto('/regras');
  await expect(page).toHaveURL(/\/login/);
});
