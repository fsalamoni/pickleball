#!/usr/bin/env node
/**
 * Gera `docs/46-INVENTARIO.md` a partir do CÓDIGO (nunca à mão): módulos, rotas,
 * coleções, índices, Cloud Functions, flags, Storage, workflows, scripts e
 * contagens. `--check` falha (CI) se o arquivo gravado não bate com o código.
 *
 *   npm run docs:inventario          # regrava
 *   npm run docs:inventario:check    # confere (usado no CI)
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { grafoEstatico, ciclos, dependenciasEntreModulos } from '../src/core/guards/grafoDeImports.js';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'docs/46-INVENTARIO.md');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ls = (p) => (existsSync(join(ROOT, p)) ? readdirSync(join(ROOT, p)) : []);
const isDir = (p) => existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isDirectory();

function walk(dir, acc = []) {
  for (const n of ls(dir)) {
    if (n === 'node_modules' || n === 'dist') continue;
    const p = `${dir}/${n}`;
    if (isDir(p)) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}
const countFiles = (dir, re) => walk(dir).filter((f) => re.test(f)).length;

// ---------- módulos ----------
const LAYERS = ['domain', 'services', 'hooks', 'components', 'pages', 'i18n'];
const modulos = ls('src/modules').filter((m) => isDir(`src/modules/${m}`)).sort().map((m) => {
  const base = `src/modules/${m}`;
  const cols = LAYERS.map((l) => (isDir(`${base}/${l}`) ? countFiles(`${base}/${l}`, /\.(js|jsx)$/) - countFiles(`${base}/${l}`, /\.test\.(js|jsx)$/) : '·'));
  return `| \`${m}\` | ${cols.join(' | ')} | ${existsSync(join(ROOT, base, 'README.md')) ? 'sim' : '—'} |`;
});

// ---------- rotas ----------
const WRAP = new Set(['Route', 'Routes', 'Isolada', 'ProtectedRoute', 'AparenciaClara', 'Suspense', 'FeatureFlagGuard', 'V2RouteBoundary', 'Fragment']);
function rotas(file, titulo) {
  const src = read(file);
  const out = [];
  const re = /<Route\s+(index|path="([^"]*)")/g;
  let m;
  while ((m = re.exec(src))) {
    let trecho = src.slice(m.index, m.index + 420);
    const prox = trecho.indexOf('<Route', 6);
    if (prox > 0) trecho = trecho.slice(0, prox);
    const nav = trecho.match(/<Navigate\s+to="([^"]*)"/);
    let alvo;
    if (nav) alvo = `→ redireciona para \`${nav[1]}\``;
    else {
      const comps = [...trecho.slice(m[0].length).matchAll(/<([A-Z]\w+)/g)].map((x) => x[1]).filter((c) => !WRAP.has(c));
      alvo = comps[0] ? `\`${comps[0]}\`` : '—';
    }
    out.push(`| \`${m[1] === 'index' ? '(índice)' : m[2]}\` | ${alvo} |`);
  }
  return `### ${titulo} (${out.length})\n\n| Caminho | Tela |\n|---|---|\n${out.join('\n')}`;
}

// ---------- coleções (firestore.rules) ----------
const rules = read('firestore.rules').split('\n');
const colecoes = [];
let ultimaTop = null;
rules.forEach((ln, i) => {
  const m = ln.match(/^(\s+)match \/([a-zA-Z0-9_]+)\/\{/);
  if (!m) return;
  const ind = m[1].length;
  if (ind === 4) { ultimaTop = m[2]; colecoes.push({ nome: m[2], sub: false, linha: i + 1 }); }
  else if (ind > 4 && ultimaTop) colecoes.push({ nome: `${ultimaTop}/…/${m[2]}`, sub: true, linha: i + 1 });
});
const tops = colecoes.filter((c) => !c.sub);

// ---------- índices ----------
const idx = JSON.parse(read('firestore.indexes.json')).indexes;
const idxPorCol = {};
idx.forEach((x) => {
  (idxPorCol[x.collectionGroup] ||= []).push(x.fields.map((f) => `${f.fieldPath}${f.order === 'DESCENDING' ? '↓' : f.arrayConfig ? '[]' : ''}`).join(', '));
});

// ---------- Cloud Functions ----------
const fsrc = read('functions/index.js');
const funcs = [];
const fre = /^exports\.(\w+)\s*=\s*(\w+)\(([\s\S]*?)(?=^exports\.|^\/\/ =====|$(?![\s\S]))/gm;
let fm;
while ((fm = fre.exec(fsrc))) {
  const [, nome, fn, corpo] = fm;
  let tipo; let detalhe = '';
  if (fn === 'onSchedule') { tipo = 'agendada'; detalhe = (corpo.match(/schedule:\s*'([^']+)'/) || [])[1] || ''; }
  else if (fn.startsWith('onDocument')) { tipo = 'gatilho Firestore'; detalhe = (corpo.match(/document:\s*'([^']+)'/) || [])[1] || ''; }
  else if (fn === 'onCall' || fn === 'marketCallable') { tipo = 'chamável (callable)'; }
  else tipo = fn;
  funcs.push(`| \`${nome}\` | ${tipo} | ${detalhe ? `\`${detalhe}\`` : ''} |`);
}

// ---------- flags ----------
const ff = read('src/core/featureFlags.js');
const bloco = (nome) => ff.match(new RegExp(`export const ${nome} = Object\\.freeze\\(\\{([\\s\\S]*?)\\n\\}\\);`));
const chaves = (b) => (b ? [...b[1].matchAll(/^\s{2}([A-Z0-9_]+):\s*'([^']+)'/gm)].map((x) => x[2]) : []);
const flags = chaves(bloco('FEATURE_FLAG'));
const permanentes = chaves(bloco('PERMANENT_FEATURE'));

// ---------- Storage ----------
const stor = read('storage.rules').split('\n').map((l) => l.match(/^\s+match (\/[^\s{]+(?:\/\{[^}]+\})*[^\s{]*)/)).filter(Boolean).map((m) => `\`${m[1]}\``);

// ---------- demais ----------
const pkg = JSON.parse(read('package.json'));
const fpkg = JSON.parse(read('functions/package.json'));
const scripts = Object.entries(pkg.scripts).map(([k, v]) => `| \`npm run ${k}\` | \`${v.length > 90 ? `${v.slice(0, 87)}…` : v}\` |`);
const workflows = ls('.github/workflows').map((w) => `- \`${w}\``);
const docsRaiz = ls('docs').filter((n) => n.endsWith('.md') || isDir(`docs/${n}`)).sort();

const nTestes = walk('.').filter((f) => /\.test\.(js|jsx)$/.test(f) && !f.startsWith('./node_modules')).length;
const nPaginas = ls('src/v2/pages').filter((n) => /^V2.*\.jsx$/.test(n) && !/\.test\./.test(n)).length;
const compV2 = ls('src/v2/components').filter((n) => isDir(`src/v2/components/${n}`));

// Quem depende de quem — a pergunta "o que pode quebrar se eu mudar este módulo?".
const grafo = grafoEstatico(ROOT);
const nCiclos = ciclos(grafo).length;
const deps = dependenciasEntreModulos(grafo, ROOT);
const usadoPor = {};
for (const [de, paras] of Object.entries(deps)) for (const para of paras) (usadoPor[para] ||= new Set()).add(de);
const lista = (s) => (s && s.size ? [...s].sort().map((m) => `\`${m}\``).join(', ') : '—');
const tabelaDeps = ls('src/modules').filter((m) => isDir(`src/modules/${m}`)).sort()
  .map((m) => `| \`${m}\` | ${usadoPor[m]?.size || 0} | ${lista(usadoPor[m])} | ${lista(deps[m])} |`);

const md = `# 46 — Inventário gerado do código

> ⚙️ **Arquivo GERADO. Não edite à mão.** Fonte: \`scripts/gen-inventario.mjs\`.
> Depois de mexer em rota, coleção, regra, índice, Cloud Function, flag ou
> módulo, rode \`npm run docs:inventario\` e comite o resultado. O CI (job de
> documentação) reprova o PR se este arquivo não bater com o código.
>
> Para o **porquê** e o **como** de cada parte, siga o mapa em
> [\`00-INDEX.md\`](./00-INDEX.md). Este arquivo responde só **"o que existe hoje"**.

## 1. Números

| Item | Valor |
|---|---|
| Módulos de domínio (\`src/modules/\`) | ${modulos.length} |
| Telas V2 (\`src/v2/pages/V2*.jsx\`) | ${nPaginas} |
| Pastas de componentes V2 (\`src/v2/components/\`) | ${compV2.length} |
| Coleções raiz no \`firestore.rules\` | ${tops.length} |
| Blocos \`match\` (raiz + subcoleções) | ${colecoes.length} |
| Índices compostos (\`firestore.indexes.json\`) | ${idx.length} |
| Cloud Functions exportadas | ${funcs.length} |
| Feature flags ligáveis (\`FEATURE_FLAG\`) | ${flags.length} |
| Funcionalidades permanentes (\`PERMANENT_FEATURE\`) | ${permanentes.length} |
| Caminhos de Storage com regra | ${stor.length} |
| Arquivos de teste (\`*.test.js(x)\`) | ${nTestes} |
| Workflows do GitHub Actions | ${ls('.github/workflows').length} |
| Documentos/pastas em \`docs/\` | ${docsRaiz.length} |

## 2. Stack (de \`package.json\`)

React ${pkg.dependencies.react} · Vite ${pkg.devDependencies.vite} · Tailwind ${pkg.devDependencies.tailwindcss} · Firebase JS ${pkg.dependencies.firebase} · React Query ${pkg.dependencies['@tanstack/react-query']} · Vitest ${pkg.devDependencies.vitest}.
Cloud Functions: Node ${fpkg.engines?.node}, \`firebase-admin\` ${fpkg.dependencies?.['firebase-admin']}, \`firebase-functions\` ${fpkg.dependencies?.['firebase-functions']}. Região \`southamerica-east1\`, banco Firestore nomeado \`pickleball\`.

## 3. Módulos de domínio

Colunas = arquivos de código (sem testes) por camada; \`·\` = a camada não existe no módulo.

| Módulo | domain | services | hooks | components | pages | i18n | README |
|---|---|---|---|---|---|---|---|
${modulos.join('\n')}

### 3.1 Dependências entre módulos

Lidas dos imports estáticos. **"Usado por"** é quem pode quebrar se você mudar
o módulo: rode os testes desses módulos também. Ciclos de import em \`src/\`:
**${nCiclos}** (o guarda \`src/core/guards/fronteirasDeModulos.test.js\` exige zero).

| Módulo | Nº de módulos que o usam | Usado por | Usa |
|---|---|---|---|
${tabelaDeps.join('\n')}

Pastas de componentes V2: ${compV2.map((c) => `\`${c}\``).join(', ')}.

## 4. Rotas

${rotas('src/App.jsx', 'Raiz (`src/App.jsx`) — públicas, telão, impressão e redirecionamentos')}

${rotas('src/v2/V2App.jsx', 'Aplicativo (`src/v2/V2App.jsx`) — dentro do `V2Layout`, exige login')}

## 5. Coleções Firestore (\`firestore.rules\`)

Cada coleção raiz tem um bloco \`match\`; a linha leva à regra exata. Campos e relações: [\`05-DATA-MODEL.md\`](./05-DATA-MODEL.md).

${tops.map((c) => `\`${c.nome}\``).join(' · ')}

**Subcoleções com regra própria (${colecoes.length - tops.length}):** ${colecoes.filter((c) => c.sub).map((c) => `\`${c.nome}\``).join(' · ')}

## 6. Índices compostos

${Object.entries(idxPorCol).sort(([a], [b]) => a.localeCompare(b)).map(([c, l]) => `- \`${c}\`: ${l.map((x) => `(${x})`).join(' · ')}`).join('\n')}

> Regra do projeto: consulta com \`where\` + \`orderBy\` precisa de índice EXATO; o guarda \`src/core/guards/indicesCompostos.test.js\` confere.

## 7. Cloud Functions (\`functions/index.js\`)

| Função | Tipo | Gatilho / agenda |
|---|---|---|
${funcs.join('\n')}

## 8. Feature flags

**Ligáveis pelo admin (\`FEATURE_FLAG\`, padrão desligado):** ${flags.map((f) => `\`${f}\``).join(', ')}.

**Incorporadas (\`PERMANENT_FEATURE\`, sempre ligadas, ${permanentes.length}):** ${permanentes.map((f) => `\`${f}\``).join(', ')}.

## 9. Storage (\`storage.rules\`)

${stor.join(' · ')}

## 10. Automação e comandos

Workflows:
${workflows.join('\n')}

| Comando | O que roda |
|---|---|
${scripts.join('\n')}

## 11. Documentos em \`docs/\`

${docsRaiz.map((d) => `\`${d}\``).join(' · ')}
`;

const atual = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
if (process.argv.includes('--check')) {
  if (atual !== md) {
    console.error('docs/46-INVENTARIO.md está desatualizado em relação ao código.\nRode: npm run docs:inventario  e comite o arquivo.');
    process.exit(1);
  }
  console.log('docs/46-INVENTARIO.md em dia.');
} else {
  writeFileSync(OUT, md);
  console.log(`Gerado: docs/46-INVENTARIO.md (${md.length} bytes)`);
}
