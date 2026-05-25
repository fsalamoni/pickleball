import { test, expect } from '@playwright/test';

test('Landing page loads with Pickleball branding', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Pickleball/i);
});

test('Rules page is publicly accessible', async ({ page }) => {
  await page.goto('/regras');
  await expect(page.getByText(/Regras do Pickleball/i)).toBeVisible();
});

test('Leveling page is publicly accessible', async ({ page }) => {
  await page.goto('/nivelamento');
  await expect(page.getByText(/Nivelamento/i).first()).toBeVisible();
});
