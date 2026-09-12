/**
 * Dia de jogo no ambiente da ARENA.
 *
 * O que estes testes protegem:
 *  1. ⭐ a flag desligada manda para a página pública da arena — a rota não
 *     existe para ninguém;
 *  2. ⭐ quem NÃO gerencia a arena não entra, mesmo sabendo a URL;
 *  3. a lista separa o que ainda vai acontecer do que já aconteceu;
 *  4. ⭐ um dia de jogo de OUTRA arena não abre por aqui (o id vem da URL, e
 *     URL é palpite de qualquer um);
 *  5. o cartão mostra o número que a arena mais olha: quantos se inscreveram.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const flags = { on: true };
const auth = { user: { uid: 'gestor-1' }, userProfile: {}, isPlatformAdmin: false };
const estado = { arena: null, geridas: [], dias: [], participantes: [], gameDay: null };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flags.on }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: estado.arena, isLoading: false }),
  useMyManagedArenas: () => ({ data: estado.geridas }),
  useArenaCourts: () => ({ data: [] }),
}));
vi.mock('@/modules/arenas/hooks/useBookings', () => ({ useArenaBookings: () => ({ data: [] }) }));
vi.mock('@/modules/games/hooks/useArenaGameDays', () => ({
  useArenaGameDays: () => ({ data: estado.dias, isLoading: false }),
  useArchiveArenaGameDay: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLeaveArenaGameDay: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateArenaGameDay: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateArenaGameDay: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDay: () => ({ data: estado.gameDay, isLoading: false }),
  useGameDayParticipants: () => ({ data: estado.participantes }),
}));
// Os organizadores são o miolo COMPARTILHADO com o ambiente do atleta e já têm
// testes próprios; aqui interessa o enquadramento da arena em volta deles.
vi.mock('@/v2/components/games/AthleteGameDayOrganizer', () => ({ default: () => <div>ORGANIZADOR</div> }));
vi.mock('@/v2/components/games/AthletePlayOrganizer', () => ({ default: () => <div>ORGANIZADOR PLAY</div> }));
vi.mock('@/v2/components/games/AthleteAmericanoLiveOrganizer', () => ({ default: () => <div>ORGANIZADOR AO VIVO</div> }));
vi.mock('@/v2/components/games/GameDayAdminsCard', () => ({ default: () => <div>ADMINS</div> }));
vi.mock('@/v2/components/tutorial/V2TutorialLauncher', () => ({ default: () => null }));

const { default: V2ArenaGameDays } = await import('./V2ArenaGameDays.jsx');

let container, root;

const slot = (id) => ({
  court_id: id, court_name: `Quadra ${id}`, start_time: '18:00', end_time: '22:00', capacity: null,
});
const dia = (over = {}) => ({
  id: 'gd1', arena_id: 'a1', title: 'Sexta de Americano', date: '2099-10-02',
  status: 'active', format: 'americano', signup_mode: 'day', capacity: null,
  created_by: 'gestor-1', member_uids: ['gestor-1'],
  arena_slots: [slot('c1')], ...over,
});

beforeEach(() => {
  flags.on = true;
  auth.user = { uid: 'gestor-1' };
  auth.isPlatformAdmin = false;
  estado.arena = { id: 'a1', name: 'Arena Teste', owner_id: 'gestor-1' };
  estado.geridas = [{ id: 'a1' }];
  estado.dias = [dia()];
  estado.participantes = [];
  estado.gameDay = dia();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render(url = '/arenas/a1/gerir/dia-de-jogo') {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/arenas/:arenaId/gerir/dia-de-jogo" element={<V2ArenaGameDays />} />
          <Route path="/arenas/:arenaId/gerir/dia-de-jogo/:gameDayId" element={<V2ArenaGameDays />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA PÚBLICA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

const botao = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);

/* =============================================================== guardas === */

describe('quem entra aqui', () => {
  it('⭐ flag desligada: vai para a página pública da arena', async () => {
    flags.on = false;
    await render();
    expect(container.textContent).toContain('PÁGINA PÚBLICA');
  });

  it('⭐ quem não gerencia a arena não entra, nem sabendo a URL', async () => {
    auth.user = { uid: 'curioso' };
    estado.geridas = [];
    estado.arena = { id: 'a1', name: 'Arena Teste', owner_id: 'outro' };
    await render();
    expect(container.textContent).toContain('PÁGINA PÚBLICA');
  });

  it('o dono da arena entra', async () => {
    await render();
    expect(container.textContent).toContain('Dia de jogo da arena');
  });

  it('um gestor que não é dono também entra', async () => {
    auth.user = { uid: 'gestor-2' };
    estado.arena = { id: 'a1', name: 'Arena Teste', owner_id: 'gestor-1' };
    estado.geridas = [{ id: 'a1' }];
    await render();
    expect(container.textContent).toContain('Dia de jogo da arena');
  });

  it('arena inexistente vai para o diretório', async () => {
    estado.arena = null;
    await render();
    expect(container.textContent).toContain('DIRETÓRIO');
  });
});

