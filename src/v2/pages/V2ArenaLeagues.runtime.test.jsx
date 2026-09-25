/**
 * `/arenas/:id/torneios` — os torneios e o ranking da casa (Onda CB).
 *
 * O que estes testes protegem:
 *  1. o endereço antigo da gestão (`/gerir/torneios`) leva à Central, seção
 *     Torneios — avisos e links antigos apontam para ele;
 *  2. ⭐ com o módulo do ranking, a página mostra o ranking E os torneios;
 *     sem ele, só os torneios (que não dependem de módulo);
 *  3. ⭐ arena que não carregou é erro, não "arena não existe" (antes, a
 *     falha redirecionava para a lista de arenas).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const estado = { arena: null, arenaErro: false, ligados: new Set(), managed: [] };

vi.mock('@/core/lib/FirebaseAuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, isPlatformAdmin: false }),
}));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useArena: () => ({
    data: estado.arena, isLoading: false, isError: estado.arenaErro, refetch: vi.fn(),
  }),
  useMyManagedArenas: () => ({ data: estado.managed }),
}));
vi.mock('@/modules/arenas/hooks/useArenaModules', () => ({
  useArenaModules: () => ({ isOn: (id) => estado.ligados.has(id), isLoading: false }),
}));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({
  useArenaTournaments: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/v2/components/arenas/houseRanking/HouseRankingPanel', () => ({
  default: () => <div>PAINEL DO RANKING</div>,
}));

const { default: V2ArenaLeagues } = await import('./V2ArenaLeagues.jsx');

let container;
let root;

function Onde() {
  const loc = useLocation();
  return <div data-testid="onde">{loc.pathname}{loc.search}</div>;
}

async function render(url) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/arenas/:arenaId/torneios" element={<V2ArenaLeagues />} />
          <Route path="/arenas/:arenaId/gerir/torneios" element={<V2ArenaLeagues />} />
          <Route path="*" element={<Onde />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

beforeEach(() => {
  Object.assign(estado, { arena: { id: 'a1', name: 'Arena Sol', owner_id: 'dono' }, arenaErro: false, ligados: new Set(), managed: [] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('V2ArenaLeagues', () => {
  it('o endereço antigo da gestão leva à Central, seção Torneios', async () => {
    await render('/arenas/a1/gerir/torneios');
    expect(container.textContent).toBe('/arenas/a1/gerir?aba=torneios');
  });

  it('⭐ com o módulo, mostra o ranking da casa e os torneios da casa', async () => {
    estado.ligados.add(ARENA_MODULE_ID.LEAGUES);
    await render('/arenas/a1/torneios');
    const texto = container.textContent;
    expect(texto).toContain('Torneios e ranking da casa');
    expect(texto).toContain('PAINEL DO RANKING');
    expect(texto).toContain('Torneios da casa');
  });

  it('sem o módulo, só os torneios — eles não dependem de módulo', async () => {
    await render('/arenas/a1/torneios');
    const texto = container.textContent;
    expect(texto).not.toContain('PAINEL DO RANKING');
    expect(texto).toContain('Torneios da casa');
    expect(texto).toContain('Nenhum torneio sediado aqui por enquanto');
  });

  it('quem gere a arena vê o caminho para a Central e para criar torneio', async () => {
    estado.managed = [{ id: 'a1' }];
    await render('/arenas/a1/torneios');
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/arenas/a1/gerir?aba=torneios');
    expect(hrefs).toContain('/torneios/criar?arena=a1');
  });

  it('⭐ arena que não carregou é erro — não redireciona como se não existisse', async () => {
    estado.arena = undefined;
    estado.arenaErro = true;
    await render('/arenas/a1/torneios');
    expect(container.textContent).toContain('Não foi possível abrir os torneios da arena');
  });
});
