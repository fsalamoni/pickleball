/**
 * Seleção do clube na Central: a lista de convocações, o detalhe com os convidados e a conferência
 * dos documentos. Fonte que falhou vira erro com "Tentar de novo", nunca "nenhuma convocação".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const acao = vi.fn();
const q = (data, extra = {}) => ({ isSuccess: true, isLoading: false, isError: false, data, refetch: vi.fn(), ...extra });
const fontes = {};
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/clubs/hooks/useClubSelection', () => ({
  useClubCallups: () => fontes.lista,
  useCallupMembers: () => fontes.convidados,
  useClubSelectionAction: () => ({ mutate: (...a) => acao(...a), isPending: false }),
}));

const { default: ClubSelectionPanel } = await import('./ClubSelectionPanel');

const club = { id: 'c1', name: 'Clube do Vale' };
const afiliados = q([{ id: 'a1', user_id: 'leo', user_name: 'Leo Dias', status: 'active' }]);
let container, root;
beforeEach(() => {
  acao.mockClear();
  fontes.lista = q({
    rows: [
      { id: 'k1', title: 'Seleção Interclubes', event_name: 'Interclubes 2027', place: 'Floripa', starts_at: '2027-05-01', ends_at: '2027-05-03', status: 'open', accept_days: 7, slots: 4, travel_docs: ['id_doc'], collect_uniform: false, involves_minors: true, counts: { accepted: 1, invited: 1, declined: 0, athletes: 1, staff: 0 } },
      { id: 'k2', title: 'Amistoso de verão', event_name: 'Amistoso', starts_at: '2027-01-10', status: 'draft', accept_days: 7, travel_docs: [], counts: { accepted: 0, invited: 0, declined: 0, athletes: 0, staff: 0 } },
    ],
  });
  fontes.convidados = q({
    rows: [
      { id: 'k1_ana', user_id: 'ana', name: 'Ana Souza', role: 'athlete', label: 'Duplas 4.0', status: 'accepted', docs_ok: { id_doc: false }, is_minor: false },
      { id: 'k1_bia', user_id: 'bia', name: 'Bia Costa', role: 'athlete', label: '', status: 'invited', docs_ok: {}, is_minor: true },
    ],
  });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async () => {
  await act(async () => {
    root.render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ClubSelectionPanel club={club} affiliationsQ={afiliados} /></QueryClientProvider></MemoryRouter>);
  });
};
const botao = (re) => [...container.querySelectorAll('button')].find((b) => re.test(b.textContent));

describe('ClubSelectionPanel', () => {
  it('a lista mostra as convocações com o estado e quantos confirmaram', async () => {
    await montar();
    expect(container.textContent).toContain('Seleção Interclubes');
    expect(container.textContent).toContain('Amistoso de verão');
    expect(container.textContent).toContain('1 confirmados');
    expect(botao(/Nova convocação/)).toBeTruthy();
  });

  it('a consulta que falhou não vira "nenhuma convocação"', async () => {
    fontes.lista = q(undefined, { isSuccess: false, isError: true });
    await montar();
    expect(container.textContent).toContain('Não carregaram as convocações');
    expect(container.textContent).not.toContain('Nenhuma convocação ainda');
    expect(botao(/Nova convocação/)).toBeFalsy();
  });

  it('sem nenhuma convocação (consulta certa) convida a criar a primeira', async () => {
    fontes.lista = q({ rows: [] });
    await montar();
    expect(container.textContent).toContain('Nenhuma convocação ainda');
  });

  it('o detalhe mostra os convidados, o aviso de menores e a conferência dos documentos', async () => {
    await montar();
    await act(async () => { botao(/Abrir/).click(); });
    expect(container.textContent).toContain('Ana Souza');
    expect(container.textContent).toContain('Menor de idade');
    expect(container.textContent).toContain('proteção de menores em dia');
    expect(botao(/Convocar/)).toBeTruthy();
    const caixa = container.querySelector('input[type="checkbox"]');
    expect(caixa).toBeTruthy();
    await act(async () => { caixa.click(); });
    expect(acao).toHaveBeenCalledTimes(1);
    expect(acao.mock.calls[0][0]).toMatchObject({ action: 'member_update', memberId: 'k1_ana', docs_ok: { id_doc: true } });
  });

  it('o rascunho oferece publicar e não convocar', async () => {
    fontes.convidados = q({ rows: [] });
    await montar();
    const abrir = [...container.querySelectorAll('button')].filter((b) => /Abrir/.test(b.textContent))[1];
    await act(async () => { abrir.click(); });
    expect(botao(/Publicar/)).toBeTruthy();
    expect(botao(/^Convocar$/)).toBeFalsy();
    await act(async () => { botao(/Publicar/).click(); });
    expect(acao.mock.calls[0][0]).toMatchObject({ action: 'publish', callupId: 'k2' });
  });

  it('a falha dos convidados diz que não carregou, não "ninguém convocado"', async () => {
    fontes.convidados = q(undefined, { isSuccess: false, isError: true });
    await montar();
    await act(async () => { botao(/Abrir/).click(); });
    expect(container.textContent).toContain('Não carregaram os convocados');
    expect(container.textContent).not.toContain('Ninguém convocado ainda');
  });
});
