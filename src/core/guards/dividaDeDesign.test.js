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
  'text-[Npx]': 0,
  'emerald/orange/rose/sky': 0,
  'cartão à mão': 68,
  'campo cru': 0,
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
    // Tamanho arbitrário em px é dívida: a escala é text-2xs (11) · xs · sm · base…
    expect(conta(v2, /text-\[\d+px\]/g)).toBeLessThanOrEqual(TETOS['text-[Npx]']);
  });

  it('cores de estado só nas quatro famílias (green/amber/red/blue) em src/v2', () => {
    // emerald, orange, rose e sky eram sinônimos soltos das mesmas quatro
    // intenções; uma família por intenção é o que mantém o escuro e o contraste
    // conferidos num lugar só (palette.test.js).
    // Isenção única: a paleta de IDENTIDADE dos grupos do Play (oito cores
    // distintas para distinguir grupos, não estados) — mapear colapsaria
    // laranja em âmbar e esmeralda em verde, e dois grupos ficariam iguais.
    const semGrupos = v2.filter((p) => !p.endsWith('playGroups/playGroupTheme.js'));
    expect(conta(semGrupos, /-(?:emerald|orange|rose|sky)-\d{2,3}\b/g)).toBeLessThanOrEqual(TETOS['emerald/orange/rose/sky']);
  });

  it('cartão escrito à mão (rounded-3xl/4xl + border + bg-paper) fora de src/v2/ui', () => {
    // O cartão é V2Surface (variantes padrao/compacto/plano). Escrever as classes
    // à mão de novo é o que fez 393 cópias divergirem em raio, sombra e padding.
    const foraDaUi = v2.filter((p) => !p.includes(`${path.sep}ui${path.sep}`));
    expect(conta(foraDaUi, /rounded-(?:3xl|4xl) border border-gray-100 bg-paper/g)).toBeLessThanOrEqual(TETOS['cartão à mão']);
  });

  it('campo de formulário escrito à mão (input/select/textarea com a borda do V2Input) fora de src/v2/ui', () => {
    // O campo é V2Input/V2Select/V2Textarea: um foco, um disabled, um placeholder.
    const foraDaUi = v2.filter((p) => !p.includes(`${path.sep}ui${path.sep}`));
    expect(conta(foraDaUi, /<(?:input|select|textarea)\b[^>]*className="[^"]*rounded-(?:2xl|md) border border-(?:gray-200|input)/g)).toBeLessThanOrEqual(TETOS['campo cru']);
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
