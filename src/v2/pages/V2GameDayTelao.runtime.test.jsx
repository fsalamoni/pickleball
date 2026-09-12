/**
 * Teste de RUNTIME do telão do dia de jogo.
 *
 * O telão fica horas aberto numa TV, sem ninguém olhando o console — se
 * quebrar, quebra na cara de todo mundo. Estes testes montam a página de
 * verdade nos cenários que ela precisa aguentar: grade, Play, Americano
 * aprimorado, dia vazio e dia inexistente.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const dados = { gameDay: null, participants: [], games: [] };
const auth = { user: { uid: 'espectador' } };

const arenasGeridas = [];
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
// `useGameDayRoles` pergunta quais arenas esta pessoa gerencia (é o que dá
// poder num dia de jogo de ARENA). Aqui ela não gerencia nenhuma — é o caso
// que estes testes cobrem, o dia de jogo do atleta.
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useMyManagedArenas: () => ({ data: arenasGeridas }) }));

vi.mock('@/modules/games/services/gameDayService', () => ({
  getGameDay: vi.fn(async () => dados.gameDay),
  listGameDayParticipants: vi.fn(async () => dados.participants),
  listGameDayGames: vi.fn(async () => dados.games),
}));

/** As mutações do Play — espionadas para provar quem pode disparar o quê. */
const mutacoes = {
  criarProximo: vi.fn(async () => ({ court: 1 })),
  encerrar: vi.fn(async () => ({ next: { court: 1 } })),
  cancelar: vi.fn(async () => ({})),
  substituir: vi.fn(async () => ({})),
  pausar: vi.fn(async () => ({})),
  dupla: vi.fn(async () => ({})),
  gerarAoVivo: vi.fn(async () => ({ court: 2 })),
  lancarResultado: vi.fn(async () => ({})),
};
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useCreateNextPlayGame: () => ({ mutateAsync: (...a) => mutacoes.criarProximo(...a) }),
  useFinishPlayGame: () => ({ mutateAsync: (...a) => mutacoes.encerrar(...a) }),
  useCancelPlayGame: () => ({ mutateAsync: (...a) => mutacoes.cancelar(...a) }),
  useNoShowSwapPlayGame: () => ({ mutateAsync: (...a) => mutacoes.substituir(...a) }),
  useSetPlayParticipantSkip: () => ({ mutateAsync: (...a) => mutacoes.pausar(...a) }),
  useSetPlayParticipantPartner: () => ({ mutateAsync: (...a) => mutacoes.dupla(...a) }),
  useCreateNextAmericanoLiveGame: () => ({ mutateAsync: (...a) => mutacoes.gerarAoVivo(...a) }),
  useSubmitAmericanoLiveResult: () => ({ mutateAsync: (...a) => mutacoes.lancarResultado(...a) }),
}));

const { default: V2GameDayTelao } = await import('./V2GameDayTelao.jsx');

let container, root, qc;

const participante = (id, name) => ({ id, name, user_id: `u-${id}`, available_since: 1, available_tie: 0.1 });

const jogoGrade = (id, round, court, a = null, b = null) => ({
  id, round, court, order: round * 10 + court,
  side_a: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bia' }],
  side_b: [{ id: 'p3', name: 'Caio' }, { id: 'p4', name: 'Davi' }],
  score_a: a, score_b: b,
});

