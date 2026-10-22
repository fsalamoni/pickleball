/**
 * Contas na Central: a cobrança paga entra sozinha na receita; o conselho
 * fiscal vê em leitura e só ele (ou o admin) dá o parecer; estornar pede o
 * motivo ANTES de chamar o servidor; fonte que falhou vira erro, nunca zero.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const accountsAction = vi.fn(async () => ({ ok: true }));
const q = (data) => ({ isSuccess: true, isLoading: false, isError: false, data, refetch: vi.fn() });
const fontes = {};
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' } }) }));
vi.mock('@/modules/federations/services/accountsService', () => ({
  accountsAction: (...a) => accountsAction(...a),
  uploadAccountFile: vi.fn(), discardAccountUpload: vi.fn(),
}));
vi.mock('@/modules/federations/hooks/useAccounts', () => ({
  useFederationBudgets: () => fontes.budgets,
  useFederationLedger: () => fontes.ledger,
}));
vi.mock('@/modules/federations/hooks/useFederations', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return {
    useFederationMutation: (fn) => useMutation({ mutationFn: fn }),
    useFederationCharges: () => fontes.charges,
    useVisibleAgenda: () => ({ ligado: false, items: [] }),
  };
});

const { default: FedAccountsPanel } = await import('./FedAccountsPanel');

const fed = { id: 'fpp', acronym: 'FPP', modules: { accounts: true } };
const ano = new Date().getFullYear();
let container, root;
beforeEach(() => {
  accountsAction.mockClear();
  fontes.budgets = q([]);
  fontes.ledger = q([{ id: 'l1', kind: 'expense', category: 'travel', date: `${ano}-01-10`, amount_cents: 12000, status: 'posted', description: 'Passagem do árbitro' }]);
  fontes.charges = q([{ id: 'c1', status: 'paid', origin: 'membership', amount_cents: 15000, paid_at: `${ano}-01-05` }]);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async ({ perms, tab, reports = [] }) => {
  await act(async () => {
    root.render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><FedAccountsPanel federation={fed} perms={perms} tab={tab} reportsQ={q(reports)} onIrParaAba={vi.fn()} /></QueryClientProvider></MemoryRouter>);
  });
};
const botao = (texto) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(texto) || b.getAttribute('aria-label') === texto);
const clicar = async (el) => { await act(async () => { el.click(); }); };
const valor = async (el, v) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })); });
};

describe('FedAccountsPanel', () => {
  it('visão geral: a cobrança paga entra na receita, sem lançar; o conselho fiscal vê em leitura', async () => {
    await montar({ perms: ['fiscal'], tab: 'orcamento' });
    expect(container.textContent).toContain('150,00');
    expect(container.textContent).toContain('120,00');
    expect(container.textContent).toContain('30,00');
    expect(container.textContent).toContain('em leitura');
    expect(botao('Abrir o orçamento')).toBeTruthy();
  });

  it('fonte que falhou vira erro com "Tentar de novo", nunca um zero', async () => {
    fontes.charges = { isSuccess: false, isLoading: false, isError: true, data: undefined, refetch: vi.fn() };
    await montar({ perms: ['finance'], tab: 'orcamento' });
    expect(container.textContent).toContain('As contas não carregaram');
    expect(container.textContent).not.toContain('120,00');
  });

  it('lançamentos: a cobrança paga aparece marcada e estornar pede o motivo antes do servidor', async () => {
    await montar({ perms: ['finance'], tab: 'lancamentos' });
    expect(container.textContent).toContain('Cobrança paga');
    expect(container.textContent).toContain('Passagem do árbitro');
    await clicar(botao('Estornar Passagem do árbitro'));
    const confirmar = [...document.body.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === 'Estornar');
    expect(confirmar.disabled).toBe(true);
    await valor(document.body.querySelector('#lc-motivo'), 'Lançado em duplicidade');
    await clicar(confirmar);
    expect(accountsAction).toHaveBeenCalledWith({ federationId: 'fpp', action: 'entry_void', entryId: 'l1', reason: 'Lançado em duplicidade' });
  });

  it('importar extrato: lê o OFX, o já lançado chega desmarcado, a categoria muda e vai só o marcado', async () => {
    fontes.ledger = q([{ id: 'l9', kind: 'income', category: 'other_income', date: `${ano}-01-02`, amount_cents: 100, status: 'posted', description: 'Antigo', source: 'bank', bank_ref: 'ofx:9:F1' }]);
    await montar({ perms: ['finance'], tab: 'lancamentos' });
    await clicar(botao('Importar extrato'));
    const ofx = `OFXHEADER:100\n<OFX><ACCTID>9\n<STMTTRN><DTPOSTED>${ano}0102<TRNAMT>1.00<FITID>F1<MEMO>Antigo</STMTTRN>\n<STMTTRN><DTPOSTED>${ano}0103<TRNAMT>-39.90<FITID>F2<MEMO>TARIFA BANCARIA</STMTTRN></OFX>`;
    const input = document.body.querySelector('#extrato-arquivo');
    const file = new File([ofx], 'extrato.ofx', { type: 'application/x-ofx' });
    if (!file.arrayBuffer) file.arrayBuffer = async () => new TextEncoder().encode(ofx).buffer;
    Object.defineProperty(input, 'files', { value: [file] });
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(document.body.textContent).toContain('2 movimentos lidos');
    expect(document.body.textContent).toContain('Já lançado');
    const sel = document.body.querySelector('select[aria-label="Categoria de TARIFA BANCARIA"]');
    await act(async () => { sel.value = 'admin'; sel.dispatchEvent(new Event('change', { bubbles: true })); });
    await clicar(botao('Importar 1 lançamento'));
    expect(accountsAction).toHaveBeenCalledWith({ federationId: 'fpp', action: 'entry_import', entries: [
      { kind: 'expense', category: 'admin', date: `${ano}-01-03`, amount_cents: 3990, description: 'TARIFA BANCARIA', counterparty: '', bank_ref: 'ofx:9:F2' },
    ] });
  });

  it('prestação enviada: o conselho fiscal dá o parecer; o financeiro só reabre', async () => {
    const rep = { id: `fpp_${ano - 1}`, period: String(ano - 1), status: 'submitted', snapshot: { income_total: 15000, expense_total: 12000, balance: 3000, income: {}, expense: {}, frozen_at_ms: 1 }, statements: [] };
    await montar({ perms: ['finance'], tab: 'prestacao-contas', reports: [rep] });
    expect(botao('Dar o parecer')).toBeFalsy();
    expect(botao('Reabrir')).toBeTruthy();
    await act(async () => root.unmount());
    root = createRoot(container);
    await montar({ perms: ['fiscal'], tab: 'prestacao-contas', reports: [rep] });
    expect(botao('Reabrir')).toBeFalsy();
    await clicar(botao('Dar o parecer'));
    const registrar = botao('Registrar o parecer');
    expect(registrar.disabled).toBe(true);
    await clicar(document.body.querySelector('input[type="radio"][value="approve_with_reservations"]'));
    await valor(document.body.querySelector('#pc-texto'), 'As contas conferem com os comprovantes, com ressalva nas diárias.');
    await clicar(botao('Registrar o parecer'));
    expect(accountsAction).toHaveBeenCalledWith({ federationId: 'fpp', action: 'opinion', reportId: rep.id, opinion: { verdict: 'approve_with_reservations', text: 'As contas conferem com os comprovantes, com ressalva nas diárias.' } });
  });
});
