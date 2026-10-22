/**
 * Secretaria → Transferências: o filtro mora na URL (`?filtro=pendentes`, que a
 * faixa "Precisa de você" manda), cada filtro mostra a contagem e "Liberar"
 * pergunta antes — liberar encerra a filiação e não tem volta.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mutate = vi.fn();
vi.mock('@/modules/federations/hooks/useFederations', () => ({ useFederationMutation: () => ({ mutate, isPending: false }) }));
vi.mock('@/modules/federations/services/federationService', () => ({}));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));

const { default: FedSecretariatPanel } = await import('./FedSecretariatPanel');

const ok = (data) => ({ isSuccess: true, isLoading: false, isError: false, data, refetch: vi.fn() });
const fed = { id: 'f1', name: 'Federação Teste', acronym: 'FT' };
const transfers = [
  { id: 't1', user_name: 'Ana', kind: 'federation', status: 'pending', requested_at: '2026-10-01' },
  { id: 't2', user_name: 'Bia', kind: 'club', status: 'approved', requested_at: '2026-09-01' },
];

let container, root;
beforeEach(() => { mutate.mockReset(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (url) => {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[url]}><FedSecretariatPanel federation={fed} tab="transferencias" transfersQ={ok(transfers)} incomingQ={ok([])} /></MemoryRouter>);
  });
};
const botao = (re) => [...document.body.querySelectorAll('button')].find((b) => re.test(b.textContent));

describe('FedSecretariatPanel · transferências', () => {
  it('abre no filtro da URL, com a contagem no rótulo', async () => {
    await montar('/?aba=transferencias&filtro=pendentes');
    expect(container.textContent).toContain('Aguardando (1)');
    expect(container.textContent).toContain('Todas (2)');
    expect(container.textContent).toContain('Ana');
    expect(container.textContent).not.toContain('Bia');
  });

  it('"Liberar" pergunta antes e só libera ao confirmar', async () => {
    await montar('/?aba=transferencias');
    await act(async () => { botao(/^Liberar$/).click(); });
    expect(mutate).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Liberar a transferência de Ana?');
    const confirmar = [...document.body.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent === 'Liberar');
    await act(async () => { confirmar.click(); });
    expect(mutate).toHaveBeenCalledWith({ action: 'approve', transferId: 't1' }, expect.any(Object));
  });
});
