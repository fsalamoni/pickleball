/**
 * Aba PRÓXIMOS: a agenda das federações que FALHOU não segura o esqueleto
 * (os torneios do PickleRush aparecem, com o aviso do que faltou); "Já me
 * inscrevi" não depende do prazo e dá para desmarcar; o seletor de prioridade
 * não é desligado enquanto salva; a lista da descoberta não é refeita à toa.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const est = vi.hoisted(() => ({ listas: [] }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => true }));
vi.mock('@/core/lib/useMyRegion', () => ({ useRegionalList: (lista) => { est.listas.push(lista); return { itens: lista, fora: 0 }; } }));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({ usePublicTournaments: () => est.publicos }));
vi.mock('@/modules/career/hooks/useCareer', () => ({ useFederationAgendaForMe: () => est.agenda }));
vi.mock('@/modules/tournament/components/AddToCalendarButton', () => ({ default: () => null }));
vi.mock('@/v2/components/region/RegionBar', () => ({ default: () => null, RegionEmptyHint: () => null }));

import CareerUpcomingTab from './CareerUpcomingTab';

const FUTURO = '2099-05-10';
const torneio = { id: 't1', name: 'Aberto de Verão', visibility: 'public', status: 'published', start_date: FUTURO };
const plano = (extra = {}) => ({ id: 'u1_a', name: 'Copa do Sul', status: 'planned', start_date: FUTURO, priority: 'casual', ...extra });

let raiz;
let el;
const save = vi.fn(async (ev) => ({ saved: true, event: ev }));
const MEUS = [];
const desenhar = (events) => act(() => {
  raiz.render(<MemoryRouter><CareerUpcomingTab data={{ isPending: false, events, myTournaments: MEUS, retry: vi.fn() }} save={save} onOpenEvent={vi.fn()} onRegister={vi.fn()} /></MemoryRouter>);
});
const montar = (events = [], { agenda, publicos } = {}) => {
  est.listas = [];
  est.publicos = { isPending: false, isSuccess: true, isError: false, data: [torneio], refetch: vi.fn(), ...publicos };
  est.agenda = { isPending: false, isError: false, incompleto: false, events: [], federations: {}, retry: vi.fn(), ...agenda };
  el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  desenhar(events);
  return el;
};
const botao = (rotulo) => [...el.querySelectorAll('button')].find((b) => b.textContent.trim() === rotulo);
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; save.mockClear(); });

describe('CareerUpcomingTab — descoberta', () => {
  it('🔴 agenda das federações que falhou não esconde os torneios do PickleRush', () => {
    // É o que o hook devolve com as filiações falhando: pendente E com erro, sem eventos.
    montar([], { agenda: { isPending: true, isError: true, events: undefined } });
    expect(el.textContent).toContain('Aberto de Verão');
    expect(el.textContent).toContain('Parte da lista não carregou');
    act(() => { botao('Tentar de novo').click(); });
    expect(est.agenda.retry).toHaveBeenCalled();
  });

  it('carregando de verdade, o esqueleto fica no lugar da lista', () => {
    montar([], { agenda: { isPending: true, events: undefined } });
    expect(el.textContent).not.toContain('Aberto de Verão');
  });

  it('a lista da descoberta é a MESMA entre renders (o filtro por região não roda à toa)', () => {
    const events = [];
    // O hook devolve `[]` e o mapa das federações novos a cada render.
    montar(events, { agenda: { events: [], federations: { f1: { name: 'Fed', acronym: 'F' } } } });
    est.agenda = { ...est.agenda, events: [], federations: { f1: { name: 'Fed', acronym: 'F' } } };
    desenhar(events);
    expect(est.listas.length).toBeGreaterThan(1);
    expect(est.listas.at(-1)).toBe(est.listas[0]);
  });
});

describe('CareerUpcomingTab — o plano', () => {
  it('🔴 "Já me inscrevi" aparece mesmo sem prazo de inscrição, e grava', async () => {
    const ev = plano();
    montar([ev]);
    await act(async () => { botao('Já me inscrevi').click(); });
    expect(save).toHaveBeenCalledWith({ ...ev, registered: true });
  });

  it('quem marcou por engano desmarca na própria lista', async () => {
    const ev = plano({ registered: true });
    montar([ev]);
    expect(botao('Já me inscrevi')).toBeUndefined();
    await act(async () => { botao('Desmarcar inscrição').click(); });
    expect(save).toHaveBeenCalledWith({ ...ev, registered: false });
  });

  it('o seletor de prioridade não é desligado enquanto salva, e a mudança concorrente é ignorada', async () => {
    let soltar;
    save.mockImplementationOnce(() => new Promise((ok) => { soltar = ok; }));
    montar([plano()]);
    const sel = el.querySelector('select');
    const mudar = (v) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, v);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await mudar('important');
    expect(sel.disabled).toBe(false);
    expect(sel.getAttribute('aria-busy')).toBe('true');
    await mudar('main');
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { soltar({ saved: true }); });
    expect(sel.getAttribute('aria-busy')).toBe('false');
  });
});

describe('CareerUpcomingTab — jogos das ligas', () => {
  const jogo = (id, extra = {}) => ({ id, leagueId: 'l1', leagueName: 'Liga de Outono', round: 2, date: FUTURO, time: '19:30', team: '', partner: 'Ana', opponent: 'Bia / Caio', ...extra });
  const comLiga = (extra) => act(() => {
    raiz.render(<MemoryRouter><CareerUpcomingTab data={{ isPending: false, events: [], myTournaments: MEUS, retry: vi.fn(), ...extra }} save={save} onOpenEvent={vi.fn()} onRegister={vi.fn()} /></MemoryRouter>);
  });

  it('⭐ mostra os jogos sem placar, com a rodada, e leva à liga; sem data diz "a combinar"', () => {
    montar([]);
    comLiga({ leagueUpcoming: [jogo('a'), jogo('b', { date: null, round: null })] });
    expect(el.textContent).toContain('Jogos das suas ligas');
    expect(el.textContent).toContain('Contra Bia / Caio');
    expect(el.textContent).toContain('Rodada 2');
    expect(el.textContent).toContain('Data a combinar');
    expect(el.querySelector('a[href="/ligas/l1"]')).not.toBeNull();
  });

  it('quem não joga liga não vê a seção; a leitura que falhou é dita', () => {
    montar([]);
    comLiga({ leagueUpcoming: [] });
    expect(el.textContent).not.toContain('Jogos das suas ligas');
    comLiga({ leagueUpcoming: undefined, leaguesError: true, retryLeagues: vi.fn() });
    expect(el.textContent).toContain('Os jogos das suas ligas não carregaram');
  });
});
