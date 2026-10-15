import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Rotas públicas (sem login) passam pelo axe. Só o que reprova no AA conta;
// "serious" e "critical" barram, o resto fica no relatório. (`/regras` e
// `/nivelamento` exigem conta desde o V2 e caem no login.)
const ROTAS = ['/', '/login'];

for (const rota of ROTAS) {
  test(`sem violações graves de acessibilidade em ${rota}`, async ({ page }) => {
    await page.goto(rota);
    // Não `networkidle`: o Firestore mantém a conexão aberta e ele nunca chega.
    // E o axe só depois das animações de entrada (no meio do fade o texto
    // ainda está meio transparente e reprova no contraste).
    await expect(page.locator('[data-boot-inicializando]')).toHaveCount(0);
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const graves = violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    expect(graves.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}
