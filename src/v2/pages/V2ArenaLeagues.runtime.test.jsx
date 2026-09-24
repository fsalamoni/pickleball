/**
 * Torneios da casa.
 *
 * O que estes testes protegem:
 *  1. ⭐ sem o módulo, a rota não existe;
 *  2. ⭐ "Começar o torneio" cria o dia de jogo com os INSCRITOS — e só fica
 *     disponível quando dá para começar (gente + quadra + horário);
 *  3. ⭐ depois de começar, a porta é o dia de jogo;
 *  4. ⭐ o atleta consegue SAIR (antes só dava para entrar);
 *  5. ⭐ o ladder aparece e explica como se pontua;
 *  6. quem já está inscrito é mostrado — é o que faz outra pessoa entrar;
 *  7. ⭐ a gestão mora na Central: o endereço antigo leva à seção Torneios;
 *  8. 🐞 "Encerrar e pontuar" existe (o serviço existia e nenhuma tela o
 *     chamava — o ladder nunca recebia ponto);
 *  9. o torneio encerrado mostra o pódio.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = { gere: false, torneios: [], ladder: [] };
const comecar = vi.fn(() => Promise.resolve({ gameDayId: 'gd1' }));
const entrar = vi.fn(() => Promise.resolve());
const sair = vi.fn(() => Promise.resolve());

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isPlatformAdmin: false, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Teste', owner_id: estado.gere ? 'eu' : 'outro' }, isLoading: false }),
  useMyManagedArenas: () => ({ data: [] }),
  useArenaCourts: () => ({ data: [{ id: 'q1', name: 'Quadra 1' }, { id: 'q2', name: 'Quadra 2' }] }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaInternalTournaments: () => ({ data: estado.torneios, isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateTournament: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTournament: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelTournament: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTournament: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useJoinTournament: () => ({ mutateAsync: entrar, isPending: false }),
  useLeaveTournament: () => ({ mutateAsync: sair, isPending: false }),
  useStartTournament: () => ({ mutateAsync: comecar, isPending: false }),
  useArenaLadder: () => ({ data: estado.ladder, isLoading: false }),
}));

vi.mock('@/v2/components/arenas/tournaments/FinishTournamentDialog', () => ({
  default: ({ torneio }) => <div>DIÁLOGO DE ENCERRAR {torneio.name}</div>,
}));

const { default: V2ArenaLeagues } = await import('./V2ArenaLeagues.jsx');
const { useLocation } = await import('react-router-dom');

function SondaDaCentral() {
  const loc = useLocation();
  return <div>CENTRAL {loc.search}</div>;
}

const torneio = (over = {}) => ({
  id: 't1', arena_id: 'a1', name: 'Americano de sábado', date: '2099-10-03',
  start_time: '14:00', end_time: '18:00', court_ids: ['q1'],
  status: 'scheduled', game_day_id: null,
  max_participants: 16, enrolled: 2, entry_fee: 30,
  participants: ['u1', 'u2'],
  roster: [
    { user_id: 'u1', name: 'Ana' },
    { user_id: 'u2', name: 'Beto' },
  ],
  ...over,
});

let container, root;

beforeEach(() => {
  LIGADOS.clear();
  LIGADOS.add(ARENA_MODULE_ID.LEAGUES);
  comecar.mockClear(); entrar.mockClear(); sair.mockClear();
  Object.assign(estado, { gere: false, torneios: [], ladder: [] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render(rota = '/arenas/a1/torneios') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/arenas/:arenaId/torneios" element={<V2ArenaLeagues />} />
          <Route path="/arenas/:arenaId/gerir/torneios" element={<V2ArenaLeagues />} />
          <Route path="/arenas/:arenaId/gerir" element={<SondaDaCentral />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
          <Route path="/dia-de-jogo/:id" element={<div>O JOGO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

async function clicar(texto) {
  const alvo = [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
  expect(alvo, `botão "${texto}" não encontrado`).toBeTruthy();
  await act(async () => { alvo.click(); });
}

function botao(texto) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));
}

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ sem o módulo, volta para a arena', async () => {
    LIGADOS.clear();
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });

  it('com o módulo, a página abre', async () => {
    await render();
    expect(container.textContent).toContain('Torneios da casa');
  });
});

/* =============================================================== atleta === */

