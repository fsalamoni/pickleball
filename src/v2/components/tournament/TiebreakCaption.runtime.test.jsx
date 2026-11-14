/**
 * A linha de desempate embaixo da classificação (página pública e impressão)
 * diz a MESMA ordem que classificou a tabela: a do torneio; no torneio antigo,
 * a de cada fase; nas equipes, a do formato de equipes.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, afterEach } from 'vitest';
import TiebreakCaption, { tiebreakCaptionText } from './TiebreakCaption.jsx';

let raiz;
let el;
afterEach(() => { act(() => raiz?.unmount()); el?.remove(); });
function montar(props) {
  el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => raiz.render(<TiebreakCaption {...props} />));
  return el;
}

const grupos = (tiebreak_order = []) => ({ type: 'groups', tiebreak_order });

describe('TiebreakCaption', () => {
  it('torneio com a ordem nas regras gerais: uma linha, a ordem do torneio', () => {
    const tournament = { tiebreak_order: ['balance', 'wins'] };
    const modality = { stages: [grupos(['wins']), grupos()] };
    const c = montar({ tournament, modality, stageIndexes: [0, 1] });
    expect(c.querySelectorAll('p')).toHaveLength(1);
    expect(c.textContent).toBe('Critérios de desempate: Saldo de pontos → Mais vitórias.');
  });

  it('torneio antigo com ordens diferentes por fase: uma linha por fase', () => {
    const modality = { stages: [grupos(['balance', 'wins']), grupos(['wins', 'head_to_head'])] };
    const c = montar({ tournament: {}, modality, stageIndexes: [0, 1] });
    const itens = [...c.querySelectorAll('li')].map((li) => li.textContent);
    expect(itens).toEqual([
      'Fase 1 — Critérios de desempate: Saldo de pontos → Mais vitórias.',
      'Fase 2 — Critérios de desempate: Mais vitórias → Confronto direto.',
    ]);
  });

  it('modalidade de equipes: os critérios do formato de equipes', () => {
    expect(tiebreakCaptionText({ tiebreak_order: ['balance'] }, { team_config: {} }, 0))
      .toMatch(/vitórias de confronto/);
  });

  it('sem fase de tabela mostrada, nada', () => {
    const c = montar({ tournament: {}, modality: { stages: [] }, stageIndexes: [] });
    expect(c.textContent).toBe('');
  });
});
