/**
 * Simples × duplas NA TELA (Onda CF).
 *
 * O que protege:
 *  1. ⭐ cada quadra do Play tem o seletor "Duplas | Simples"; trocar para
 *     simples e criar o jogo pede SIMPLES ao serviço — e sem troca a chamada é
 *     a de sempre (sem `kind`);
 *  2. ⭐ a quadra que teve jogo simples já abre em Simples (a quadra lembra);
 *  3. ⭐ quem não organiza não vê o seletor — só o selo "Simples";
 *  4. ⭐ o ranking do dia vira DUAS tabelas quando há simples e duplas;
 *  5. o seletor é um grupo de botões com `aria-pressed` e nome acessível.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'dono' }, userProfile: {} };
const mutacoes = {
  criarProximo: vi.fn(async () => ({ court: 2, kind: 'singles' })),
  sortearRodada: vi.fn(async () => ({ created: [{ court: 1 }, { court: 2 }], courts: [1, 2] })),
};
const semMutacao = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useMyManagedArenas: () => ({ data: [] }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => ({ data: [], isLoading: false }),
  useGameDayGames: () => ({ data: [], isLoading: false }),
  useAddGameDayParticipant: () => semMutacao,
  useRemoveGameDayParticipant: () => semMutacao,
  useCreateNextPlayGame: () => ({ ...semMutacao, mutateAsync: mutacoes.criarProximo }),
  useCreatePlayRound: () => ({ ...semMutacao, mutateAsync: mutacoes.sortearRodada }),
  useCreateManualPlayGame: () => semMutacao,
  useFinishPlayGame: () => semMutacao,
  useCancelPlayGame: () => semMutacao,
  useNoShowSwapPlayGame: () => semMutacao,
  useSetPlayParticipantSkip: () => semMutacao,
  useSetPlayParticipantPartner: () => semMutacao,
}));

const { PlayCourtsSection } = await import('./AthletePlayOrganizer.jsx');
const { default: GameDayLeaderboard } = await import('@/modules/clubs/components/GameDayLeaderboard.jsx');
const { computePlayOrder } = await import('@/modules/games/domain/gamePlay');

const P = (id, name, wait) => ({
  id, name, user_id: id, photo_url: null, available_since: 1000 + wait, available_tie: 0, skip_remaining: 0,
});
const participants = [P('a', 'Ana', 0), P('b', 'Bia', 1), P('c', 'Caio', 2), P('d', 'Davi', 3), P('e', 'Elis', 4), P('f', 'Fábio', 5)];

let container, root;
beforeEach(() => {
  window.localStorage.clear();
  Object.values(mutacoes).forEach((m) => m.mockClear());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const grupo = (quadra) => container.querySelector(`[role="group"][aria-label="Tipo de jogo da quadra ${quadra}"]`);
const opcao = (quadra, rotulo) => [...(grupo(quadra)?.querySelectorAll('button') || [])]
  .find((b) => b.textContent.includes(rotulo));

async function render({ canManage = true, jogos = [], quadras = 2 } = {}) {
  const view = computePlayOrder({ participants, games: jogos });
  await act(async () => {
    root.render(
      <PlayCourtsSection
        gameDay={{ id: 'gd1', play_courts: quadras }}
        participants={participants}
        games={jogos}
        view={view}
        canManage={canManage}
      />,
    );
  });
  if (!grupo(1) && !container.textContent.includes('Quadra 1')) {
    const cabecalho = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Quadras'));
    if (cabecalho) await click(cabecalho);
  }
}

/** O botão "Criar jogo" da LINHA da quadra. */
function criarNaQuadra(quadra) {
  const linha = [...container.querySelectorAll('tr')].find((tr) => tr.textContent.includes(`Quadra ${quadra}`));
  return [...linha.querySelectorAll('button')].find((b) => b.textContent.includes('Criar jogo'));
}

