/**
 * Escolher pessoas na lista de usuários da plataforma: a lista aparece sem
 * digitar nada, perfil oculto não entra, quem não pode ser escolhido aparece
 * com o motivo e sem clique, e a busca estreita por nome ou cidade.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const atletas = vi.hoisted(() => ({ value: null }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAllAthletes: () => atletas.value }));
const { default: FedPersonPicker } = await import('./FedPersonPicker');

const ok = (data) => ({ isSuccess: true, isLoading: false, isError: false, data, refetch: vi.fn() });
const pessoas = [
  { id: 'u2', platform_name: 'Bruno Dias', city: 'Porto Alegre', state: 'RS' },
  { id: 'u1', platform_name: 'Ana Souza', city: 'Pelotas', state: 'RS' },
  { id: 'u3', platform_name: 'Carla Oculta', hidden: true },
];

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const botoes = () => [...container.querySelectorAll('ul[aria-label="Usuários da plataforma"] button')];

describe('FedPersonPicker', () => {
  it('lista já aberta, em ordem, sem oculto; excluído aparece com o motivo e desabilitado', async () => {
    atletas.value = ok(pessoas);
    const onChange = vi.fn();
    await act(async () => { root.render(<FedPersonPicker multiple selecionados={[]} onChange={onChange} excluir={new Map([['u2', 'Já filiado(a)']])} />); });
    const lista = botoes();
    expect(lista.map((b) => b.textContent)).toEqual([expect.stringContaining('Ana Souza'), expect.stringContaining('Bruno Dias')]);
    expect(container.textContent).not.toContain('Carla');
    expect(lista[1].disabled).toBe(true);
    expect(lista[1].textContent).toContain('Já filiado(a)');
    await act(async () => { lista[0].click(); });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'u1' })]);
  });

  it('a busca estreita por cidade', async () => {
    atletas.value = ok(pessoas);
    await act(async () => { root.render(<FedPersonPicker selecionados={[]} onChange={vi.fn()} />); });
    const input = container.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => { setter.call(input, 'pelotas'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(botoes().map((b) => b.textContent)).toEqual([expect.stringContaining('Ana Souza')]);
  });

  it('leitura que falhou vira aviso com Tentar de novo, não lista vazia', async () => {
    atletas.value = { isSuccess: false, isLoading: false, isError: true, data: undefined, refetch: vi.fn() };
    await act(async () => { root.render(<FedPersonPicker selecionados={[]} onChange={vi.fn()} />); });
    expect(container.textContent).toContain('Não carregou a lista de usuários');
  });
});
