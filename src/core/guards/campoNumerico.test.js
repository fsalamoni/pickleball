/**
 * 🐞 NO CELULAR NÃO DAVA PARA APAGAR O NÚMERO E DIGITAR OUTRO.
 *
 * Muita tela converte no `onChange` (`Number(v) || 1`, `Math.max(1, …)`,
 * `normalizePlayCourts`): apagar o último dígito devolvia o número na hora, e
 * só selecionar tudo e digitar por cima funcionava. A correção mora num lugar
 * só, `useNumberDraft` (o campo mostra o que a pessoa digita enquanto edita),
 * e chega a toda tela por `V2Input`, `Input` e `NumberInput`.
 *
 * Um `<input type="number">` nativo escrito numa tela fica de fora dela — e
 * volta o defeito sem nada avisar. Este guarda reprova.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(__dirname, '../..');
const PERMITIDO = new Set(['components/ui/input.jsx']);

function listar(dir, saida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, saida);
    else if (/\.jsx$/.test(e.name) && !/\.test\./.test(e.name)) saida.push(p);
  }
  return saida;
}

describe('⭐ campo numérico deixa apagar e redigitar', () => {
  it('nenhuma tela escreve <input type="number"> nativo (use V2Input, Input, NumberInput ou V2NumberInput)', () => {
    const achados = [];
    for (const arq of listar(RAIZ)) {
      const rel = path.relative(RAIZ, arq).split(path.sep).join('/');
      if (PERMITIDO.has(rel)) continue;
      const src = fs.readFileSync(arq, 'utf8');
      const re = /type=(?:"number"|'number'|\{['"]number['"]\})/g;
      let m;
      while ((m = re.exec(src))) {
        const ini = src.lastIndexOf('<', m.index);
        if (/^<input[\s/>]/.test(src.slice(ini, ini + 7))) achados.push(`${rel}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it('V2Input e Input passam pelo useNumberDraft', () => {
    expect(fs.readFileSync(path.join(RAIZ, 'v2/ui/primitives.jsx'), 'utf8')).toMatch(/useNumberDraft\(props\.type === 'number'/);
    expect(fs.readFileSync(path.join(RAIZ, 'components/ui/input.jsx'), 'utf8')).toMatch(/useNumberDraft\(type === 'number'/);
  });
});
