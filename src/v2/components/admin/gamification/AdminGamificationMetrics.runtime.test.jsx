import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

const s = { metrics: [], isLoading: false, isError: false, refetch: vi.fn() };
vi.mock('@/modules/progression/hooks/useGamificationAdmin', () => ({ useAdminMetrics: () => s }));

import AdminGamificationMetrics from './AdminGamificationMetrics.jsx';

let container; let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); Object.assign(s, { metrics: [], isLoading: false, isError: false, refetch: vi.fn() }); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = () => act(async () => { root.render(<AdminGamificationMetrics />); });
const linha = (day, over = {}) => ({ id: day, day, athletes: 200, active7: 80, active30: 120, referrals: 40, referralsActivated: 10, kudos7: 30, reviews7: 12, letters7: 5, challengesActive: 2, duelsActive: 15, rewardClaimsOpen: 3, flagsOpen: 1, prefsDocs: 25, ...over });

describe('AdminGamificationMetrics', () => {
  it('sem retrato ainda: explica quando o servidor grava', async () => {
    await render();
    expect(container.textContent).toContain('Ainda sem métricas');
  });

  it('mostra o último retrato, a taxa de ativos e a evolução em barras', async () => {
    s.metrics = [linha('2026-10-01'), linha('2026-10-02', { active7: 90 }), linha('2026-10-03', { active7: 100 })];
    await render();
    expect(container.textContent).toContain('Ativos em 30 dias: 120 (60%)');
    expect(container.textContent).toContain('Convites ativados');
    expect(container.textContent).toContain('10/40');
    expect(container.textContent).toContain('Último retrato: 2026-10-03');
    expect(container.querySelectorAll('[role="img"]').length).toBe(4);
    expect(container.querySelector('[role="img"]').getAttribute('aria-label')).toContain('80, 90, 100');
  });

  it('falha de leitura não vira "sem métricas"', async () => {
    s.isError = true;
    await render();
    expect(container.textContent).toContain('Não deu para carregar as métricas');
    expect(container.textContent).not.toContain('Ainda sem métricas');
  });
});
