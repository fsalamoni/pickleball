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
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (v && typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, campo(x)])) } };
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

/** Toque de verdade no celular (eventos de toque), clique no computador. */
const tocar = (alvo) => (test.info().project.use.hasTouch ? alvo.tap() : alvo.click());

/**
 * Rola com o gesto de verdade (o dedo no celular, a roda do mouse no
 * computador) até o alvo aparecer inteiro na tela.
 */
async function rolarAte(page, alvo) {
  const { width, height } = page.viewportSize();
  // Inteiro na tela e sem nada por cima (a barra de baixo do celular, por exemplo).
  const emVista = () => alvo.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const meio = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.top >= 0 && r.bottom <= window.innerHeight && !!meio && el.contains(meio);
  });
  const cdp = test.info().project.use.hasTouch ? await page.context().newCDPSession(page) : null;
  for (let i = 0; i < 30 && !(await emVista()); i += 1) {
    if (cdp) {
      const x = Math.round(width / 2);
      const y0 = Math.round(height * 0.75);
      const y1 = Math.round(height * 0.3);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
      for (let k = 1; k <= 10; k += 1) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 + ((y1 - y0) * k) / 10) }] });
        await page.waitForTimeout(16);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.wheel(0, height * 0.6);
    }
    await page.waitForTimeout(150);
  }
  expect(await emVista(), 'o gesto de rolar leva até o botão').toBe(true);
}

/**
 * Aceita o aviso como uma pessoa: rola até o fim (o botão é a última coisa),
 * e um toque no botão, que nasce ativo, fecha o aviso.
 */
