/**
 * Card "Associação do clube" do início: falha ≠ vazio (a consulta que falha diz que não
 * carregou, nunca "você não é associado"); sem clube, a porta para a lista; o que pede a
 * pessoa (pagar) sobe ao topo.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { clubs: null, assoc: null };
vi.mock('@/modules/clubs/hooks/useClubs', () => ({ useMyClubs: () => estado.clubs }));
vi.mock('@/modules/clubs/hooks/useClubAssociation', () => ({ useMyClubAssociations: () => estado.assoc }));

const { default: Card } = await import('./HomeClubAssociationCard');

const ok = (data) => ({ isLoading: false, isError: false, isSuccess: true, isFetching: false, data, refetch: vi.fn() });
const falha = () => ({ isLoading: false, isError: true, isSuccess: false, data: undefined, refetch: vi.fn() });

let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async () => { await act(async () => { root.render(<MemoryRouter><Card /></MemoryRouter>); }); };

describe('HomeClubAssociationCard', () => {
  it('clubes que falharam: diz que não carregou, não que não há clube', async () => {
    estado.clubs = falha(); estado.assoc = ok(undefined);
    await montar();
    expect(container.textContent).toContain('não carregaram');
    expect(container.textContent).not.toContain('Encontrar um clube');
  });

  it('associações que falharam: diz que não carregaram', async () => {
    estado.clubs = ok([{ id: 'c1' }]); estado.assoc = falha();
    await montar();
    expect(container.textContent).toContain('As suas associações não carregaram');
  });

  it('sem clube: oferece encontrar um', async () => {
    estado.clubs = ok([]); estado.assoc = ok(undefined);
    await montar();
    expect(container.textContent).toContain('Encontrar um clube');
  });

  it('cobrança aberta: mostra "Pagar" e o nome do clube', async () => {
    estado.clubs = ok([{ id: 'c1' }]);
    estado.assoc = ok({ clubs: [{ club_id: 'c1', club_name: 'Clube Pickle Sul', charges: [{ status: 'open' }] }] });
    await montar();
    expect(container.textContent).toContain('Clube Pickle Sul');
    expect(container.textContent).toContain('Pagar');
  });
});
