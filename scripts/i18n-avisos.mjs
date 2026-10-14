/**
 * Gera `functions/i18n/avisos.json`: o catálogo que o PUSH usa para mandar o
 * aviso no idioma de quem recebe (o pacote de Functions não enxerga `src/`).
 *
 * Só as chaves dos `tx('…')` do código (src e functions), com a tradução que já
 * está nos catálogos `src/**\/i18n/locales/<codigo>.js`. Rodar depois de mexer
 * num aviso:  npm run i18n:avisos
 * A guarda `src/core/guards/i18nAvisos.test.js` reprova o arquivo desatualizado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ARQUIVO_AVISOS = path.join(RAIZ, 'functions', 'i18n', 'avisos.json');
const IDIOMAS = ['en', 'es'];

function listar(dir, saida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, saida);
    else saida.push(p);
  }
  return saida;
}

/** As chaves literais de `tx('…')`, fora de testes e catálogos. */
export function chavesDeAvisos() {
  const re = /(?<![\w.$])tx\(\s*'((?:[^'\\\n])+)'/g;
  const chaves = new Set();
  for (const pasta of ['src', 'functions']) {
    for (const f of listar(path.join(RAIZ, pasta))) {
      if (!/\.(jsx?|mjs)$/.test(f) || /\.test\.|[\\/]locales[\\/]/.test(f)) continue;
      const src = fs.readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      for (const m of src.matchAll(re)) chaves.add(m[1]);
    }
  }
  return [...chaves].sort();
}

async function catalogo(codigo) {
  const arquivos = listar(path.join(RAIZ, 'src')).filter((p) => p.endsWith(`${path.sep}i18n${path.sep}locales${path.sep}${codigo}.js`));
  const partes = await Promise.all(arquivos.sort().map((p) => import(pathToFileURL(p).href)));
  return Object.assign({}, ...partes.map((m) => m.default));
}

/** `{ avisos: { en, es }, faltando: ['en: chave', …] }`. */
export async function gerarAvisos() {
  const chaves = chavesDeAvisos();
  const avisos = {};
  const faltando = [];
  for (const codigo of IDIOMAS) {
    const cat = await catalogo(codigo);
    avisos[codigo] = {};
    for (const k of chaves) {
      if (typeof cat[k] === 'string') avisos[codigo][k] = cat[k];
      else faltando.push(`${codigo}: ${k}`);
    }
  }
  return { avisos, faltando };
}

export const serializar = (avisos) => `${JSON.stringify(avisos, null, 2)}\n`;

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { avisos, faltando } = await gerarAvisos();
  if (faltando.length) {
    console.error(`Sem tradução nos catálogos:\n${faltando.join('\n')}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(ARQUIVO_AVISOS), { recursive: true });
  fs.writeFileSync(ARQUIVO_AVISOS, serializar(avisos));
  console.log(`${ARQUIVO_AVISOS}: ${Object.keys(avisos.en).length} chaves.`);
}