beforeEach(() => {
  dados.gameDay = null; dados.participants = []; dados.games = [];
  auth.user = { uid: 'espectador' };
  Object.values(mutacoes).forEach((m) => m.mockClear());
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  vi.clearAllMocks();
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

async function render() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/dia-de-jogo/gd1/telao']}>
          <Routes>
            <Route path="/dia-de-jogo/:gameDayId/telao" element={<V2GameDayTelao />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  // As três consultas resolvem em microtarefas separadas; um único flush não
  // basta. Gira até a página sair do estado de carregamento.
  for (let i = 0; i < 20 && container.textContent.includes('Carregando'); i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
  }
}

describe('telão — formatos de grade', () => {
  beforeEach(() => {
    dados.gameDay = { id: 'gd1', title: 'Quinta no Parque', format: 'americano' };
    dados.participants = [participante('a', 'Ana'), participante('b', 'Bia')];
    dados.games = [
      jogoGrade('g1', 1, 1, 11, 7),
      jogoGrade('g2', 2, 1),
      jogoGrade('g3', 3, 1),
    ];
  });

  it('mostra título, formato e os três blocos', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Quinta no Parque');
    expect(txt).toContain('Americano');
    expect(txt).toContain('Em quadra agora');
    expect(txt).toContain('Próximos jogos');
    expect(txt).toContain('Últimos resultados');
  });

  it('mostra o placar do jogo já decidido, um número por dupla', async () => {
    await render();
    // O resultado sai como uma linha por lado (11 numa, 7 na outra), e o
    // vencedor fica destacado — não como um "11 × 7" corrido.
    const placares = [...container.querySelectorAll('span.tabular-nums')].map((el) => el.textContent.trim());
    expect(placares).toContain('11');
    expect(placares).toContain('7');
    const vencedor = [...container.querySelectorAll('span.tabular-nums')]
      .find((el) => el.textContent.trim() === '11');
    expect(vencedor.className).toContain('text-acid');
  });

  it('mostra o ranking do dia quando já há resultado', async () => {
    await render();
    expect(container.textContent).toContain('Ranking do dia');
  });

  it('NÃO mostra a ordem de participação (é conceito do Play)', async () => {
    await render();
    expect(container.textContent).not.toContain('Ordem de participação');
  });
});

describe('telão — formato Play', () => {
  beforeEach(() => {
    dados.gameDay = { id: 'gd1', title: 'Play de sábado', format: 'play', play_courts: 2 };
    dados.participants = [
      participante('a', 'Ana'), participante('b', 'Bia'),
      participante('c', 'Caio'), participante('d', 'Davi'),
      participante('e', 'Elis Prado'), participante('f', 'Fábio Reis'),
      participante('g', 'Gabi Martins'), participante('h', 'Hugo Teixeira'),
    ];
    dados.games = [{
      id: 'g1', court: 1, order: 1, status: 'open', round: null,
      side_a: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }],
      side_b: [{ id: 'c', name: 'Caio' }, { id: 'd', name: 'Davi' }],
      score_a: null, score_b: null,
    }];
  });

  it('mostra próximos jogos E ordem de participação', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Próximos jogos');
    expect(txt).toContain('Ordem de participação');
  });

  it('NÃO mostra resultados nem ranking — o Play não grava placar', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).not.toContain('Últimos resultados');
    expect(txt).not.toContain('Ranking do dia');
  });

  it('mostra a próxima partida DE CADA QUADRA, e a fila vai para a que está livre', async () => {
    await render();
    const txt = container.textContent;
    // Quadra 1 está ocupada; a 2 está livre → os 4 da fila vão para a 2.
    expect(txt).toContain('livre agora');
    expect(txt).toContain('Elis Prado · Fábio Reis · Gabi Martins · Hugo Teixeira');
    // A quadra ocupada aparece assim mesmo, dizendo que só recebe ao liberar.
    expect(txt).toContain('quando liberar');
    expect(txt).toContain('As duplas são formadas na hora de criar o jogo.');
  });

  it('a quadra livre aparece como card, não some da tela', async () => {
    await render();
    expect(container.textContent).toContain('QUADRA 2');
    expect(container.textContent).toContain('Livre');
  });

  it('com menos de 4 na fila, diz quantos faltam em vez de anunciar a partida', async () => {
    dados.participants = dados.participants.slice(0, 6); // 4 em quadra + 2 livres
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Elis Prado · Fábio Reis');
    expect(txt).toContain('faltam 2');
  });

  it('sem ninguém na fila, avisa em vez de mostrar bloco vazio', async () => {
    dados.participants = dados.participants.slice(0, 4); // os 4 estão em quadra
    await render();
    expect(container.textContent).toContain('Ninguém aguardando no momento.');
  });
});

