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

/**
 * Conta nova no emulador, com o cadastro completo (o assistente não abre).
 * `incompleto`: sem o lado da quadra, para o assistente de cadastro abrir.
 */
async function criarAtleta({ incompleto = false } = {}) {
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
  if (incompleto) delete perfil.court_side;
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

/** Marca cada documento e aceita; o aviso tem de sumir (no celular, pelo toque). */
async function aceitar(page, aviso, botao) {
  await expect(aviso).toBeVisible();
  for (const caixa of await aviso.getByRole('checkbox').all()) await caixa.check();
  await aviso.getByRole('button', { name: botao }).click();
  await expect(aviso).toBeHidden();
}

/** Liga uma flag da plataforma no emulador (`platform_settings/global`). */
async function ligarFlag(chave) {
  const r = await fetch(
    `${FIRESTORE}/v1/projects/${PROJETO}/databases/pickleball/documents/platform_settings/global?updateMask.fieldPaths=feature_flags.${chave}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: { feature_flags: { mapValue: { fields: { [chave]: { booleanValue: true } } } } } }),
    },
  );
  expect(r.ok, `ligar a flag ${chave} no emulador`).toBe(true);
}

// As telas que quase todo mundo abre. Cada uma tem de montar sem erro e sem
// cair na tela de "Algo deu errado".
const TELAS = ['/', '/dia-de-jogo', '/torneios', '/arenas', '/ranking', '/perfil', '/treino', '/notificacoes', '/configuracoes', '/ajuda'];

test.describe('@emuladores com conta', () => {
  test('entra com e-mail e senha e as telas principais abrem', async ({ page }) => {
    const errosDaPagina = [];
    page.on('pageerror', (e) => errosDaPagina.push(`${page.url()}: ${e.message}`));

    await entrar(page, await criarAtleta());
    await aceitar(page, page.getByRole('dialog', { name: 'Antes de continuar' }), 'Aceitar e continuar');

    for (const tela of TELAS) {
      await page.goto(tela);
      await expect(page.locator('main h1').first(), `título de ${tela}`).toBeVisible();
      // A tela de erro de cada rota (V2RouteBoundary) e a do app inteiro.
      await expect(page.locator('[role="alert"]').filter({ hasText: /Tentar de novo|Recarregar/ })).toHaveCount(0);
      await expect(page.getByText(/Algo deu errado|Não conseguimos abrir/i)).toHaveCount(0);
    }
    expect(errosDaPagina).toEqual([]);
  });

  // 🐞 No celular os termos do Mercado "travavam": o assistente de cadastro
  // abria por cima, e o diálogo de cima desliga os toques no de baixo.
  test('⭐ com o cadastro por completar, os termos do Mercado respondem ao toque', async ({ page }) => {
    await ligarFlag('marketplace');
    await entrar(page, await criarAtleta({ incompleto: true }));
    await aceitar(page, page.getByRole('dialog', { name: 'Antes de continuar' }), 'Aceitar e continuar');

    await page.goto('/mercado');
    const termos = page.getByRole('dialog', { name: 'Antes de entrar no Mercado' });
    await expect(termos).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    // O documento abre dentro do aviso, e "Li e concordo" volta marcando.
    await termos.getByRole('button', { name: 'Ler documento' }).first().click();
    await termos.getByRole('button', { name: 'Li e concordo' }).click();
    await expect(termos.getByRole('checkbox').first()).toBeChecked();
    await aceitar(page, termos, 'Li e aceito, entrar no Mercado');
    // Aceitos os termos, é a vez do cadastro.
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });
});
