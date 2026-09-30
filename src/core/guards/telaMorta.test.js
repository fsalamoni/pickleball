/**
 * ⭐ Nenhum componente de tela fica órfão (varredura de 2026-09-30).
 *
 * Cópia morta de tela viva é armadilha de divergência: a pessoa corrige a
 * cópia errada, o teste do arquivo passa, e o aplicativo segue com o defeito.
 * Aconteceu com o `V2GameDayOrganizer` (Onda AS), o `TournamentDrawTab` (Onda
 * AU) e o `EventDatesPanel` (Onda AV) — e, na varredura de 2026-09-30, com
 * VINTE arquivos: a versão V1 do chat, do nivelamento e de seis peças da
 * arena, todas com equivalente V2 em uso, e todas ainda afirmando vazio numa
 * falha que nenhuma tela mostrava. Ninguém os veria corrigidos.
 *
 * O guarda segue os imports a partir de `src/main.jsx` (estáticos, dinâmicos
 * e `lazy`, com os aliases do Vite) e reprova qualquer `.jsx` do aplicativo
 * que não seja alcançado. Os primitivos do shadcn (`src/components/ui/`) ficam
 * de fora: são o kit, não telas.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

const RAIZ = process.cwd();
const EXTENSOES = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];

/** Resolve um import como o Vite resolveria (só o que é do projeto). */
function resolver(deArquivo, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(RAIZ, 'src', spec.slice(2));
  else if (spec.startsWith('@core/')) base = path.join(RAIZ, 'src/core', spec.slice(6));
  else if (spec.startsWith('@modules/')) base = path.join(RAIZ, 'src/modules', spec.slice(9));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(deArquivo), spec);
  else return null;
  for (const ext of EXTENSOES) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

const IMPORTS = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;

function alcancaveis(entrada) {
  const vistos = new Set();
  const pilha = [entrada];
  while (pilha.length) {
    const arquivo = pilha.pop();
    if (vistos.has(arquivo)) continue;
    vistos.add(arquivo);
    if (!/\.(jsx?|tsx?)$/.test(arquivo)) continue;
    const fonte = readFileSync(arquivo, 'utf8');
    for (const m of fonte.matchAll(IMPORTS)) {
      const destino = resolver(arquivo, m[1] || m[2] || m[3]);
      if (destino) pilha.push(destino);
    }
  }
  return vistos;
}

function componentes(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) componentes(p, saida);
    else if (nome.endsWith('.jsx') && !/\.test\.|\.runtime\./.test(nome)) saida.push(p);
  }
  return saida;
}

/**
 * Órfãos DE PROPÓSITO — cada um com o motivo. Acrescentar aqui é decisão de
 * projeto: o critério é o componente ser API documentada que alguém vai usar,
 * não "pode ser útil um dia".
 */
const ORFAOS_DE_PROPOSITO = new Map([
  ['src/v2/components/arenas/ArenaModuleGuard.jsx',
    'API documentada no CLAUDE.md para gatear uma tela por módulo de arena (<ArenaModuleGuard arenaId module>)'],
]);

const rel = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

describe('⭐ nenhum componente de tela fica órfão', () => {
  const vivos = alcancaveis(path.join(RAIZ, 'src/main.jsx'));
  const todos = componentes(path.join(RAIZ, 'src'))
    .filter((p) => !rel(p).startsWith('src/components/ui/'));

  it('o grafo de imports foi montado (senão este teste não prova nada)', () => {
    expect(vivos.size).toBeGreaterThan(600);
    expect(todos.length).toBeGreaterThan(300);
  });

  it('⭐ todo .jsx do aplicativo é alcançado a partir de src/main.jsx', () => {
    const orfaos = todos
      .filter((p) => !vivos.has(p))
      .map(rel)
      .filter((c) => !ORFAOS_DE_PROPOSITO.has(c));
    expect(
      orfaos,
      `componentes que nenhuma tela importa (cópia morta vira armadilha — apague ou use):\n  ${orfaos.join('\n  ')}`,
    ).toEqual([]);
  });

  it('toda exceção tem motivo e ainda é órfã de verdade', () => {
    for (const [caminho, motivo] of ORFAOS_DE_PROPOSITO) {
      expect(existsSync(path.join(RAIZ, caminho)), `exceção aponta para arquivo que não existe: ${caminho}`).toBe(true);
      expect(String(motivo).length).toBeGreaterThan(30);
      expect(vivos.has(path.join(RAIZ, caminho)), `exceção sobrando (o arquivo já é usado): ${caminho}`).toBe(false);
    }
  });

  it('o resolvedor entende os três aliases do Vite e o import dinâmico', () => {
    const aqui = path.join(RAIZ, 'src/main.jsx');
    expect(resolver(aqui, '@/v2/V2App')).toMatch(/src\/v2\/V2App\.jsx$/);
    expect(resolver(aqui, '@core/lib/utils')).toMatch(/src\/core\/lib\/utils\.js$/);
    expect(resolver(aqui, '@modules/help/domain/guias')).toMatch(/src\/modules\/help\/domain\/guias\.js$/);
    expect(resolver(aqui, 'react')).toBeNull();
    const dinamico = [...'const X = lazy(() => import(\'@/v2/pages/V2Help\'));'.matchAll(IMPORTS)];
    expect(dinamico).toHaveLength(1);
  });
});
