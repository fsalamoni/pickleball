#!/usr/bin/env node
/**
 * Regra do projeto: toda implementação atualiza a documentação (CLAUDE.md §2.12).
 * Em PR, se o diff mexe em código de produto e NÃO mexe em nenhum doc, reprova.
 * Saída honesta: PR que realmente não muda comportamento escreve, no corpo,
 * uma linha `Docs: não se aplica — <motivo>` (o motivo é obrigatório).
 *
 *   BASE_REF=origin/main PR_BODY="..." node scripts/check-docs-updated.mjs
 */
import { execFileSync } from 'node:child_process';

const base = process.env.BASE_REF || 'origin/main';
const body = process.env.PR_BODY || '';
const files = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);

const PRODUTO = /^(src\/(?!.*\.test\.)|functions\/(?!.*\.test\.)|firestore\.rules$|storage\.rules$|firestore\.indexes\.json$|firebase\.json$|\.github\/workflows\/)/;
const DOC = /^(docs\/|CLAUDE\.md$|AGENTS\.md$|README\.md$|src\/modules\/[^/]+\/README\.md$|functions\/README\.md$)/;

const produto = files.filter((f) => PRODUTO.test(f) && !DOC.test(f));
const docs = files.filter((f) => DOC.test(f));
const isento = /^\s*Docs:\s*não se aplica\s*[—-]\s*\S{8,}/im.test(body);

if (!produto.length) { console.log('Sem mudança de código de produto: nada a exigir.'); process.exit(0); }
if (docs.length) { console.log(`Documentação tocada (${docs.length} arquivo(s)). OK.`); process.exit(0); }
if (isento) { console.log('Isenção declarada no corpo do PR ("Docs: não se aplica — motivo"). OK.'); process.exit(0); }

console.error(`✖ O PR muda ${produto.length} arquivo(s) de código mas nenhum documento.
  Atualize o doc do assunto (docs/NN-*.md, README do módulo, CLAUDE.md §4/§10) e rode
  "npm run docs:inventario". Se de fato nada muda para quem lê a documentação, escreva no
  corpo do PR:  Docs: não se aplica — <motivo>
  Exemplos de arquivos de código no diff:\n   ${produto.slice(0, 5).join('\n   ')}`);
process.exit(1);
