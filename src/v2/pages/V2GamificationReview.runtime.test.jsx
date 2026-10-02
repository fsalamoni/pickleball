import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

const flag = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flag.value }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
vi.mock('@/modules/progression/hooks/useGamificationEngine', () => ({ useGamificationEngine: (...a) => engineSpy(...a) }));
const engineSpy = vi.fn(() => ({ uid: 'u1' }));
const rev = { value: null };
const reviewSpy = vi.fn();
vi.mock('@/modules/progression/hooks/usePeriodReview', () => ({ usePeriodReview: (...a) => { reviewSpy(...a); return rev.value; } }));

import V2GamificationReview from './V2GamificationReview.jsx';
import { buildPeriodReview } from '@/modules/progression/domain/periodReview';

let container; let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); flag.value = true; engineSpy.mockClear(); reviewSpy.mockClear(); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = () => act(async () => { root.render(<MemoryRouter><V2GamificationReview /></MemoryRouter>); });
const monta = (over = {}) => buildPeriodReview({ kind: 'week', records: [{ at: Date.now() - 1000, won: true, partner: 'Bia', opponents: ['X'] }, { at: Date.now() - 2000, won: true, opponents: ['Y'] }, { at: Date.now() - 3000, won: false, opponents: ['Z'] }], now: new Date(), ...over });

describe('V2GamificationReview', () => {
  it('flag desligada: empty state, e o motor nem é chamado (não custa consulta)', async () => {
    flag.value = false;
    rev.value = { review: null, isLoading: false, isError: false, refetch: vi.fn() };
    await render();
    expect(container.textContent).toContain('Disponível em breve');
    expect(engineSpy).not.toHaveBeenCalled();
  });

  it('mostra a manchete, os números e os destaques da semana — sem cobrança', async () => {
    rev.value = { review: monta(), isLoading: false, isError: false, refetch: vi.fn() };
    await render();
    expect(container.textContent).toContain('Sua revisão');
    expect(container.textContent).toContain('Nada aqui é cobrança');
    expect(container.textContent).toContain('3 jogos');
    expect(container.textContent).toMatch(/2 vitórias · 67% de aproveitamento/);
  });

  it('semana vazia diz com gentileza, nunca como cobrança', async () => {
    rev.value = { review: monta({ records: [] }), isLoading: false, isError: false, refetch: vi.fn() };
    await render();
    expect(container.textContent).toContain('Um jogo já muda isso');
  });

  it('fonte que falhou é avisada na própria revisão', async () => {
    rev.value = { review: monta({ incompleteSources: ['dias de jogo'] }), isLoading: false, isError: false, refetch: vi.fn() };
    await render();
    expect(container.querySelector('[role="alert"]').textContent).toContain('dias de jogo');
  });

  it('navega entre períodos: anterior sempre, seguinte só até o corrente', async () => {
    rev.value = { review: monta(), isLoading: false, isError: false, refetch: vi.fn() };
    await render();
    const prox = container.querySelector('[aria-label="Período seguinte"]');
    expect(prox.disabled).toBe(true);
    await act(async () => { container.querySelector('[aria-label="Período anterior"]').click(); });
    expect(reviewSpy.mock.calls.at(-1).slice(1)).toEqual(['week', -1]);
    expect(container.querySelector('[aria-label="Período seguinte"]').disabled).toBe(false);
    await act(async () => { container.querySelector('[aria-label="Período seguinte"]').click(); });
    expect(reviewSpy.mock.calls.at(-1).slice(1)).toEqual(['week', 0]);
  });

  it('trocar para Mês volta ao período corrente', async () => {
    rev.value = { review: monta(), isLoading: false, isError: false, refetch: vi.fn() };
    await render();
    await act(async () => { container.querySelector('[aria-label="Período anterior"]').click(); });
    await act(async () => { Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent === 'Mês').click(); });
    expect(reviewSpy.mock.calls.at(-1).slice(1)).toEqual(['month', 0]);
  });

  it('carregando: esqueleto. Falha: erro com botão (nunca uma revisão vazia)', async () => {
    rev.value = { review: null, isLoading: true, isError: false, refetch: vi.fn() };
    await render();
    expect(container.textContent).not.toContain('Foi um período tranquilo');
    rev.value = { review: null, isLoading: false, isError: true, refetch: vi.fn() };
    await render();
    expect(container.textContent).toContain('Não deu para montar a revisão');
  });

  it('aponta a conquista mais perto de sair', async () => {
    rev.value = { review: monta({ nextAchievement: { id: 'a', name: 'Maratonista', progress: 0.9 } }), isLoading: false, isError: false, refetch: vi.fn() };
    await render();
    expect(container.textContent).toContain('Maratonista');
    expect(container.textContent).toContain('90%');
  });
});
