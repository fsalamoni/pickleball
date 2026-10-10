/**
 * Guarda de fonte (plano de UX §5.6): o "voltar" de uma tela é `V2BackLink` /
 * `V2PageHeader` (`src/v2/ui/primitives.jsx`), não um `<ArrowLeft>` desenhado
 * à mão. Em 2026-10-10 havia 28 desenhos próprios em `src/v2`, com quatro
 * alturas e três tamanhos de ícone; a contagem só pode DESCER.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const RAIZ = path.resolve(__dirname, '../../..');
const TETO_ARROW_LEFT = 13;

function arquivos(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const p = path.join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, saida);
    else if (/\.jsx$/.test(nome) && !/\.test\.|\.runtime\./.test(nome) && !p.endsWith('primitives.jsx')) saida.push(p);
  }
  return saida;
}

describe('cabeçalho de página único', () => {
  it('⭐ <ArrowLeft> desenhado à mão em src/v2 só desce', () => {
    const n = arquivos(path.join(RAIZ, 'src/v2'))
      .reduce((s, p) => s + (readFileSync(p, 'utf8').match(/<ArrowLeft\b/g) || []).length, 0);
    expect(n).toBeLessThanOrEqual(TETO_ARROW_LEFT);
  });

  it('V2BackLink e V2PageHeader existem e o link tem alvo de toque de 44 px', () => {
    const prim = readFileSync(path.join(RAIZ, 'src/v2/ui/primitives.jsx'), 'utf8');
    expect(prim).toMatch(/export function V2BackLink\(/);
    expect(prim).toMatch(/export function V2PageHeader\(/);
    expect(prim).toMatch(/min-h-11/);
  });
});