describe('telão do Play — organizar pela própria tela', () => {
  beforeEach(() => {
    dados.gameDay = { id: 'gd1', title: 'Play de sábado', format: 'play', play_courts: 2, created_by: 'dono' };
    dados.participants = [
      participante('a', 'Ana'), participante('b', 'Bia'),
      participante('c', 'Caio'), participante('d', 'Davi'),
      participante('e', 'Elis Prado'), participante('f', 'Fábio Reis'),
      participante('g', 'Gabi Martins'), participante('h', 'Hugo Teixeira'),
    ];
    dados.games = [{
      id: 'g1', court: 1, order: 1, status: 'open', round: null,
      side_a: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }],
      side_b: [{ id: 'c', name: 'Caio' }, { id: 'd', name: 'Davi' }],
      score_a: null, score_b: null,
    }];
  });

  const botaoPorTexto = (texto) => [...container.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === texto);
  // Diálogos renderizam em portal, fora do `container`: procure no documento.
  const botaoDoDialogo = (trecho) => [...document.body.querySelectorAll('button')]
    .find((b) => b.textContent.includes(trecho));

  it('quem NÃO organiza vê a tela sem nenhuma ação', async () => {
    auth.user = { uid: 'espectador' };
    await render();
    expect(botaoPorTexto('Criar próxima partida')).toBeUndefined();
    expect(botaoPorTexto('Criar jogo')).toBeUndefined();
    expect(botaoPorTexto('Cancelar')).toBeUndefined();
    expect(container.textContent).toContain('Esta tela se atualiza sozinha');
  });

  it('quem organiza vê as ações de cada quadra', async () => {
    auth.user = { uid: 'dono' };
    await render();
    expect(botaoPorTexto('Criar próxima partida')).toBeTruthy();
    expect(botaoPorTexto('Criar jogo')).toBeTruthy();   // quadra 2 está livre
    expect(botaoPorTexto('Cancelar')).toBeTruthy();
    expect(container.textContent).toContain('Você organiza este Play');
  });

  it('criar jogo numa quadra livre chama a mutação com aquela quadra', async () => {
    auth.user = { uid: 'dono' };
    await render();
    click(botaoPorTexto('Criar jogo'));
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.criarProximo).toHaveBeenCalledWith({ court: 2 });
  });

  it('criar a próxima partida pede confirmação antes de encerrar', async () => {
    auth.user = { uid: 'dono' };
    await render();
    click(botaoPorTexto('Criar próxima partida'));
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.encerrar).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Criar a próxima partida?');
  });

  it('⭐ clicar no nome em quadra OFERECE ESCOLHA — não executa nada direto', async () => {
    auth.user = { uid: 'dono' };
    await render();
    const nome = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ana');
    expect(nome).toBeTruthy();
    click(nome);
    await act(async () => { await Promise.resolve(); });
    // O clique abre as DUAS opções...
    expect(document.body.textContent).toContain('Indisponível para esta partida');
    expect(document.body.textContent).toContain('Substituir por outro jogador');
    // ...e, principalmente, NÃO substituiu ninguém ainda.
    expect(mutacoes.substituir).not.toHaveBeenCalled();
  });

  it('⭐ "indisponível para esta partida" traz o próximo da ordem (sem escolher)', async () => {
    auth.user = { uid: 'dono' };
    await render();
    click([...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ana'));
    await act(async () => { await Promise.resolve(); });
    // A opção já ANUNCIA quem entra, para não haver surpresa.
    expect(document.body.textContent).toContain('Elis Prado');
    click(botaoDoDialogo('Indisponível para esta partida'));
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.substituir).toHaveBeenCalledWith(
      expect.objectContaining({ absentId: 'a', replacementId: null }),
    );
  });

  it('⭐ "substituir por outro" deixa ESCOLHER quem entra, na ordem de participação', async () => {
    auth.user = { uid: 'dono' };
    await render();
    click([...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ana'));
    await act(async () => { await Promise.resolve(); });
    click(botaoDoDialogo('Substituir por outro jogador'));
    await act(async () => { await Promise.resolve(); });
    // Ainda não gravou nada: escolher a opção só abre a lista.
    expect(mutacoes.substituir).not.toHaveBeenCalled();
    // A lista traz os disponíveis, numerados pela ordem de participação.
    const texto = document.body.textContent;
    ['Elis Prado', 'Fábio Reis', 'Gabi Martins', 'Hugo Teixeira'].forEach((n) => {
      expect(texto).toContain(n);
    });
    // Escolhe o TERCEIRO da fila — de propósito, para provar que entra quem foi
    // escolhido e não o primeiro.
    // A linha mais interna que tem o nome E o botão de entrada é a dele.
    const linhas = [...document.body.querySelectorAll('div')].filter((d) => (
      d.textContent.includes('Gabi Martins')
      && [...d.querySelectorAll('button')].some((b) => b.textContent.includes('Entra'))
    ));
    expect(linhas.length).toBeGreaterThan(0);
    const entrar = [...linhas[linhas.length - 1].querySelectorAll('button')]
      .find((b) => b.textContent.includes('Entra'));
    expect(entrar).toBeTruthy();
    click(entrar);
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.substituir).toHaveBeenCalledWith(
      expect.objectContaining({ absentId: 'a', replacementId: 'g' }),
    );
  });

  it('para quem não organiza, o nome em quadra NÃO é clicável', async () => {
    auth.user = { uid: 'espectador' };
    await render();
    const nome = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ana');
    expect(nome).toBeUndefined();
  });

  it('clicar num atleta da fila abre as ações de pausa e dupla', async () => {
    auth.user = { uid: 'dono' };
    await render();
    const linha = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Elis Prado') && b.textContent.includes('entra a seguir'));
    expect(linha).toBeTruthy();
    click(linha);
    await act(async () => { await Promise.resolve(); });
    const txt = document.body.textContent;
    expect(txt).toContain('Ficar indisponível por X jogos');
    expect(txt).toContain('Vincular dupla');
  });

  it('mostra quem está em quadra e quem está na fila', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('QUADRA 1');
    expect(txt).toContain('Elis Prado');      // na fila
    expect(txt).toContain('Em quadra:');      // resumo de quem está jogando
  });
});

