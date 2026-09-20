/**
 * A CHAVE INCOMPLETA NA TELA.
 *
 * O motor já garante que o bye vai para os cabeças e que nenhuma partida nasce
 * vazia (`draw.test.js`). Aqui prendemos o terceiro pedaço: que a TELA diz o
 * que aconteceu. Um lado vazio mostrado como "A definir" faz parecer que falta
 * sortear um adversário que nunca vai existir — e quem organiza vai procurar
 * um botão que não existe.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { default: V2BracketTree } = await import('./V2BracketTree.jsx');
const { default: StageExplanation } = await import('@/modules/tournament/components/StageExplanation.jsx');

let container;
let root;

function render(ui) {
  act(() => { root.render(ui); });
  return container.textContent;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const rotulos = new Map([['r1', 'Ana'], ['r2', 'Bruno'], ['r3', 'Carla']]);

describe('⭐ o bye aparece como bye, não como "A definir"', () => {
  it('⭐ lado vazio de uma partida com W.O. diz que a pessoa passou direto', () => {
    const texto = render(
      <V2BracketTree
        matches={[
          {
            id: 'm1', round: 1, position: 1, stage_type: 'single_elimination',
            side_a_ids: ['r1'], side_b_ids: [], status: 'walkover', bye: true,
          },
          {
            id: 'm2', round: 1, position: 2, stage_type: 'single_elimination',
            side_a_ids: ['r2'], side_b_ids: ['r3'], status: 'scheduled',
          },
        ]}
        labelById={rotulos}
      />,
    );
    expect(texto).toContain('Ana');
    expect(texto).toContain('Passa direto (bye)');
  });

  it('⭐ lado vazio SEM bye continua sendo "A definir" (rodada que ainda não veio)', () => {
    const texto = render(
      <V2BracketTree
        matches={[{
          id: 'm1', round: 2, position: 1, stage_type: 'single_elimination',
          side_a_ids: ['r1'], side_b_ids: [], status: 'scheduled',
        }]}
        labelById={rotulos}
      />,
    );
    expect(texto).toContain('A definir');
    expect(texto).not.toContain('Passa direto');
  });
});

describe('⭐ o plano da fase de grupos na tela', () => {
  const plano = (props) => render(
    <StageExplanation stageType="groups" qualifiersPerGroup={2} {...props} />,
  );

  it('⭐ com 19 inscritos em 4 grupos, mostra os tamanhos reais e o que eles dão', () => {
    const texto = plano({ playerCount: 19, groupCount: 4 });
    expect(texto).toContain('grupos de 5, 5, 5 e 4');
    expect(texto).toContain('8 classificados');
  });

  it('⭐ grupo desigual NÃO manda mudar o número de inscritos — explica a regra', () => {
    // 🐞 A versão anterior dizia "para grupos do mesmo tamanho use um número
    // de inscritos múltiplo de 4", que é pedir para alguém desistir.
    const texto = plano({ playerCount: 19, groupCount: 4 });
    expect(texto).not.toMatch(/múltiplo de/i);
    expect(texto).toContain('APROVEITAMENTO');
  });

  it('⭐ oferece as outras divisões possíveis para aquele número', () => {
    const texto = plano({ playerCount: 19, groupCount: 5 });
    expect(texto).toContain('Outras divisões possíveis');
    expect(texto).toContain('4 grupos');
  });

  it('⭐ avisa quando os classificados não fecham a chave', () => {
    const texto = plano({ playerCount: 19, groupCount: 5 });
    expect(texto).toContain('10 classificados');
    expect(texto).toMatch(/Repescar 6/);
  });

  it('⭐ grupo de 2 é erro, com o caminho para sair dele', () => {
    const texto = plano({ playerCount: 7, groupCount: 3 });
    expect(texto).toContain('Grupo de 2 não é grupo');
  });

  it('as alternativas podem ser desligadas (tela do atleta)', () => {
    const texto = plano({ playerCount: 19, groupCount: 5, showAlternatives: false });
    expect(texto).not.toContain('Outras divisões possíveis');
  });

  it('em formato que não é de grupos, nenhuma alternativa aparece', () => {
    const texto = render(<StageExplanation stageType="knockout" playerCount={9} />);
    expect(texto).not.toContain('Outras divisões possíveis');
    expect(texto).toContain('bye');
  });
});
