/**
 * ⭐ VÍNCULO DO DIA DE JOGO A CLUBE/ARENA — as três peças de tela.
 *
 *  1. `GameDayLinkSection` (nas configurações do dia): só oferece o que a pessoa
 *     ADMINISTRA, confirma antes de gravar, grava os quatro campos por um caminho
 *     só e desfaz sem confirmação. Falha ao carregar as listas não vira
 *     "você não administra nada".
 *  2. `GameDayGuestsCard`: quem é de fora vira CONVIDADO (só rótulo); lista de
 *     membros desconhecida nunca rotula ninguém.
 *  3. `LinkedGameDaysSection`: sem dia, não existe; consulta falhando diz isso.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const opcoes = { clubs: [], arenas: [], isLoading: false, isError: false };
const retry = vi.fn();
const vinculados = { clube: { data: [], isSuccess: true, isError: false }, arena: { data: [], isSuccess: true, isError: false } };
vi.mock('@/modules/games/hooks/useGameDayLink', () => ({
  useGameDayLinkOptions: () => ({
    options: { clubs: opcoes.clubs, arenas: opcoes.arenas },
    isLoading: opcoes.isLoading,
    isError: opcoes.isError,
    retry,
  }),
  useClubLinkedGameDays: () => ({ ...vinculados.clube, refetch: vi.fn() }),
  useArenaLinkedGameDays: () => ({ ...vinculados.arena, refetch: vi.fn() }),
}));

const participantes = { lista: [], ok: true };
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => ({ data: participantes.lista, isSuccess: participantes.ok }),
}));
const membros = { clube: { isSuccess: true, data: [] }, arena: { isSuccess: true, data: [] }, geridas: [] };
vi.mock('@/modules/clubs/hooks/useClubs', () => ({ useClubMembers: () => membros.clube }));
vi.mock('@/modules/arenas/hooks/useArenas', () => ({ useMyManagedArenas: () => ({ data: membros.geridas }) }));
vi.mock('@/modules/arenas/hooks/useArenaV3', () => ({ useArenaMembers: () => membros.arena }));

const { default: GameDayLinkSection } = await import('./GameDayLinkSection.jsx');
const { default: GameDayGuestsCard } = await import('./GameDayGuestsCard.jsx');
const { default: LinkedGameDaysSection } = await import('./LinkedGameDaysSection.jsx');

const DIA = { id: 'gd1', title: 'Racha', created_by: 'u1', open_game_id: 'og1' };
let container;
let root;

function montar(el) {
  act(() => { root.render(<MemoryRouter>{el}</MemoryRouter>); });
  return container.textContent;
}
const botao = (texto, escopo = document.body) => [...escopo.querySelectorAll('button')]
  .find((b) => b.textContent.includes(texto) || b.getAttribute('aria-label') === texto);
const escolher = (id, valor) => {
  const sel = container.querySelector(`#${id}`);
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, valor);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

beforeEach(() => {
  Object.assign(opcoes, { clubs: [], arenas: [], isLoading: false, isError: false });
  vinculados.clube = { data: [], isSuccess: true, isError: false };
  vinculados.arena = { data: [], isSuccess: true, isError: false };
  Object.assign(participantes, { lista: [], ok: true });
  Object.assign(membros, { clube: { isSuccess: true, data: [] }, arena: { isSuccess: true, data: [] }, geridas: [] });
  retry.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('⭐ GameDayLinkSection', () => {
  it('oferece só o que a pessoa administra e confirma antes de gravar', async () => {
    opcoes.clubs = [{ id: 'c1', name: 'Clube Norte' }];
    opcoes.arenas = [{ id: 'a1', name: 'Arena Sul' }];
    const gravar = vi.fn(async () => true);
    montar(<GameDayLinkSection gameDay={DIA} gravar={gravar} />);
    expect(container.textContent).toContain('Clube Norte');
    expect(container.textContent).toContain('Arena Sul');

    escolher('gds-vc-gd1', 'c1');
    act(() => { botao('Vincular', container).click(); });
    expect(gravar).not.toHaveBeenCalled(); // pediu confirmação
    expect(document.body.textContent).toContain('Vincular este dia de jogo?');

    const confirmar = [...document.body.querySelectorAll('[role="alertdialog"] button, [role="dialog"] button')]
      .find((b) => b.textContent.trim() === 'Vincular');
    await act(async () => { confirmar.click(); });
    expect(gravar).toHaveBeenCalledTimes(1);
    expect(gravar.mock.calls[0][0]).toEqual({
      link_club_id: 'c1', link_club_name: 'Clube Norte', link_arena_id: null, link_arena_name: null,
    });
  });

  it('desvincular grava os quatro campos zerados do lado tirado, sem pedir confirmação', async () => {
    opcoes.clubs = [{ id: 'c1', name: 'Clube Norte' }];
    const gravar = vi.fn(async () => true);
    montar(<GameDayLinkSection
      gameDay={{ ...DIA, link_club_id: 'c1', link_club_name: 'Clube Norte', visibility: 'public' }}
      gravar={gravar}
    />);
    await act(async () => { botao('Desvincular do clube', container).click(); });
    expect(gravar.mock.calls[0][0]).toEqual({
      link_club_id: null, link_club_name: null, link_arena_id: null, link_arena_name: null,
    });
  });

  it('⭐ sem clube nem arena administrados, diz por quê — e sem seletor', () => {
    montar(<GameDayLinkSection gameDay={DIA} gravar={vi.fn()} />);
    expect(container.textContent).toContain('Só quem administra o clube ou gere a arena');
    expect(container.querySelector('select')).toBeNull();
  });

  it('⭐ falha ao carregar as listas NÃO afirma que a pessoa não administra nada', () => {
    opcoes.isError = true;
    montar(<GameDayLinkSection gameDay={DIA} gravar={vi.fn()} />);
    expect(container.textContent).toContain('Não deu para carregar seus clubes e arenas');
    expect(container.textContent).not.toContain('Você não administra nenhum clube');
  });

  it('dia que já é de uma arena (ou clube) não mostra a seção', () => {
    opcoes.clubs = [{ id: 'c1', name: 'Clube Norte' }];
    montar(<GameDayLinkSection gameDay={{ ...DIA, arena_id: 'a9' }} gravar={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
});

describe('⭐ GameDayGuestsCard', () => {
  const diaVinculado = { ...DIA, link_club_id: 'c1', link_club_name: 'Clube Norte' };

  it('quem não é do clube aparece como convidado; quem é, só conta como de dentro', () => {
    participantes.lista = [
      { id: 'p1', user_id: 'u1', name: 'Ana' },
      { id: 'p2', user_id: 'u2', name: 'Bia' },
    ];
    membros.clube = { isSuccess: true, data: [{ user_id: 'u1' }] };
    const texto = montar(<GameDayGuestsCard gameDay={diaVinculado} />);
    expect(texto).toContain('Clube Norte');
    expect(texto).toContain('1 convidado');
    expect(texto).toContain('Bia');
    expect(texto).toContain('mantém todas as suas estatísticas');
  });

  it('⭐ lista de membros DESCONHECIDA: não rotula ninguém de convidado', () => {
    participantes.lista = [{ id: 'p2', user_id: 'u2', name: 'Bia' }];
    membros.clube = { isSuccess: false, data: undefined };
    expect(montar(<GameDayGuestsCard gameDay={diaVinculado} />)).toBe('');
  });

  it('sem vínculo não renderiza nada', () => {
    participantes.lista = [{ id: 'p2', user_id: 'u2', name: 'Bia' }];
    expect(montar(<GameDayGuestsCard gameDay={DIA} />)).toBe('');
  });

  it('arena que a pessoa NÃO gere: a lista de membros é privada e o cartão cala sobre ela', () => {
    participantes.lista = [{ id: 'p2', user_id: 'u2', name: 'Bia' }];
    const texto = montar(<GameDayGuestsCard gameDay={{ ...DIA, link_arena_id: 'a1', link_arena_name: 'Arena Sul' }} />);
    expect(texto).toBe('');
  });
});

describe('⭐ LinkedGameDaysSection', () => {
  const futuro = new Date(Date.now() + 5 * 86400000);
  const iso = `${futuro.getFullYear()}-${String(futuro.getMonth() + 1).padStart(2, '0')}-${String(futuro.getDate()).padStart(2, '0')}`;

  it('lista os dias vinculados do clube, com link para cada um', () => {
    vinculados.clube = { data: [{ id: 'gd7', title: 'Racha de sábado', date: iso, time: '19:00', creator_name: 'Flavio' }], isSuccess: true, isError: false };
    const texto = montar(<LinkedGameDaysSection clubId="c1" />);
    expect(texto).toContain('Dias de jogo vinculados');
    expect(texto).toContain('Racha de sábado');
    expect(container.querySelector('a[href="/dia-de-jogo/gd7"]')).not.toBeNull();
  });

  it('sem nenhum dia, a seção não existe', () => {
    expect(montar(<LinkedGameDaysSection arenaId="a1" />)).toBe('');
  });

  it('⭐ consulta que falhou diz que não carregou — não some como se não houvesse dias', () => {
    vinculados.arena = { data: undefined, isSuccess: false, isError: true };
    const texto = montar(<LinkedGameDaysSection arenaId="a1" />);
    expect(texto).toContain('Não deu para carregar os dias de jogo vinculados');
  });
});
