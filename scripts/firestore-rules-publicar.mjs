#!/usr/bin/env node
/**
 * Publica as regras do Firestore pela API de regras, sem passar pela CLI.
 *
 * Por que não `firebase deploy --only firestore:rules`:
 * - Em 2026-11-03 e 2026-11-04 o endpoint `projects/{p}:test` respondeu
 *   **503** por horas. A CLI chama esse endpoint antes de publicar, e também no
 *   deploy de índices. Ele só confere se a regra compila, e a criação do
 *   ruleset já faz essa conferência. Cinco deploys seguidos (PRs #383 a #390)
 *   pararam ali, e com eles o site, as funções e o Storage.
 * - Quando o PATCH da release falha, a CLI esconde o erro real e sai com
 *   "409 already exists" (ver docs/03-WORKFLOW.md §4.3). Aqui a resposta do
 *   serviço aparece inteira.
 *
 * O caminho tem três passos:
 * 1. Lê a regra que está no ar: a release `cloud.firestore/<banco>` e o
 *    ruleset dela.
 * 2. Se a fonte no ar é igual à compactada, não publica nada (status
 *    `unchanged`). A maioria dos merges não mexe nas regras, e assim não fica
 *    exposta à instabilidade do serviço.
 * 3. Se mudou, cria o ruleset (o serviço compila e recusa a regra que não
 *    compila) e aponta a release para ele, repetindo nos erros 5xx e de rede
 *    com espera crescente.
 *
 * Códigos de saída:
 * - 0: publicada ou já no ar;
 * - 75: serviço indisponível depois das repetições (passageiro: o deploy
 *   segue, e a vigilância `firestore-rules-catchup.yml` publica depois);
 * - 1: erro de verdade (regra que não compila, permissão, release recusada).
 *
 * Uso: FIREBASE_PROJECT_ID=… FIRESTORE_DATABASE_ID=pickleball
 *      GOOGLE_APPLICATION_CREDENTIALS=… node scripts/firestore-rules-publicar.mjs [arquivo]
 * O arquivo padrão é o firestore.rules, já compactado pelo passo anterior.
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const API = 'https://firebaserules.googleapis.com/v1';
export const SAIDA_PASSAGEIRA = 75;

/** Esperas entre tentativas, em segundos (~13 min no total, dentro do job de 30). */
export const ESPERAS = [20, 40, 60, 90, 120, 150, 150, 150];

/** Erro em que vale tentar de novo: 5xx, 429 e falha de rede. */
export function ehPassageiro(status) {
  return status === 0 || status === 429 || (status >= 500 && status <= 599);
}

/** A fonte do ruleset no ar, para comparar com a compactada. */
export function fonteDoRuleset(ruleset) {
  const arquivos = ruleset?.source?.files || [];
  return arquivos.map((f) => f.content || '').join('\n');
}

export function mesmaFonte(noAr, local) {
  const norm = (s) => String(s || '').replace(/\r\n/g, '\n').trimEnd();
  return noAr != null && norm(noAr) === norm(local);
}

/** O nome da release do Firestore: banco nomeado leva o id do banco no fim. */
export function nomeDaRelease(projeto, banco) {
  const sufixo = !banco || banco === '(default)' ? 'cloud.firestore' : `cloud.firestore/${banco}`;
  return `projects/${projeto}/releases/${sufixo}`;
}

