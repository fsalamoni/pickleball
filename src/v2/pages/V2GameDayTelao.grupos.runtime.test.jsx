/**
 * O telão do Play COM grupos (flag `play_groups`).
 *
 * O telão é a tela que a sala inteira olha. Com grupos, ele precisa dizer três
 * coisas que antes não existiam: de que grupo é cada partida, quem entra a
 * seguir EM CADA grupo e — quando nenhum grupo tem partida pronta — que o
 * problema não é falta de gente. E com a flag desligada nada disso aparece,
 * mesmo que o dia tenha grupos gravados (a flag é o interruptor geral).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const dados = { gameDay: null, participants: [], games: [] };
const auth = { user: { uid: 'dono' } };
const flags = { play_groups: true };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: (k) => !!flags[k] }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useMyManagedArenas: () => ({ data: [] }) }));
vi.mock('@/modules/games/services/gameDayService', () => ({
  getGameDay: vi.fn(async () => dados.gameDay),
  listGameDayParticipants: vi.fn(async () => dados.participants),
  listGameDayGames: vi.fn(async () => dados.games),
}));

const mutacoes = {
  criarProximo: vi.fn(async () => ({ court: 1 })),
  sortearRodada: vi.fn(async () => ({ created: [{ court: 1 }, { court: 2 }], courts: [1, 2] })),
};
const nada = { mutateAsync: vi.fn(async () => ({})) };
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useCreateNextPlayGame: () => ({ mutateAsync: (...a) => mutacoes.criarProximo(...a) }),
  useCreatePlayRound: () => ({ mutateAsync: (...a) => mutacoes.sortearRodada(...a) }),
  useFinishPlayGame: () => nada,
  useCancelPlayGame: () => nada,
  useNoShowSwapPlayGame: () => nada,
  useSetPlayParticipantSkip: () => nada,
  useSetPlayParticipantPartner: () => nada,
  useCreateNextAmericanoLiveGame: () => nada,
  useCreateAmericanoLiveRound: () => nada,
  useSubmitAmericanoLiveResult: () => nada,
}));

const { default: V2GameDayTelao } = await import('./V2GameDayTelao.jsx');

let container, root, qc;

/** Sem `user_id` de propósito: o nível vem de `level_value` e nenhuma consulta de nível sai. */
const P = (id, name, extra = {}) => ({
  id, name, available_since: 1, available_tie: 0.1, ...extra,
});

const GRUPOS = [
  { id: 'alfa', name: 'Alfa', color: 'rose', level_min: 2, level_max: 3.5 },
  { id: 'beta', name: 'Beta', color: 'sky', level_min: 3.5, level_max: 8 },
];

/** Quatro de nível baixo (Alfa) e quatro de nível alto (Beta). */
const oito = () => [
  P('a', 'Ana', { level_value: 2.5 }), P('b', 'Bia', { level_value: 2.8 }),
  P('c', 'Caio', { level_value: 3 }), P('d', 'Davi', { level_value: 3.2 }),
  P('e', 'Elis Prado', { level_value: 5 }), P('f', 'Fábio Reis', { level_value: 5.2 }),
  P('g', 'Gabi Martins', { level_value: 5.5 }), P('h', 'Hugo Teixeira', { level_value: 6 }),
].map((p) => ({ ...p, play_group_id: Number(p.level_value) <= 3.5 ? 'alfa' : 'beta' }));

beforeEach(() => {
  flags.play_groups = true;
  auth.user = { uid: 'dono' };
  dados.gameDay = {
    id: 'gd1', title: 'Play por nível', format: 'play', play_courts: 2, created_by: 'dono',
    play_groups: GRUPOS, play_groups_policy: 'queue',
  };
  dados.participants = oito();
  dados.games = [];
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
  for (let i = 0; i < 20 && container.textContent.includes('Carregando'); i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
  }
}

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const botaoPorTexto = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);
const fila = (nome) => container.querySelector(`section[aria-label="Fila do grupo ${nome}"]`);

