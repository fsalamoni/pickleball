#!/usr/bin/env node
/**
 * Operação da integração DUPR a partir do GitHub Actions (`dupr-uat.yml`).
 *
 * As credenciais moram nos SEGREDOS do repositório (DUPR_CLIENT_KEY,
 * DUPR_CLIENT_SECRET) e só chegam aqui por variável de ambiente. Nada delas é
 * impresso: o log do Actions mascara o valor exato, mas ele também não é
 * montado em nenhuma mensagem.
 *
 *   node scripts/dupr-uat.cjs smoke      credencial vale? o DUPR responde? (só leitura)
 *   node scripts/dupr-uat.cjs seed       copia as credenciais para platform_secrets/dupr
 *                                        (o servidor lê dali; o navegador não lê)
 *   node scripts/dupr-uat.cjs webhook    registra no DUPR a URL do nosso webhook
 *   node scripts/dupr-uat.cjs user <ID>  ratings públicos de um jogador (ID DUPR)
 *
 * Variáveis: DUPR_CLIENT_KEY, DUPR_CLIENT_SECRET, DUPR_ENV (uat|prod, padrão uat),
 * FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS (seed/webhook).
 */
const path = require('node:path');
const crypto = require('node:crypto');

const funcoes = path.join(__dirname, '..', 'functions');
const exigir = (m) => require(require.resolve(m, { paths: [funcoes] }));
const { createDuprClient } = require(path.join(funcoes, 'duprClient.js'));

const DATABASE_ID = 'pickleball';
const SITE = 'https://picklerush.web.app';

const env = () => (String(process.env.DUPR_ENV || 'uat').toLowerCase() === 'prod' ? 'prod' : 'uat');

function cliente() {
  return createDuprClient({
    clientKey: process.env.DUPR_CLIENT_KEY,
    clientSecret: process.env.DUPR_CLIENT_SECRET,
    env: env(),
  });
}

function db() {
  const { initializeApp, getApps, getApp } = exigir('firebase-admin/app');
  const { getFirestore } = exigir('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  return getFirestore(getApp(), DATABASE_ID);
}

const log = (...a) => console.log(...a);

async function smoke() {
  const c = cliente();
  log(`Ambiente: ${env()} · API de parceiro: ${c.hosts.partner}`);
  await c.partnerToken();
  log('✔ Token de parceiro gerado (credencial válida).');

  const topicos = await fetch(`${c.hosts.partner}/v1.0/topic`, { headers: { Authorization: `Bearer ${await c.partnerToken()}` } });
  log(`${topicos.ok ? '✔' : '✖'} Tópicos de webhook: HTTP ${topicos.status}`);

  const sso = await fetch(c.ssoUrl());
  log(`${sso.ok ? '✔' : '✖'} Tela de login (SSO) responde: HTTP ${sso.status}`);

  const esquema = await fetch(`${c.hosts.partner}/v1.0/webhook/schema/RATING`);
  log(`${esquema.ok ? '✔' : '✖'} Esquema do webhook RATING: HTTP ${esquema.status}`);
}

async function seed() {
  const banco = db();
  const ref = banco.collection('platform_secrets').doc('dupr');
  const atual = await ref.get();
  const antigo = atual.exists ? atual.data() || {} : {};
  await ref.set({
    client_key: String(process.env.DUPR_CLIENT_KEY || '').trim(),
    client_secret: String(process.env.DUPR_CLIENT_SECRET || '').trim(),
    env: env(),
    // O token vai na URL do webhook: é o que separa o DUPR de qualquer outro
    // chamador. Gerado uma vez e mantido.
    webhook_token: antigo.webhook_token || crypto.randomBytes(24).toString('hex'),
    updated_at: new Date().toISOString(),
  }, { merge: true });
  log(`✔ platform_secrets/dupr gravado (ambiente ${env()}). Credenciais não impressas.`);
}

async function webhook() {
  const c = cliente();
  const snap = await db().collection('platform_secrets').doc('dupr').get();
  const token = snap.exists && snap.data().webhook_token;
  if (!token) throw new Error('Rode `seed` antes: falta o webhook_token.');
  // Pelo domínio do site (rewrite do hosting → `duprWebhook`): o endereço não muda se a função for recriada.
  const url = `${SITE}/api/dupr/webhook?k=${token}`;
  const r = await c.registerWebhook(url, ['RATING']);
  log(`✔ Webhook registrado no DUPR (${r && r.status}). Endereço: ${SITE}/api/dupr/webhook?k=***`);
}

async function user(id) {
  if (!id) throw new Error('Informe o ID DUPR.');
  const r = await cliente().getUser(id);
  const x = (r && r.result) || {};
  log(JSON.stringify({ id: x.id, nome: x.fullName, ratings: x.ratings && { singles: x.ratings.singles, doubles: x.ratings.doubles } }));
}

const comandos = { smoke, seed, webhook, user };

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!comandos[cmd]) throw new Error(`Uso: dupr-uat.cjs ${Object.keys(comandos).join('|')}`);
  await comandos[cmd](...args);
}

main().catch((err) => {
  // A mensagem do DuprError traz status e texto do DUPR, nunca credencial.
  console.error(`::error title=DUPR::${err.message}`);
  process.exit(1);
});
