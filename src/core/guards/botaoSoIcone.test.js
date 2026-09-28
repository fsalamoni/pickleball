/**
 * ⭐ Botão só com ícone tem nome acessível — em TODA a V2 e módulos.
 *
 * Sem `aria-label`, o leitor de tela anuncia "botão" e mais nada: quem não
 * enxerga o ícone não tem como saber o que ele faz. A varredura inicial
 * achou um (o "adicionar admin" da gestão, em 2026); este guarda impede
 * o próximo em QUALQUER página (não só arena/coach).
 *
 * Cobertura expandida em 2026-09-28 (Batch 5 da auditoria): antes cobria
 * só arena|coach|openMatch|shop|members|classes|tournaments|marketing;
 * agora cobre TODA src/v2 e src/modules/<*>/components. Achados extras
 * do escopo novo foram corrigidos no mesmo commit:
 *   - src/v2/components/clubs/V2ForumThreadView.jsx (×2)
 *   - src/v2/pages/V2AdminPartners.jsx
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrer } from './afirmaVazio.js';

// Qualquer arquivo .jsx do escopo V2 OU dos componentes de módulo.
// A regex é por módulo (sem restrito a arena/coach): se aparecer um ícone-
// só botão sem nome em qualquer lugar, o guarda pega.
//
// Importante: a regex SÓ casa com "ícone como PRIMEIRO (e único) filho".
// `<Btn>Texto <Icon/></Btn>` é texto + ícone — tem nome pelo próprio texto.
// Para isso, depois do `>` aceitamos OU só whitespace OU `{}` imediatamente
// seguido de `<` (sem whitespace entre o `}` e o `<`).
const SO_ICONE_BOTAO = /<button\b([^>]*)>(?:\s*|\s*\{[^}]+\})<([A-Z]\w*)\b[^>]*\/>\s*<\/button>/gs;
const SO_ICONE_V2BUTTON = /<V2Button\b([^>]*)>(?:\s*|\s*\{[^}]+\})<([A-Z]\w*)\b[^>]*\/>\s*<\/V2Button>/gs;

const ALVO = [
  ...varrer('src/v2', (c) => c.endsWith('.jsx') && !/\.test\./.test(c)),
  ...varrer('src/modules', (c) => c.endsWith('.jsx') && !/\.test\./.test(c) && /\/components\//.test(c)),
];

function acharRuins(c) {
  const src = readFileSync(c, 'utf8');
  const ruins = [];
  for (const re of [SO_ICONE_BOTAO, SO_ICONE_V2BUTTON]) {
    re.lastIndex = 0;
    for (const m of src.matchAll(re)) {
      if (!/aria-label|title=/.test(m[1])) {
        ruins.push(`${c}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
  }
  return ruins;
}

describe('⭐ botão só com ícone tem nome acessível em toda a V2 e módulos', () => {
  it('cobre >= 200 arquivos da V2 + components de módulo', () => {
    expect(ALVO.length).toBeGreaterThan(200);
  });

  it('⭐ nenhum botão só-ícone sem aria-label', () => {
    const ruins = ALVO.flatMap(acharRuins);
    expect(ruins, `botão só com ícone, sem aria-label:\n  ${ruins.join('\n  ')}`).toEqual([]);
  });

  it('o detector reconhece o caso e deixa passar quem tem nome', () => {
    const acha = (s, re) => [...s.matchAll(re)].filter((m) => !/aria-label|title=/.test(m[1])).length;
    expect(acha('<V2Button onClick={f}><Plus className="h-4 w-4" /></V2Button>', SO_ICONE_V2BUTTON)).toBe(1);
    expect(acha('<V2Button aria-label="Adicionar" onClick={f}><Plus /></V2Button>', SO_ICONE_V2BUTTON)).toBe(0);
    expect(acha('<V2Button onClick={f}><Plus /> Adicionar</V2Button>', SO_ICONE_V2BUTTON)).toBe(0);
    expect(acha('<button onClick={f}><Trash2 /></button>', SO_ICONE_BOTAO)).toBe(1);
    expect(acha('<button aria-label="Excluir" onClick={f}><Trash2 /></button>', SO_ICONE_BOTAO)).toBe(0);
    // Botão com texto + ícone: passa (texto já é o nome).
    expect(acha('<button onClick={f}><Plus /> Adicionar</button>', SO_ICONE_BOTAO)).toBe(0);
  });
});
