import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFlagState = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => mockFlagState.value }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u3' } }) }));

const mod = { hallOn: true, seasonRows: null, hallRows: null, hallLoading: false, hallError: false, mySeason: null, myHall: null };

// Placar do Hall (XP de vida): o servidor já entrega nome, foto e estado.
const hall = (uid, position, name, over = {}) => ({
  uid, position, xpTotal: 6000 - position * 500, tier: 'Veterano', level: 9, achievementsUnlocked: 20, achievementsTotal: 83,
  name, photoUrl: '', state: 'PR', city: 'Curitiba', ...over,
});
const HALL = [hall('u1', 1, 'Ana Souza'), hall('u2', 2, 'Bruno Lima'), hall('u3', 3, 'Carla Dias'), hall('u4', 4, 'Diego Reis'), hall('u5', 5, 'Elisa Nunes')];
// Temporada (XP do mês): só quem aceitou — com `publicPosition`.
const season = (uid, pos, name, xp) => ({ uid, publicPosition: pos, position: pos, xp, tier: 'Regular', level: 6, displayName: name, photoUrl: '', state: 'SP', city: 'Campinas', deltaPosition: 2 });
const SEASON = [season('s1', 1, 'Fábio Alves', 900), season('s2', 2, 'Gabi Rocha', 700), season('s3', 3, 'Hugo Melo', 500), season('s4', 4, 'Íris Paz', 300)];

vi.mock('@/modules/progression/hooks/useHallOfFame', () => ({
  useHallOfFame: () => ({ data: mod.hallRows ?? HALL, isLoading: mod.hallLoading, isError: mod.hallError, refetch: () => {} }),
  useMyHallRow: () => ({ data: mod.myHall }),
}));
vi.mock('@/modules/progression/hooks/useUserSeasonRanking', () => ({
  useSeasonTop: () => ({ data: mod.seasonRows ?? SEASON, isLoading: false, isError: false, refetch: () => {} }),
  useUserCurrentSeason: () => ({ season: mod.mySeason, seasonId: '2026-10', isLoading: false }),
}));
vi.mock('@/modules/progression/hooks/useGamificationConfig', async () => {
  const { normalizeGamificationConfig } = await import('@/modules/progression/domain/gamificationConfig');
  return { useGamificationConfig: () => ({ config: normalizeGamificationConfig(null), isLoading: false, isModuleOn: () => mod.hallOn }) };
});

import V2HallOfFame from './V2HallOfFame.jsx';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockFlagState.value = true;
  Object.assign(mod, { hallOn: true, seasonRows: null, hallRows: null, hallLoading: false, hallError: false, mySeason: null, myHall: null });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  container = null;
  root = null;
});

function render() {
  return new Promise((resolve) => {
    act(() => { root.render(<MemoryRouter><V2HallOfFame /></MemoryRouter>); });
    setTimeout(resolve, 30);
  });
}
const abrirAba = async (rotulo) => {
  const b = Array.from(container.querySelectorAll('nav button')).find((x) => x.textContent.includes(rotulo));
  await act(async () => { b.click(); });
};

describe('V2HallOfFame · flag OFF / módulo desligado', () => {
  it('flag OFF mostra empty state', async () => {
    mockFlagState.value = false;
    await render();
    expect(container.textContent).toContain('Hall da Fama em construção');
  });

  it('módulo desligado pelo admin: a página diz isso, sem fingir que o placar está vazio', async () => {
    mod.hallOn = false;
    await render();
    expect(container.textContent).toContain('O placar público está desligado');
    expect(container.querySelector('[data-testid="hof-podium"]')).toBeNull();
  });
});

describe('V2HallOfFame · temporada (padrão)', () => {
  it('abre na temporada do mês, com pódio e lista por posição PÚBLICA', async () => {
    await render();
    expect(container.textContent).toContain('A temporada de cada mês');
    expect(container.querySelectorAll('[data-testid="hof-podium"]').length).toBe(3);
    const rows = container.querySelectorAll('[data-testid="hof-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('#4');
    expect(rows[0].textContent).toContain('Íris Paz');
  });

  it('mostra o NOME de cada pessoa (nunca o uid) e o XP do mês', async () => {
    await render();
    expect(container.textContent).toContain('Fábio Alves');
    expect(container.textContent).toContain('900');
    expect(container.textContent).not.toMatch(/UID:/);
    expect(container.textContent).not.toMatch(/s1…/);
  });

  it('o nome leva ao perfil do atleta', async () => {
    await render();
    expect(container.querySelector('a[href="/atleta/s1"]')).toBeTruthy();
  });

  it('diz onde a pessoa está: posição pública, ou que a posição só ela vê', async () => {
    mod.mySeason = { xp: 120, position: 14, public: false, publicPosition: null };
    await render();
    expect(container.querySelector('[data-testid="hof-me"]').textContent).toContain('que só você vê');
    expect(container.querySelector('a[href="/gamification/configuracoes#privacidade"]')).toBeTruthy();
  });

  it('tem o filtro por estado', async () => {
    await render();
    const sel = container.querySelector('select[aria-label="Filtrar por estado"]');
    expect(sel).toBeTruthy();
    expect(sel.querySelectorAll('option').length).toBe(28); // Brasil todo + 27 UFs
  });

  it('placar vazio diz que ainda está em formação (e a falha de leitura é outro texto, abaixo)', async () => {
    mod.seasonRows = [];
    await render();
    expect(container.textContent).toContain('O placar ainda está em formação');
  });
});

describe('V2HallOfFame · todos os tempos', () => {
  it('mostra o Hall com nome, estado e conquistas', async () => {
    await render();
    await abrirAba('Todos os tempos');
    expect(container.textContent).toContain('Ana Souza');
    expect(container.querySelectorAll('[data-testid="hof-podium"]').length).toBe(3);
    const rows = container.querySelectorAll('[data-testid="hof-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('#4');
    expect(rows[0].textContent).toContain('20/83 conquistas');
    expect(rows[0].textContent).toContain('Curitiba/PR');
  });

  it('quem não está no Hall é avisado do porquê', async () => {
    await render();
    await abrirAba('Todos os tempos');
    expect(container.querySelector('[data-testid="hof-me"]').textContent).toContain('não aparece no Hall público');
  });

  it('quem está no Hall vê a própria posição', async () => {
    mod.myHall = { position: 3 };
    await render();
    await abrirAba('Todos os tempos');
    expect(container.querySelector('[data-testid="hof-me"]').textContent).toContain('#3');
  });

  it('falha de leitura tem texto próprio e botão — não vira "ninguém no Hall"', async () => {
    mod.hallError = true;
    mod.hallRows = [];
    await render();
    await abrirAba('Todos os tempos');
    expect(container.textContent).toContain('Não deu para carregar o placar');
    expect(container.textContent).not.toContain('ainda está em formação');
  });
});
