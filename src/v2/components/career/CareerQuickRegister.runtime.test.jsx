/**
 * Registro rápido: é um formulário de verdade (o Enter e o "Ir" do teclado do
 * celular salvam), o campo que falta é dito NELE e a data tem limites.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import CareerQuickRegister from './CareerQuickRegister';

let raiz;
const montar = (props) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => { raiz.render(<CareerQuickRegister open onOpenChange={vi.fn()} events={[]} {...props} />); });
};
const digitar = (input, valor) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, valor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const enviar = () => act(async () => {
  document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; });

describe('CareerQuickRegister', () => {
  it('🔴 enviar o formulário (Enter) salva; depois de salvar o foco vai para "Pronto"', async () => {
    const save = vi.fn(async (input) => ({ saved: true, event: { ...input, id: 'ana_a', status: 'played' } }));
    montar({ save });
    digitar(document.getElementById('carreira-nome'), 'Open de Floripa');
    await enviar();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({ name: 'Open de Floripa', entries: [{ format: 'doubles' }] });
    expect(document.activeElement.textContent).toBe('Pronto');
  });

  it('sem nome: não salva e o erro fica ligado ao campo', async () => {
    const save = vi.fn();
    montar({ save });
    await enviar();
    expect(save).not.toHaveBeenCalled();
    const nome = document.getElementById('carreira-nome');
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(nome.getAttribute('aria-describedby')).textContent).toBe('Dê um nome ao torneio.');
  });

  it('a data tem limites (1990 … ano atual + 5) e a falha mostra a frase que veio', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Você tem 20 registros esperando conexão neste aparelho.'));
    montar({ save });
    const data = document.getElementById('carreira-data');
    expect(data.min).toBe('1990-01-01');
    expect(data.max).toBe(`${new Date().getFullYear() + 5}-12-31`);
    digitar(document.getElementById('carreira-nome'), 'Copa');
    await enviar();
    expect(document.querySelector('form [role="alert"]').textContent).toContain('20 registros esperando');
  });

  it('os grupos Formato e Categoria têm rótulo visível', () => {
    montar({ save: vi.fn() });
    const rotulos = [...document.querySelectorAll('form p')].map((p) => p.textContent);
    expect(rotulos).toEqual(expect.arrayContaining(['Formato', 'Categoria (opcional)', 'Medalha (opcional)']));
  });
});