/* ---------------------------------------------------------------------------
 * AMERICANO APRIMORADO
 *
 * O terceiro caso do telão, e o mais fácil de errar: os jogos gravam `status`
 * como o Play E placar como a grade. Se o painel o confundir com o Play,
 * esconde resultado e ranking; se o confundir com a grade, some com a fila e
 * com as quadras. Estes testes prendem os dois lados.
 *
 * E prendem o fluxo de DOIS PASSOS que dá nome ao formato: lançar o resultado
 * NÃO cria a próxima partida — a quadra fica livre e só então oferece o
 * sorteio. Um clique só, como no Play, seria outra coisa.
 * ------------------------------------------------------------------------- */
describe('telão — Americano aprimorado', () => {
  const oitoParticipantes = () => [
    participante('a', 'Ana'), participante('b', 'Bia'),
    participante('c', 'Caio'), participante('d', 'Davi'),
    participante('e', 'Elis Prado'), participante('f', 'Fábio Reis'),
    participante('g', 'Gabi Martins'), participante('h', 'Hugo Teixeira'),
  ];

  beforeEach(() => {
    dados.gameDay = {
      id: 'gd1', title: 'Americano de terça', format: 'americano_live',
      play_courts: 2, created_by: 'dono',
    };
    dados.participants = oitoParticipantes();
    dados.games = [
      {
        id: 'g1', court: 1, order: 1, status: 'finished', created_at_ms: 1,
        side_a: [{ id: 'e', name: 'Elis Prado' }, { id: 'f', name: 'Fábio Reis' }],
        side_b: [{ id: 'g', name: 'Gabi Martins' }, { id: 'h', name: 'Hugo Teixeira' }],
        score_a: 11, score_b: 7,
      },
      {
        id: 'g2', court: 1, order: 2, status: 'open', created_at_ms: 2,
        side_a: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }],
        side_b: [{ id: 'c', name: 'Caio' }, { id: 'd', name: 'Davi' }],
        score_a: null, score_b: null,
      },
    ];
  });

  const botaoPorTexto = (texto) => [...container.querySelectorAll('button')]
    .find((b) => b.textContent.trim() === texto);
  const dialogo = () => document.body.querySelector('[role="dialog"]');
  const botaoDoDialogo = (trecho) => [...(dialogo()?.querySelectorAll('button') || [])]
    .find((b) => b.textContent.includes(trecho));
  // V2Input é controlado pelo React: mexer em `.value` direto não dispara o
  // onChange. É preciso passar pelo setter nativo antes de emitir o evento.
  const digitar = (input, valor) => act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  it('mostra o rótulo do formato e TODOS os blocos: quadra, previsão, fila, concluídas e ranking', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Americano aprimorado');
    expect(txt).toContain('Em quadra agora');
    expect(txt).toContain('Próximos jogos');
    expect(txt).toContain('Ordem de participação'); // herança do Play
    expect(txt).toContain('Partidas concluídas');   // herança do Americano
    expect(txt).toContain('Ranking do dia');        // herança do Americano
  });

  it('a partida concluída aparece COM placar — este formato grava resultado', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('11');
    expect(txt).toContain('7');
    expect(txt).toContain('Elis Prado · Fábio Reis');
  });

  it('a partida EM ANDAMENTO não mostra placar nenhum', async () => {
    await render();
    // O card da quadra 1 traz os quatro nomes, mas nada de "0 × 0" nem "11 × 7":
    // o placar só nasce quando o organizador lança o resultado.
    const txt = container.textContent;
    expect(txt).toContain('QUADRA 1');
    expect(txt).not.toContain('×');
  });

  it('a previsão traz as DUPLAS já formadas, e diz que podem mudar', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('As duplas abaixo são as que o sorteio formaria agora.');
    expect(txt).toContain('livre agora');   // quadra 2
    expect(txt).toContain('quando liberar'); // quadra 1, ocupada
    // Os quatro da fila entram na quadra livre — o pareamento é sorteado, então
    // provamos QUEM entra, não de que lado.
    ['Elis Prado', 'Fábio Reis', 'Gabi Martins', 'Hugo Teixeira']
      .forEach((n) => expect(txt).toContain(n));
    // A previsão CONDICIONAL é a de quem volta da quadra 1 — e precisa sair
    // com NOME. Quem está jogando não está na fila, e já saiu id cru por isso.
    expect(txt).toContain('Ana');
    expect(txt).not.toMatch(/·\s*a\s*·/); // nada de "a · b · c · d"
  });

  it('quem NÃO organiza vê a tela inteira, sem nenhuma ação', async () => {
    auth.user = { uid: 'espectador' };
    await render();
    expect(botaoPorTexto('Lançar resultado')).toBeUndefined();
    expect(botaoPorTexto('Gerar próxima partida')).toBeUndefined();
    expect(botaoPorTexto('Cancelar')).toBeUndefined();
    expect(container.textContent).toContain('Esta tela se atualiza sozinha');
  });

  it('quem organiza vê "Lançar resultado" na quadra ocupada e "Gerar próxima partida" na livre', async () => {
    auth.user = { uid: 'dono' };
    await render();
    expect(botaoPorTexto('Lançar resultado')).toBeTruthy();
    expect(botaoPorTexto('Gerar próxima partida')).toBeTruthy();
    // O botão do Play — que encerra E cria de uma vez — NÃO existe aqui.
    expect(botaoPorTexto('Criar próxima partida')).toBeUndefined();
    expect(botaoPorTexto('Criar jogo')).toBeUndefined();
    expect(container.textContent).toContain('lance o resultado da quadra para liberá-la');
  });

  it('gerar próxima partida chama o sorteio DO FORMATO, com a quadra livre', async () => {
    auth.user = { uid: 'dono' };
    await render();
    click(botaoPorTexto('Gerar próxima partida'));
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.gerarAoVivo).toHaveBeenCalledWith({ court: 2 });
    // Nunca o sorteio do Play: os dois formatos têm motores diferentes.
    expect(mutacoes.criarProximo).not.toHaveBeenCalled();
  });

  it('⭐ "Lançar resultado" ABRE o placar — não salva nada direto', async () => {
    auth.user = { uid: 'dono' };
    await render();
    click(botaoPorTexto('Lançar resultado'));
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.lancarResultado).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Lançar resultado — quadra 1');
    // O diálogo identifica cada lado pelos nomes: trocar A por B falsearia o
    // ranking do dia inteiro.
    expect(dialogo().textContent).toContain('Ana · Bia');
    expect(dialogo().textContent).toContain('Caio · Davi');
  });

  it('sem os dois placares, salvar fica travado', async () => {
    auth.user = { uid: 'dono' };
    await render();
    click(botaoPorTexto('Lançar resultado'));
    await act(async () => { await Promise.resolve(); });
    expect(botaoDoDialogo('Salvar resultado').disabled).toBe(true);

    const [campoA] = dialogo().querySelectorAll('input');
    digitar(campoA, '11');
    expect(botaoDoDialogo('Salvar resultado').disabled).toBe(true); // falta o B
  });

  it('com os dois placares, salvar manda o resultado da partida certa', async () => {
    auth.user = { uid: 'dono' };
    await render();
    click(botaoPorTexto('Lançar resultado'));
    await act(async () => { await Promise.resolve(); });

    const [campoA, campoB] = dialogo().querySelectorAll('input');
    digitar(campoA, '11');
    digitar(campoB, '9');
    click(botaoDoDialogo('Salvar resultado'));
    await act(async () => { await Promise.resolve(); });

    expect(mutacoes.lancarResultado).toHaveBeenCalledWith({ gid: 'g2', scoreA: 11, scoreB: 9 });
    // Dois passos: lançar o resultado NÃO cria a próxima partida.
    expect(mutacoes.gerarAoVivo).not.toHaveBeenCalled();
  });

  it('clicar num nome em quadra oferece a mesma escolha do Play', async () => {
    auth.user = { uid: 'dono' };
    await render();
    const nome = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ana');
    expect(nome).toBeTruthy();
    click(nome);
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.substituir).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Ana');
  });

  it('sem partida nenhuma, a tela se monta com as duas quadras livres', async () => {
    dados.games = [];
    auth.user = { uid: 'dono' };
    await render();
    const txt = container.textContent;
    expect(txt).toContain('QUADRA 1');
    expect(txt).toContain('QUADRA 2');
    expect(txt).toContain('Nenhuma partida concluída ainda.');
    expect(txt).not.toContain('Ranking do dia'); // ninguém jogou ainda
  });
});

describe('telão — casos de borda', () => {
  it('dia de jogo sem nenhum jogo não quebra', async () => {
    dados.gameDay = { id: 'gd1', title: 'Ainda vazio', format: 'americano' };
    await render();
    expect(container.textContent).toContain('Ainda vazio');
    expect(container.textContent).toContain('Os jogos ainda não foram sorteados.');
  });

  it('dia de jogo inexistente mostra recado, não tela em branco', async () => {
    dados.gameDay = null;
    await render();
    expect(container.textContent).toContain('Dia de jogo não encontrado');
  });

  it('jogo com lado vazio ainda renderiza', async () => {
    dados.gameDay = { id: 'gd1', title: 'X', format: 'americano' };
    dados.games = [{ id: 'g1', round: 1, court: 1, order: 1, side_a: [], side_b: null, score_a: null, score_b: null }];
    await render();
    expect(container.textContent).toContain('A definir');
  });
});
