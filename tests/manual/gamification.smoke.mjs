/**
 * Smoke test AUTENTICADO da gamificação V2, contra os emuladores REAIS
 * (Auth + Firestore + regras de segurança de verdade).
 *
 * É o teste que os unitários não conseguem fazer: cria um usuário, aceita os
 * termos pela UI, liga a flag no banco e percorre as telas num navegador —
 * conferindo no fim o que foi realmente GRAVADO no Firestore passando pelas
 * regras. Foi ele que revelou que nenhuma missão jamais era criada (o
 * documento saía com campos `undefined` e o Firestore recusava, em silêncio).
 *
 * NÃO roda no `npm test` — precisa de Java, dos emuladores e do servidor de
 * desenvolvimento. Rode à mão antes de mexer no fluxo da gamificação:
 *
 *   1. crie um .env.local com config falsa e:
 *        VITE_FIREBASE_USE_EMULATORS=true
 *        VITE_FIREBASE_PROJECT_ID=demo-picklerush
 *        VITE_FIRESTORE_DATABASE_ID=(default)
 *   2. npm run dev
 *   3. npx firebase-tools emulators:exec --only firestore,auth \
 *        --project demo-picklerush --config <firebase.json com auth+firestore> \
 *        "node tests/manual/gamification.smoke.mjs"
 *
 * Para o teste espelho (flag DESLIGADA não pode gravar nada nem mudar tela),
 * troque `booleanValue: true` por `false` e confira que todas as coleções
 * ficam em 0 documentos.
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173';
const PROJ = 'demo-picklerush';
const AUTH = 'http://127.0.0.1:9099';
const FS = `http://127.0.0.1:8080/v1/projects/${PROJ}/databases/(default)/documents`;

// 1) Usuário no emulador de Auth
const signUp = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=dummy`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'atleta@teste.com', password: 'senha123', returnSecureToken: true }),
}).then((r) => r.json());
if (!signUp.localId) { console.error('falha ao criar usuário:', signUp); process.exit(1); }
const UID = signUp.localId;
console.log(`usuário criado no emulador: ${UID}`);

// 2) Flag LIGADA + perfil, escritos direto no emulador (bypass de regras via REST admin)
async function setDoc(path, fields) {
  const r = await fetch(`${FS}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) console.error(`  ! escrita falhou ${path}: ${r.status} ${await r.text()}`);
}
// documento correto: platform_settings/global, com feature_flags como MAPA
await setDoc('platform_settings/global', {
  feature_flags: { mapValue: { fields: { gamification_v2: { booleanValue: true } } } },
});
await setDoc(`users/${UID}`, {
  uid: { stringValue: UID }, email: { stringValue: 'atleta@teste.com' },
  platform_name: { stringValue: 'Atleta Teste' }, role: { stringValue: 'user' },
  directory_listed: { booleanValue: true },
});
console.log('flag gamification_v2 = true e perfil gravados no emulador');

// 3) Navegador
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (/Failed to load resource|net::ERR|installations|measurement|analytics|WebChannel/i.test(t)) return;
  erros.push(`console: ${t.slice(0, 220)}`);
});

// Autentica pelo FORMULÁRIO REAL do app (mesmo caminho do usuário)
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type="email"]', { timeout: 20000 });
await page.fill('input[type="email"]', 'atleta@teste.com');
await page.fill('input[type="password"]', 'senha123');
await page.click('button[type="submit"]');
await page.waitForTimeout(5000);
const logado = await page.evaluate(() => !window.location.pathname.startsWith('/login'));
console.log(`login pelo formulário: ${logado ? 'OK' : 'FALHOU (segue em /login)'}`);
if (!logado) {
  console.log('  texto da tela:', (await page.locator('body').innerText()).replace(/\s+/g,' ').slice(0,200));
}

// Portão de consentimento da plataforma (não é da gamificação): aceitar pela
// UI, exatamente como um usuário novo faria.
await page.goto(`${BASE}/inicio`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
if ((await page.locator('body').innerText()).includes('Antes de continuar')) {
  const caixas = page.locator('input[type="checkbox"]');
  const n = await caixas.count();
  for (let i = 0; i < n; i += 1) await caixas.nth(i).check({ force: true }).catch(() => {});
  await page.getByRole('button', { name: /Aceitar e continuar/i }).click().catch(() => {});
  await page.waitForTimeout(3500);
  const aindaBloqueado = (await page.locator('body').innerText()).includes('Antes de continuar');
  console.log(`aceite dos termos: ${aindaBloqueado ? 'FALHOU' : 'OK'} (${n} caixas)`);
}

const resultados = [];
async function ver(rota, nome, espera) {
  const antes = erros.length;
  await page.goto(`${BASE}${rota}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(
    () => (document.getElementById('root')?.innerText || '').trim().length > 20,
    { timeout: 20000 },
  ).catch(() => {});
  await page.waitForTimeout(2500);
  const texto = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  const novos = erros.slice(antes);
  const bloqueado = texto.includes('Antes de continuar');
  const desligada = /em construção|estará disponível em breve/i.test(texto);
  let achou = true;
  let motivo = espera;
  if (bloqueado) { achou = false; motivo = 'tela liberada (portão de termos ativo)'; }
  else if (desligada) { achou = false; motivo = 'conteúdo da flag LIGADA (veio o estado de flag desligada)'; }
  else if (espera && !texto.includes(espera)) { achou = false; }
  resultados.push({ rota, nome, texto: texto.slice(0, 150), erros: novos, achou, espera: motivo });
}

await ver('/perfil', 'perfil · bloco de progressão V2', 'Sua progressão');
await ver('/gamification', 'hub · trilhas e convite', 'Trilhas paralelas');
await ver('/conquistas', 'catálogo · filtros por família', 'desbloqueadas');
// diagnóstico: o que /conquistas realmente renderiza?
await page.goto(`${BASE}/conquistas`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
const txtConquistas = (await page.locator('main, #root').first().innerText()).replace(/\s+/g, ' ');
console.log('\n[diag] /conquistas renderizou:', txtConquistas.slice(0, 400));
// diagnóstico: missões
await page.goto(`${BASE}/gamification`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const txtHub = (await page.locator('#root').innerText()).replace(/\s+/g, ' ');
const iMiss = txtHub.indexOf('Missões');
console.log('\n[diag] hub perto de "Missões":', iMiss >= 0 ? txtHub.slice(iMiss, iMiss + 300) : '(sem seção de missões)');
await ver('/vinculos', 'vínculos · rivais/crews/mentorias', 'Rivais');
await ver('/hall-da-fama', 'hall da fama · ranking por XP', 'Hall da Fama');
await ver(`/conquistas/${UID}`, 'perfil público de conquistas', 'Atleta Teste');
await ver('/meu-desempenho', 'página existente (controle)', null);
await ver('/ranking', 'página existente (controle)', null);

// 4) O que foi realmente GRAVADO no banco pelo app?
const escreveu = {};
for (const col of ['user_progression_v2', 'user_missions', 'user_streak_meta', 'user_achievements_v2', 'user_referral_codes']) {
  const r = await fetch(`${FS}/${col}`, { headers: { Authorization: 'Bearer owner' } }).then((x) => x.json());
  escreveu[col] = (r.documents || []).length;
}

await browser.close();

let falhas = 0;
console.log('\n──────── TELAS ────────');
for (const r of resultados) {
  const ok = r.erros.length === 0 && r.achou;
  if (!ok) falhas += 1;
  console.log(`${ok ? '✓' : '✗'} ${r.rota.padEnd(22)} ${r.nome}`);
  console.log(`    "${r.texto || '(vazio)'}"`);
  if (!r.achou) console.log(`    !! esperava encontrar: "${r.espera}"`);
  r.erros.forEach((e) => console.log(`    !! ${e}`));
}
const miss = await fetch(`${FS}/user_missions`, { headers: { Authorization: 'Bearer owner' } }).then((x) => x.json());
const d0 = (miss.documents || [])[0];
if (d0) {
  const m0 = d0.fields?.missions?.arrayValue?.values?.[0]?.mapValue?.fields || {};
  console.log('\n[missão gravada] título:', m0.title?.stringValue, '| xp:', m0.xp?.integerValue, '| alvo:', m0.target?.integerValue, '| atual:', m0.current?.integerValue);
}
console.log('\n──────── GRAVOU NO BANCO (via regras reais) ────────');
for (const [c, n] of Object.entries(escreveu)) console.log(`  ${c.padEnd(24)} ${n} doc(s)`);
console.log(`\n${resultados.length - falhas}/${resultados.length} telas OK`);
process.exit(falhas ? 1 : 0);
