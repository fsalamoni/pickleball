/**
 * Jogo aberto DENTRO da arena — as quatro telas que passaram a mostrá-lo.
 *
 * O que protege:
 *  1. ⭐ página da arena: módulos desligados, a seção não existe; ligados, o
 *     jogo com vaga aparece e se entra ALI MESMO;
 *  2. ⭐ a chamada da fila (que tem prazo) vem antes de tudo, com o botão de
 *     confirmar;
 *  3. ⭐ falha de leitura NÃO some com a seção — vira aviso com "tentar de
 *     novo" (sumir seria dizer que não há jogo);
 *  4. só o buscar parceiro ligado: a seção vira a porta para ele;
 *  5. ⭐ Central: a arena vê QUEM vem jogar e quem está na fila;
 *  6. ⭐ Minhas reservas: a chamada e os jogos de todas as arenas;
 *  7. a rota antiga de gestão leva à aba da Central.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const LIGADOS = new Set();
const estado = {
  slots: [], slotsErro: false, fila: [], meus: [], meusErro: false, filaArena: [], atletas: [],
  porId: [],
};
const entrar = vi.fn(() => Promise.resolve());
const aceitar = vi.fn(() => Promise.resolve());
const refetch = vi.fn();
const mut = (fn = vi.fn(() => Promise.resolve())) => ({ mutateAsync: fn, isPending: false });

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' }, isAuthenticated: true }) }));
vi.mock('@/modules/rating/hooks/useMyUnifiedLevel', () => ({ useMyUnifiedLevel: () => ({ level: 3.5 }) }));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => LIGADOS.has(id), isLoading: false }),
}));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: estado.atletas }) }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useArenaCourts: () => ({ data: [{ id: 'q1', name: 'Quadra 1' }] }) }));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaOpenSlots: (arenaId) => ({
    data: arenaId ? (estado.slotsErro ? undefined : estado.slots) : undefined,
    isLoading: false, isError: Boolean(arenaId) && estado.slotsErro, refetch,
  }),
  useUserWaitlist: () => ({ data: estado.fila }),
  useMyOpenSlots: () => ({ data: estado.meusErro ? undefined : estado.meus, isError: estado.meusErro, refetch }),
  useOpenSlotsByIds: () => ({ slots: estado.porId, isLoading: false }),
  useArenaWaitlist: () => ({ data: estado.filaArena }),
  useJoinOpenSlot: () => mut(entrar),
  useLeaveOpenSlot: () => mut(),
  useJoinWaitlist: () => mut(),
  useLeaveWaitlist: () => mut(),
  useAcceptWaitlist: () => mut(aceitar),
  useDeclineWaitlist: () => mut(),
  useCreateOpenSlot: () => mut(),
  useCancelOpenSlot: () => mut(),
  useDeleteOpenSlot: () => mut(),
}));

const { default: ArenaOpenMatchSection } = await import('./ArenaOpenMatchSection.jsx');
const { default: ArenaOpenMatchAdminPanel } = await import('./ArenaOpenMatchAdminPanel.jsx');
const { default: MyOpenMatches } = await import('./MyOpenMatches.jsx');
const { default: V2ArenaAdminOpenMatch } = await import('@/v2/pages/V2ArenaAdminOpenMatch.jsx');

const ARENA = { id: 'a1', name: 'Arena Teste' };
// Datas no futuro distante: o teste não depende do dia em que roda.
const vaga = (id, over = {}) => ({
  id, arena_id: 'a1', arena_name: 'Arena Teste', date: '2099-05-10', start: '19:00', end: '21:00',
  court: 'Quadra 1', court_id: 'q1', total_spots: 4, participants: [], status: 'open', ...over,
});

let container;
let root;
beforeEach(() => {
  LIGADOS.clear();
  entrar.mockClear();
  aceitar.mockClear();
  Object.assign(estado, {
    slots: [], slotsErro: false, fila: [], meus: [], meusErro: false, filaArena: [], atletas: [], porId: [],
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async (el, rota = '/arenas/a1') => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/arenas/:arenaId" element={el} />
          <Route path="/arenas/:arenaId/gerir/open-match" element={el} />
          <Route path="/arenas/:arenaId/gerir" element={<div>CENTRAL</div>} />
          <Route path="/minhas-reservas" element={el} />
        </Routes>
      </MemoryRouter>,
    );
  });
};
const botao = (texto) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(texto));

describe('a seção na página da arena', () => {
  it('⭐ módulos desligados: não existe', async () => {
    estado.slots = [vaga('s1')];
    await render(<ArenaOpenMatchSection arena={ARENA} />);
    expect(container.textContent).toBe('');
  });

  it('⭐ jogo com vaga aparece e se entra ali mesmo', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH);
    estado.slots = [vaga('s1')];
    await render(<ArenaOpenMatchSection arena={ARENA} />);
    expect(container.textContent).toContain('Jogos abertos');
    expect(container.textContent).toContain('4 vagas');
    await act(async () => { botao('Quero jogar').click(); });
    expect(entrar).toHaveBeenCalledWith('s1');
    expect(container.querySelector('a[href="/arenas/a1/open-match"]')).toBeTruthy();
  });

  it('⭐ a chamada da fila vem antes de tudo, com o botão de confirmar', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH);
    estado.slots = [vaga('s1', { participants: ['a', 'b', 'c'] })];
    estado.fila = [{ id: 'w1', slot_id: 's1', status: 'notified' }];
    await render(<ArenaOpenMatchSection arena={ARENA} />);
    expect(container.textContent).toContain('Vagou um lugar para você');
    const texto = container.textContent;
    expect(texto.indexOf('Vagou um lugar')).toBeLessThan(texto.indexOf('Com vaga'));
    await act(async () => { botao('Confirmar minha vaga').click(); });
    expect(aceitar).toHaveBeenCalledWith('s1');
  });

  it('⭐ falha de leitura vira aviso, não some', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH);
    estado.slotsErro = true;
    await render(<ArenaOpenMatchSection arena={ARENA} />);
    expect(container.textContent).toContain('Não foi possível carregar os jogos abertos');
    await act(async () => { botao('Tentar de novo').click(); });
    expect(refetch).toHaveBeenCalled();
  });

  it('sem jogo e sem buscar parceiro: a seção não ocupa a página', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH);
    await render(<ArenaOpenMatchSection arena={ARENA} />);
    expect(container.textContent).toBe('');
  });

  it('só o buscar parceiro ligado: a seção é a porta para ele', async () => {
    LIGADOS.add(ARENA_MODULE_ID.MATCHMAKING_PARTNER_FINDER);
    await render(<ArenaOpenMatchSection arena={ARENA} />);
    expect(container.textContent).toContain('Parceiros para jogar aqui');
    expect(container.querySelector('a[href="/arenas/a1/matchmaking"]')).toBeTruthy();
  });
});

describe('a aba na Central', () => {
  it('⭐ a arena vê QUEM vem jogar e quem está na fila', async () => {
    estado.slots = [vaga('s1', { participants: ['u1', 'u2'] })];
    estado.atletas = [{ id: 'u1', platform_name: 'Ana' }];
    estado.filaArena = [
      { slot_id: 's1', status: 'waiting', athlete_name: 'Bia' },
      { slot_id: 's1', status: 'notified', athlete_name: 'Caio' },
    ];
    await render(<ArenaOpenMatchAdminPanel arena={ARENA} />);
    expect(container.textContent).toContain('Quem vem');
    expect(container.textContent).toContain('Ana');
    expect(container.textContent).toContain('Atleta'); // quem não está no diretório
    expect(container.textContent).toContain('Fila de espera: 1');
    expect(container.textContent).toContain('Chamado agora: Caio');
  });

  it('a rota antiga de gestão leva à aba da Central', async () => {
    await render(<V2ArenaAdminOpenMatch />, '/arenas/a1/gerir/open-match');
    expect(container.textContent).toBe('CENTRAL');
  });
});

describe('Minhas reservas', () => {
  it('⭐ mostra a chamada e os jogos de todas as arenas', async () => {
    estado.meus = [vaga('meu', { participants: ['eu'], arena_name: 'Arena Norte' })];
    estado.fila = [{ id: 'w1', slot_id: 's9', status: 'notified' }];
    estado.porId = [vaga('s9', { arena_name: 'Arena Sul' })];
    await render(<MyOpenMatches />, '/minhas-reservas');
    expect(container.textContent).toContain('Vagou um lugar para você');
    expect(container.textContent).toContain('Arena Sul');
    expect(container.textContent).toContain('Arena Norte');
    expect(container.textContent).toContain('Você está dentro');
  });

  it('⭐ falha de leitura vira aviso (sumir seria dizer que não há jogo marcado)', async () => {
    estado.meusErro = true;
    await render(<MyOpenMatches />, '/minhas-reservas');
    expect(container.textContent).toContain('Não foi possível carregar os seus jogos abertos');
  });

  it('nada em jogo aberto: a seção não aparece', async () => {
    await render(<MyOpenMatches />, '/minhas-reservas');
    expect(container.textContent).toBe('');
  });
});
