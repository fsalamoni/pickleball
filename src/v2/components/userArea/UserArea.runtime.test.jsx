/**
 * Minha área (flag `user_hub`): com a flag desligada o perfil é o de sempre;
 * ligada, as seções saem do papel da pessoa e "Precisa de você" nunca afirma
 * zero sobre o que não carregou.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ok = (data) => ({ isPending: false, isLoading: false, isSuccess: true, isError: false, data, refetch: vi.fn() });
const erro = () => ({ isPending: false, isLoading: false, isSuccess: false, isError: true, data: undefined, refetch: vi.fn() });

const estado = {};
function reset() {
  Object.assign(estado, {
    flags: { user_hub: true },
    admin: false,
    coach: ok(null),
    arenas: ok([]),
    resumoArenas: { pendingByArena: {}, pendingError: false, refetch: vi.fn() },
    clubes: ok([]),
    convites: ok([]),
    eventos: ok([]),
  });
}

vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: (k) => Boolean(estado.flags[k]) }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'u1' },
    userProfile: { platform_name: 'Ana', city: 'Porto Alegre', state: 'RS' },
    isPlatformAdmin: estado.admin,
  }),
}));
vi.mock('@/modules/coaches/hooks/useCoaches', () => ({ useCoach: () => estado.coach }));
vi.mock('@/modules/coaches/hooks/useLessons', () => ({ useCoachLessons: () => ok([]) }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useMyManagedArenas: () => estado.arenas }));
vi.mock('@/modules/arenas/hooks/useMyArenaSummary', () => ({ useMyArenaSummary: () => estado.resumoArenas }));
vi.mock('@/modules/clubs/hooks/useClubs', () => ({
  useMyClubs: () => estado.clubes,
  useMyClubInvites: () => estado.convites,
  useMyEventInvites: () => estado.eventos,
  useMyJoinRequests: () => ok([]),
}));
vi.mock('@/modules/training/hooks/useTrainingShares', () => ({ useTrainingInbox: () => ok([]) }));
vi.mock('@/modules/training/hooks/useTrainingQuestions', () => ({
  useMyTrainingQuestions: () => ok([]),
  useCoachTrainingQuestions: () => ok([]),
}));
vi.mock('@/modules/rating/hooks/useMyUnifiedLevel', () => ({ useMyUnifiedLevel: () => ({ level: null, source: null, isLoading: false }) }));
vi.mock('@/modules/rating/hooks/useRating', () => ({
  useMyPlayerRating: () => ok(null),
  useNationalRanking: () => ({ data: [] }),
}));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({ useMyTournaments: () => ok([]) }));
vi.mock('@/v2/components/rating/V2DuprRatingBadge', () => ({ default: () => null }));
vi.mock('@/v2/components/arenas/marketing/MyReferralCodes', () => ({ default: () => null }));

import V2Profile from '@/v2/pages/V2Profile.jsx';
import UserArea from './UserArea.jsx';

let container; let root;
beforeEach(() => {
  reset();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = (el, url = '/perfil') => act(async () => {
  root.render(<MemoryRouter initialEntries={[url]}>{el}</MemoryRouter>);
});
const secoes = () => Array.from(container.querySelectorAll('nav[aria-label="Seções da Minha área"] button')).map((b) => b.textContent.trim());

describe('Minha área desligada', () => {
  it('o perfil é o de sempre, com a âncora das dicas', async () => {
    estado.flags = {};
    await render(<V2Profile />);
    expect(container.querySelectorAll('[data-dica="perfil-editar"]')).toHaveLength(1);
    expect(container.textContent).toContain('Abrir editor de perfil');
    expect(container.textContent).not.toContain('Minha área');
  });
});

describe('Minha área ligada', () => {
  it('o /perfil vira a Minha área', async () => {
    await render(<V2Profile />);
    // O pedaço da Minha área chega por import dinâmico.
    for (let i = 0; i < 20 && !container.textContent.includes('Minha área'); i += 1) {
      await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    }
    expect(container.textContent).toContain('Minha área');
    expect(container.querySelectorAll('[data-dica="perfil-editar"]')).toHaveLength(1);
  });

  it('quem só joga vê as seções de todos — nada de gestão', async () => {
    await render(<UserArea />);
    expect(secoes()).toEqual(['Resumo', 'Perfil', 'Jogo', 'Agenda', 'Torneios', 'Conta']);
    expect(container.querySelector('[data-dica="minha-area-pendencias"]')).toBeNull();
  });

  it('cada papel traz a sua seção', async () => {
    estado.coach = ok({ id: 'u1' });
    estado.arenas = ok([{ id: 'a1', name: 'Arena Sol' }]);
    estado.clubes = ok([{ id: 'c1', name: 'Clube', my_role: 'member' }]);
    estado.admin = true;
    await render(<UserArea />);
    expect(secoes()).toEqual(['Resumo', 'Perfil', 'Jogo', 'Agenda', 'Torneios', 'Clubes', 'Conta', 'Professor', 'Arenas', 'Admin']);
  });

  it('pedido de reserva conhecido vira pendência que leva à Central', async () => {
    estado.arenas = ok([{ id: 'a1', name: 'Arena Sol' }]);
    estado.resumoArenas = { pendingByArena: { a1: 2 }, pendingError: false, refetch: vi.fn() };
    await render(<UserArea />);
    const link = container.querySelector('[data-dica="minha-area-pendencias"] a');
    expect(link.textContent).toContain('2 pedidos de reserva esperando resposta');
    expect(link.getAttribute('href')).toBe('/arenas/a1/gerir?aba=reservas');
  });

  it('contagem que falhou não vira zero — a faixa diz o que ficou de fora', async () => {
    estado.arenas = ok([{ id: 'a1', name: 'Arena Sol' }]);
    estado.resumoArenas = { pendingByArena: {}, pendingError: true, refetch: vi.fn() };
    await render(<UserArea />, '/perfil?secao=arenas');
    const faixa = container.querySelector('[data-dica="minha-area-pendencias"]');
    expect(faixa.textContent).toContain('Ficou de fora: os pedidos de reserva');
    expect(faixa.querySelector('a')).toBeNull();
    // Na seção, a arena aparece sem selo de "0 pedidos".
    expect(container.textContent).toContain('Arena Sol');
    expect(container.textContent).not.toMatch(/0 pedidos?/);
  });

  it('arenas que falharam abrem a seção com o erro, não "sem arena"', async () => {
    estado.arenas = erro();
    await render(<UserArea />, '/perfil?secao=arenas');
    expect(secoes()).toContain('Arenas');
    expect(container.textContent).toContain('Não carregaram as suas arenas');
  });

  it('seção pedida que a pessoa não vê cai no resumo', async () => {
    await render(<UserArea />, '/perfil?secao=admin');
    const ativa = container.querySelector('nav[aria-label="Seções da Minha área"] [aria-current="page"]');
    expect(ativa.textContent.trim()).toBe('Resumo');
  });

  it('convite de clube abre a seção Clubes mesmo sem clube', async () => {
    estado.convites = ok([{ id: 'i1', club_id: 'c9', club_name: 'Pickle Sul' }]);
    await render(<UserArea />, '/perfil?secao=clubes');
    expect(secoes()).toContain('Clubes');
    expect(container.textContent).toContain('Pickle Sul');
    expect(container.textContent).toContain('1 convite para entrar num clube');
  });
});