describe('⭐ o seletor por quadra, no Play', () => {
  it('cada quadra tem o seletor, com Duplas marcado e nome acessível', async () => {
    await render();
    expect(grupo(1)).toBeTruthy();
    expect(grupo(2)).toBeTruthy();
    expect(opcao(1, 'Duplas').getAttribute('aria-pressed')).toBe('true');
    expect(opcao(1, 'Simples').getAttribute('aria-pressed')).toBe('false');
  });

  it('⭐ trocar a quadra 2 para Simples e criar: o serviço recebe SIMPLES', async () => {
    await render();
    await click(opcao(2, 'Simples'));
    expect(opcao(2, 'Simples').getAttribute('aria-pressed')).toBe('true');
    await act(async () => { criarNaQuadra(2).click(); });
    expect(mutacoes.criarProximo).toHaveBeenCalledWith({ court: 2, kind: 'singles' });
  });

  it('⭐ sem troca, a chamada é a de sempre (sem `kind`)', async () => {
    await render();
    await act(async () => { criarNaQuadra(1).click(); });
    expect(mutacoes.criarProximo).toHaveBeenCalledWith({ court: 1 });
  });

  it('⭐ a quadra que teve jogo simples já abre em Simples', async () => {
    const jogos = [{
      id: 'g0', court: 2, status: 'finished', kind: 'singles', created_at_ms: 5,
      side_a: [{ id: 'x', name: 'X' }], side_b: [{ id: 'y', name: 'Y' }],
    }];
    await render({ jogos });
    expect(opcao(2, 'Simples').getAttribute('aria-pressed')).toBe('true');
    expect(opcao(1, 'Duplas').getAttribute('aria-pressed')).toBe('true');
  });

  it('⭐ "Sortear todas as quadras" leva o tipo de cada quadra', async () => {
    await render();
    await click(opcao(2, 'Simples'));
    const sortear = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('Sortear todas'));
    await act(async () => { sortear.click(); });
    expect(mutacoes.sortearRodada).toHaveBeenCalledWith({ courtKinds: { 1: 'doubles', 2: 'singles' } });
  });

  it('⭐ quem não organiza não vê o seletor, só o selo de Simples', async () => {
    const jogos = [{
      id: 'g1', court: 1, status: 'open', kind: 'singles', created_at_ms: 5,
      side_a: [{ id: 'a', name: 'Ana' }], side_b: [{ id: 'b', name: 'Bia' }],
    }];
    await render({ canManage: false, jogos });
    expect(grupo(1)).toBeNull();
    const linha = [...container.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Quadra 1'));
    expect(linha.textContent).toContain('Simples');
  });
});

describe('⭐ o ranking do dia com simples e duplas', () => {
  const lado = (...ids) => ids.map((id) => ({ id, name: id.toUpperCase() }));
  const parts = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase() }));

  it('um tipo só: uma tabela, sem subtítulos', async () => {
    await act(async () => {
      root.render(<GameDayLeaderboard participants={parts} games={[{ side_a: lado('a', 'b'), side_b: lado('c', 'd'), score_a: 11, score_b: 3 }]} />);
    });
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(container.textContent).not.toMatch(/cada tipo tem o seu ranking/);
  });

  it('⭐ os dois tipos: DUAS tabelas, com o aviso de que não se somam', async () => {
    await act(async () => {
      root.render(
        <GameDayLeaderboard
          participants={parts}
          games={[
            { side_a: lado('a', 'b'), side_b: lado('c', 'd'), score_a: 11, score_b: 3 },
            { side_a: lado('e'), side_b: lado('a'), score_a: 11, score_b: 9 },
          ]}
        />,
      );
    });
    expect(container.querySelectorAll('table')).toHaveLength(2);
    const titulos = [...container.querySelectorAll('h4')].map((h) => h.textContent);
    expect(titulos).toEqual(['Duplas', 'Simples']);
    expect(container.textContent).toMatch(/cada tipo tem o seu/);
  });
});
