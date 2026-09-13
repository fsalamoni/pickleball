/**
 * Jogos abertos, na visão do ATLETA.
 *
 * O que estes testes protegem:
 *  1. ⭐ módulo desligado: a rota não existe (volta para a arena);
 *  2. ⭐ a data sai em PORTUGUÊS — `2026-07-23 · 19:00` era o que aparecia;
 *  3. ⭐ o nível é dito nos DOIS lados, e fora da faixa não dá para entrar;
 *  4. ⭐ sem nível conhecido a peneira NÃO barra — a plataforma não inventa nível;
 *  5. lotado oferece a fila; e quem já está na fila não vê o convite de novo;
 *  6. ⭐ quem foi CHAMADO da fila tem onde confirmar (antes a notificação
 *     apontava para `/minha-fila`, rota que nunca existiu);
 *  7. ⭐ falha de leitura não vira "nenhum jogo aberto".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const estado = {
  moduloOn: true,
  slots: [],
  fila: [],
  nivel: 3.5,
  carregando: false,
  erro: false,
};
const chamou = { entrar: [], sair: [], fila: [], aceitar: [], recusar: [] };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'eu' }, isAuthenticated: true }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({ data: { id: 'a1', name: 'Arena Teste' }, isLoading: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({
    isOn: (id) => estado.moduloOn && id === ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH,
    isLoading: false,
  }),
}));
vi.mock('@/modules/rating/hooks/useMyUnifiedLevel', () => ({
  useMyUnifiedLevel: () => ({ level: estado.nivel, source: 'dupr_official', isLoading: false }),
}));
const mut = (bucket) => ({
  mutateAsync: async (arg) => { chamou[bucket].push(arg); },
  isPending: false,
});
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaOpenSlots: () => ({
    data: estado.slots, isLoading: estado.carregando, isError: estado.erro, refetch: vi.fn(),
  }),
  useUserWaitlist: () => ({ data: estado.fila }),
  useJoinOpenSlot: () => mut('entrar'),
  useLeaveOpenSlot: () => mut('sair'),
  useJoinWaitlist: () => mut('fila'),
  useLeaveWaitlist: () => mut('fila'),
  useAcceptWaitlist: () => mut('aceitar'),
  useDeclineWaitlist: () => mut('recusar'),
}));

const { default: V2ArenaOpenMatch } = await import('./V2ArenaOpenMatch.jsx');

let container, root;

// Data bem no futuro, para as inscrições nunca estarem encerradas.
const vaga = (over = {}) => ({
  id: 'v1', arena_id: 'a1', date: '2099-07-23', start: '19:00', end: '21:00',
  total_spots: 4, participants: [], status: 'open', format: 'duplas',
  court: 'Quadra 1', ...over,
});

beforeEach(() => {
  estado.moduloOn = true;
  estado.slots = [vaga()];
  estado.fila = [];
  estado.nivel = 3.5;
  estado.carregando = false;
  estado.erro = false;
  chamou.entrar = []; chamou.sair = []; chamou.fila = [];
  chamou.aceitar = []; chamou.recusar = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

async function render() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/arenas/a1/open-match']}>
        <Routes>
          <Route path="/arenas/:arenaId/open-match" element={<V2ArenaOpenMatch />} />
          <Route path="/arenas/:arenaId" element={<div>PÁGINA DA ARENA</div>} />
          <Route path="/arenas" element={<div>DIRETÓRIO</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

const botao = (texto) => [...container.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);

/* ================================================================ guarda === */

describe('quem entra aqui', () => {
  it('⭐ módulo desligado: volta para a página da arena', async () => {
    estado.moduloOn = false;
    await render();
    expect(container.textContent).toContain('PÁGINA DA ARENA');
  });
});

/* ================================================================== data === */

describe('⭐ a data sai em português', () => {
  it('mostra dia da semana e dd/mm, não a ISO crua', async () => {
    await render();
    expect(container.textContent).toContain('23/07');
    expect(container.textContent).toContain('19:00–21:00');
    expect(container.textContent).not.toContain('2099-07-23');
  });
});

/* ================================================================= nível === */

