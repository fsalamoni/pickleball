/**
 * O grafo de imports do aplicativo, lido do código-fonte. Uma fonte só para
 * os guardas (`telaMorta`, `fronteirasDeModulos`) e para o inventário gerado
 * (`scripts/gen-inventario.mjs`) — resolver de import escrito duas vezes
 * diverge um dia, e aí um guarda vê um grafo e o documento outro.
 *
 * Resolve como o Vite resolveria (aliases `@/`, `@core/`, `@modules/` e
 * caminhos relativos), só para arquivos do projeto.
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

const EXTENSOES = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];

/** Estáticos (`import … from`, `export … from`, `import '…'`) e dinâmicos (`import('…')`). */
export const IMPORTS = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
/** Só os estáticos: são eles que fecham ciclo na carga do módulo. */
const ESTATICOS = /^\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;

export function resolver(deArquivo, spec, raiz = process.cwd()) {
  let base;
  if (spec.startsWith('@/')) base = path.join(raiz, 'src', spec.slice(2));
  else if (spec.startsWith('@core/')) base = path.join(raiz, 'src/core', spec.slice(6));
  else if (spec.startsWith('@modules/')) base = path.join(raiz, 'src/modules', spec.slice(9));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(deArquivo), spec);
  else return null;
  for (const ext of EXTENSOES) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

/** Arquivos de código do aplicativo (sem testes). */
export function arquivosDoCodigo(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) arquivosDoCodigo(p, saida);
    else if (/\.(jsx?)$/.test(nome) && !/\.test\.|\.runtime\.|\.spec\./.test(nome)) saida.push(p);
  }
  return saida;
}

/** `{ arquivo: [arquivos que ele importa estaticamente] }` */
export function grafoEstatico(raiz = process.cwd()) {
  const grafo = {};
  for (const arq of arquivosDoCodigo(path.join(raiz, 'src'))) {
    const fonte = readFileSync(arq, 'utf8');
    grafo[arq] = [...fonte.matchAll(ESTATICOS)]
      .map((m) => resolver(arq, m[1] || m[2], raiz))
      .filter(Boolean);
  }
  return grafo;
}

/** Grupos de arquivos que se importam em círculo (Tarjan, sem recursão). */
export function ciclos(grafo) {
  let i = 0;
  const idx = new Map(); const low = new Map(); const naPilha = new Set();
  const pilha = []; const grupos = [];
  for (const raizNo of Object.keys(grafo)) {
    if (idx.has(raizNo)) continue;
    const trabalho = [[raizNo, 0]];
    while (trabalho.length) {
      const topo = trabalho[trabalho.length - 1];
      const [v, k] = topo;
      if (k === 0) { idx.set(v, i); low.set(v, i); i += 1; pilha.push(v); naPilha.add(v); }
      const viz = grafo[v] || [];
      if (k < viz.length) {
        topo[1] += 1;
        const w = viz[k];
        if (!idx.has(w)) trabalho.push([w, 0]);
        else if (naPilha.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
        continue;
      }
      trabalho.pop();
      if (trabalho.length) { const pai = trabalho[trabalho.length - 1][0]; low.set(pai, Math.min(low.get(pai), low.get(v))); }
      if (low.get(v) === idx.get(v)) {
        const grupo = [];
        let w;
        do { w = pilha.pop(); naPilha.delete(w); grupo.push(w); } while (w !== v);
        if (grupo.length > 1) grupos.push(grupo);
      }
    }
  }
  return grupos;
}

/** `{ modulo: Set(módulos de que ele depende) }`, a partir do grafo estático. */
export function dependenciasEntreModulos(grafo, raiz = process.cwd()) {
  const modDe = (p) => {
    const r = path.relative(path.join(raiz, 'src/modules'), p).split(path.sep);
    return r[0] && r[0] !== '..' && r.length > 1 ? r[0] : null;
  };
  const deps = {};
  for (const [arq, destinos] of Object.entries(grafo)) {
    const de = modDe(arq);
    if (!de) continue;
    deps[de] ||= new Set();
    for (const d of destinos) {
      const para = modDe(d);
      if (para && para !== de) deps[de].add(para);
    }
  }
  return deps;
}
