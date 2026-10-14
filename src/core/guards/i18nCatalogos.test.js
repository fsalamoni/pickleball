import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { IDIOMAS, IDIOMA_PADRAO } from '@/core/i18n/languages.js';

/**
 * Os catálogos de idioma (src/<área>/i18n/locales/<codigo>.js) têm de andar
 * juntos: todo idioma em toda pasta, as mesmas chaves, as mesmas {variáveis}.
 * E todo `t('…')` do código tem de existir no catálogo — texto embrulhado sem
 * tradução cairia em português no meio da tela em inglês.
 */
const RAIZ = path.resolve(__dirname, '../..');
const alvos = IDIOMAS.map((i) => i.codigo).filter((c) => c !== IDIOMA_PADRAO);

function listar(dir, saida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, saida);
    else saida.push(p);
  }
  return saida;
}
const arquivos = listar(RAIZ);
const pastas = [...new Set(arquivos.filter((p) => /[\\/]i18n[\\/]locales[\\/][^\\/]+\.js$/.test(p)).map((p) => path.dirname(p)))];

async function ler(pasta, codigo) {
  return (await import(/* @vite-ignore */ path.join(pasta, `${codigo}.js`))).default;
}
const variaveis = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const textos = (v) => (Array.isArray(v) ? v : [v]);

describe('catálogos de idioma', () => {
  it('há pelo menos uma pasta de catálogos', () => {
    expect(pastas.length).toBeGreaterThan(0);
  });

  it.each(pastas.map((p) => [path.relative(RAIZ, p), p]))('%s: todo idioma, mesmas chaves e variáveis', async (_n, pasta) => {
    const catalogos = {};
    for (const c of alvos) {
      expect(fs.existsSync(path.join(pasta, `${c}.js`)), `falta ${c}.js`).toBe(true);
      catalogos[c] = await ler(pasta, c);
    }
    const base = Object.keys(catalogos[alvos[0]]).sort();
    for (const c of alvos) {
      expect(Object.keys(catalogos[c]).sort(), `chaves de ${c}`).toEqual(base);
      for (const [chave, valor] of Object.entries(catalogos[c])) {
        const esperado = variaveis(chave);
        textos(valor).forEach((v) => {
          expect(typeof v === 'string' && v.length > 0, `${c}: "${chave}" vazio`).toBe(true);
          expect(variaveis(v), `${c}: variáveis de "${chave}"`).toBe(esperado);
        });
      }
    }
  });

  it('todo t/tn/tk(\'…\') literal do código existe nos catálogos', async () => {
    const todas = new Set();
    for (const p of pastas) Object.keys(await ler(p, alvos[0])).forEach((k) => todas.add(k));
    const faltando = [];
    const re = /(?<![\w.$])t[k]?\(\s*'((?:[^'\\\n])+)'/g;
    // tn(n, 'singular', 'plural'): a chave é o PLURAL.
    const rePlural = /(?<![\w.$])tn\(\s*[^,]+,\s*'(?:[^'\\\n])+'\s*,\s*'((?:[^'\\\n])+)'/g;
    for (const f of arquivos) {
      if (!/\.(jsx?|mjs)$/.test(f) || /\.test\.|[\\/]locales[\\/]/.test(f)) continue;
      const src = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      for (const m of [...src.matchAll(re), ...src.matchAll(rePlural)]) {
        if (!todas.has(m[1])) faltando.push(`${path.relative(RAIZ, f)}: ${m[1]}`);
      }
    }
    expect(faltando).toEqual([]);
  });
});
