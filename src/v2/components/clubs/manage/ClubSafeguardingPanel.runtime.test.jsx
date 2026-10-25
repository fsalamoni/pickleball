/**
 * Proteção de menores do CLUBE na Central: o quadro de quem trabalha com menores, a certidão
 * para conferir e os associados menores com o responsável. Fonte que falhou vira erro com
 * "Tentar de novo", nunca "ninguém no quadro" nem "nenhum menor".
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
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' } }) }));
vi.mock('@/modules/clubs/hooks/useClubSafeguarding', () => ({
  useClubSgOverview: () => fontes.quadro,
  useClubMinors: () => fontes.menores,
  useClubSafeguardingAction: () => ({ mutate: (...a) => acao(...a), isPending: false }),
}));
vi.mock('@/modules/clubs/services/clubSafeguardingService', () => ({ fetchClubBackgroundFile: vi.fn() }));
vi.mock('../association/ClubGuardianForm', () => ({ default: () => <div>form do responsável</div> }));

const { default: ClubSafeguardingPanel } = await import('./ClubSafeguardingPanel');

const club = { id: 'c1', name: 'Clube do Vale' };
const afiliados = q([]);
let container, root;
beforeEach(() => {
  acao.mockClear();
  fontes.quadro = q({
    rules: {},
    rows: [
      { user_id: 'ana', name: 'Ana Souza', photo_url: '', roles: ['staff'], label: '', required: true, ok: false, until: '', pledge_ok: true, background: { valid: false, status: 'pending' }, pending: { issued_at: '2026-10-01', valid_until: '2027-04-01' } },
      { user_id: 'leo', name: 'Leo Dias', photo_url: '', roles: ['designated'], label: 'Treinador da escolinha', required: true, ok: true, until: '2027-03-01', pledge_ok: true, background: { valid: true, until: '2027-03-01' }, pending: null },
    ],
  });
  fontes.menores = q({ rows: [{ user_id: 'bia', name: 'Bia Lima', photo_url: '', age: 12, guardian: null }] });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const montar = async (tab) => {
  await act(async () => {
    root.render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><ClubSafeguardingPanel club={club} affiliationsQ={afiliados} tab={tab} /></QueryClientProvider></MemoryRouter>);
  });
};

describe('ClubSafeguardingPanel', () => {
  it('o quadro mostra quem está em dia e oferece conferir a certidão pendente', async () => {
    await montar('protecao');
    expect(container.textContent).toContain('Ana Souza');
    expect(container.textContent).toContain('Treinador da escolinha');
    expect(container.textContent).toContain('Certidão para conferir');
    expect([...container.querySelectorAll('button')].some((b) => /Conferir certidão/.test(b.textContent))).toBe(true);
  });

  it('a consulta do quadro que falhou não vira "ninguém no quadro"', async () => {
    fontes.quadro = q(undefined, { isSuccess: false, isError: true });
    await montar('protecao');
    expect(container.textContent).toContain('Não carregou quem trabalha com menores');
    expect(container.textContent).not.toContain('Ninguém no quadro ainda');
  });

  it('o menor sem responsável aparece com o aviso e o botão de registrar', async () => {
    await montar('menores');
    expect(container.textContent).toContain('Bia Lima');
    expect(container.textContent).toContain('Sem responsável registrado');
    expect([...container.querySelectorAll('button')].some((b) => /Registrar responsável/.test(b.textContent))).toBe(true);
  });

  it('a consulta dos menores que falhou não vira "nenhum menor"', async () => {
    fontes.menores = q(undefined, { isSuccess: false, isError: true });
    await montar('menores');
    expect(container.textContent).toContain('Não carregaram os associados menores');
    expect(container.textContent).not.toContain('Nenhum associado menor de idade');
  });

  it('as regras salvam pelo servidor, subindo a versão só quando se pede novo aceite', async () => {
    await montar('protecao-regras');
    const form = container.querySelector('form[aria-label="Regras da proteção de menores"]');
    expect(form).toBeTruthy();
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(acao).toHaveBeenCalledTimes(1);
    expect(acao.mock.calls[0][0]).toMatchObject({ action: 'sg_rules', rules: { pledge_version: 1 } });
  });
});
