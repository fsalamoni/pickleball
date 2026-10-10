import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Dívida de design medida em 2026-10-10 (plano de UX/UI, Fase 0). Cada número
 * é um TETO: só pode descer. Quem precisar subir um deles está reintroduzindo
 * o defeito que a onda inteira veio tirar — e o teste diz qual.
 *
 *  - texto cinza-400 em fundo claro: contraste 2,5:1, reprova no AA (4,5:1)
 *  - texto de 10 px: ilegível no celular; o piso da plataforma é 11 px
 *  - <button> sem type: dentro de um <form> ele ENVIA o formulário ao clicar
 *  - PERMANENT_FEATURE.*: ramo "desligado" morto desde que as flags viraram código
 */
const RAIZ = path.resolve(__dirname, '../../..');
const TETOS = {
  'text-gray-400': 293,
  'text-[10px]': 0,
  '<button> sem type': 250,
  'PERMANENT_FEATURE.': 116,
};

function arquivos(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, saida);
    else if (/\.(jsx?|js)$/.test(nome) && !/\.test\.|\.runtime\./.test(nome)) saida.push(p);
  }
  return saida;
}

const conta = (arqs, re) => arqs.reduce((n, p) => n + (readFileSync(p, 'utf8').match(re) || []).length, 0);

describe('⭐ a dívida de design só desce', () => {
  const v2 = arquivos(path.join(RAIZ, 'src/v2'));
  const src = arquivos(path.join(RAIZ, 'src'))
    .filter((p) => !/featureFlags\.js$|featureFlagGroups\.js$/.test(p));

  it('texto cinza-400 (contraste insuficiente) em src/v2', () => {
    expect(conta(v2, /text-gray-400/g)).toBeLessThanOrEqual(TETOS['text-gray-400']);
  });

  it('texto de 10 px em src/v2 (o piso é 11 px)', () => {
    expect(conta(v2, /text-\[10px\]/g)).toBeLessThanOrEqual(TETOS['text-[10px]']);
  });

  it('<button> sem type em src/v2', () => {
    const semType = v2.reduce((n, p) => {
      const linhas = readFileSync(p, 'utf8').split('\n');
      return n + linhas.filter((l) => /<button\b/.test(l) && !/type=/.test(l)).length;
    }, 0);
    expect(semType).toBeLessThanOrEqual(TETOS['<button> sem type']);
  });

  it('leituras de PERMANENT_FEATURE fora do catálogo (ramo morto a apagar)', () => {
    expect(conta(src, /PERMANENT_FEATURE\./g)).toBeLessThanOrEqual(TETOS['PERMANENT_FEATURE.']);
  });
});
