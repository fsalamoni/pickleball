/**
 * O cartão colapsável de Configurações — o que protege:
 *  1. nasce recolhido, com o resumo ("como está") no cabeçalho; abrir esconde o resumo;
 *  2. ⭐ o link direto (`#id`) abre o cartão por cima da preferência — e não grava nada;
 *  3. a preferência de aberto/recolhido é por pessoa (`v2:collapse:<uid>:config:<id>`);
 *  4. `id` e `data-dica` ficam no cartão, montado recolhido ou aberto.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'ana' } }) }));

import SettingsSection, { SettingsGroup } from './SettingsSection';

let container; let root;
beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const montar = (el, em = '/configuracoes') => act(() => {
  root.render(<MemoryRouter initialEntries={[em]}>{el}</MemoryRouter>);
});
const cabecalho = () => container.querySelector('button[aria-expanded]');
const clicar = (el) => act(() => { el.click(); });
const CARTAO = (
  <SettingsSection id="aparencia" dica="config-aparencia" title="Aparência" summary="Automático">
    <p>corpo do cartão</p>
  </SettingsSection>
);

describe('SettingsSection', () => {
  it('nasce recolhido com o resumo; abrir mostra o corpo e esconde o resumo', () => {
    montar(CARTAO);
    expect(cabecalho().getAttribute('aria-expanded')).toBe('false');
    expect(container.textContent).toContain('Automático');
    expect(container.textContent).not.toContain('corpo do cartão');
    clicar(cabecalho());
    expect(container.textContent).toContain('corpo do cartão');
    expect(container.textContent).not.toContain('Automático');
    expect(window.localStorage.getItem('v2:collapse:ana:config:aparencia')).toBe('0');
  });

  it('⭐ o link direto abre o cartão, mesmo com a preferência "recolhido" guardada — e não grava', () => {
    window.localStorage.setItem('v2:collapse:ana:config:aparencia', '1');
    montar(CARTAO, '/configuracoes#aparencia');
    expect(cabecalho().getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('corpo do cartão');
    expect(window.localStorage.getItem('v2:collapse:ana:config:aparencia')).toBe('1');
  });

  it('outra âncora não abre este cartão', () => {
    montar(CARTAO, '/configuracoes#notificacoes');
    expect(cabecalho().getAttribute('aria-expanded')).toBe('false');
  });

  it('id e data-dica ficam no cartão, recolhido ou aberto', () => {
    montar(CARTAO);
    const el = container.querySelector('#aparencia');
    expect(el.getAttribute('data-dica')).toBe('config-aparencia');
    clicar(cabecalho());
    expect(container.querySelector('#aparencia[data-dica="config-aparencia"]')).toBe(el);
  });

  it('fora de um Router, a âncora vem do endereço do navegador', () => {
    window.location.hash = '#aparencia';
    act(() => { root.render(CARTAO); });
    expect(cabecalho().getAttribute('aria-expanded')).toBe('true');
  });

  it('o grupo tem nome e descrição', () => {
    montar(<SettingsGroup title="Tela e navegação" description="Como aparece.">{CARTAO}</SettingsGroup>);
    const grupo = container.querySelector('section[aria-label="Tela e navegação"]');
    expect(grupo.querySelector('h2').textContent).toBe('Tela e navegação');
    expect(grupo.textContent).toContain('Como aparece.');
  });
});
