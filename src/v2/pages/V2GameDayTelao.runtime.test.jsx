/**
 * Teste de RUNTIME do telão do dia de jogo.
 *
 * O telão fica horas aberto numa TV, sem ninguém olhando o console — se
 * quebrar, quebra na cara de todo mundo. Estes testes montam a página de
 * verdade nos quatro cenários que ela precisa aguentar: grade, Play, dia vazio
 * e dia inexistente.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const dados = { gameDay: null, participants: [], games: [] };

vi.mock('@/modules/games/services/gameDayService', () => ({
  getGameDay: vi.fn(async () => dados.gameDay),
  listGameDayParticipants: vi.fn(async () => dados.participants),
  listGameDayGames: vi.fn(async () => dados.games),
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
      participante('e', 'Elis'),
    ];
    dados.games = [{
      id: 'g1', court: 1, order: 1, status: 'open', round: null,
      side_a: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }],
      side_b: [{ id: 'c', name: 'Caio' }, { id: 'd', name: 'Davi' }],
      score_a: null, score_b: null,
    }];
  });

  it('troca "próximos jogos" pela ordem de participação', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Ordem de participação');
    expect(txt).not.toContain('Próximos jogos');
  });

  it('mostra quem está em quadra e quem está na fila', async () => {
    await render();
    const txt = container.textContent;
    expect(txt).toContain('QUADRA 1');
    expect(txt).toContain('Elis');            // na fila
    expect(txt).toContain('Em quadra:');      // resumo de quem está jogando
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
