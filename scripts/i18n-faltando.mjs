#!/usr/bin/env node
/**
 * Lista as chaves t('…') / tn(…) / tk('…') usadas nos arquivos ou pastas
 * passados que ainda não estão em NENHUM catálogo en.js.
 *   node scripts/i18n-faltando.mjs src/v2/pages/V2Login.jsx src/modules/arenas
 * Saída: JSON { "chave": "" } pronto para colar num catálogo.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { desescapar } from './i18n-avisos.mjs';

const listar = (p, out = []) => {
  if (!fs.existsSync(p)) return out;
  if (fs.statSync(p).isFile()) { out.push(p); return out; }
  for (const e of fs.readdirSync(p)) listar(path.join(p, e), out);
  return out;
};
const todos = listar('src');
const catalogos = todos.filter((p) => /[\\/]i18n[\\/]locales[\\/]en\.js$/.test(p));
const conhecidas = new Set();
for (const c of catalogos) Object.keys((await import(pathToFileURL(path.resolve(c)))).default).forEach((k) => conhecidas.add(k));

const re = /(?<![\w.$])t[k]?\(\s*'((?:[^'\\\n]|\\.)+)'/g;
const rePlural = /(?<![\w.$])tn\(\s*[^,]+,\s*'(?:[^'\\\n]|\\.)+'\s*,\s*'((?:[^'\\\n]|\\.)+)'/g;
const faltando = {};
for (const alvo of process.argv.slice(2)) {
  for (const f of listar(alvo)) {
    if (!/\.(jsx?|mjs)$/.test(f) || /\.test\.|[\\/]locales[\\/]/.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    for (const m of src.matchAll(re)) if (!conhecidas.has(desescapar(m[1]))) faltando[desescapar(m[1])] = '';
    for (const m of src.matchAll(rePlural)) if (!conhecidas.has(desescapar(m[1]))) faltando[desescapar(m[1])] = ['', ''];
  }
}
process.stdout.write(`${JSON.stringify(faltando, null, 2)}\n`);
