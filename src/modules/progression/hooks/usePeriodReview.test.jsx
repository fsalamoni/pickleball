import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const s = { records: [], incomplete: [], missions: [] };
vi.mock('./useGameRecords', () => ({
  useGameRecords: () => ({ records: s.records, incomplete: s.incomplete, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/modules/progression/services/missionService', () => ({ listUserMissions: () => Promise.resolve(s.missions) }));

import { usePeriodReview } from './usePeriodReview';

let container; let root; let out;
function Probe({ engine, kind, offset }) { out = usePeriodReview(engine, kind, offset); return null; }
const aguardar = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); out = null; Object.assign(s, { records: [], incomplete: [], missions: [] }); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (engine, kind = 'week', offset = 0) => act(async () => {
  root.render(<QueryClientProvider client={new QueryClient()}><Probe engine={engine} kind={kind} offset={offset} /></QueryClientProvider>);
});

const DIA = 86_400_000;
const engine = (over = {}) => ({
  uid: 'u1', facts: { unknown: [], dates: {} }, dates: { tournamentDates: [] }, persistedAchievements: [], ratingPoints: [], streak: { weeks: 3 },
  achievements: { locked: [{ id: 'a1', name: 'Quase lá', progress: 0.8 }, { id: 'a2', name: 'Longe', progress: 0.1 }, { id: 'a3', name: 'Nada', progress: 0 }] },
  ...over,
});

describe('usePeriodReview', () => {
  it('monta a revisão da semana com os jogos do período e destaca a conquista mais perto', async () => {
    const agora = Date.now();
    s.records = [{ at: agora - 1000, won: true }, { at: agora - 2000, won: false }, { at: agora - 40 * DIA, won: true }];
    await render(engine()); await aguardar();
    expect(out.review.games).toBe(2);
    expect(out.review.wins).toBe(1);
    expect(out.review.nextAchievement).toEqual({ id: 'a1', name: 'Quase lá', progress: 0.8 });
    expect(out.review.streakWeeks).toBe(3);
  });

  it('fonte que não carregou entra em `incomplete` (a tela avisa) em vez de virar zero', async () => {
    s.incomplete = ['dias de jogo'];
    await render(engine({ facts: { unknown: ['bookings'], dates: {} } })); await aguardar();
    expect(out.review.incomplete).toEqual(['dias de jogo', 'dados de atividade']);
  });

  it('o marco "seu 50º jogo" é medido pela carreira ATÉ o fim do período, não até hoje', async () => {
    const agora = Date.now();
    // 49 jogos há 2 meses + 1 jogo esta semana → o 50º jogo é desta semana
    s.records = [...Array.from({ length: 49 }, (_, i) => ({ at: agora - 60 * DIA - i * 1000, won: true })), { at: agora - 1000, won: true }];
    await render(engine()); await aguardar();
    expect(out.review.milestones.map((m) => m.text)).toContain('Seu 50º jogo!');
  });

  it('o período anterior (offset -1) não conta o que aconteceu depois dele', async () => {
    const agora = Date.now();
    s.records = [{ at: agora - 8 * DIA, won: true }, { at: agora - 1000, won: true }];
    await render(engine(), 'week', -1); await aguardar();
    expect(out.review.games).toBe(1);
  });

  it('sem motor/uid não monta nada', async () => {
    await render(null); await aguardar();
    expect(out.review).toBeNull();
  });
});