describe('telão do Play — com grupos', () => {
  it('⭐ a previsão diz de que grupo é cada quadra, e quem entra nela', async () => {
    await render();
    const txt = container.textContent;
    // Duas quadras livres: cada uma recebe o grupo que a política escolheria,
    // com os quatro daquele grupo — nunca uma mistura de Alfa com Beta.
    expect(txt).toContain('Ana · Bia · Caio · Davi');
    expect(txt).toContain('Elis Prado · Fábio Reis · Gabi Martins · Hugo Teixeira');
    expect(txt).toContain('Alfa');
    expect(txt).toContain('Beta');
    expect(txt).not.toContain('Nenhum grupo tem partida pronta');
  });

  it('⭐ a fila vira uma por grupo, cada uma com a sua numeração', async () => {
    await render();
    const alfa = fila('Alfa');
    const beta = fila('Beta');
    expect(alfa).toBeTruthy();
    expect(beta).toBeTruthy();
    expect(alfa.textContent).toContain('Ana');
    expect(alfa.textContent).not.toContain('Elis Prado');
    expect(beta.textContent).toContain('Elis Prado');
    // O primeiro de cada fila é o "1" dele — o número é a posição NO GRUPO.
    const numeros = (sec) => [...sec.querySelectorAll('span.font-display')].map((n) => n.textContent.trim());
    expect(numeros(alfa)[0]).toBe('1');
    expect(numeros(beta)[0]).toBe('1');
  });

  it('a partida em quadra leva o selo do grupo em que foi sorteada', async () => {
    dados.games = [{
      id: 'g1', court: 1, order: 1, status: 'open', round: null,
      group_id: 'alfa', group_name: 'Alfa', group_color: 'rose',
      side_a: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bia' }],
      side_b: [{ id: 'c', name: 'Caio' }, { id: 'd', name: 'Davi' }],
      score_a: null, score_b: null,
    }];
    await render();
    const quadra1 = [...container.querySelectorAll('div')]
      .find((d) => d.className.includes('border-acid/30') && d.textContent.includes('QUADRA 1'));
    expect(quadra1).toBeTruthy();
    expect(quadra1.querySelector('[title="Grupo Alfa"]')).toBeTruthy();
  });

  it('⭐ COM grupos, "entra a seguir" é quem a previsão põe em quadra — não os quatro primeiros da lista', async () => {
    await render();
    // As duas quadras estão livres: oito pessoas "entram a seguir".
    expect(container.textContent.match(/entra a seguir/gi)).toHaveLength(8);
  });

  it('⭐ sem partida pronta em NENHUM grupo, o telão não culpa a falta de gente', async () => {
    // Beta exige dupla mista, e ninguém do dia tem sexo informado.
    dados.gameDay = {
      ...dados.gameDay,
      play_groups: [
        { id: 'alfa', name: 'Alfa', color: 'rose', level_min: 2, level_max: 3.5, formation: 'mixed', strict: true },
        { id: 'beta', name: 'Beta', color: 'sky', level_min: 3.5, level_max: 8, formation: 'mixed', strict: true },
      ],
    };
    await render();
    const txt = container.textContent;
    expect(txt).toContain('Nenhum grupo tem partida pronta ainda (8 na fila).');
    expect(txt).not.toContain('Faltam jogadores');
    expect(txt).not.toContain('entra a seguir');
  });

  it('⭐ "Criar jogo" numa quadra livre fica travado quando nenhum grupo tem partida, e diz por quê', async () => {
    dados.gameDay = {
      ...dados.gameDay,
      play_groups: [
        { id: 'alfa', name: 'Alfa', color: 'rose', level_min: 2, level_max: 3.5, formation: 'mixed', strict: true },
        { id: 'beta', name: 'Beta', color: 'sky', level_min: 3.5, level_max: 8, formation: 'mixed', strict: true },
      ],
    };
    await render();
    const criar = [...container.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Criar jogo');
    expect(criar.length).toBe(2);
    criar.forEach((b) => {
      expect(b.disabled).toBe(true);
      expect(b.title).toBe('Nenhum grupo tem partida pronta para esta quadra');
    });
    expect(botaoPorTexto('Sortear todas as quadras')).toBeUndefined();
  });

  it('com partida pronta nos grupos, "Criar jogo" e "Sortear todas as quadras" aparecem para quem organiza', async () => {
    await render();
    const criar = [...container.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Criar jogo');
    expect(criar.length).toBe(2);
    expect(criar.every((b) => !b.disabled)).toBe(true);
    expect(botaoPorTexto('Sortear todas as quadras')).toBeTruthy();
    click(botaoPorTexto('Sortear todas as quadras'));
    await act(async () => { await Promise.resolve(); });
    expect(mutacoes.sortearRodada).toHaveBeenCalled();
  });

  it('quem NÃO organiza vê os grupos, mas nenhum comando', async () => {
    auth.user = { uid: 'espectador' };
    await render();
    expect(fila('Alfa')).toBeTruthy();
    expect(container.textContent).toContain('Beta');
    expect(botaoPorTexto('Criar jogo')).toBeUndefined();
    expect(botaoPorTexto('Sortear todas as quadras')).toBeUndefined();
  });

  it('⭐ com a flag DESLIGADA o telão é o de sempre, mesmo com grupos gravados no dia', async () => {
    flags.play_groups = false;
    await render();
    const txt = container.textContent;
    expect(fila('Alfa')).toBeNull();
    expect(container.querySelector('[title^="Grupo "]')).toBeNull();
    // Uma fila só: a previsão volta a pôr os quatro primeiros na quadra livre.
    expect(txt).toContain('Ana · Bia · Caio · Davi');
    expect(txt).not.toContain('Nenhum grupo tem partida pronta');
  });
});
