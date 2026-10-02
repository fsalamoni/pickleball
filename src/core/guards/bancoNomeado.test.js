/**
 * Guarda de fonte: o app só fala com o banco NOMEADO.
 *
 * `getFirestore()` sem o segundo argumento devolve o banco `(default)`, que
 * não é o do PickleRush (o app usa o `pickleball`, ver
 * `core/config/firebase.js`). Os services da gamificação V2 fizeram isso — e o
 * defeito era invisível: o emulador cria o `(default)` sozinho e os testes
 * mockam `getFirestore`. Em produção, ligar a flag mandaria toda leitura e
 * escrita para um banco que não é o do app.
 *
 * A regra: fora de `core/config/firebase.js`, ninguém chama `getFirestore(`.
 * Quem precisa do banco importa `db` de lá.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(process.cwd(), 'src');

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(js|jsx)$/.test(nome) && !/\.test\.(js|jsx)$/.test(nome) ? [caminho] : [];
  });
}

describe('banco nomeado', () => {
  it('nenhum arquivo do app chama getFirestore() fora da configuração', () => {
    const infratores = arquivos(RAIZ)
      .filter((arq) => !arq.endsWith(join('core', 'config', 'firebase.js')))
      .filter((arq) => {
        const codigo = readFileSync(arq, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        return /\bgetFirestore\s*\(/.test(codigo);
      })
      .map((arq) => relative(RAIZ, arq));
    expect(infratores).toEqual([]);
  });
});
