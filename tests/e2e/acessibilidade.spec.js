import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Rotas públicas (sem login) passam pelo axe. Só o que reprova no AA conta;
// "serious" e "critical" barram, o resto fica no relatório.
const ROTAS = ['/', '/login', '/regras', '/nivelamento'];

for (const rota of ROTAS) {
  test(`sem violações graves de acessibilidade em ${rota}`, async ({ page }) => {
    await page.goto(rota);
    await page.waitForLoadState('networkidle');
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const graves = violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    expect(graves.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}
