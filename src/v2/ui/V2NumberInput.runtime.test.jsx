import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { V2Input } from './primitives';
import { V2NumberInput, stepNumber } from './V2NumberInput';
import { Input, NumberInput } from '@/components/ui/input';

// O defeito relatado: a tela converte no onChange (`Math.max(1, Number(v) || 1)`),
// apagar o último dígito devolvia o número na hora e o campo não esvaziava.
const clamp = (v) => Math.max(1, Math.min(12, Number(v) || 1));

let host; let root; let valorDaTela;
function Tela({ Campo, comBotoes = false }) {
  const [v, setV] = useState(4);
  valorDaTela = v;
  const props = { value: v, onChange: (e) => setV(clamp(e.target.value)), min: 1, max: 12 };
  if (comBotoes) return <V2NumberInput {...props} />;
  return <Campo type="number" {...props} />;
}

function digitar(el, texto) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  React.act(() => {
    setter.call(el, texto);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const campo = () => host.querySelector('input');

beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { React.act(() => root.unmount()); host.remove(); });

describe.each([['V2Input', V2Input], ['Input', Input], ['NumberInput', NumberInput]])('%s type="number"', (_n, Campo) => {
  it('apagar tudo deixa o campo vazio enquanto se edita, e dá para digitar outro número', () => {
    React.act(() => root.render(<Tela Campo={Campo} />));
    React.act(() => campo().focus());
    digitar(campo(), '');
    expect(campo().value).toBe('');
    expect(valorDaTela).toBe(1); // a tela segue com o valor dela
    digitar(campo(), '9');
    expect(campo().value).toBe('9');
    expect(valorDaTela).toBe(9);
  });

  it('ao sair do campo, vale o valor da tela (já no limite)', () => {
    React.act(() => root.render(<Tela Campo={Campo} />));
    React.act(() => campo().focus());
    digitar(campo(), '');
    React.act(() => campo().blur());
    expect(campo().value).toBe('1');
  });

  it('dá para chegar a 12 digitando 1 e depois 2, sem a tela atropelar no meio', () => {
    React.act(() => root.render(<Tela Campo={Campo} />));
    React.act(() => campo().focus());
    digitar(campo(), '');
    digitar(campo(), '1');
    digitar(campo(), '12');
    expect(campo().value).toBe('12');
    expect(valorDaTela).toBe(12);
  });
});

describe('V2NumberInput (− e +)', () => {
  const botao = (rotulo) => host.querySelector(`button[aria-label="${rotulo}"]`);

  it('os botões mudam o valor pelo mesmo onChange e param nos limites', () => {
    React.act(() => root.render(<Tela comBotoes />));
    React.act(() => botao('Aumentar').click());
    expect(valorDaTela).toBe(5);
    expect(campo().value).toBe('5');
    React.act(() => root.render(<Tela comBotoes />));
    for (let i = 0; i < 20; i += 1) React.act(() => botao('Diminuir').click());
    expect(valorDaTela).toBe(1);
    expect(botao('Diminuir').disabled).toBe(true);
    expect(botao('Aumentar').disabled).toBe(false);
  });

  it('botões não enviam formulário (type="button") e o campo pede o teclado de números', () => {
    React.act(() => root.render(<Tela comBotoes />));
    host.querySelectorAll('button').forEach((b) => expect(b.getAttribute('type')).toBe('button'));
    expect(campo().getAttribute('inputmode')).toBe('numeric');
  });

  it('com o campo em foco, tocar no + troca o rascunho pelo valor novo', () => {
    React.act(() => root.render(<Tela comBotoes />));
    React.act(() => campo().focus());
    digitar(campo(), '7');
    React.act(() => botao('Aumentar').click());
    expect(valorDaTela).toBe(8);
    expect(campo().value).toBe('8');
  });
});

describe('stepNumber', () => {
  it('soma e subtrai dentro dos limites', () => {
    expect(stepNumber(3, 1, { min: 1, max: 4 })).toBe(4);
    expect(stepNumber(4, 1, { min: 1, max: 4 })).toBe(4);
    expect(stepNumber(1, -1, { min: 1, max: 4 })).toBe(1);
    expect(stepNumber('10', 1, { step: 5, max: 180 })).toBe(15);
  });
  it('campo vazio vai para o mínimo (ou zero)', () => {
    expect(stepNumber('', 1, { min: 2 })).toBe(2);
    expect(stepNumber('', -1, { min: 2 })).toBe(2);
    expect(stepNumber(null, 1, {})).toBe(0);
  });
  it('decimais sem erro de arredondamento', () => {
    expect(stepNumber(0.2, 1, { step: 0.1 })).toBe(0.3);
  });
  it('valor acima do máximo volta ao máximo', () => {
    expect(stepNumber(50, -1, { min: 1, max: 12 })).toBe(12);
  });
});
