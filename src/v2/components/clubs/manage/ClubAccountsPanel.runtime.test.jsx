/**
 * Contas do CLUBE na Central: a cobrança paga da associação entra sozinha na
 * receita; o conselho fiscal vê em leitura; fonte que falhou vira erro, nunca
 * zero; e toda escrita vai ao servidor do CLUBE (`clubAccounts`), com o clube
 * no pedido — nunca à função da federação.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const clubAccountsAction = vi.fn(async () => ({ ok: true }));
const federationAccountsAction = vi.fn(async () => ({ ok: true }));
const q = (data) => ({ isSuccess: true, isLoading: false, isError: false, data, refetch: vi.fn() });
const fontes = {};
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' } }) }));
vi.mock('@/modules/clubs/services/clubAccountsService', () => ({ clubAccountsAction: (...a) => clubAccountsAction(...a) }));
vi.mock('@/modules/federations/services/accountsService', () => ({
  accountsAction: (...a) => federationAccountsAction(...a),
  uploadAccountFile: vi.fn(), discardAccountUpload: vi.fn(),
}));
vi.mock('@/modules/clubs/hooks/useClubAccounts', () => ({
  useClubBudgets: () => fontes.budgets,
  useClubLedger: () => fontes.ledger,
  useClubAccountReports: () => fontes.reports,
}));
vi.mock('@/modules/clubs/hooks/useClubAssociation', () => ({
  useClubCharges: () => fontes.charges,
  assocKeys: { all: (id) => ['club-assoc', id] },
}));
vi.mock('@/modules/federations/hooks/useFederations', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return {
    useFederationMutation: (fn) => useMutation({ mutationFn: fn }),
    useVisibleAgenda: () => ({ ligado: false, items: [] }),
  };
});

const { default: ClubAccountsPanel } = await import('./ClubAccountsPanel');

const club = { id: 'c1', name: 'Clube do Vale' };
const ano = new Date().getFullYear();
let container, root;
beforeEach(() => {
  clubAccountsAction.mockClear();
  federationAccountsAction.mockClear();
  fontes.budgets = q([]);
  fontes.reports = q([]);
  fontes.ledger = q([{ id: 'l1', kind: 'expense', category: 'travel', date: `${ano}-01-10`, amount_cents: 12000, status: 'posted', description: 'Aluguel da quadra' }]);
  fontes.charges = q([{ id: 'k1', status: 'paid', origin: 'membership', amount_cents: 15000, paid_at: `${ano}-01-05` }]);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async ({ perms, tab }) => {
  await act(async () => {
    root.render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ClubAccountsPanel club={club} perms={perms} tab={tab} onIrParaAba={vi.fn()} /></QueryClientProvider></MemoryRouter>);
  });
};
const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(texto) || b.getAttribute('aria-label') === texto);
const clicar = async (el) => { await act(async () => { el.click(); }); };
const valor = async (el, v) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })); });
};

describe('ClubAccountsPanel', () => {
  it('a mensalidade paga entra na receita sem lançar; o conselho fiscal vê em leitura', async () => {
    await montar({ perms: ['fiscal'], tab: 'contas' });
    expect(container.textContent).toContain('150,00');
    expect(container.textContent).toContain('120,00');
    expect(container.textContent).toContain('em leitura');
  });

  it('fonte que falhou vira erro com "Tentar de novo", nunca um zero', async () => {
    fontes.ledger = { isSuccess: false, isLoading: false, isError: true, data: undefined, refetch: vi.fn() };
    await montar({ perms: ['finance'], tab: 'contas' });
    expect(container.textContent).toContain('As contas não carregaram');
    expect(container.textContent).not.toContain('150,00');
  });

  it('estornar pede o motivo e chama o servidor do CLUBE, com o clube no pedido', async () => {
    await montar({ perms: ['finance'], tab: 'lancamentos' });
    await clicar(botao('Estornar Aluguel da quadra'));
    const confirmar = [...document.body.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === 'Estornar');
    expect(confirmar.disabled).toBe(true);
    await valor(document.body.querySelector('#lc-motivo'), 'Lançado em duplicidade');
    await clicar(confirmar);
    expect(clubAccountsAction).toHaveBeenCalledWith({ clubId: 'c1', action: 'entry_void', entryId: 'l1', reason: 'Lançado em duplicidade' });
    expect(federationAccountsAction).not.toHaveBeenCalled();
  });
});
