/**
 * As abas do grupo TREINAR (Hoje · Planos · Diário · Evolução) e o registro
 * do diário:
 *  - Hoje mostra o dia do plano ativo, com "Começar";
 *  - sem os planos, Hoje diz que não carregou (não sugere outra coisa);
 *  - uma fonte secundária que falha vira "Ficou de fora", não vazio;
 *  - registrar salva com o input normalizado;
 *  - Diário e Planos só afirmam "vazio" com a lista carregada;
 *  - Evolução sem registros aponta o diário.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { todayLocal, weekKeyOf, weekdayOf } from '@/modules/training/domain/dates';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const identidade = {
  uid: 'eu', name: 'Ana', photo: null, isAdmin: false, isCoach: false, coachReady: true,
  activeCoachIds: [], coachLinks: [], coachLinksError: false, ageYears: 30, actor: { uid: 'eu' },
};
const ok = (data) => ({ isPending: false, isLoading: false, isError: false, isSuccess: true, data, refetch: vi.fn() });
const falha = () => ({ isPending: false, isLoading: false, isError: true, isSuccess: false, data: undefined, refetch: vi.fn() });
const mut = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });

const drill = { id: 'd1', title: 'Dink cruzado', kind: 'drill', duration_min: 15, skills: ['kitchen.dink_cruzado'], author_role: 'plataforma' };
const est = {};
const acoesSessao = { create: mut(), update: mut(), remove: mut(), comment: mut(), deleteComment: mut(), confirm: mut() };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/modules/training/hooks/useTrainingItems', () => ({
  useVisibleTrainingItems: () => est.visiveis,
}));
vi.mock('@/modules/training/hooks/useTrainingPlans', () => ({
  useMyTrainingPlans: () => est.planos,
  usePlanActions: () => ({ create: mut(), update: mut(), setStatus: mut(), remove: mut() }),
}));
vi.mock('@/modules/training/hooks/useTrainingShares', () => ({ useTrainingInbox: () => est.inbox }));
vi.mock('@/modules/training/hooks/useTrainingMeta', () => ({
  useTrainingMeta: () => est.meta,
  useMetaActions: () => ({ save: mut(), favorite: mut(), mastery: mut() }),
}));
vi.mock('@/modules/training/hooks/useTrainingSessions', () => ({
  useMyTrainingSessions: () => est.sessoes,
  useSessionActions: () => acoesSessao,
  useSessionComments: () => ok([]),
}));
vi.mock('@/modules/rating/hooks/useMyUnifiedLevel', () => ({ useMyUnifiedLevel: () => ({ level: 3.5, source: 'x', isLoading: false }) }));
vi.mock('@/modules/progression/hooks/usePeople', () => ({ usePeople: () => ({ people: new Map() }) }));

const { default: TodayTab } = await import('./TodayTab.jsx');
const { default: PlansTab } = await import('./PlansTab.jsx');
const { default: DiaryTab } = await import('./DiaryTab.jsx');
const { default: EvolutionTab } = await import('./EvolutionTab.jsx');
const { default: LogSessionDialog } = await import('../LogSessionDialog.jsx');

const hoje = todayLocal();
const planoDeHoje = {
  id: 'p1', title: 'Dink em 4 semanas', status: 'ativo', start_date: weekKeyOf(hoje), weeks: 4,
  days: [weekdayOf(hoje)], minutes: 60, slots: [{ week: 1, day: weekdayOf(hoje), title: 'Treino do foco', item_ids: ['d1'], duration_min: 60 }],
};

let container;
let root;
beforeEach(() => {
  est.visiveis = { items: [drill], byId: { d1: drill }, isLoading: false, isError: false, incompleto: false, refetch: vi.fn() };
  est.planos = ok([]);
  est.inbox = ok([]);
  est.meta = ok({ routine: { days: [0, 1, 2, 3, 4, 5, 6], minutes: 45, place: '', focus: [] } });
  est.sessoes = ok([]);
  Object.values(acoesSessao).forEach((m) => m.mutate.mockClear());
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ''; });

const render = async (el, url = '/treino') => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[url]}>{el}</MemoryRouter>
      </QueryClientProvider>,
    );
  });
};
const texto = () => document.body.textContent;
const params = (q = '') => new URLSearchParams(q);

describe('Hoje', () => {
  it('mostra o dia do plano ativo com o item e "Começar"', async () => {
    est.planos = ok([planoDeHoje]);
    await render(<TodayTab identity={identidade} irPara={vi.fn()} />);
    expect(texto()).toContain('Do seu plano');
    expect(texto()).toContain('Dink cruzado');
    expect(container.querySelector('[data-dica="treino-hoje-comecar"]')).not.toBeNull();
  });

  it('sem os planos, diz que não carregou — não sugere outra coisa', async () => {
    est.planos = falha();
    await render(<TodayTab identity={identidade} irPara={vi.fn()} />);
    expect(texto()).toContain('Não foi possível montar o treino de hoje');
    expect(texto()).not.toContain('Sugestão para você');
  });

  it('o que o professor mandou não carregou: avisa e segue com a sugestão', async () => {
    est.inbox = falha();
    await render(<TodayTab identity={identidade} irPara={vi.fn()} />);
    expect(texto()).toContain('Ficou de fora: o que o professor mandou');
    expect(texto()).toContain('Sugestão para você');
  });
});

describe('Registrar treino', () => {
  it('salva com os minutos e os itens, normalizados', async () => {
    await render(
      <LogSessionDialog open onOpenChange={vi.fn()} identity={identidade} itemsById={{ d1: drill }} initial={{ item_ids: ['d1'] }} />,
    );
    const min = document.getElementById('sessao-min');
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(min, '30');
      min.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const form = min.closest('form');
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(acoesSessao.create.mutate).toHaveBeenCalledTimes(1);
    const [input] = acoesSessao.create.mutate.mock.calls[0];
    expect(input).toMatchObject({ duration_min: 30, item_ids: ['d1'], date: hoje, title: 'Dink cruzado', status: 'feito' });
  });

  it('sem minutos, não salva e diz o que falta', async () => {
    await render(<LogSessionDialog open onOpenChange={vi.fn()} identity={identidade} itemsById={{}} initial={{}} />);
    const form = document.getElementById('sessao-min').closest('form');
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(acoesSessao.create.mutate).not.toHaveBeenCalled();
    expect(texto()).toContain('Diga quantos minutos durou');
  });
});

describe('Diário, Planos e Evolução: falha não é vazio', () => {
  it('Diário com a leitura falhando não diz "nenhum treino"', async () => {
    est.sessoes = falha();
    await render(<DiaryTab identity={identidade} params={params()} irPara={vi.fn()} />);
    expect(texto()).toContain('O seu diário não carregou');
    expect(texto()).not.toContain('Nenhum treino registrado');
  });

  it('Diário vazio de verdade convida a registrar', async () => {
    await render(<DiaryTab identity={identidade} params={params()} irPara={vi.fn()} />);
    expect(texto()).toContain('Nenhum treino registrado ainda');
  });

  it('Diário lista as sessões da semana', async () => {
    est.sessoes = ok([{ id: 's1', date: hoje, week_key: weekKeyOf(hoje), title: 'Treino de dink', kind: 'quadra', status: 'feito', duration_min: 40, rpe: 6, item_ids: ['d1'] }]);
    await render(<DiaryTab identity={identidade} params={params()} irPara={vi.fn()} />);
    expect(texto()).toContain('Treino de dink');
    expect(texto()).toContain('carga 240');
  });

  it('Planos: falha × vazio', async () => {
    est.planos = falha();
    await render(<PlansTab identity={identidade} params={params()} irPara={vi.fn()} />);
    expect(texto()).toContain('Os seus planos não carregaram');
    expect(texto()).not.toContain('Você ainda não tem um plano');
    est.planos = ok([]);
    await render(<PlansTab identity={identidade} params={params()} irPara={vi.fn()} />);
    expect(texto()).toContain('Você ainda não tem um plano');
  });

  it('Planos: "Pôr no meu treino" oferece o dia do plano ativo', async () => {
    est.planos = ok([planoDeHoje]);
    await render(<PlansTab identity={identidade} params={params('adicionar=d1')} irPara={vi.fn()} />);
    expect(texto()).toContain('Pôr no meu treino');
    expect(texto()).toContain('Colocar neste dia');
  });

  it('Evolução sem registros aponta o diário; com o diário falhando, avisa', async () => {
    await render(<EvolutionTab identity={identidade} irPara={vi.fn()} />);
    expect(texto()).toContain('A evolução começa no diário');
    est.sessoes = falha();
    await render(<EvolutionTab identity={identidade} irPara={vi.fn()} />);
    expect(texto()).toContain('O seu diário não carregou');
    expect(texto()).not.toContain('A evolução começa no diário');
  });
});
