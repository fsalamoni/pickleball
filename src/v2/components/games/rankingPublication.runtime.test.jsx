/**
 * "Lancei os jogos e o atleta não aparece no ranking."
 *
 * A causa mais comum: um atleta foi inserido como CONVIDADO (só o nome) e a
 * partida dele não entra no ranking — para NINGUÉM da partida. A tela dizia
 * só "convidados sem conta são ignorados", o que escondia o efeito. Este
 * arquivo prova que a seção de publicação agora MOSTRA quantos jogos ficam de
 * fora e quem os deixa de fora, oferece o vínculo com a conta e não afirma
 * nada enquanto os jogos não chegaram.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'dono' } }) }));

const estado = { games: [], isSuccess: true };
const vincular = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({ synced: true })), isPending: false };
const semMutacao = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false };

vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayGames: () => ({ data: estado.games, isSuccess: estado.isSuccess, isLoading: !estado.isSuccess }),
  useGameDayRankingMeta: () => ({ data: { publishedIds: [] } }),
  usePublishGameDayRanking: () => semMutacao,
  useUnpublishGameDayRanking: () => semMutacao,
  useLinkGuestParticipant: () => vincular,
  // O resto do organizador não é montado aqui, mas o módulo os importa.
  useGameDayParticipants: () => ({ data: [] }),
  useAddGameDayParticipant: () => semMutacao,
  useRemoveGameDayParticipant: () => semMutacao,
  useAddGameDayGame: () => semMutacao,
  useUpdateGameDayGame: () => semMutacao,
  useDeleteGameDayGame: () => semMutacao,
  useAppendGameDayGames: () => semMutacao,
  useClearGameDayGames: () => semMutacao,
  useSetPlayParticipantPartner: () => semMutacao,
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({
  useAthletes: () => ({ data: [{ id: 'u9', platform_name: 'José Silva' }, { id: 'u1', platform_name: 'Ana' }], isLoading: false }),
}));

const { RankingSection } = await import('./AthleteGameDayOrganizer.jsx');

const participants = [
  { id: 'p1', user_id: 'u1', name: 'Ana' },
  { id: 'p2', user_id: 'u2', name: 'Bia' },
  { id: 'p3', user_id: 'u3', name: 'Caio' },
  { id: 'p4', user_id: 'u4', name: 'Duda' },
  { id: 'pg', user_id: null, name: 'José' },
];
const s = (id, name) => ({ id, name });
const jogo = (id, a, b) => ({ id, side_a: a, side_b: b, score_a: 11, score_b: 8 });

let container, root;
beforeEach(() => {
  window.localStorage.clear();
  estado.isSuccess = true;
  estado.games = [
    jogo('g1', [s('p1', 'Ana'), s('p2', 'Bia')], [s('p3', 'Caio'), s('p4', 'Duda')]),
    jogo('g2', [s('p1', 'Ana'), s('pg', 'José')], [s('p3', 'Caio'), s('p4', 'Duda')]),
    jogo('g3', [s('pg', 'José'), s('p2', 'Bia')], [s('p3', 'Caio'), s('p4', 'Duda')]),
  ];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function abrir() {
  act(() => { root.render(<RankingSection gameDay={{ id: 'gd1', created_by: 'dono' }} participants={participants} />); });
  const cabecalho = container.querySelector('[aria-expanded]');
  if (cabecalho && cabecalho.getAttribute('aria-expanded') === 'false') act(() => { cabecalho.click(); });
}

describe('publicar no ranking — o que entra e o que fica fora', () => {
  it('diz quantos jogos entram e que o convidado tira a partida de TODOS', () => {
    abrir();
    expect(container.textContent).toContain('1 de 3 jogo(s) decidido(s) entram no ranking');
    expect(container.textContent).toContain('2 jogo(s) ficam de fora');
    expect(container.textContent).toContain('José');
    expect([...container.querySelectorAll('button')].some((b) => b.textContent.includes('Vincular a uma conta'))).toBe(true);
  });

  it('sem os jogos carregados não afirma nada sobre o que fica de fora', () => {
    estado.isSuccess = false;
    abrir();
    expect(container.textContent).not.toContain('jogo(s) decidido(s) entram no ranking');
  });

  it('tudo com conta: nenhum aviso', () => {
    estado.games = estado.games.slice(0, 1);
    abrir();
    expect(container.textContent).not.toContain('ficam de fora');
  });

  it('vincular: abre buscando pelo nome digitado e grava a conta escolhida', async () => {
    abrir();
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Vincular a uma conta'));
    act(() => { botao.click(); });
    const busca = document.body.querySelector('input[placeholder="Buscar atleta pelo nome…"]');
    expect(busca.value).toBe('José');
    // Ana já está no dia: não pode ser oferecida (seriam duas pessoas iguais).
    expect(document.body.textContent).not.toMatch(/Ana\s*$/);
    const opcao = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('José Silva'));
    act(() => { opcao.click(); });
    const confirmar = [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes('Vincular a José Silva'));
    await act(async () => { confirmar.click(); });
    expect(vincular.mutateAsync).toHaveBeenCalledWith({
      pid: 'pg', athlete: expect.objectContaining({ user_id: 'u9', name: 'José Silva' }),
    });
  });
});