/* ================================================================= lista === */

describe('a lista da arena', () => {
  it('mostra o dia de jogo com data, horário e quadras', async () => {
    await render();
    expect(container.textContent).toContain('Sexta de Americano');
    expect(container.textContent).toContain('2099-10-02');
    expect(container.textContent).toContain('18:00–22:00');
  });

  it('⭐ mostra quantos se inscreveram', async () => {
    estado.participantes = [{ user_id: 'a' }, { user_id: 'b' }];
    await render();
    expect(container.textContent).toContain('2 inscrito(s)');
  });

  it('mostra o limite quando existe, e "lotado" quando enche', async () => {
    estado.dias = [dia({ capacity: 2 })];
    estado.participantes = [{ user_id: 'a' }, { user_id: 'b' }];
    await render();
    expect(container.textContent).toContain('2/2 inscrito(s)');
    expect(container.textContent).toContain('Lotado');
  });

  it('separa o que já aconteceu', async () => {
    estado.dias = [dia(), dia({ id: 'gd0', title: 'Play de ontem', date: '2020-01-01' })];
    await render();
    expect(container.textContent).toContain('Já aconteceram (1)');
    expect(container.textContent).toContain('Play de ontem');
  });

  it('sem nenhum dia marcado, explica o que vai acontecer ao marcar', async () => {
    estado.dias = [];
    await render();
    expect(container.textContent).toContain('Nenhum dia de jogo marcado');
    expect(container.textContent).toContain('fecha essas quadras');
  });

  it('oferece criar', async () => {
    await render();
    expect(botao('Novo dia de jogo')).toBeTruthy();
  });
});

/* =============================================================== detalhe === */

describe('conduzir um dia de jogo pela arena', () => {
  it('abre com o organizador compartilhado', async () => {
    await render('/arenas/a1/gerir/dia-de-jogo/gd1');
    expect(container.textContent).toContain('Sexta de Americano');
    expect(container.textContent).toContain('ORGANIZADOR');
  });

  it('⭐ dia de jogo de OUTRA arena não abre por aqui', async () => {
    estado.gameDay = dia({ arena_id: 'outra-arena' });
    await render('/arenas/a1/gerir/dia-de-jogo/gd1');
    expect(container.textContent).toContain('Dia de jogo não encontrado');
    expect(container.textContent).not.toContain('ORGANIZADOR');
  });

  it('avisa que as quadras estão fechadas no calendário', async () => {
    await render('/arenas/a1/gerir/dia-de-jogo/gd1');
    expect(container.textContent).toContain('fechadas para reserva');
  });

  it('arquivado: diz que as quadras foram liberadas e não oferece editar', async () => {
    estado.gameDay = dia({ status: 'archived' });
    await render('/arenas/a1/gerir/dia-de-jogo/gd1');
    expect(container.textContent).toContain('foram liberadas');
    expect(botao('Editar')).toBeFalsy();
  });

  it('lista os inscritos e a quadra de cada um quando é por quadra', async () => {
    estado.gameDay = dia({
      signup_mode: 'court',
      arena_slots: [slot('c1'), slot('c2')],
    });
    estado.participantes = [{ id: 'p1', user_id: 'u1', name: 'Ana', arena_court_id: 'c2' }];
    await render('/arenas/a1/gerir/dia-de-jogo/gd1');
    expect(container.textContent).toContain('Ana');
    expect(container.textContent).toContain('Quadra c2');
  });

  it('⭐ gestor que NÃO criou o dia mesmo assim edita e conduz', async () => {
    // A arena é a dona do evento. Se o poder ficasse com quem clicou em criar,
    // o dia de jogo ficaria órfão quando essa pessoa saísse da equipe.
    auth.user = { uid: 'gestor-2' };
    estado.geridas = [{ id: 'a1' }];
    estado.gameDay = dia({ created_by: 'gestor-1' });
    await render('/arenas/a1/gerir/dia-de-jogo/gd1');
    expect(botao('Editar')).toBeTruthy();
    expect(container.textContent).toContain('ORGANIZADOR');
  });

  it('sem inscritos, diz que o dia já está visível para os atletas', async () => {
    await render('/arenas/a1/gerir/dia-de-jogo/gd1');
    expect(container.textContent).toContain('Ninguém marcou presença ainda');
  });
});
