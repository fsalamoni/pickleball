/**
 * Clique num jogador que está EM QUADRA, no PAINEL do Play.
 *
 * O que este arquivo protege: o clique NÃO pode executar nada sozinho. Ele tem
 * de oferecer as duas intenções — deixar o jogador indisponível para aquela
 * partida (entra o próximo da ordem) ou substituí-lo por alguém escolhido na
 * ordem de participação — e só gravar depois da escolha.
 *
 * O telão tem o seu próprio arquivo (`V2GameDayTelao.runtime.test.jsx`) e
 * exercita o MESMO componente de diálogo: se as duas telas divergirem, um dos
 * dois quebra.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'dono' }, userProfile: {} };
const mutacoes = {
  substituir: vi.fn(),
  criarProximo: vi.fn(),
  encerrar: vi.fn(),
  cancelar: vi.fn(),
};
const semMutacao = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => ({ data: [], isLoading: false }),
  useGameDayGames: () => ({ data: [], isLoading: false }),
  useAddGameDayParticipant: () => semMutacao,
  useRemoveGameDayParticipant: () => semMutacao,
  useCreateNextPlayGame: () => ({ ...semMutacao, mutate: mutacoes.criarProximo }),
  useCreateManualPlayGame: () => semMutacao,
  useFinishPlayGame: () => ({ ...semMutacao, mutate: mutacoes.encerrar, mutateAsync: mutacoes.encerrar }),
  useCancelPlayGame: () => ({ ...semMutacao, mutate: mutacoes.cancelar }),
  useNoShowSwapPlayGame: () => ({ ...semMutacao, mutate: mutacoes.substituir }),
  useSetPlayParticipantSkip: () => semMutacao,
  useSetPlayParticipantPartner: () => semMutacao,
}));

const { PlayCourtsSection } = await import('./AthletePlayOrganizer.jsx');
const { computePlayOrder } = await import('@/modules/games/domain/gamePlay');

const P = (id, name, wait) => ({
  id, name, user_id: id, photo_url: null,
  available_since: 1000 + wait, available_tie: 0, skip_remaining: 0,
});

// 8 participantes: 4 em quadra (a,b,c,d) e 4 na fila (e,f,g,h), nesta ordem.
const participants = [
  P('a', 'Ana', 0), P('b', 'Bia', 1), P('c', 'Caio', 2), P('d', 'Davi', 3),
  P('e', 'Elis', 4), P('f', 'Fábio', 5), P('g', 'Gabi', 6), P('h', 'Hugo', 7),
];
const games = [{
  id: 'g1', court: 1, status: 'open', created_at_ms: 1,
  side_a: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }],
  side_b: [{ id: 'c', name: 'Caio' }, { id: 'd', name: 'Davi' }],
}];

let container, root;

beforeEach(() => {
  window.localStorage.clear();
  Object.values(mutacoes).forEach((m) => m.mockReset());
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
const botao = (trecho) => [...document.body.querySelectorAll('button')]
  .find((b) => b.textContent.includes(trecho));

async function render({ canManage = true } = {}) {
  const view = computePlayOrder({ participants, games });
  await act(async () => {
    root.render(
      <PlayCourtsSection
        gameDay={{ id: 'gd1', play_courts: 2 }}
        participants={participants}
        games={games}
        view={view}
        canManage={canManage}
      />,
    );
  });
  // A seção é colapsável: se vier fechada, abre antes de interagir.
  if (!container.textContent.includes('Ana')) {
    const cabecalho = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Quadras'));
    if (cabecalho) await click(cabecalho);
  }
}

// O botão do nome contém avatar (iniciais) + nome + ícone: casar por trecho.
const nomeEmQuadra = () => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.includes('Ana'));

describe('painel do Play — clique no jogador em quadra', () => {
  it('⭐ oferece ESCOLHA e não substitui ninguém de imediato', async () => {
    await render();
    const alvo = nomeEmQuadra();
    expect(alvo).toBeTruthy();
    await click(alvo);
    expect(document.body.textContent).toContain('Indisponível para esta partida');
    expect(document.body.textContent).toContain('Substituir por outro jogador');
    expect(mutacoes.substituir).not.toHaveBeenCalled();
  });

  it('⭐ a opção automática anuncia QUEM entra antes de confirmar', async () => {
    await render();
    await click(nomeEmQuadra());
    // Elis é a primeira da fila: a tela promete exatamente quem vai entrar.
    expect(document.body.textContent).toContain('Elis');
    await click(botao('Indisponível para esta partida'));
    expect(mutacoes.substituir).toHaveBeenCalledWith({
      gid: 'g1', absentId: 'a', replacementId: null,
    });
  });

  it('⭐ a substituição escolhida grava QUEM foi escolhido, não o primeiro', async () => {
    await render();
    await click(nomeEmQuadra());
    await click(botao('Substituir por outro jogador'));
    expect(mutacoes.substituir).not.toHaveBeenCalled();

    const linhas = [...document.body.querySelectorAll('div')].filter((d) => (
      d.textContent.includes('Gabi')
      && [...d.querySelectorAll('button')].some((b) => b.textContent.includes('Entra'))
    ));
    expect(linhas.length).toBeGreaterThan(0);
    const entrar = [...linhas[linhas.length - 1].querySelectorAll('button')]
      .find((b) => b.textContent.includes('Entra'));
    await click(entrar);
    expect(mutacoes.substituir).toHaveBeenCalledWith({
      gid: 'g1', absentId: 'a', replacementId: 'g',
    });
  });

  it('a lista de substitutos NÃO oferece quem já está na mesma partida', async () => {
    await render();
    await click(nomeEmQuadra());
    await click(botao('Substituir por outro jogador'));
    // Bia, Caio e Davi estão em quadra: não podem entrar no lugar da Ana.
    const dialogo = document.querySelector('[role="dialog"]');
    expect(dialogo).toBeTruthy();
    const oferecidos = [...dialogo.querySelectorAll('button')]
      .filter((b) => b.textContent.includes('Entra'))
      .map((b) => b.closest('div').textContent);
    expect(oferecidos).toHaveLength(4);
    ['Elis', 'Fábio', 'Gabi', 'Hugo'].forEach((n) => {
      expect(oferecidos.some((t) => t.includes(n))).toBe(true);
    });
    ['Bia', 'Caio', 'Davi'].forEach((n) => {
      expect(oferecidos.some((t) => t.includes(n))).toBe(false);
    });
  });

  it('quem já foi substituído para FORA desta partida não volta na lista', async () => {
    const view = computePlayOrder({ participants, games });
    await act(async () => {
      root.render(
        <PlayCourtsSection
          gameDay={{ id: 'gd1', play_courts: 2 }}
          participants={participants}
          games={[{ ...games[0], swapped_out_ids: ['e'] }]}
          view={view}
          canManage
        />,
      );
    });
    await click(nomeEmQuadra());
    // Elis saiu desta partida antes: some da opção automática e da lista.
    expect(document.body.textContent).toContain('Fábio');
    await click(botao('Substituir por outro jogador'));
    const linhasElis = [...document.body.querySelectorAll('div')].filter((d) => (
      d.textContent.includes('Elis')
      && [...d.querySelectorAll('button')].some((b) => b.textContent.includes('Entra'))
    ));
    expect(linhasElis).toHaveLength(0);
  });

  it('sem ninguém na fila, avisa em vez de oferecer opção que falharia', async () => {
    const soEmQuadra = participants.slice(0, 4);
    const view = computePlayOrder({ participants: soEmQuadra, games });
    await act(async () => {
      root.render(
        <PlayCourtsSection
          gameDay={{ id: 'gd1', play_courts: 2 }}
          participants={soEmQuadra}
          games={games}
          view={view}
          canManage
        />,
      );
    });
    await click(nomeEmQuadra());
    expect(document.body.textContent).toContain('Não há ninguém disponível');
    expect(botao('Indisponível para esta partida')).toBeFalsy();
    expect(mutacoes.substituir).not.toHaveBeenCalled();
  });

  it('para quem não organiza, o nome em quadra não é clicável', async () => {
    await render({ canManage: false });
    expect(nomeEmQuadra()).toBeFalsy();
    expect(container.textContent).toContain('Ana');
  });
});
