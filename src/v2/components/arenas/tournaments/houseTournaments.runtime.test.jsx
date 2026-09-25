/**
 * Os TORNEIOS DA CASA na tela (Onda CB): a seção da página da arena, a aba da
 * Central e o aviso dos torneios internos antigos.
 *
 * O que estes testes protegem:
 *  1. ⭐ torneio da casa = torneio da PLATAFORMA sediado aqui, na ordem de quem
 *     olha (rolando → próximos → encerrados); rascunho só para a arena;
 *  2. ⭐ falha diz que falhou — nunca some calada nem afirma "nenhum";
 *  3. ⭐ torneio interno antigo ainda aberto NÃO some calado: a arena vê e
 *     encerra avisando os inscritos; o que já virou dia de jogo leva a ele.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = {
  torneios: [],
  torneiosErro: false,
  internos: [],
  internosErro: false,
  cancelou: [],
};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({
  useArenaTournaments: () => ({
    data: estado.torneiosErro ? undefined : estado.torneios,
    isLoading: false,
    isError: estado.torneiosErro,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({
  useArenaInternalTournaments: () => ({
    data: estado.internosErro ? undefined : estado.internos,
    isLoading: false,
    isError: estado.internosErro,
    refetch: vi.fn(),
  }),
  useCancelTournament: () => ({
    mutateAsync: async (args) => { estado.cancelou.push(args); },
    isPending: false,
  }),
}));

const { default: HouseTournamentsSection } = await import('./HouseTournamentsSection.jsx');
const { default: ArenaPlatformTournamentsTab } = await import('./ArenaPlatformTournamentsTab.jsx');
const { default: LegacyInternalTournamentsNotice } = await import('./LegacyInternalTournamentsNotice.jsx');

let container;
let root;

async function render(el) {
  await act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); });
}

beforeEach(() => {
  Object.assign(estado, { torneios: [], torneiosErro: false, internos: [], internosErro: false, cancelou: [] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const T = (id, status, starts_at, extra = {}) => ({ id, name: `Torneio ${id}`, status, starts_at, ...extra });

describe('⭐ a seção "Torneios da casa" da página da arena', () => {
  it('mostra os torneios da plataforma sediados aqui, rolando primeiro, sem rascunho', async () => {
    estado.torneios = [
      T('fim', 'finished', '2026-01-10'),
      T('rolando', 'in_progress', '2026-09-20'),
      T('rascunho', 'draft', '2026-12-01'),
    ];
    await render(<HouseTournamentsSection arenaId="a1" />);
    const texto = container.textContent;
    expect(texto).toContain('Torneios da casa');
    expect(texto).toContain('regras da plataforma');
    expect(texto.indexOf('Torneio rolando')).toBeLessThan(texto.indexOf('Torneio fim'));
    expect(texto).not.toContain('Torneio rascunho');
    expect(texto).toContain('Em andamento');
  });

  it('sem torneio nenhum, a seção não aparece (a página é da arena, não um convite)', async () => {
    await render(<HouseTournamentsSection arenaId="a1" />);
    expect(container.textContent).toBe('');
  });

  it('⭐ falhando, diz que falhou — com como tentar de novo', async () => {
    estado.torneiosErro = true;
    await render(<HouseTournamentsSection arenaId="a1" />);
    expect(container.textContent).toContain('Não foi possível carregar os torneios da casa');
    expect(container.textContent).toContain('Tentar de novo');
  });
});

describe('⭐ a aba "Torneios da casa" da Central', () => {
  it('a arena vê também o rascunho, e cria torneio já com a arena escolhida', async () => {
    estado.torneios = [T('rascunho', 'draft', '2026-12-01'), T('aberto', 'registrations_open', '2026-10-01')];
    await render(<ArenaPlatformTournamentsTab arena={{ id: 'a1' }} />);
    const texto = container.textContent;
    expect(texto).toContain('Torneio rascunho');
    expect(texto).toContain('Rascunho');
    const criar = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Criar torneio aqui'));
    expect(criar.getAttribute('href')).toBe('/torneios/criar?arena=a1');
  });

  it('⭐ falhando, é erro — não "nenhum torneio sediado aqui"', async () => {
    estado.torneiosErro = true;
    await render(<ArenaPlatformTournamentsTab arena={{ id: 'a1' }} />);
    expect(container.textContent).toContain('Não foi possível carregar os torneios');
    expect(container.textContent).not.toContain('Nenhum torneio sediado aqui');
  });
});

describe('⭐ os torneios internos antigos', () => {
  it('um antigo ainda aberto aparece, e a arena encerra AVISANDO os inscritos', async () => {
    estado.internos = [{ id: 'it1', name: 'Rei da casa', status: 'scheduled', date: '2026-10-05', enrolled: 6 }];
    await render(<LegacyInternalTournamentsNotice arena={{ id: 'a1' }} />);
    expect(container.textContent).toContain('Torneios internos no formato antigo');
    expect(container.textContent).toContain('Rei da casa');
    const botao = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Cancelar e avisar os inscritos'));
    await act(async () => { botao.click(); });
    expect(estado.cancelou).toHaveLength(1);
    expect(estado.cancelou[0].tid).toBe('it1');
    expect(estado.cancelou[0].motivo).toMatch(/torneios da plataforma/);
  });

  it('o que já virou dia de jogo leva ao dia de jogo (que conta sozinho no ranking)', async () => {
    estado.internos = [{ id: 'it2', name: 'Copa', status: 'running', game_day_id: 'gd9' }];
    await render(<LegacyInternalTournamentsNotice arena={{ id: 'a1' }} />);
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent.includes('Abrir o dia de jogo'));
    expect(link.getAttribute('href')).toBe('/dia-de-jogo/gd9');
  });

  it('encerrado ou cancelado não aparece; sem nenhum aberto, o aviso não existe', async () => {
    estado.internos = [{ id: 'a', status: 'finished' }, { id: 'b', status: 'cancelled' }];
    await render(<LegacyInternalTournamentsNotice arena={{ id: 'a1' }} />);
    expect(container.textContent).toBe('');
  });

  it('⭐ falhando a leitura, diz que não conseguiu conferir — não que não há nenhum', async () => {
    estado.internosErro = true;
    await render(<LegacyInternalTournamentsNotice arena={{ id: 'a1' }} />);
    expect(container.textContent).toContain('Não foi possível conferir os torneios internos antigos');
  });
});
