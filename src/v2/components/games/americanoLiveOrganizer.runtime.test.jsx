/**
 * PAINEL do Americano aprimorado (`americano_live`).
 *
 * O formato é uma mescla: a organização é a do Play (quadra a quadra, fila de
 * participação) e o resultado é o do Americano (placar, partidas concluídas,
 * ranking do dia). O que este arquivo protege é justamente a costura entre os
 * dois — e o fluxo de DOIS PASSOS que dá nome ao formato:
 *
 *   "Lançar resultado" salva o placar e LIBERA a quadra.
 *   Só então aparece "Gerar próxima partida".
 *
 * Um clique só, como no Play, seria outro formato. E é fácil alguém "melhorar"
 * isso sem perceber: os dois botões vivem no mesmo card.
 *
 * O telão tem o seu próprio arquivo (`V2GameDayTelao.runtime.test.jsx`) e
 * exercita o MESMO serviço: se as duas telas divergirem, um dos dois quebra.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'dono' }, userProfile: {} };
const dados = { participants: [], games: [] };

const mutacoes = {
  gerar: vi.fn(async () => ({ court: 2 })),
  lancar: vi.fn(async () => ({})),
  editar: vi.fn(async () => ({})),
  apagar: vi.fn(async () => ({})),
  manual: vi.fn(async () => ({})),
};
const vazio = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false };
const comMutacao = (fn) => ({ ...vazio, mutate: fn, mutateAsync: fn, isPending: false });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => ({ data: dados.participants, isLoading: false }),
  useGameDayGames: () => ({ data: dados.games, isLoading: false }),
  useAddGameDayParticipant: () => vazio,
  useRemoveGameDayParticipant: () => vazio,
  useAddGameDayAdmin: () => vazio,
  useRemoveGameDayAdmin: () => vazio,
  useSetGameDayManageMode: () => vazio,
  useSetPlayParticipantSkip: () => vazio,
  useSetPlayParticipantPartner: () => vazio,
  useAddGameDayGame: () => vazio,
  useUpdateGameDayGame: () => vazio,
  useAppendGameDayGames: () => vazio,
  useClearGameDayGames: () => vazio,
  useGameDayRankingMeta: () => ({ data: null, isLoading: false }),
  usePublishGameDayRanking: () => vazio,
  useUnpublishGameDayRanking: () => vazio,
  useDeleteGameDayGame: () => comMutacao(mutacoes.apagar),
  useCreateNextAmericanoLiveGame: () => comMutacao(mutacoes.gerar),
  useSubmitAmericanoLiveResult: () => comMutacao(mutacoes.lancar),
  useUpdateAmericanoLiveResult: () => comMutacao(mutacoes.editar),
  useCreateManualAmericanoLiveGame: () => comMutacao(mutacoes.manual),
}));

const { default: AthleteAmericanoLiveOrganizer } = await import('./AthleteAmericanoLiveOrganizer.jsx');

const P = (id, name, wait) => ({
  id, name, user_id: id, photo_url: null,
  available_since: 1000 + wait, available_tie: 0, skip_remaining: 0,
});

// 8 participantes: 4 em quadra (a,b,c,d) e 4 na fila (e,f,g,h), nesta ordem.
const oito = () => [
  P('a', 'Ana', 0), P('b', 'Bia', 1), P('c', 'Caio', 2), P('d', 'Davi', 3),
  P('e', 'Elis', 4), P('f', 'Fábio', 5), P('g', 'Gabi', 6), P('h', 'Hugo', 7),
];

const emQuadra = {
  id: 'g2', court: 1, order: 2, status: 'open', created_at_ms: 2,
  side_a: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }],
  side_b: [{ id: 'c', name: 'Caio' }, { id: 'd', name: 'Davi' }],
  score_a: null, score_b: null,
};
const concluida = {
  id: 'g1', court: 1, order: 1, status: 'finished', created_at_ms: 1,
  side_a: [{ id: 'e', name: 'Elis' }, { id: 'f', name: 'Fábio' }],
  side_b: [{ id: 'g', name: 'Gabi' }, { id: 'h', name: 'Hugo' }],
  score_a: 11, score_b: 7,
};

const gameDay = {
  id: 'gd1', title: 'Americano de terça', format: 'americano_live',
  play_courts: 2, created_by: 'dono',
};

let container, root;

beforeEach(() => {
  window.localStorage.clear();
  auth.user = { uid: 'dono' };
  dados.participants = oito();
  dados.games = [concluida, emQuadra];
  Object.values(mutacoes).forEach((m) => m.mockClear());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const botao = (trecho) => [...document.body.querySelectorAll('button')]
  .find((b) => b.textContent.includes(trecho));
const digitar = (input, valor) => act(() => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, valor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

async function render() {
  await act(async () => { root.render(<AthleteAmericanoLiveOrganizer gameDay={gameDay} />); });
  // Os cards colapsáveis lembram a preferência do usuário; nos testes tudo
  // começa aberto porque o localStorage está limpo.
  await act(async () => { await Promise.resolve(); });
}

describe('painel do Americano aprimorado — as duas heranças na mesma tela', () => {
  it('mostra as seções do Play E as do Americano', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Quadras e partidas');   // Play
    expect(txt).toContain('Ordem de participação'); // Play
    expect(txt).toContain('Partidas concluídas');   // Americano
    expect(txt).toContain('Como o dia está indo');  // próprio do formato
  });

  it('a partida concluída aparece com o placar gravado', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Elis');
    expect(txt).toContain('11');
    expect(txt).toContain('7');
  });

  it('a previsão de partidas aparece com as duplas já formadas', async () => {
    await render();
    expect(container.textContent).toContain('Próximas partidas (previsão)');
    expect(container.textContent).toContain('quando liberar');
    // A previsão CONDICIONAL é a de quem volta da quadra — e mostra NOME, não
    // id: essa gente não está na fila, e já saiu id cru na tela por isso.
    expect(container.textContent).toContain('Ana · Bia · Caio · Davi');
  });
});

describe('painel do Americano aprimorado — o fluxo de dois passos', () => {
  it('a quadra ocupada oferece LANÇAR RESULTADO, não "criar próxima"', async () => {
    await render();
    expect(botao('Lançar resultado')).toBeTruthy();
    expect(botao('Criar próxima partida')).toBeUndefined();
  });

  it('⭐ lançar resultado NÃO cria a próxima partida', async () => {
    await render();
    const inputs = [...container.querySelectorAll('input')];
    // Os dois primeiros campos numéricos do card da quadra ocupada.
    const [ladoA, ladoB] = inputs.filter((i) => i.getAttribute('inputmode') === 'numeric');
    digitar(ladoA, '11');
    digitar(ladoB, '9');
    click(botao('Lançar resultado'));
    await act(async () => { await Promise.resolve(); });

    expect(mutacoes.lancar).toHaveBeenCalledWith({ gid: 'g2', scoreA: 11, scoreB: 9 });
    expect(mutacoes.gerar).not.toHaveBeenCalled();
  });

  it('sem os dois placares, lançar fica travado', async () => {
    await render();
    expect(botao('Lançar resultado').disabled).toBe(true);
    const [ladoA] = [...container.querySelectorAll('input')]
      .filter((i) => i.getAttribute('inputmode') === 'numeric');
    digitar(ladoA, '11');
    expect(botao('Lançar resultado').disabled).toBe(true);
  });

  it('a quadra LIVRE é a única que oferece o sorteio, e com a quadra certa', async () => {
    await render();
    const sortear = botao('Gerar próxima partida');
    expect(sortear).toBeTruthy();
    click(sortear);
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.gerar).toHaveBeenCalledWith({ court: 2 });
  });

  it('com a quadra livre e menos de 4 na fila, o sorteio não é oferecido', async () => {
    dados.participants = oito().slice(0, 6); // 4 em quadra, 2 na fila
    await render();
    expect(botao('Gerar próxima partida').disabled).toBe(true);
  });
});

describe('painel do Americano aprimorado — quem pode o quê', () => {
  it('quem NÃO organiza vê a tela inteira, sem nenhum comando de partida', async () => {
    auth.user = { uid: 'visitante' };
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Quadras e partidas');
    expect(txt).toContain('Partidas concluídas');
    expect(botao('Lançar resultado')).toBeUndefined();
    expect(botao('Gerar próxima partida')).toBeUndefined();
    expect(botao('Manual')).toBeUndefined();
  });

  it('quem organiza pode criar partida manual e apagar uma concluída', async () => {
    await render();
    expect(botao('Manual')).toBeTruthy();
    // O apagar pede confirmação: um clique não pode sumir com um resultado.
    const apagar = [...container.querySelectorAll('button')]
      .find((b) => b.getAttribute('title') === 'Excluir partida');
    expect(apagar).toBeTruthy();
    click(apagar);
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.apagar).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Excluir esta partida?');
  });
});

/* ---------------------------------------------------------------------------
 * "Não deve ser possível colocar em uma nova quadra um atleta que já está em
 *  uma quadra no mesmo momento."
 *
 * No sorteio isso é grátis: a fila (`computePlayOrder`) já exclui quem está
 * jogando. O caminho por onde a regra pode furar é a criação MANUAL, em que o
 * organizador escolhe os quatro na mão. A trava real está no serviço; aqui
 * provamos que a tela mostra o impedimento ANTES do clique — e que ela não
 * atrapalha o caso legítimo (lançar um jogo que já aconteceu).
 * ------------------------------------------------------------------------- */
