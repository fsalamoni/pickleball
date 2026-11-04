/**
 * Teste de RUNTIME de /carreira/convite/:token (Minha carreira, PR 6).
 *
 * 🔴 A dupla sem conta cria a conta pelo link e volta SEM nascimento (o
 * assistente de cadastro abre por cima): a tela não pode perguntar ao servidor
 * nessa hora — ele trataria como menor e a resposta "não vale" ficaria na tela.
 * Ela pede o cadastro e pergunta assim que a data chega ao perfil.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockAuth = { user: { uid: 'ze' }, userProfile: {}, isAuthenticated: true, isLoadingAuth: false };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => mockAuth }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlags: () => ({ flags: { athlete_career: true }, isLoading: false }) }));
const careerAction = vi.fn();
vi.mock('@/modules/career/services/careerService.js', () => ({ careerAction: (...a) => careerAction(...a) }));

import V2CareerInvite from './V2CareerInvite.jsx';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
let container; let root; let qc;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient();
  careerAction.mockReset();
  careerAction.mockResolvedValue({ valid: true, owner_name: 'Ana', partner_name: 'Zé', event_name: 'Copa Sul', start_date: '2026-10-10', date_precision: 'day' });
  mockAuth.userProfile = {};
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

async function render() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/carreira/convite/${TOKEN}`]}>
          <Routes><Route path="/carreira/convite/:token" element={<V2CareerInvite />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
}

describe('V2CareerInvite · conta sem nascimento', () => {
  it('🔴 pede o cadastro, não consulta o servidor; com a data salva, mostra o convite', async () => {
    await render();
    expect(container.textContent).toContain('Complete o seu cadastro');
    expect(careerAction).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('não vale mais');

    mockAuth.userProfile = { birth_date: '1988-03-03' };
    await render();
    expect(careerAction).toHaveBeenCalledWith('invite_peek', { token: TOKEN });
    expect(container.textContent).toContain('Sou eu, aceitar o convite');
  });
});
