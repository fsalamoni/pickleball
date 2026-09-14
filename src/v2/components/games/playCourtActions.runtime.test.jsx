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
  sortearRodada: vi.fn(async () => ({ created: [{ court: 1 }, { court: 2 }], courts: [1, 2] })),
};
const semMutacao = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false };

const arenasGeridas = [];
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
// `useGameDayRoles` pergunta quais arenas esta pessoa gerencia (é o que dá
// poder num dia de jogo de ARENA). Aqui ela não gerencia nenhuma — é o caso
// que estes testes cobrem, o dia de jogo do atleta.
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useMyManagedArenas: () => ({ data: arenasGeridas }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => ({ data: [], isLoading: false }),
  useGameDayGames: () => ({ data: [], isLoading: false }),
  useAddGameDayParticipant: () => semMutacao,
  useRemoveGameDayParticipant: () => semMutacao,
  useCreateNextPlayGame: () => ({ ...semMutacao, mutate: mutacoes.criarProximo }),
  useCreatePlayRound: () => ({ ...semMutacao, mutate: mutacoes.sortearRodada, mutateAsync: mutacoes.sortearRodada }),
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

async function render({ canManage = true, jogos = games, quadras = 2 } = {}) {
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

/* ============================================ sortear todas as quadras === */

describe('⭐ sortear TODAS as quadras de uma vez', () => {
  it('⭐ com as duas quadras livres e 8 na fila, o botão aparece e funciona', async () => {
    // É o caso que motivou a funcionalidade: número exato de jogadores para
    // encher as quadras. Sorteando uma por vez, os mesmos 4 voltam para a
    // mesma quadra a noite inteira.
    await render({ jogos: [] });
    const b = botao('Sortear todas as quadras');
    expect(b).toBeTruthy();
    expect(b.disabled).toBe(false);
    await click(b);
    expect(mutacoes.sortearRodada).toHaveBeenCalled();
  });

  it('⭐ com uma quadra só, o botão nem existe (seria o "criar próximo jogo")', async () => {
    await render({ jogos: [], quadras: 1 });
    expect(botao('Sortear todas as quadras')).toBeUndefined();
  });

  it('com uma quadra ocupada, sobra uma livre: sortear a rodada fica travado', async () => {
    // Uma quadra livre e 4 na fila não misturam nada — é o mesmo que criar o
    // próximo jogo. A tela não oferece um caminho que não muda o resultado.
    await render();
    const b = botao('Sortear todas as quadras');
    expect(b).toBeTruthy();
    expect(b.disabled).toBe(true);
  });

  it('⭐ e aí a tela EXPLICA como misturar, em vez de só desabilitar', async () => {
    await render();
    expect(container.textContent).toContain('misturar os grupos entre as quadras');
    expect(container.textContent).toContain('Sortear todas as quadras');
  });

  it('quem não organiza não vê o botão', async () => {
    await render({ jogos: [], canManage: false });
    expect(botao('Sortear todas as quadras')).toBeUndefined();
  });
});

describe('⭐ encerrar a partida: as duas saídas', () => {
  it('o diálogo oferece seguir nesta quadra OU só liberar', async () => {
    await render();
    await click(botao('Criar próxima partida'));
    expect(document.body.textContent).toContain('Encerrar a partida da quadra 1?');
    expect(botao('Criar próxima aqui')).toBeTruthy();
    expect(botao('Só encerrar')).toBeTruthy();
  });

  it('⭐ "Só encerrar" libera a quadra SEM sortear', async () => {
    await render();
    await click(botao('Criar próxima partida'));
    await click(botao('Só encerrar'));
    expect(mutacoes.encerrar).toHaveBeenCalledWith({ gid: 'g1', createNext: false });
  });

  it('⭐ "Criar próxima aqui" mantém o comportamento de sempre', async () => {
    await render();
    await click(botao('Criar próxima partida'));
    await click(botao('Criar próxima aqui'));
    expect(mutacoes.encerrar).toHaveBeenCalledWith({ gid: 'g1', createNext: true });
  });

  it('com uma quadra só, não há segunda saída — não faria diferença', async () => {
    await render({ quadras: 1 });
    await click(botao('Criar próxima partida'));
    expect(botao('Só encerrar')).toBeUndefined();
  });
});
