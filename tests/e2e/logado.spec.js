import { test, expect } from '@playwright/test';

/**
 * ⭐ A pessoa entra e as telas principais abrem — no build deste código, com
 * Auth e Firestore nos emuladores (`npm run e2e`). Pega o que os testes de
 * unidade não veem: tela que quebra ao montar de verdade, rota que leva ao
 * nada, regra do banco que recusa a leitura de quem acabou de entrar.
 */
const PROJETO = 'demo-picklerush';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8080';

/** Valor do Firestore REST a partir de um valor JS simples. */
function campo(v) {
  if (Array.isArray(v)) return { arrayValue: { values: v.map(campo) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  return { stringValue: String(v) };
}

/** Conta nova no emulador, com o cadastro completo (o assistente não abre). */
async function criarAtleta() {
  const email = `atleta.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@teste.dev`;
  const senha = 'senha-de-teste-123';
  const conta = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
  }).then((r) => r.json());
  const perfil = {
    uid: conta.localId,
    email,
    role: 'user',
    platform_name: 'Atleta de Teste',
    full_name: 'Atleta de Teste',
    birth_date: '1990-05-10',
    phone: '(51) 99999-9999',
    pickleball_experience: '1_2_anos',
    gender: 'female',
    competition_gender: 'female',
    leveling_level: 'beginner',
    city: 'Porto Alegre',
    state: 'RS',
    court_side: 'left',
    interests: ['play_tournaments'],
    onboarding_completed_at: new Date(),
  };
  const fields = Object.fromEntries(Object.entries(perfil).map(([k, v]) => [k, campo(v)]));
  const r = await fetch(`${FIRESTORE}/v1/projects/${PROJETO}/databases/pickleball/documents/users/${conta.localId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  });
  expect(r.ok, 'semear o perfil no emulador').toBe(true);
  return { email, senha };
}

async function entrar(page, { email, senha }) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(senha);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

// As telas que quase todo mundo abre. Cada uma tem de montar sem erro e sem
// cair na tela de "Algo deu errado".
const TELAS = ['/', '/dia-de-jogo', '/torneios', '/arenas', '/ranking', '/perfil', '/treino', '/notificacoes', '/configuracoes', '/ajuda'];

test.describe('@emuladores com conta', () => {
  test('entra com e-mail e senha e as telas principais abrem', async ({ page }) => {
    const errosDaPagina = [];
    page.on('pageerror', (e) => errosDaPagina.push(`${page.url()}: ${e.message}`));

    await entrar(page, await criarAtleta());

    for (const tela of TELAS) {
      await page.goto(tela);
      await expect(page.locator('main h1').first(), `título de ${tela}`).toBeVisible();
      // A tela de erro de cada rota (V2RouteBoundary) e a do app inteiro.
      await expect(page.locator('[role="alert"]').filter({ hasText: /Tentar de novo|Recarregar/ })).toHaveCount(0);
      await expect(page.getByText(/Algo deu errado|Não conseguimos abrir/i)).toHaveCount(0);
    }
    expect(errosDaPagina).toEqual([]);
  });
});
