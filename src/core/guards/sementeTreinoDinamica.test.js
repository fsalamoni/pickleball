/**
 * O catálogo-semente do treino (`src/modules/training/content/`) é grande e
 * só serve ao admin que publica a biblioteca. Ele NÃO pode entrar no pacote
 * comum: só o `seedService.js` o importa, e só por `import()` dinâmico.
 *
 * Um `import … from '…/content/seed'` estático numa tela comum colocaria
 * dezenas de itens no código que todo mundo baixa — sem erro nenhum, só a
 * plataforma mais lenta.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PASTA_DO_CATALOGO = 'src/modules/training/content';
const UNICO_IMPORTADOR = 'src/modules/training/services/seedService.js';

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) return nome === 'node_modules' ? [] : arquivos(p);
    return /\.(jsx?|mjs)$/.test(nome) ? [p] : [];
  });
}

const semComentarios = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// Qualquer menção ao catálogo num especificador de módulo (estático, dinâmico ou reexportação).
const MENCAO = /(?:from\s*|import\s*\(\s*|import\s+)['"]([^'"]*training\/content[^'"]*|\.{1,2}\/(?:\.\.\/)*content(?:\/[^'"]*)?)['"]/g;

describe('o catálogo-semente do treino fica fora do pacote comum', () => {
  const fora = arquivos('src').filter((p) => !p.startsWith(PASTA_DO_CATALOGO) && !/\.test\.jsx?$/.test(p));

  it('⭐ ninguém além do seedService importa o catálogo', () => {
    const culpados = fora.filter((p) => {
      if (p === UNICO_IMPORTADOR) return false;
      const fonte = semComentarios(readFileSync(p, 'utf8'));
      return [...fonte.matchAll(MENCAO)].some(([, alvo]) => {
        // `./content` relativo só conta dentro do módulo de treino.
        if (!alvo.includes('training/content') && !p.startsWith('src/modules/training/')) return false;
        return true;
      });
    });
    expect(culpados).toEqual([]);
  });

  it('⭐ o seedService o importa só por import() dinâmico', () => {
    const fonte = semComentarios(readFileSync(UNICO_IMPORTADOR, 'utf8'));
    expect(fonte).toMatch(/import\(\s*['"]\.\.\/content\/seed(\.js)?['"]\s*\)/);
    expect(fonte).not.toMatch(/(?:from|^import)\s+['"]\.\.\/content/m);
  });
});
