/**
 * ⭐ Botão só com ícone tem nome acessível — na arena e no professor.
 *
 * Sem `aria-label`, o leitor de tela anuncia "botão" e mais nada: quem não
 * enxerga o ícone não tem como saber o que ele faz. A varredura das telas da
 * arena achou um (o "adicionar admin" da gestão); este guarda impede o próximo.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrer } from './afirmaVazio.js';

const ESCOPO = /(arena|coach|openMatch|shop|members|classes|tournaments|marketing)/i;
const SO_ICONE = /<(button|V2Button)\b([^>]*)>\s*(\{[^}]*\}\s*)?<([A-Z]\w*)\b[^>]*\/>\s*<\/(button|V2Button)>/gs;

describe('⭐ botão só com ícone tem nome acessível', () => {
  it('⭐ nenhum botão só-ícone sem aria-label nas telas da arena e do professor', () => {
    const arquivos = [...new Set([
      ...varrer('src/v2', (c) => c.endsWith('.jsx') && !/\.test\./.test(c) && ESCOPO.test(c)),
      ...varrer('src/modules/arenas/components', (c) => c.endsWith('.jsx') && !/\.test\./.test(c)),
      ...varrer('src/modules/coaches/components', (c) => c.endsWith('.jsx') && !/\.test\./.test(c)),
    ])];
    expect(arquivos.length).toBeGreaterThan(80);
    const ruins = [];
    for (const c of arquivos) {
      const src = readFileSync(c, 'utf8');
      for (const m of src.matchAll(SO_ICONE)) {
        if (!/aria-label|title=/.test(m[2])) ruins.push(`${c}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(ruins, `botão só com ícone, sem aria-label:\n  ${ruins.join('\n  ')}`).toEqual([]);
  });

  it('o detector reconhece o caso e deixa passar quem tem nome', () => {
    const acha = (s) => [...s.matchAll(SO_ICONE)].filter((m) => !/aria-label|title=/.test(m[2])).length;
    expect(acha('<V2Button onClick={f}><Plus className="h-4 w-4" /></V2Button>')).toBe(1);
    expect(acha('<V2Button aria-label="Adicionar" onClick={f}><Plus /></V2Button>')).toBe(0);
    expect(acha('<V2Button onClick={f}><Plus /> Adicionar</V2Button>')).toBe(0);
  });
});
