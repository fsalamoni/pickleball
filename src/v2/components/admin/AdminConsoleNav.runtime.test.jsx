/**
 * A barra do Painel admin: uma linha por seção, só a ativa abre as abas, e o
 * selo de pendências ("Precisa de você") soma as abas da seção.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AdminConsoleNav from './AdminConsoleNav';

const S = [
  { id: 'today', label: 'Hoje', tabs: [{ id: 'overview', label: 'Resumo' }] },
  { id: 'people', label: 'Pessoas', tabs: [{ id: 'records', label: 'Cadastros' }, { id: 'access', label: 'Acessos' }] },
  { id: 'training', label: 'Treino', tabs: [{ id: 'treino-revisao', label: 'Revisão' }, { id: 'treino-config', label: 'Configurações' }] },
];

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const montar = async (props) => {
  await act(async () => { root.render(<AdminConsoleNav sections={S} onTab={() => {}} {...props} />); });
};
// A lateral (computador); o celular repete a lista dentro de um <details>.
const botoes = () => [...container.querySelector('aside').querySelectorAll('button')];
const botao = (re) => botoes().find((b) => re.test(b.textContent));

describe('AdminConsoleNav', () => {
  it('só a seção ativa mostra as abas; as outras ficam numa linha', async () => {
    await montar({ tab: 'records' });
    expect(botao(/Acessos/)).toBeTruthy();
    expect(botao(/Revisão/)).toBeFalsy();
    expect(botao(/Treino/)).toBeTruthy();
  });

  it('tocar numa seção fechada abre a primeira aba; na ativa não faz nada', async () => {
    const onTab = vi.fn();
    await montar({ tab: 'records', onTab });
    await act(async () => { botao(/Treino/).click(); });
    expect(onTab).toHaveBeenCalledWith('treino-revisao');
    onTab.mockClear();
    await act(async () => { botao(/Pessoas/).click(); });
    expect(onTab).not.toHaveBeenCalled();
  });

  it('o selo soma as abas da seção e leitor de tela ouve a contagem', async () => {
    await montar({ tab: 'overview', badges: { 'treino-revisao': 2, 'treino-config': 1 } });
    expect(botao(/Treino/).textContent).toContain('3 pendentes');
  });
});