describe('⭐ o nível é dito dos dois lados', () => {
  it('mostra a faixa da vaga E o nível de quem olha', async () => {
    estado.slots = [vaga({ min_level: 3, max_level: 4 })];
    await render();
    expect(container.textContent).toContain('3.0 a 4.0');
    expect(container.textContent).toContain('3.5');
  });

  it('fora da faixa: não dá para entrar', async () => {
    estado.nivel = 5;
    estado.slots = [vaga({ min_level: 3, max_level: 4 })];
    await render();
    expect(botao('Quero jogar')?.disabled).toBe(true);
    expect(container.textContent).toMatch(/fora da faixa/i);
  });

  it('dentro da faixa: entra', async () => {
    estado.slots = [vaga({ min_level: 3, max_level: 4 })];
    await render();
    await act(async () => botao('Quero jogar')?.click());
    expect(chamou.entrar).toEqual(['v1']);
  });

  it('⭐ sem nível conhecido, a peneira NÃO barra', async () => {
    estado.nivel = null;
    estado.slots = [vaga({ min_level: 4, max_level: 5 })];
    await render();
    expect(botao('Quero jogar')?.disabled).toBe(false);
    expect(container.textContent).toMatch(/ainda não temos o seu nível/i);
  });

  it('vaga sem faixa não fala de nível', async () => {
    await render();
    expect(container.textContent).not.toMatch(/Nível/);
  });
});

/* ============================================================== inscrição === */

describe('entrar e sair', () => {
  it('quem já está dentro vê o destaque e o botão de sair', async () => {
    estado.slots = [vaga({ participants: ['eu'] })];
    await render();
    expect(container.textContent).toContain('Você está dentro');
    await act(async () => botao('Sair deste jogo')?.click());
    expect(chamou.sair).toEqual(['v1']);
  });

  it('separa "você vai jogar" dos outros jogos', async () => {
    estado.slots = [vaga({ participants: ['eu'] }), vaga({ id: 'v2' })];
    await render();
    expect(container.textContent).toContain('Você vai jogar');
    expect(container.textContent).toContain('Outros jogos');
  });
});

/* =================================================================== fila === */

describe('fila de espera', () => {
  const lotada = () => vaga({ total_spots: 2, participants: ['a', 'b'], status: 'full' });

  it('lotado oferece a fila no mesmo lugar', async () => {
    estado.slots = [lotada()];
    await render();
    expect(container.textContent).toContain('Lotado');
    await act(async () => botao('Entrar na fila de espera')?.click());
    expect(chamou.fila).toEqual(['v1']);
  });

  it('quem já está na fila não recebe o convite de novo', async () => {
    estado.slots = [lotada()];
    estado.fila = [{ id: 'w1', slot_id: 'v1', status: 'waiting' }];
    await render();
    expect(botao('Entrar na fila de espera')).toBeUndefined();
    expect(container.textContent).toContain('Você está na fila de espera');
  });

  it('⭐ quem foi CHAMADO tem onde confirmar', async () => {
    estado.slots = [lotada()];
    estado.fila = [{ id: 'w1', slot_id: 'v1', status: 'notified' }];
    await render();
    expect(container.textContent).toContain('Vagou um lugar para você');
    await act(async () => botao('Confirmar minha vaga')?.click());
    expect(chamou.aceitar).toEqual(['v1']);
  });

  it('e pode recusar, liberando para o próximo', async () => {
    estado.slots = [lotada()];
    estado.fila = [{ id: 'w1', slot_id: 'v1', status: 'notified' }];
    await render();
    await act(async () => botao('Não vou poder')?.click());
    expect(chamou.recusar).toEqual(['v1']);
  });

  it('chamada de OUTRA arena não aparece aqui', async () => {
    estado.slots = [lotada()];
    estado.fila = [{ id: 'w9', slot_id: 'de-outra-arena', status: 'notified' }];
    await render();
    expect(container.textContent).not.toContain('Vagou um lugar para você');
  });
});

/* =============================================================== estados === */

describe('vazio, carregando e falhando', () => {
  it('sem jogos, explica e oferece a arena', async () => {
    estado.slots = [];
    await render();
    expect(container.textContent).toContain('Nenhum jogo aberto agora');
  });

  it('⭐ falha NÃO vira "nenhum jogo aberto"', async () => {
    estado.erro = true;
    await render();
    expect(container.textContent).toMatch(/não foi possível carregar/i);
    expect(container.textContent).toMatch(/tentar de novo/i);
    expect(container.textContent).not.toContain('Nenhum jogo aberto agora');
  });

  it('enquanto carrega, não afirma que não há jogos', async () => {
    estado.carregando = true;
    estado.slots = [];
    await render();
    expect(container.textContent).not.toContain('Nenhum jogo aberto agora');
  });

  it('jogo cancelado não aparece', async () => {
    estado.slots = [vaga({ status: 'cancelled' })];
    await render();
    expect(container.textContent).toContain('Nenhum jogo aberto agora');
  });
});
