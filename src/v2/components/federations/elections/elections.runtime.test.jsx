/**
 * Eleições na tela: o assistente cria o rascunho e só publica depois da
 * confirmação; a prévia do colégio mostra o alerta de 1/3; a votação vai
 * cargo a cargo, revisa, confirma e mostra o comprovante — e manda ao
 * servidor só as escolhas e o registro do eleitor, nada mais.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const electionAction = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({ toast }));
vi.mock('@/modules/federations/hooks/useElections', async () => {
  const { useMutation } = await import('@tanstack/react-query');
  return {
    useElectionAction: () => useMutation({ mutationFn: (p) => electionAction(p) }),
    useElectionCandidacies: () => ({
      isLoading: false, isError: false,
      data: [
        { id: 'ch1', position_id: 'c1', status: 'accepted', name: 'Chapa Renovação', members: [{ name: 'Ana' }, { name: 'Bia' }] },
        { id: 'ch2', position_id: 'c1', status: 'accepted', name: 'Chapa Unidade', members: [{ name: 'Caio' }, { name: 'Davi' }] },
      ],
    }),
  };
});
vi.mock('../manage/FedPersonPicker', () => ({ default: () => null }));
vi.mock('../manage/naoSalvo', () => ({ useAvisoNaoSalvo: () => {} }));
vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm, confirmLabel, children, confirmDisabled }) => (open ? (
    <div role="alertdialog">{children}<button type="button" disabled={confirmDisabled} onClick={onConfirm}>{`ok:${confirmLabel}`}</button></div>
  ) : null),
}));

const { default: FedElectionWizard } = await import('./FedElectionWizard');
const { default: VoteFlow } = await import('./VoteFlow');

const fed = { id: 'fpp', slug: 'fpp', name: 'Federação Paulista', acronym: 'FPP', modules: { elections: true } };

let container, root;
beforeEach(() => {
  electionAction.mockReset(); toast.error.mockClear(); toast.success.mockClear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (el) => { await act(async () => { root.render(<QueryClientProvider client={new QueryClient()}>{el}</QueryClientProvider>); }); };
const valor = async (sel, v) => {
  const el = container.querySelector(sel);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
const clicar = async (texto) => { await act(async () => { botao(texto).click(); }); };

describe('FedElectionWizard', () => {
  it('cria o rascunho e publica só depois de confirmar', async () => {
    const onClose = vi.fn();
    electionAction.mockImplementation(async (p) => (p.action === 'create' ? { ok: true, electionId: 'el1' } : { ok: true, notified: 7 }));
    await montar(<FedElectionWizard federation={fed} onClose={onClose} />);
    await valor('#el-titulo', 'Eleições 2027–2030');
    await clicar('Revisar e publicar');
    expect(container.textContent).toContain('Prévia do edital');
    await clicar('Publicar o edital');
    expect(electionAction).not.toHaveBeenCalled();
    await clicar('ok:Publicar');
    expect(electionAction.mock.calls.map(([p]) => p.action)).toEqual(['create', 'publish']);
    expect(electionAction.mock.calls[0][0].election).toMatchObject({ title: 'Eleições 2027–2030' });
    expect(electionAction.mock.calls[1][0]).toMatchObject({ federationId: 'fpp', electionId: 'el1' });
    expect(onClose).toHaveBeenCalledWith('el1');
  });

  it('a prévia do colégio vem do servidor e mostra o alerta de 1/3', async () => {
    const categoria = (voters, unit) => ({ voters, unit, weight: voters * unit });
    electionAction.mockResolvedValue({
      ok: true, endorsements_needed: 0,
      balance: {
        by_category: { athlete: categoria(2, 1), coach: categoria(0, 1), referee: categoria(0, 1), club: categoria(2, 3), arena: categoria(0, 3) },
        voters: 4, total_weight: 8, athlete_share: 0.25, athletes_ok: false, ratio_ok: true, small: ['athlete', 'club'],
      },
    });
    await montar(<FedElectionWizard federation={fed} onClose={vi.fn()} />);
    await clicar('Colégio e pesos');
    await clicar('Ver a prévia do colégio');
    expect(electionAction.mock.calls[0][0]).toMatchObject({ action: 'preview' });
    expect(container.textContent).toContain('Atletas com 25% do peso');
    expect(container.textContent).toContain('Grupos com menos de 3 eleitores');
  });
});

describe('VoteFlow', () => {
  const eleicao = { id: 'el1', status: 'voting', positions: [{ id: 'c1', label: 'Diretoria', kind: 'slate' }, { id: 'c2', label: 'Conselho fiscal', kind: 'individual', seats: 3 }] };
  const radio = async (nome, valorEscolhido) => {
    const el = container.querySelector(`input[name="${nome}"][value="${valorEscolhido}"]`);
    await act(async () => { el.click(); });
  };

  it('cargo a cargo, revisão, confirmação e comprovante', async () => {
    electionAction.mockResolvedValue({ ok: true, receipt: 'AB12-CD34' });
    const onDone = vi.fn();
    await montar(<VoteFlow federation={fed} election={eleicao} voter={{ id: 'el1_u1', weight: 1 }} onDone={onDone} />);
    expect(botao('Avançar').disabled).toBe(true);
    await radio('voto-c1', 'ch2');
    await clicar('Avançar');
    expect(container.textContent).toContain('Conselho fiscal');
    await radio('voto-c2', 'blank');
    await clicar('Avançar');
    expect(container.textContent).toContain('Chapa Unidade');
    expect(container.textContent).toContain('Em branco');
    await clicar('Confirmar voto');
    expect(electionAction).not.toHaveBeenCalled();
    await clicar('ok:Votar');
    expect(electionAction).toHaveBeenCalledWith({ federationId: 'fpp', action: 'vote', electionId: 'el1', voterId: 'el1_u1', choices: { c1: 'ch2', c2: 'blank' } });
    expect(container.textContent).toContain('AB12-CD34');
    await clicar('Concluir');
    expect(onDone).toHaveBeenCalledWith('AB12-CD34');
  });

  it('voto recusado pelo servidor fica na revisão, com o motivo', async () => {
    electionAction.mockRejectedValue(new Error('Este voto já foi registrado.'));
    await montar(<VoteFlow federation={fed} election={{ ...eleicao, positions: [eleicao.positions[0]] }} voter={{ id: 'el1_u1', weight: 3 }} />);
    await radio('voto-c1', 'null');
    await clicar('Avançar');
    await clicar('Confirmar voto');
    await clicar('ok:Votar');
    expect(container.textContent).toContain('Este voto já foi registrado.');
    expect(container.textContent).not.toContain('Voto registrado');
  });
});