describe('painel do Americano aprimorado — ninguém em duas quadras', () => {
  const abrirManual = async () => {
    await render();
    click(botao('Manual'));
    await act(async () => { await Promise.resolve(); });
  };
  const selects = () => [...document.body.querySelectorAll('[role="dialog"] select')];
  const escolher = (select, valor) => act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(select, valor);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const campoNumerico = (i) => [...document.body.querySelectorAll('[role="dialog"] input')]
    .filter((el) => el.getAttribute('inputmode') === 'numeric')[i];

  it('quem está em quadra aparece marcado na lista', async () => {
    await abrirManual();
    const opcoes = [...selects()[0].querySelectorAll('option')].map((o) => o.textContent);
    expect(opcoes).toContain('Ana · em quadra');
    expect(opcoes).toContain('Elis');
  });

  it('⭐ escolher alguém que está em quadra, SEM placar, trava a criação', async () => {
    await abrirManual();
    // Ana e Bia estão na quadra 1; Elis e Fábio estão na fila.
    escolher(selects()[0], 'a');
    escolher(selects()[1], 'e');
    escolher(selects()[2], 'f');
    escolher(selects()[3], 'g');
    expect(document.body.textContent).toContain('já está em quadra');
    expect(botao('Criar partida').disabled).toBe(true);
  });

  it('com PLACAR, a mesma escolha é liberada — é um jogo que já aconteceu', async () => {
    await abrirManual();
    escolher(selects()[0], 'a');
    escolher(selects()[1], 'e');
    escolher(selects()[2], 'f');
    escolher(selects()[3], 'g');
    digitar(campoNumerico(0), '11');
    digitar(campoNumerico(1), '7');
    expect(document.body.textContent).not.toContain('já está em quadra');
    expect(botao('Criar partida').disabled).toBe(false);
  });

  it('só as quadras LIVRES são oferecidas', async () => {
    await abrirManual();
    const quadra = selects()[4];
    const opcoes = [...quadra.querySelectorAll('option')].map((o) => o.textContent);
    expect(opcoes).toContain('Quadra 2');
    expect(opcoes).not.toContain('Quadra 1'); // ocupada
  });
});