async function aceitar(page, aviso, botao) {
  await expect(aviso).toBeVisible();
  const aceite = aviso.getByRole('button', { name: botao });
  await expect(aceite).toBeEnabled();
  await rolarAte(page, aceite);
  await tocar(aceite);
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

/** Grava um documento no emulador (sem regras), a partir de um objeto simples. */
async function semear(caminho, dados) {
  const fields = Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, campo(v)]));
  const r = await fetch(`${FIRESTORE}/v1/projects/${PROJETO}/databases/pickleball/documents/${caminho}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  });
  expect(r.ok, `semear ${caminho}`).toBe(true);
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

  // 🐞 No celular os termos do Mercado "travavam": primeiro o assistente de
  // cadastro abria por cima (o diálogo de cima desliga os toques no de baixo);
  // depois o botão só acendia com quatro caixas marcadas, e as últimas ficavam
  // abaixo da dobra. Num celular pequeno: rolar com o dedo até o fim e um
  // toque aceita.
  test('⭐ com o cadastro por completar, os termos do Mercado respondem ao toque', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 600 });
    await ligarFlag('marketplace');
    await entrar(page, await criarAtleta({ incompleto: true }));
    await aceitar(page, page.getByRole('dialog', { name: 'Antes de continuar' }), 'Aceitar e continuar');

    await page.goto('/mercado');
    // Uma página no lugar do Mercado, não uma janela; o cadastro espera a vez.
    const termos = page.getByRole('region', { name: 'Antes de entrar no Mercado' });
    await expect(termos).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Os quatro documentos em ordem; o primeiro abre o texto ali mesmo.
    await expect(termos.locator('summary')).toHaveCount(4);
    await tocar(termos.locator('summary').first());
    await expect(termos.locator('details').first()).toHaveAttribute('open', '');
    await expect(termos.locator('details').first().locator('h4').first()).toBeVisible();
    await aceitar(page, termos, 'Li e aceito, entrar no Mercado');
    // O Mercado abre do topo (não rolado até onde estava o botão)…
    await expect.poll(() => page.locator('main').evaluate((el) => el.scrollTop)).toBe(0);
    // …e, aceitos os termos, é a vez do cadastro.
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  // 🐞 Com o professor sem horários publicados, o pedido mostrava "propor
  // horário" e o botão "Solicitar aula" ficava apagado com tudo preenchido.
  // Agora: só horários livres; sem eles, a tela diz e oferece a lista de
  // espera — gravada de verdade, pela regra do banco.
  test('⭐ professor sem horários: o pedido de aula oferece a lista de espera', async ({ page }) => {
    const prof = `prof_${Date.now()}`;
    await semear(`coaches/${prof}`, {
      uid: prof, display_name: 'Prof. Teste', active: true, accepting_students: true, hourly_rate: 100,
    });
    await entrar(page, await criarAtleta());
    await aceitar(page, page.getByRole('dialog', { name: 'Antes de continuar' }), 'Aceitar e continuar');

    await page.goto(`/coaches/${prof}?marcar=1`);
    const pedido = page.getByRole('dialog', { name: /Solicitar aula com Prof\. Teste/ });
    await expect(pedido).toBeVisible();
    await expect(pedido.getByText('Este professor ainda não tem horários disponíveis.')).toBeVisible();
    await expect(pedido.locator('input[type="date"]')).toHaveCount(0);
    await expect(pedido.getByRole('button', { name: 'Solicitar aula' })).toHaveCount(0);
    await expect(pedido.getByRole('button', { name: 'Mandar mensagem ao professor' })).toBeVisible();

    await tocar(pedido.getByRole('button', { name: 'Noite' }));
    const entrarNaLista = pedido.getByRole('button', { name: 'Entrar na lista de espera' });
    await rolarAte(page, entrarNaLista);
    await tocar(entrarNaLista);
    await expect(pedido.getByText(/Você está na lista de espera desde/)).toBeVisible();
  });

  test('⭐ professor com horários: só os livres aparecem e o pedido sai', async ({ page }) => {
    const prof = `prof_${Date.now()}`;
    await semear(`coaches/${prof}`, {
      uid: prof, display_name: 'Prof. Agenda', active: true, accepting_students: true, hourly_rate: 100,
    });
    await semear(`coach_availability/${prof}`, {
      coach_id: prof, slot_minutes: 60,
      windows: [{ id: 'w1', weekdays: [0, 1, 2, 3, 4, 5, 6], start: '07:00', end: '21:00' }],
    });
    await entrar(page, await criarAtleta());
    await aceitar(page, page.getByRole('dialog', { name: 'Antes de continuar' }), 'Aceitar e continuar');

    await page.goto(`/coaches/${prof}?marcar=1`);
    const pedido = page.getByRole('dialog', { name: /Solicitar aula com Prof\. Agenda/ });
    await expect(pedido.getByText('Horários livres', { exact: true })).toBeVisible();
    await expect(pedido.locator('input[type="date"], input[type="time"]')).toHaveCount(0);
    const solicitar = pedido.getByRole('button', { name: 'Solicitar aula' });
    await expect(solicitar).toBeDisabled();
    await tocar(pedido.locator('button[aria-pressed]').first());
    await expect(solicitar).toBeEnabled();
    await rolarAte(page, solicitar);
    await tocar(solicitar);
    await expect(pedido).toBeHidden();
  });

  // ⭐ Federações (flag `federations`): o diretório, a página da federação, o
  // formulário de filiação e a página pública sem conta montam de verdade, com
  // a regra do banco deixando a pessoa ler o que a tela mostra. Pedir a
  // filiação é do servidor (Cloud Function) e fica fora: aqui o que se prova é
  // que a leitura e os vínculos (federação → planos → filiar → pública) batem.
  test('⭐ federação: diretório, página, filiação e página pública abrem com a flag ligada', async ({ page }) => {
    const fed = `fed_${Date.now()}`;
    const slug = `fpp-${Date.now().toString(36)}`;
    await ligarFlag('federations');
    await semear(`federations/${fed}`, {
      name: 'Federação de Teste de Pickleball', acronym: 'FTP', slug, level: 'state', state: 'RS', city: 'Porto Alegre',
      status: 'approved', created_by: 'seed', verified: false, official: false, member_count: 0,
      about: 'A federação dos testes de ponta a ponta.', modules: { tournaments: true, ranking: true },
      branding: { color: '#1d4ed8', logo_url: '' }, contact_public: { email: 'contato@ftp.teste' }, sponsors: [],
      created_at: new Date(), updated_at: new Date(),
    });
    await semear(`federation_plans/${fed}_anual`, {
      federation_id: fed, name: 'Federado anual', description: 'Carteirinha e ranking oficial.', benefits: 'Carteirinha digital\nRanking oficial',
      person_type: 'athlete', tier: 'federated', billing: 'annual', validity: 'rolling', price_cents: 12000, active: true, sort: 0,
      created_at: new Date(), updated_at: new Date(),
    });
    const errosDaPagina = [];
    page.on('pageerror', (e) => errosDaPagina.push(`${page.url()}: ${e.message}`));

    // Sem conta: a página pública lê federação e planos pela regra (aprovada ⇒ pública).
    await page.goto(`/f/${slug}`);
    await expect(page.getByRole('heading', { name: 'Federação de Teste de Pickleball' })).toBeVisible();
    await expect(page.getByText('Federado anual').first()).toBeVisible();

    await entrar(page, await criarAtleta());
    await aceitar(page, page.getByRole('dialog', { name: 'Antes de continuar' }), 'Aceitar e continuar');

    await page.goto('/federacoes');
    await expect(page.locator('main h1').first()).toBeVisible();
    await tocar(page.getByRole('link', { name: /Federação de Teste de Pickleball/ }).first());
    await expect(page).toHaveURL(new RegExp(`/federacoes/${fed}$`));
    await expect(page.getByRole('heading', { name: 'Federação de Teste de Pickleball' })).toBeVisible();
    await expect(page.getByText('Federado anual').first()).toBeVisible();
    // Aprovada ⇒ o botão de filiar é um link de verdade (numa suspensa ele não existe).
    const filiar = page.getByRole('link', { name: 'Filiar-se' });
    await expect(filiar).toBeVisible();
    await tocar(filiar);
    await expect(page).toHaveURL(new RegExp(`/federacoes/${fed}/filiar`));
    await expect(page.getByText('Federado anual').first()).toBeVisible();
    await expect(page.locator('#fj-termos')).toBeVisible();

    for (const tela of ['/perfil?secao=federacoes', `/federacoes/${fed}`]) {
      await page.goto(tela);
      await expect(page.locator('main h1').first(), `título de ${tela}`).toBeVisible();
      await expect(page.locator('[role="alert"]').filter({ hasText: /Tentar de novo|Recarregar/ })).toHaveCount(0);
      await expect(page.getByText(/Algo deu errado|Não conseguimos abrir/i)).toHaveCount(0);
    }
    expect(errosDaPagina).toEqual([]);
  });
});