const dormir = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function pedir(token, metodo, url, corpo) {
  try {
    const resp = await fetch(url, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await resp.text();
    let json = null;
    try { json = texto ? JSON.parse(texto) : null; } catch { /* corpo não-JSON */ }
    return { status: resp.status, json, texto };
  } catch (e) {
    return { status: 0, json: null, texto: String(e?.message || e) };
  }
}

/** Repete nos erros passageiros; devolve a última resposta. */
async function comRepeticao(rotulo, fn) {
  let resp = await fn();
  for (let i = 0; i < ESPERAS.length && ehPassageiro(resp.status); i += 1) {
    console.log(`::warning title=Serviço de regras indisponível::${rotulo}: HTTP ${resp.status}. Tentativa ${i + 2} em ${ESPERAS[i]} s.`);
    await dormir(ESPERAS[i]);
    resp = await fn();
  }
  return resp;
}

function resumo(linha) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${linha}\n`);
}

function saida(status) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `status=${status}\n`);
}

async function principal() {
  const projeto = process.env.FIREBASE_PROJECT_ID;
  const banco = process.env.FIRESTORE_DATABASE_ID || '(default)';
  const arquivo = process.argv[2] || 'firestore.rules';
  if (!projeto) {
    console.log('::error title=Regras do Firestore::FIREBASE_PROJECT_ID ausente.');
    return 1;
  }
  const fonte = readFileSync(arquivo, 'utf8');

  const { default: admin } = await import('firebase-admin');
  const token = (await admin.credential.applicationDefault().getAccessToken()).access_token;

  const release = nomeDaRelease(projeto, banco);
  const atual = await comRepeticao('Ler a release', () => pedir(token, 'GET', `${API}/${release}`));
  let existeRelease = atual.status === 200;
  if (atual.status !== 200 && atual.status !== 404) {
    if (ehPassageiro(atual.status)) return passageiro(`ler a release (HTTP ${atual.status})`);
    console.log(`::error title=Regras do Firestore::Não deu para ler a release ${release}: HTTP ${atual.status} ${atual.texto.slice(0, 800)}`);
    return 1;
  }

  if (existeRelease) {
    const rs = await comRepeticao('Ler o ruleset no ar', () => pedir(token, 'GET', `${API}/${atual.json.rulesetName}`));
    if (rs.status === 200 && mesmaFonte(fonteDoRuleset(rs.json), fonte)) {
      console.log(`Regras já no ar (${atual.json.rulesetName}): nada a publicar.`);
      resumo('Regras do Firestore: **já no ar**, iguais às do código.');
      saida('unchanged');
      return 0;
    }
    if (rs.status !== 200) console.log(`Não deu para ler o ruleset no ar (HTTP ${rs.status}); publico assim mesmo.`);
  }

  const criado = await comRepeticao('Criar o ruleset', () =>
    pedir(token, 'POST', `${API}/projects/${projeto}/rulesets`, {
      source: { files: [{ name: 'firestore.rules', content: fonte }] },
    }));
  if (criado.status !== 200) {
    if (ehPassageiro(criado.status)) return passageiro(`criar o ruleset (HTTP ${criado.status})`);
    console.log(`::error title=Regras do Firestore não publicadas::O serviço recusou o ruleset: HTTP ${criado.status} ${criado.texto.slice(0, 3000)}`);
    return 1;
  }
  const rulesetName = criado.json.name;

  const corpo = { release: { name: release, rulesetName } };
  const publicado = existeRelease
    ? await comRepeticao('Apontar a release', () => pedir(token, 'PATCH', `${API}/${release}`, corpo))
    : await comRepeticao('Criar a release', () => pedir(token, 'POST', `${API}/projects/${projeto}/releases`, { name: release, rulesetName }));
  if (publicado.status !== 200) {
    if (ehPassageiro(publicado.status)) return passageiro(`apontar a release (HTTP ${publicado.status})`);
    console.log(`::error title=Regras do Firestore não publicadas::A release recusou o ruleset ${rulesetName}: HTTP ${publicado.status} ${publicado.texto.slice(0, 3000)}. Causa comum: ruleset compilado acima de 250 KB (docs/03-WORKFLOW.md §4.3).`);
    return 1;
  }
  console.log(`released rules: ${release} → ${rulesetName}`);
  resumo(`Regras do Firestore: **publicadas** (${rulesetName}).`);
  saida('deployed');
  return 0;
}

function passageiro(onde) {
  console.log(`::warning title=Regras do Firestore pendentes::O serviço de regras não respondeu ao ${onde} depois de ${ESPERAS.length + 1} tentativas. O deploy segue; a vigilância firestore-rules-catchup.yml publica assim que o serviço voltar.`);
  resumo('Regras do Firestore: **pendentes** (serviço de regras indisponível). A vigilância publica sozinha em até 30 min.');
  saida('pending');
  return SAIDA_PASSAGEIRA;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  principal().then((c) => process.exit(c), (e) => {
    console.log(`::error title=Regras do Firestore::${e?.stack || e}`);
    process.exit(1);
  });
}
