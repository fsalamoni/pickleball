#!/usr/bin/env node
/**
 * Junta traduções num catálogo de pasta.
 *   node scripts/i18n-gravar.mjs src/v2/i18n traducoes.json
 * traducoes.json: { "texto pt": { "en": "…", "es": "…" } }  (plural: arrays)
 * Grava/atualiza <pasta>/locales/<codigo>.js para cada idioma do registro,
 * em ordem alfabética, preservando o que já existia.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IDIOMAS, IDIOMA_PADRAO } from '../src/core/i18n/languages.js';

const [pasta, arquivo] = process.argv.slice(2);
const novas = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
const dir = path.join(pasta, 'locales');
fs.mkdirSync(dir, { recursive: true });
const lit = (v) => (Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v));
for (const { codigo } of IDIOMAS) {
  if (codigo === IDIOMA_PADRAO) continue;
  const alvo = path.join(dir, `${codigo}.js`);
  const atual = fs.existsSync(alvo) ? (await import(`${pathToFileURL(path.resolve(alvo))}?v=${Date.now()}`)).default : {};
  for (const [k, v] of Object.entries(novas)) {
    if (!v[codigo]) throw new Error(`sem ${codigo}: ${k}`);
    atual[k] = v[codigo];
  }
  const linhas = Object.keys(atual).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((k) => `  ${JSON.stringify(k)}: ${lit(atual[k])},`);
  fs.writeFileSync(alvo, `// Catálogo ${codigo} — chave: o texto em português (ver docs/44-IDIOMAS.md).\nexport default {\n${linhas.join('\n')}\n};\n`);
}
console.log(`${Object.keys(novas).length} chaves em ${dir}`);
