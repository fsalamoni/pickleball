/**
 * O cartão Menu — o que protege:
 *  1. quem gere arena abre no padrão Arena, com a Central em 2º;
 *  2. ligar um item o põe antes da Minha área; o fixo não tem interruptor;
 *  3. trocar de padrão regrava a lista; restaurar volta ao padrão do papel;
 *  4. zero banco: tudo vai para o localStorage, por uid.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { uid: 'ana', arenas: [], coach: null, admin: false };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: estado.uid }, isPlatformAdmin: estado.admin }) }));
vi.mock('@/modules/arenas/hooks/useMyArenaSummary', () => ({ useMyArenaSummary: () => ({ arenas: estado.arenas }) }));
vi.mock('@/modules/coaches/hooks/useCoaches', () => ({ useCoach: () => ({ data: estado.coach }) }));

import SidebarSettingsCard from './SidebarSettingsCard';

let container; let root;
// O cartão nasce RECOLHIDO (2026-10-11), com o resumo no cabeçalho; os testes o abrem.
const montar = () => {
  act(() => { root.render(<SidebarSettingsCard />); });
  act(() => { container.querySelector('button[aria-expanded="false"]').click(); });
};
const ordem = () => [...container.querySelectorAll('ol [data-item-menu]')].map((li) => li.dataset.itemMenu);
const clicar = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

beforeEach(() => {
  window.localStorage.clear();
  Object.assign(estado, { uid: 'ana', arenas: [], coach: null, admin: false });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('SidebarSettingsCard', () => {
  it('⭐ recolhido, o cabeçalho diz quantos itens e o padrão; personalizado, diz isso', () => {
    act(() => { root.render(<SidebarSettingsCard />); });
    expect(ordem()).toEqual([]);
    expect(container.textContent).toContain('7 itens · padrão Atleta');
    act(() => { container.querySelector('button[aria-expanded="false"]').click(); });
    clicar(container.querySelector('ul [data-item-menu="parceiros"] [role="switch"]'));
    act(() => { container.querySelector('button[aria-expanded="true"]').click(); });
    expect(container.textContent).toContain('8 itens · personalizado');
  });

  it('atleta: padrão Atleta, Início primeiro e Minha área por último; os dois sem interruptor', () => {
    montar();
    expect(ordem()).toEqual(['inicio', 'jogar', 'competir', 'arenas', 'comunidade', 'ensino', 'perfil']);
    expect(container.querySelector('[data-item-menu="inicio"] [role="switch"]')).toBeNull();
    expect(container.querySelector('[data-item-menu="perfil"] [role="switch"]')).toBeNull();
    // Parceiros está para acrescentar; os padrões de arena/professor não aparecem.
    expect(container.querySelector('ul [data-item-menu="parceiros"]')).toBeTruthy();
    expect(botao('Arena')).toBeUndefined();
  });

  it('quem gere arena começa no padrão Arena, com a Central (nome da arena) em 2º', () => {
    estado.arenas = [{ id: 'a1', name: 'Arena Sul' }];
    montar();
    expect(ordem()[1]).toBe('minha-arena');
    expect(container.querySelector('[data-item-menu="minha-arena"]').textContent).toContain('Arena Sul');
    expect(botao('Arena').getAttribute('aria-pressed')).toBe('true');
  });

  it('ligar entra antes da Minha área; trocar de padrão e restaurar regravam', () => {
    estado.coach = { id: 'ana' };
    montar();
    expect(ordem()[1]).toBe('professor');
    clicar(container.querySelector('ul [data-item-menu="parceiros"] [role="switch"]'));
    const depois = ordem();
    expect(depois[depois.length - 1]).toBe('perfil');
    expect(depois[depois.length - 2]).toBe('parceiros');
    expect(JSON.parse(window.localStorage.getItem('v2:view:ana:menu:lateral')).items).toEqual(depois);

    clicar(botao('Atleta'));
    expect(ordem()).toEqual(['inicio', 'jogar', 'competir', 'arenas', 'comunidade', 'ensino', 'perfil']);
    clicar(container.querySelector('ul [data-item-menu="professor"] [role="switch"]'));
    expect(botao('Restaurar o padrão')).toBeTruthy();
    clicar(botao('Restaurar o padrão'));
    expect(ordem()[1]).toBe('professor');
    expect(window.localStorage.getItem('v2:view:ana:menu:lateral')).toBeNull();
  });
});
