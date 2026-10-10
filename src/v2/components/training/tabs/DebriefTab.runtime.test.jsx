/**
 * A aba BALANÇO e o diálogo do balanço:
 *  - desligado para a pessoa, a aba só explica e oferece ligar;
 *  - os jogos recentes que falharam viram erro, nunca "nenhum jogo";
 *  - responder salva o balanço COM a sugestão e mostra a semana;
 *  - "Adicionar aos meus treinos" cria um plano curto de origem "balanço".
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addDays, todayLocal } from '@/modules/training/domain/dates';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const identidade = { uid: 'eu', isCoach: false, activeCoachIds: [] };
const ok = (data) => ({ isPending: false, isLoading: false, isError: false, isSuccess: true, data, refetch: vi.fn() });
const mut = () => ({ mutate: vi.fn(), isPending: false });

const hoje = todayLocal();
const ontem = addDays(hoje, -1);
const drill = { id: 'd1', title: 'Dink cruzado', kind: 'drill', duration_min: 15, skills: ['kitchen.dink_cruzado'] };
const est = {};

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/training/hooks/useDebriefs', () => ({
  useDebriefSettings: () => est.settings,
  usePendingDebriefs: () => est.pend,
  useDebriefActions: () => est.acoes,
}));
vi.mock('@/modules/training/hooks/useTrainingItems', () => ({
  useVisibleTrainingItems: () => ({ items: [drill], byId: { d1: drill }, isLoading: false, isError: false, incompleto: false }),
}));
vi.mock('@/modules/training/hooks/useTrainingPlans', () => ({
  useMyTrainingPlans: () => ok([]),
  usePlanActions: () => est.planAcoes,
}));
vi.mock('@/modules/training/hooks/useTrainingMeta', () => ({ useTrainingMeta: () => ok(null) }));
vi.mock('@/modules/rating/hooks/useMyUnifiedLevel', () => ({ useMyUnifiedLevel: () => ({ level: 3.5 }) }));

const { default: DebriefTab } = await import('./DebriefTab.jsx');

let container;
let root;
beforeEach(() => {
  est.settings = { uid: 'eu', available: true, enabled: true, since: ontem, isLoading: false, isError: false, refetch: vi.fn() };
  est.pend = {
    on: true,
    pending: [{ type: 'torneio', ref_id: 't1', title: 'Open de Verão', date: ontem, games: null, wins: null }],
    debriefs: [],
    incompleto: [],
    isLoading: false,
    isError: false,
    isSuccess: true,
    refetch: vi.fn(),
  };
  est.acoes = { save: mut(), skip: mut(), applied: mut(), remove: mut(), setEnabled: mut() };
  est.planAcoes = { create: mut(), update: mut(), setStatus: mut(), remove: mut() };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });

const render = async () => {
  await act(async () => {
    root.render(<MemoryRouter><DebriefTab identity={identidade} /></MemoryRouter>);
  });
};
const botao = (texto) => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent.includes(texto));
const clicar = async (el) => { await act(async () => { el.click(); }); };

describe('aba Balanço', () => {
  it('desligado para a pessoa: só explica e oferece ligar', async () => {
    est.settings = { ...est.settings, enabled: false };
    await render();
    expect(container.textContent).not.toContain('Open de Verão');
    await clicar(botao('Ligar para mim'));
    expect(est.acoes.setEnabled.mutate).toHaveBeenCalledWith(true, expect.any(Object));
  });

  it('jogos recentes que falharam viram erro, não "nenhum jogo"', async () => {
    est.pend = { ...est.pend, pending: [], isError: true, isSuccess: false };
    await render();
    expect(container.textContent).toContain('não carregaram');
    expect(container.textContent).not.toContain('Nenhum jogo esperando');
  });

  it('responder salva com a sugestão e "Adicionar" cria o plano do balanço', async () => {
    await render();
    expect(container.textContent).toContain('Open de Verão');
    await clicar(botao('Fazer o balanço'));
    await clicar(document.body.querySelector('[role="radio"][aria-label^="2,"]'));
    await clicar(botao('Dink e jogo curto'));
    // O primeiro chip é "O que funcionou"; o segundo grupo é "O que faltou".
    const chips = Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent === 'Dink e jogo curto');
    await clicar(chips[0]); // desmarca de "funcionou"
    await clicar(chips[1]); // marca em "faltou"
    await clicar(botao('Salvar e ver a sugestão'));

    expect(est.acoes.save.mutate).toHaveBeenCalledTimes(1);
    const [{ input, suggestion }, cb] = est.acoes.save.mutate.mock.calls[0];
    expect(input).toMatchObject({ rating: 2, weaknesses: ['dink'], source: { type: 'torneio', ref_id: 't1' } });
    expect(suggestion.focus.map((f) => f.id)).toEqual(['dink']);
    expect(suggestion.days.some((d) => d.item_ids.includes('d1'))).toBe(true);

    await act(async () => { cb.onSuccess(`eu_torneio_t1`); });
    expect(document.body.textContent).toContain('Sugestão para esta semana');
    expect(document.body.textContent).toContain('Dink cruzado');

    await clicar(botao('Adicionar aos meus treinos'));
    expect(est.planAcoes.create.mutate).toHaveBeenCalledTimes(1);
    expect(est.planAcoes.create.mutate.mock.calls[0][0]).toMatchObject({ source: 'balanco', title: 'Semana do balanço' });
  });
});
