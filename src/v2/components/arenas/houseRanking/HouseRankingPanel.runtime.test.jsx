/**
 * O RANKING DA CASA na tela (Onda CB).
 *
 * O hook (`useHouseRanking`) roda DE VERDADE, com um QueryClient real: só as
 * leituras do banco são dubladas. É o que exercita o que importa — a soma, a
 * espera pelo que ainda não chegou e o tratamento de falha — em vez de uma
 * imitação do hook que poderia divergir dele.
 *
 * O que estes testes protegem:
 *  1. ⭐ jogo aberto + torneio da casa somam no mesmo ranking;
 *  2. ⭐ falha parcial NÃO some da conta calada: a tela diz o que ficou de fora;
 *  3. ⭐ falha das duas listas-base: erro, nunca "ninguém pontuou";
 *  4. ⭐ o vazio só é afirmado com tudo carregado, e oferece o próximo passo;
 *  5. ⭐ o torneio interno antigo encerrado não soma duas vezes (ladder + dia);
 *  6. sem saber quais dias estão no ladder, o ladder sai da conta e a tela avisa;
 *  7. a linha de quem está olhando é destacada, e a posição dele aparece no topo;
 *  8. "De onde vêm os pontos" explica a tabela e o que ainda não entrou.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ANO = new Date().getFullYear();
const DATA = `${ANO}-01-01`;

const estado = {
  uid: null,
  dias: [],
  diasErro: false,
  torneios: [],
  torneiosErro: false,
  internos: [],
  internosErro: false,
  legado: null,
  participantes: {},
  jogos: {},
  jogosErro: new Set(),
  categorias: {},
  inscricoes: {},
  partidas: {},
};

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: estado.uid ? { uid: estado.uid } : null }),
}));

const consultaFixa = (dados, erro) => ({
  data: erro ? undefined : dados,
  isLoading: false,
  isSuccess: !erro,
  isError: Boolean(erro),
  refetch: vi.fn(),
});

vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({
  useArenaGameDays: (id) => (id ? consultaFixa(estado.dias, estado.diasErro) : consultaFixa(undefined, false)),
}));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({
  useArenaTournaments: (id) => (id ? consultaFixa(estado.torneios, estado.torneiosErro) : consultaFixa(undefined, false)),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaInternalTournaments: (id) => (id ? consultaFixa(estado.internos, estado.internosErro) : consultaFixa(undefined, false)),
}));

vi.mock('@/modules/games/services/gameDayService', () => ({
  listGameDayParticipants: async (id) => estado.participantes[id] || [],
  listGameDayGames: async (id) => {
    if (estado.jogosErro.has(id)) throw new Error('rede');
    return estado.jogos[id] || [];
  },
}));
vi.mock('@/modules/tournament/services/modalityService', () => ({
  listModalities: async (tid) => estado.categorias[tid] || [],
}));
vi.mock('@/modules/tournament/services/registrationService', () => ({
  listRegistrationsByTournament: async (tid) => estado.inscricoes[tid] || [],
}));
vi.mock('@/modules/tournament/services/matchService', () => ({
  listMatchesByTournament: async (tid) => estado.partidas[tid] || [],
}));
vi.mock('@/modules/arenas/services/houseRankingService', () => ({
  getLegacyHouseLadder: async () => estado.legado,
}));

const { default: HouseRankingPanel } = await import('./HouseRankingPanel.jsx');

let container;
let root;

function clicar(texto) {
  const el = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
  if (!el) throw new Error(`botão "${texto}" não encontrado`);
  act(() => { el.click(); });
}

async function render(audience = 'public') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <HouseRankingPanel arena={{ id: 'a1', name: 'Arena' }} audience={audience} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  // As leituras por dia/torneio resolvem em microtarefas: deixa assentar.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

// ---- fixtures ------------------------------------------------------------

const P = (id, uid, name) => ({ id, user_id: uid, name });
const lado = (ids) => ids.map((id) => ({ id }));
const jogo = (a, b, sa, sb) => ({ side_a: lado(a), side_b: lado(b), score_a: sa, score_b: sb });

function comUmJogoAberto(id = 'gd1') {
  estado.dias.push({ id, title: 'Jogo aberto', date: DATA, format: 'americano', open_slot_id: 's1', status: 'active' });
  estado.participantes[id] = [P('p1', 'ana', 'Ana'), P('p2', 'bia', 'Bia'), P('p3', 'caio', 'Caio'), P('p4', 'duda', 'Duda')];
  estado.jogos[id] = [jogo(['p1', 'p2'], ['p3', 'p4'], 11, 3)];
}

function comUmTorneio() {
  estado.torneios.push({ id: 't1', name: 'Open da Casa', status: 'finished', visibility: 'public', starts_at: DATA });
  estado.categorias.t1 = [{ id: 'm1', name: 'Duplas', stages: [{ type: 'knockout' }] }];
  estado.inscricoes.t1 = [
    { id: 'r1', player_a_user_id: 'caio', player_a_name: 'Caio' },
    { id: 'r2', player_a_user_id: 'edu', player_a_name: 'Edu' },
  ];
  estado.partidas.t1 = [{
    id: 'x1', modality_id: 'm1', stage_index: 0, round: 1, side_a_ids: ['r1'], side_b_ids: ['r2'],
    winner_side: 'a', status: 'finished', games: [{ a: 11, b: 4 }],
  }];
}

beforeEach(() => {
  Object.assign(estado, {
    uid: null, dias: [], diasErro: false, torneios: [], torneiosErro: false, internos: [], internosErro: false,
    legado: null, participantes: {}, jogos: {}, jogosErro: new Set(), categorias: {}, inscricoes: {}, partidas: {},
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// ---- testes --------------------------------------------------------------

describe('⭐ a soma', () => {
  it('jogo aberto e torneio da casa entram no mesmo ranking', async () => {
    comUmJogoAberto();
    comUmTorneio();
    await render();
    const texto = container.textContent;
    // Caio: 3º no jogo aberto (50) + campeão do torneio (200) = 250 — lidera.
    expect(texto).toContain('Caio');
    const podio = container.querySelector('[aria-label="Pódio da temporada"]');
    expect(podio.textContent.indexOf('Caio')).toBeLessThan(podio.textContent.indexOf('Ana'));
    expect(podio.textContent).toContain('250');
    expect(texto).not.toContain('Ninguém pontuou');
  });
});

describe('⭐ falha não é vazio', () => {
  it('um dia que não carregou fica de fora — e a tela DIZ isso', async () => {
    comUmJogoAberto('gd1');
    comUmJogoAberto('gd2');
    estado.dias[1].title = 'Jogo de sábado';
    estado.jogosErro.add('gd2');
    await render();
    const texto = container.textContent;
    expect(texto).toContain('Parte dos resultados não carregou');
    expect(texto).toContain('Jogo de sábado');
    expect(texto).toContain('Ana');
  });

  it('as duas listas-base falharam: erro, nunca "ninguém pontuou"', async () => {
    estado.diasErro = true;
    estado.torneiosErro = true;
    await render();
    const texto = container.textContent;
    expect(texto).toContain('Não foi possível montar o ranking da casa');
    expect(texto).not.toContain('Ninguém pontuou');
  });

  it('só a lista de torneios falhou: mostra os jogos e avisa dos torneios', async () => {
    comUmJogoAberto();
    estado.torneiosErro = true;
    await render();
    const texto = container.textContent;
    expect(texto).toContain('Ficou de fora: Os torneios da casa');
    expect(texto).toContain('Ana');
  });
});

describe('⭐ o vazio honesto', () => {
  it('com tudo carregado e nada pontuado, diz isso — e oferece o próximo passo à arena', async () => {
    await render('arena');
    const texto = container.textContent;
    expect(texto).toContain(`Ninguém pontuou em ${ANO} ainda`);
    expect(texto).toContain('Publicar um jogo aberto');
    expect(texto).toContain('Criar torneio aqui');
  });

  it('para o atleta, o próximo passo é entrar num jogo aberto', async () => {
    await render('public');
    expect(container.textContent).toContain('Ver os jogos abertos');
    expect(container.textContent).not.toContain('Publicar um jogo aberto');
  });
});

describe('⭐ o torneio interno antigo não soma duas vezes', () => {
  it('dia de jogo de torneio interno ENCERRADO: vale o ladder, não o placar de novo', async () => {
    comUmJogoAberto('gd1');
    estado.internos = [{ id: 'it1', status: 'finished', game_day_id: 'gd1' }];
    estado.legado = { rankings: [{ user_id: 'ana', name: 'Ana', points: 100, played: 1, wins: 1, titles: 1 }], updated_at: DATA };
    await render();
    const podio = container.querySelector('[aria-label="Pódio da temporada"]');
    // Só o ladder: Ana 100. Somando o dia de novo daria 200.
    expect(podio.textContent).toContain('100');
    expect(podio.textContent).not.toContain('200');
    expect(podio.textContent).not.toContain('Bia');
  });

  it('sem saber quais dias estão no ladder, o ladder sai da conta e a tela avisa', async () => {
    comUmJogoAberto('gd1');
    estado.internosErro = true;
    estado.legado = { rankings: [{ user_id: 'ana', name: 'Ana', points: 100 }], updated_at: DATA };
    await render();
    const texto = container.textContent;
    expect(texto).toContain('Os torneios internos antigos');
    const podio = container.querySelector('[aria-label="Pódio da temporada"]');
    expect(podio.textContent).toContain('100'); // o dia, pelo placar (1º = 100)
    expect(podio.textContent).toContain('Bia');
  });
});

describe('quem está olhando', () => {
  it('a própria linha é destacada, e a posição aparece no topo quando está fora do pódio', async () => {
    comUmJogoAberto();
    // Um quinto atleta e um segundo jogo: Duda termina em 5º, fora do pódio.
    estado.participantes.gd1.push(P('p5', 'edu', 'Edu'));
    estado.jogos.gd1.push(jogo(['p5', 'p4'], ['p1', 'p3'], 0, 11));
    estado.uid = 'duda';
    await render();
    const texto = container.textContent;
    expect(texto).toContain('Você está em 5º');
    expect(texto).toContain('você');
  });
});

describe('de onde vêm os pontos', () => {
  it('explica a tabela e lista o que ainda não entrou (Play não pontua)', async () => {
    comUmJogoAberto();
    estado.dias.push({ id: 'pl', title: 'Play de domingo', date: DATA, format: 'play', status: 'active' });
    await render();
    clicar('De onde vêm os pontos');
    const texto = container.textContent;
    expect(texto).toContain('vale 2×');
    expect(texto).toContain('Play de domingo');
    expect(texto).toContain('Play não tem placar');
  });
});