describe('o atleta', () => {
  it('vê o torneio, com vagas, preço e quadras', async () => {
    estado.torneios = [torneio()];
    await render();
    const texto = container.textContent;
    expect(texto).toContain('Americano de sábado');
    expect(texto).toContain('2/16');
    expect(texto).toContain('Quadra 1');
    expect(texto).toMatch(/30,00/);
  });

  it('⭐ vê QUEM já está inscrito — é o que faz outra pessoa entrar', async () => {
    estado.torneios = [torneio()];
    await render();
    expect(container.textContent).toContain('Quem já está');
    expect(container.textContent).toContain('Ana');
    expect(container.textContent).toContain('Beto');
  });

  it('se inscreve', async () => {
    estado.torneios = [torneio()];
    await render();
    await clicar('Quero jogar');
    expect(entrar).toHaveBeenCalledWith({ arenaId: 'a1', tid: 't1' });
  });

  it('⭐ quem está inscrito pode SAIR — antes só dava para entrar', async () => {
    estado.torneios = [torneio({ participants: ['eu'], roster: [{ user_id: 'eu', name: 'Eu' }] })];
    await render();
    expect(container.textContent).toContain('Você está inscrito');
    expect(botao('Sair do torneio')).toBeTruthy();
  });

  it('torneio lotado não oferece inscrição', async () => {
    estado.torneios = [torneio({ enrolled: 16, max_participants: 16 })];
    await render();
    expect(botao('Lotado')?.disabled).toBe(true);
  });

  it('inscrição gratuita é dita como gratuita, não como R$ 0,00', async () => {
    estado.torneios = [torneio({ entry_fee: 0 })];
    await render();
    expect(container.textContent).toContain('Inscrição gratuita');
  });

  it('não vê os botões de gestão', async () => {
    estado.torneios = [torneio()];
    await render();
    expect(botao('Começar o torneio')).toBeFalsy();
    expect(botao('Novo torneio')).toBeFalsy();
  });

  it('torneio cancelado sai dos ativos, e nos encerrados mostra o motivo', async () => {
    estado.torneios = [torneio({ status: 'cancelled', cancel_reason: 'Chuva' })];
    await render();
    // Cancelado não fica misturado com o que ainda vai acontecer.
    expect(container.textContent).toMatch(/Nenhum torneio marcado/i);
    await clicar('Encerrados');
    expect(container.textContent).toContain('Cancelado');
    expect(container.textContent).toContain('Chuva');
  });
});

/* ================================================================ arena === */

