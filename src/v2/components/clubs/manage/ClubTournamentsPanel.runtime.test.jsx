/**
 * Torneios na Central do clube: a lista dos torneios com o selo do clube e o caminho para criar
 * mais um. Fonte que falhou vira erro com "Tentar de novo" — nunca "nenhum torneio" nem o botão de criar.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const q = (data, extra = {}) => ({ isSuccess: true, isLoading: false, isError: false, data, refetch: vi.fn(), ...extra });
const fontes = {};
vi.mock('@/modules/clubs/hooks/useClubTournaments', () => ({ useClubTournaments: () => fontes.lista }));

const { default: ClubTournamentsPanel } = await import('./ClubTournamentsPanel');
const club = { id: 'c1', name: 'Clube do Vale' };
let container, root;
beforeEach(() => {
  fontes.lista = q([
    { id: 't1', name: 'Aberto de Verão', status: 'registrations_open', visibility: 'public', starts_at: '2099-01-10', ends_at: '2099-01-12', city: 'Floripa' },
    { id: 't2', name: 'Copa Antiga', status: 'finished', visibility: 'public', starts_at: '2020-01-10', ends_at: '2020-01-12' },
    { id: 't3', name: 'Rascunho do Clube', status: 'draft', visibility: 'private' },
  ]);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async () => {
  await act(async () => { root.render(<MemoryRouter><ClubTournamentsPanel club={club} /></MemoryRouter>); });
};
const botao = (re) => [...container.querySelectorAll('button')].find((b) => re.test(b.textContent));

describe('ClubTournamentsPanel', () => {
  it('lista os atuais e os rascunhos, deixa os encerrados atrás de um botão e liga o criar ao clube', async () => {
    await montar();
    expect(container.textContent).toContain('Aberto de Verão');
    expect(container.textContent).toContain('Rascunho do Clube');
    expect(container.textContent).not.toContain('Copa Antiga');
    const criar = container.querySelector('a[href="/torneios/criar?clube=c1"]');
    expect(criar).toBeTruthy();
    await act(async () => { botao(/Mostrar os encerrados/).click(); });
    expect(container.textContent).toContain('Copa Antiga');
  });

  it('a consulta que falhou não vira "nenhum torneio" nem oferece criar', async () => {
    fontes.lista = q(undefined, { isSuccess: false, isError: true });
    await montar();
    expect(container.textContent).toContain('Não carregaram os torneios do clube');
    expect(container.textContent).not.toContain('Nenhum torneio do clube ainda');
    expect(container.querySelector('a[href^="/torneios/criar"]')).toBeFalsy();
  });

  it('sem nenhum torneio (consulta certa) convida a criar o primeiro', async () => {
    fontes.lista = q([]);
    await montar();
    expect(container.textContent).toContain('Nenhum torneio do clube ainda');
    expect(container.querySelector('a[href="/torneios/criar?clube=c1"]')).toBeTruthy();
  });
});
