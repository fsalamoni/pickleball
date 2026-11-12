/**
 * Teste de RUNTIME de /carreira/convite/:token (Carreira, PR 6).
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

const mockAuth = { user: { uid: 'ze' }, userProfile: {}, isAuthenticated: true, isLoadingAuth: false, signOut: vi.fn() };
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
    expect(container.textContent).toContain('Preencha a sua data de nascimento no cadastro');
    expect(careerAction).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('não vale mais');

    mockAuth.userProfile = { birth_date: '1988-03-03' };
    await render();
    expect(careerAction).toHaveBeenCalledWith('invite_peek', { token: TOKEN });
    expect(container.textContent).toContain('Sou eu, aceitar o convite');
  });
});

describe('V2CareerInvite · aceitar', () => {
  const PEEK = { valid: true, owner_name: 'Ana', partner_name: 'Zé', event_name: 'Copa Sul', start_date: '2026-10-10', date_precision: 'day' };
  const botao = (txt) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(txt));
  async function aceitarCom(erro) {
    mockAuth.userProfile = { birth_date: '1988-03-03', full_name: 'Zé da Silva' };
    careerAction.mockImplementation((acao) => (acao === 'invite_peek' ? Promise.resolve(PEEK) : Promise.reject(erro)));
    await render();
    await act(async () => { botao('Sou eu, aceitar o convite').click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  }

  it('🔴 queda de rede não trava o botão: vira "Tentar de novo"', async () => {
    await aceitarCom(Object.assign(new Error('Sem conexão com o servidor. Tente de novo.'), { code: 'functions/unavailable' }));
    expect(container.querySelector('[role="alert"]').textContent).toContain('Sem conexão');
    expect(botao('Tentar de novo').disabled).toBe(false);
  });

  it('recusa do servidor (link morto) trava o botão e diz o motivo', async () => {
    await aceitarCom(Object.assign(new Error('Este convite não vale mais.'), { code: 'functions/failed-precondition' }));
    expect(container.querySelector('[role="alert"]').textContent).toContain('não vale mais');
    expect(botao('Sou eu, aceitar o convite').disabled).toBe(true);
  });

  it('diz com qual conta o aceite será feito e deixa trocar', async () => {
    mockAuth.userProfile = { birth_date: '1988-03-03', full_name: 'Zé da Silva' };
    await render();
    expect(container.textContent).toContain('Você entrou como Zé da Silva.');
    await act(async () => { botao('Trocar de conta').click(); });
    expect(mockAuth.signOut).toHaveBeenCalled();
  });
});
