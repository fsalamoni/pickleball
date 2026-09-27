/**
 * O seletor de aparência, montado. O que protege:
 *
 *  1. ⭐ sem o escuro disponível (flag desligada), NADA aparece — nenhuma opção
 *     que não faz nada;
 *  2. a gaveta e Configurações são grupos de rádio de verdade: nome, estado
 *     marcado, só o escolhido no Tab, setas movem E escolhem;
 *  3. a miniatura de cada modo sai com o escopo certo (`.tema-claro` / `.dark`),
 *     e o automático tem as duas metades;
 *  4. no automático, a tela diz em que modo o aparelho está agora.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const tema = { disponivel: true, escolha: 'claro', efetivo: 'claro', setEscolha: vi.fn() };
vi.mock('@/core/lib/ThemeContext', () => ({ useTheme: () => tema }));

import { ThemeDrawerSwitcher, ThemeSettingsCard } from './ThemeSwitcher';

let container; let root;
beforeEach(() => {
  Object.assign(tema, { disponivel: true, escolha: 'claro', efetivo: 'claro', setEscolha: vi.fn() });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (el) => act(() => { root.render(el); });
const radios = () => [...container.querySelectorAll('[role="radio"]')];
const tecla = (el, key) => act(() => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
});

describe('⭐ só aparece quando o escuro está disponível', () => {
  it('flag desligada: gaveta e Configurações não mostram nada', () => {
    tema.disponivel = false;
    render(<><ThemeDrawerSwitcher /><ThemeSettingsCard /></>);
    expect(container.innerHTML).toBe('');
  });
});

describe('a gaveta do celular', () => {
  it('grupo de rádio com nome, três opções e a escolhida marcada', () => {
    tema.escolha = 'escuro';
    render(<ThemeDrawerSwitcher />);
    const grupo = container.querySelector('[role="radiogroup"]');
    const rotulo = document.getElementById(grupo.getAttribute('aria-labelledby'));
    expect(rotulo.textContent).toBe('Aparência');
    expect(radios().map((r) => r.textContent)).toEqual(['Claro', 'Escuro', 'Automático']);
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    // Só o escolhido entra no Tab.
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
  });

  it('tocar escolhe', () => {
    render(<ThemeDrawerSwitcher />);
    act(() => radios()[1].click());
    expect(tema.setEscolha).toHaveBeenCalledWith('escuro');
  });

  it('setas movem E escolhem, dando a volta; Home e End vão às pontas', () => {
    render(<ThemeDrawerSwitcher />);
    tecla(radios()[0], 'ArrowRight');
    expect(tema.setEscolha).toHaveBeenLastCalledWith('escuro');
    expect(document.activeElement).toBe(radios()[1]);
    tecla(radios()[0], 'ArrowLeft');
    expect(tema.setEscolha).toHaveBeenLastCalledWith('automatico');
    tecla(radios()[0], 'End');
    expect(tema.setEscolha).toHaveBeenLastCalledWith('automatico');
    tema.setEscolha.mockClear();
    tecla(radios()[0], 'Home');
    // Home cai no Claro, que já é o escolhido: foca, sem trocar à toa.
    expect(tema.setEscolha).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(radios()[0]);
  });
});

describe('Configurações', () => {
  it('três cartões com miniatura, cada uma no seu modo', () => {
    render(<ThemeSettingsCard />);
    expect(container.textContent).toContain('Aparência');
    const [claro, escuro, auto] = radios();
    expect(claro.querySelector('.tema-claro')).toBeTruthy();
    expect(claro.querySelector('.dark')).toBeNull();
    expect(escuro.querySelector('.dark')).toBeTruthy();
    expect(escuro.querySelector('.tema-claro')).toBeNull();
    // O automático é metade de cada.
    expect(auto.querySelector('.tema-claro')).toBeTruthy();
    expect(auto.querySelector('.dark')).toBeTruthy();
  });

  it('cada cartão tem descrição ligada a ele', () => {
    render(<ThemeSettingsCard />);
    radios().forEach((r) => {
      const d = document.getElementById(r.getAttribute('aria-describedby'));
      expect(d.textContent.length).toBeGreaterThan(10);
    });
  });

  it('no automático, diz em que modo o aparelho está agora', () => {
    Object.assign(tema, { escolha: 'automatico', efetivo: 'escuro' });
    render(<ThemeSettingsCard />);
    expect(container.textContent).toContain('Agora o aparelho está no escuro.');
    Object.assign(tema, { escolha: 'escuro', efetivo: 'escuro' });
    render(<ThemeSettingsCard />);
    expect(container.textContent).not.toContain('Agora o aparelho');
  });

  it('avisa que telão, totem e impressão continuam claros', () => {
    render(<ThemeSettingsCard />);
    expect(container.textContent).toMatch(/telão, o totem da arena e a impressão continuam claros/);
  });
});
