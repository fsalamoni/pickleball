/**
 * O DIAGRAMA do mata-mata: classificados, vagas futuras com o título do
 * confronto, linhas ligando as rodadas e o campeão no fim.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { default: V2BracketTree } = await import('./V2BracketTree.jsx');

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const rotulos = new Map([['a', 'Ana'], ['b', 'Bia'], ['c', 'Caio'], ['d', 'Davi']]);
const semis = [
  { id: 's1', stage_type: 'knockout', round: 1, position: 1, side_a_ids: ['a'], side_b_ids: ['b'], status: 'finished', winner_side: 'a', games: [{ a: 11, b: 6 }] },
  { id: 's2', stage_type: 'knockout', round: 1, position: 2, side_a_ids: ['c'], side_b_ids: ['d'], status: 'scheduled' },
];

describe('V2BracketTree — o diagrama', () => {
  it('mostra os classificados, a final como vaga e o campeão a definir, ligados por linhas', () => {
    act(() => { root.render(<V2BracketTree matches={semis} labelById={rotulos} thirdPlace />); });
    const t = container.textContent;
    expect(t).toContain('Semifinal');
    expect(t).toContain('Ana');
    expect(t).toContain('Davi');
    expect(t).toContain('Vencedor do jogo 1');
    expect(t).toContain('Vencedor do jogo 2');
    expect(t).toContain('Perdedor do jogo 1');
    expect(t).toContain('Campeão');
    expect(t).toContain('Vencedor do jogo 3');
    // Duas linhas semifinal → final + final → campeão.
    expect(container.querySelectorAll('svg[data-linhas] path').length).toBe(3);
    // Sem tabela.
    expect(container.querySelector('table')).toBeNull();
  });

  it('o campeão aparece quando a final termina', () => {
    const final = { id: 'f', stage_type: 'knockout', round: 2, position: 1, side_a_ids: ['a'], side_b_ids: ['c'], status: 'finished', winner_side: 'b', games: [{ a: 8, b: 11 }] };
    act(() => { root.render(<V2BracketTree matches={[...semis, final]} labelById={rotulos} />); });
    const campeao = [...container.querySelectorAll('[title]')].map((e) => e.getAttribute('title'));
    expect(campeao).toContain('Caio');
    expect(container.textContent).not.toContain('Vencedor do jogo 3');
  });

  it('quem organiza toca no jogo; a vaga futura não é botão', () => {
    const onClick = vi.fn();
    act(() => { root.render(<V2BracketTree matches={semis} labelById={rotulos} onMatchClick={onClick} />); });
    const botoes = container.querySelectorAll('button');
    expect(botoes.length).toBe(2);
    act(() => { botoes[1].click(); });
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 's2', number: 2 }));
  });

  it('grupo não vira diagrama', () => {
    act(() => { root.render(<V2BracketTree matches={[{ id: 'g', round: 1, position: 1, stage_type: 'groups' }]} />); });
    expect(container.textContent).toBe('');
  });
});
