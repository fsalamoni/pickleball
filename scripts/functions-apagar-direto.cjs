#!/usr/bin/env node
/**
 * Apaga UMA Cloud Function (2ª geração) direto pela API do Google, pelo nome.
 *
 * Só é chamado por scripts/functions-apagar-aposentadas.sh, e só quando a CLI
 * do Firebase não consegue: numa função AGENDADA cuja tarefa (Cloud Scheduler)
 * já foi apagada, `firebase functions:delete` tenta apagar a tarefa primeiro,
 * recebe 404 e desiste antes de chegar à função — e ainda sai com código 0.
 * 🐞 Foi o caso de expireStaleNotifications (2026-11-14).
 *
 * Projeto COMPARTILHADO com outro app: o nome e a região vêm de quem chama (a
 * lista fechada), e a função é recusada se o rótulo dela disser que pertence a
 * outro codebase.
 *
 * Uso: FIREBASE_PROJECT_ID=… FUNCTIONS_REGION=… node scripts/functions-apagar-direto.cjs <nome>
 * Depende de functions/node_modules (firebase-admin) e de GOOGLE_APPLICATION_CREDENTIALS.
 */
const path = require('node:path');

const funcoes = path.join(__dirname, '..', 'functions');
const exigir = (m) => require(require.resolve(m, { paths: [funcoes] }));

const CODEBASE = process.env.FUNCTIONS_CODEBASE || 'picklerush';
const ROTULO = 'firebase-functions-codebase';
const API = 'https://cloudfunctions.googleapis.com/v2';

/** Recebe quem busca (`api(caminho, init) → { status, json() }`), para o teste. */
async function apagar({ api, projeto, regiao, nome, espera = 4000, tentativas = 45 }) {
  if (!/^[A-Za-z0-9_]+$/.test(nome || '')) throw new Error(`nome de função inválido: ${nome}`);
  const funcao = `projects/${projeto}/locations/${regiao}/functions/${nome}`;
  const atual = await api(funcao);
  if (atual.status === 404) return 'ja-nao-existe';
  if (atual.status !== 200) throw new Error(`não deu para ler ${nome} (HTTP ${atual.status})`);
  const dono = ((await atual.json()).labels || {})[ROTULO];
  if (dono && dono !== CODEBASE) throw new Error(`${nome} é do codebase "${dono}", não do "${CODEBASE}": não apago`);

  const pedido = await api(funcao, { method: 'DELETE' });
  let op = await pedido.json();
  if (pedido.status !== 200) throw new Error(`o pedido de apagar ${nome} foi recusado (HTTP ${pedido.status}): ${op?.error?.message || ''}`);
  for (let i = 0; i < tentativas && !op.done; i += 1) {
    await new Promise((r) => { setTimeout(r, espera); });
    op = await (await api(op.name)).json();
  }
  if (!op.done) throw new Error(`apagar ${nome} não terminou a tempo`);
  if (op.error) throw new Error(`apagar ${nome} falhou: ${op.error.message}`);
  return 'apagada';
}

async function principal() {
  const { FIREBASE_PROJECT_ID: projeto, FUNCTIONS_REGION: regiao } = process.env;
  if (!projeto || !regiao) throw new Error('FIREBASE_PROJECT_ID e FUNCTIONS_REGION são obrigatórios');
  const admin = exigir('firebase-admin');
  const { access_token: token } = await admin.credential.applicationDefault().getAccessToken();
  const api = (caminho, init = {}) => fetch(`${API}/${caminho}`, { ...init, headers: { Authorization: `Bearer ${token}` } });
  const nome = process.argv[2];
  const fim = await apagar({ api, projeto, regiao, nome });
  console.log(fim === 'apagada' ? `${nome}: apagada direto pela API.` : `${nome}: já não existe.`);
}

if (require.main === module) {
  principal().catch((e) => { console.error(`Error: ${e.message}`); process.exit(1); });
}

module.exports = { apagar };