describe('a arena', () => {
  beforeEach(() => { estado.gere = true; });

  it('⭐ "Começar o torneio" cria o dia de jogo com os inscritos', async () => {
    estado.torneios = [torneio()];
    await render();
    await clicar('Começar o torneio');
    expect(comecar).toHaveBeenCalledTimes(1);
    const arg = comecar.mock.calls[0][0];
    expect(arg.arenaId).toBe('a1');
    expect(arg.tournament.id).toBe('t1');
    expect(arg.courts).toHaveLength(2);
  });

  it('⭐ sem inscritos suficientes, não dá para começar — e a tela diz por quê', async () => {
    estado.torneios = [torneio({ roster: [{ user_id: 'u1', name: 'Ana' }], enrolled: 1 })];
    await render();
    expect(botao('Começar o torneio')?.disabled).toBe(true);
    expect(container.textContent).toMatch(/Faltam inscritos/i);
  });

  it('⭐ sem quadra escolhida, também não — e diz o outro motivo', async () => {
    estado.torneios = [torneio({ court_ids: [] })];
    await render();
    expect(botao('Começar o torneio')?.disabled).toBe(true);
    expect(container.textContent).toMatch(/Escolha as quadras e o horário/i);
  });

  it('⭐ depois de começar, a porta é o DIA DE JOGO', async () => {
    estado.torneios = [torneio({ status: 'running', game_day_id: 'gd1' })];
    await render();
    expect(container.textContent).toContain('Abrir o jogo');
    expect(container.textContent).toContain('Em andamento');
    // Não oferece começar de novo.
    expect(botao('Começar o torneio')).toBeFalsy();
  });

  it('explica o que "Começar" faz', async () => {
    await render();
    expect(container.textContent).toMatch(/cria um dia de jogo da arena/i);
    expect(container.textContent).toMatch(/saem da venda/i);
  });

  it('torneio encerrado sai da lista de ativos', async () => {
    estado.torneios = [torneio({ status: 'finished' })];
    await render();
    expect(container.textContent).toMatch(/Nenhum torneio marcado/i);
    expect(container.textContent).toContain('Encerrados (1)');
  });

  it('⭐ o endereço antigo de gestão leva à Central, seção Torneios', async () => {
    await render('/arenas/a1/gerir/torneios');
    expect(container.textContent).toContain('CENTRAL ?aba=torneios');
  });

  it('🐞 torneio em andamento oferece "Encerrar e pontuar" (antes: não havia botão)', async () => {
    estado.torneios = [torneio({ status: 'running', game_day_id: 'gd1' })];
    await render();
    await clicar('Encerrar e pontuar');
    expect(container.textContent).toContain('DIÁLOGO DE ENCERRAR Americano de sábado');
  });

  it('o atleta NÃO vê "Encerrar"', async () => {
    estado.gere = false;
    estado.torneios = [torneio({ status: 'running', game_day_id: 'gd1' })];
    await render();
    expect(botao('Encerrar e pontuar')).toBeFalsy();
  });

  it('⭐ o torneio encerrado mostra o pódio', async () => {
    estado.torneios = [torneio({
      status: 'finished',
      final_standings: [
        { user_id: 'u2', name: 'Beto', position: 2 },
        { user_id: 'u1', name: 'Ana', position: 1 },
        { user_id: 'u9', name: 'Zé', position: null },
      ],
    })];
    await render();
    await clicar('Encerrados (1)');
    const texto = container.textContent;
    expect(texto).toContain('1º Ana');
    expect(texto).toContain('2º Beto');
    expect(texto.indexOf('1º Ana')).toBeLessThan(texto.indexOf('2º Beto'));
    expect(texto).not.toContain('Zé');
  });
});

/* =============================================================== ladder === */

describe('a classificação da casa', () => {
  beforeEach(() => LIGADOS.add(ARENA_MODULE_ID.LEAGUES_LADDER));

  it('⭐ vazia, explica como se pontua em vez de mostrar nada', async () => {
    await render();
    expect(container.textContent).toMatch(/Ninguém pontuou ainda/i);
    expect(container.textContent).toMatch(/100 pontos para o campeão/i);
  });

  it('mostra a classificação com pontos e títulos', async () => {
    estado.ladder = [
      { user_id: 'u1', name: 'Ana', points: 170, played: 2, titles: 1, ladder_position: 1 },
      { user_id: 'u2', name: 'Beto', points: 150, played: 2, titles: 1, ladder_position: 2 },
    ];
    await render();
    expect(container.textContent).toContain('Ana');
    expect(container.textContent).toContain('170');
    expect(container.textContent).toMatch(/2 torneio\(s\)/);
    expect(container.textContent).toMatch(/1 título/);
  });

  it('sem o módulo de ladder, a seção não existe', async () => {
    LIGADOS.delete(ARENA_MODULE_ID.LEAGUES_LADDER);
    estado.ladder = [{ user_id: 'u1', name: 'Ana', points: 170 }];
    await render();
    expect(container.textContent).not.toContain('Classificação da casa');
  });
});
