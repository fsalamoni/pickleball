/**
 * O placar por sets na GRADE (Americano e demais formatos de grade).
 *
 *  1. ⭐ um set: os dois campos de sempre, gravados ao sair do campo;
 *  2. ⭐ "Sets" abre o lançamento com dois sets e salva os campos do jogo
 *     (sets vencidos, sets, pontos);
 *  3. o jogo por sets mostra o resultado e os sets; voltar a um set limpa os
 *     campos de sets;
 *  4. quem não organiza não vê o botão "Sets".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import GridScoreCell from './GridScoreCell';

let container, root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const botao = (t) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(t));
const digitar = (input, valor) => act(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, valor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const jogo = {
  id: 'g1', side_a: [{ id: 'a', name: 'Ana' }], side_b: [{ id: 'b', name: 'Bia' }], score_a: null, score_b: null,
};
const montar = (props) => act(() => { root.render(<GridScoreCell {...props} />); });

describe('GridScoreCell', () => {
  it('um set: grava ao sair do campo', () => {
    const onSave = vi.fn();
    montar({ game: jogo, onSave });
    const [a, b] = container.querySelectorAll('input');
    digitar(a, '11'); digitar(b, '6');
    act(() => { b.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(onSave).toHaveBeenCalledWith({ score_a: 11, score_b: 6 });
  });

  it('"Sets" abre o lançamento por sets e salva sets, vencidos e pontos', () => {
    const onSave = vi.fn();
    montar({ game: { ...jogo, score_a: 11, score_b: 9 }, onSave });
    click(botao('Sets'));
    const campos = [...document.body.querySelectorAll('input')].filter((i) => i.getAttribute('aria-label')?.startsWith('Set '));
    expect(campos).toHaveLength(4);
    expect(campos[0].value).toBe('11');
    digitar(campos[2], '11'); digitar(campos[3], '5');
    click(botao('Salvar'));
    expect(onSave).toHaveBeenCalledWith({
      score_a: 2, score_b: 0, sets: [{ a: 11, b: 9 }, { a: 11, b: 5 }], points_a: 22, points_b: 14,
    });
  });

  it('jogo por sets mostra o resultado; voltar a um set limpa os sets', () => {
    const onSave = vi.fn();
    const porSets = { ...jogo, score_a: 2, score_b: 1, sets: [{ a: 11, b: 9 }, { a: 8, b: 11 }, { a: 11, b: 3 }], points_a: 30, points_b: 23 };
    montar({ game: porSets, onSave });
    expect(container.textContent).toContain('2 × 1');
    expect(container.textContent).toContain('11-9 · 8-11 · 11-3');
    click(container.querySelector('button'));
    click(document.body.querySelector('[aria-label="Remover o set 3"]'));
    click(document.body.querySelector('[aria-label="Remover o set 2"]'));
    click(botao('Salvar'));
    expect(onSave).toHaveBeenCalledWith({ score_a: 11, score_b: 9, sets: null, points_a: null, points_b: null });
  });

  it('sem permissão: campos travados e sem "Sets"', () => {
    montar({ game: jogo, onSave: vi.fn(), disabled: true });
    expect(botao('Sets')).toBeUndefined();
    expect([...container.querySelectorAll('input')].every((i) => i.disabled)).toBe(true);
  });
});
