/**
 * Teste de RUNTIME da página /gamification (V2GamificationHome) — o hub em abas.
 *
 * Garante que:
 *  - Flag OFF: empty state
 *  - Flag ON: cabeçalho (tier, nível, XP, conquistas), as cinco abas e o conteúdo da Jornada
 *  - A aba vem da URL (`?aba=`), inclusive pelos nomes antigos que os avisos usam
 *  - Módulo que o admin desligou some (aba e conteúdo)
 *  - Cenário Flávio: tier Aprendiz, 3.020 XP
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockAuth = { user: { uid: 'u1', displayName: 'Test' }, userProfile: { platform_name: 'Test' } };
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => mockAuth }));

const mockFlagState = { value: true };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => mockFlagState.value }));

const mockModules = { off: new Set() };

vi.mock('@/modules/progression/hooks/useGamificationEngine', async () => {
  const { computeAchievementsV2 } = await import('@/modules/achievements/domain/achievementsV2');
  const { splitAchievements } = await import('@/modules/progression/domain/gamificationSnapshot');
  const { levelFromXpV2 } = await import('@/modules/progression/domain/progressionV2');
  const { tierFromXp, tierProgress } = await import('@/modules/progression/domain/tiers');
  const { buildSkillTrees } = await import('@/modules/progression/domain/skillTrees');
  const { XP_WEIGHTS_V2 } = await import('@/modules/progression/domain/progressionV2');
  const { evaluateOnboarding } = await import('@/modules/progression/domain/onboarding');
  const { normalizeGamificationConfig } = await import('@/modules/progression/domain/gamificationConfig');
  const { normalizeGamificationPrefs } = await import('@/modules/progression/domain/gamificationPrefs');
  const stats = { tournaments: 8, played: 142, wins: 66, podiums: 1, titles: 0 };
  const achievements = splitAchievements(computeAchievementsV2({ uid: 'u1', rating: 1023, stats, streak: { weeks: 2 } }));
  const state = evaluateOnboarding({ facts: null, done: {}, dismissed: false, joinedDays: 1 });
  const total = 3020;
  return {
    useGamificationEngine: () => ({
      uid: 'u1',
      isLoading: false, isError: false, ready: true, refetch: () => {},
      config: normalizeGamificationConfig(null),
      isModuleOn: (id) => !mockModules.off.has(id),
      stats, history: [], gameDayGames: [], matchDates: [], dates: { tournamentDates: [], gameDayDates: [] },
      streak: { weeks: 2 }, facts: null,
      xp: { total, breakdown: { activity: 3000, achievements: 0, missions: 20, onboarding: 0, grants: 0 }, level: levelFromXpV2(total), tier: tierFromXp(total), tierProgress: tierProgress(total) },
      skillTrees: buildSkillTrees({ tournament_attended: 8, tournament_podium: 1, tournament_title: 0, game_played: 142, game_won: 66 }, XP_WEIGHTS_V2).trees,
      achievements,
      persistedAchievements: [], persistedIds: new Set(),
      onboarding: { ...state, visible: true },
      marks: [], prefs: normalizeGamificationPrefs(null, 'u1'), updatePrefs: () => Promise.resolve({}),
      progression: null,
    }),
  };
});

const mockMissions = {
  isLoading: false, isError: false, refetch: () => {}, claimBonus: () => {}, isClaiming: false,
  doc: { bonusClaimed: false },
  missions: [
    { id: 'm1', title: 'Jogue 1 partida', description: 'Jogue 1 partida', metric: 'game_played', target: 1, current: 0, xp: 30 },
    { id: 'm2', title: 'Dê 2 kudos', description: 'Dê 2 kudos', metric: 'kudos_given', target: 2, current: 1, xp: 20 },
  ],
};
vi.mock('@/modules/progression/hooks/useScopedMissions', () => ({ useScopedMissions: () => mockMissions }));
vi.mock('@/modules/progression/hooks/useGameRecords', () => ({ useGameRecords: () => ({ records: [], isLoading: false, isError: false, incomplete: [], refetch: () => {} }) }));
vi.mock('@/modules/progression/hooks/usePeriodReview', () => ({ usePeriodReview: () => ({ review: null, isLoading: false, isError: false, refetch: () => {} }) }));
vi.mock('@/modules/progression/hooks/useGamificationTracker', () => ({ useGamificationTracker: () => ({ track: () => {}, enabled: false, GAMIFICATION_EVENT: {} }) }));
vi.mock('@/modules/progression/hooks/useStreakMetaV2', () => ({
  useStreakMetaV2: () => ({
    meta: { graceDaysRemaining: 2, freezesAvailable: 2, vacationMode: false, comebackBonus: 0, lastPlayAt: null },
    isLoading: false, enableVacation: () => {}, disableVacation: () => {}, useFreeze: () => {}, addFreeze: () => {}, isMutating: false,
  }),
}));
vi.mock('@/modules/progression/hooks/useKudoActions', () => ({
  useKudoActions: () => ({ index: { givenToday: 0 }, received: [], given: [], isLoading: false, give: () => {}, isGiving: false, giveError: null }),
}));
vi.mock('@/modules/progression/hooks/useUserReferralCode', () => ({
  // código PERSISTIDO do usuário (antes a página gerava um aleatório no render)
  useUserReferralCode: () => ({ code: { uid: 'u1', code: 'AB2CD3EF', totalSignups: 4 }, isLoading: false }),
}));
vi.mock('@/modules/progression/hooks/useUserSeasonRanking', () => ({
  useUserCurrentSeason: () => ({ season: null, seasonId: '2026-09', isLoading: false }),
  useSeasonTop: () => ({ data: [] }),
}));
vi.mock('@/modules/progression/hooks/useCelebrationListener', () => ({ useCelebrationListener: () => {} }));

// Os painéis das outras abas têm teste próprio: aqui só se confere que a ABA certa os monta.
vi.mock('@/v2/components/gamification/DuelCard', () => ({ default: () => <div data-testid="stub-duel" /> }));
vi.mock('@/v2/components/gamification/ChallengesPanel', () => ({ default: () => <div data-testid="stub-challenges" /> }));
vi.mock('@/v2/components/gamification/ReviewsPanel', () => ({ default: () => <div data-testid="stub-reviews" /> }));
vi.mock('@/v2/components/gamification/LettersPanel', () => ({ default: () => <div data-testid="stub-letters" /> }));
vi.mock('@/v2/components/gamification/ReputationCard', () => ({ default: () => <div data-testid="stub-reputation" /> }));
vi.mock('@/v2/components/gamification/RewardsPanel', () => ({ default: () => <div data-testid="stub-rewards" /> }));
vi.mock('@/v2/components/gamification/IssuerShortcuts', () => ({ default: () => null }));
vi.mock('@/v2/components/gamification/XpBreakdownCard', () => ({ default: () => <div data-testid="stub-xp" /> }));
vi.mock('@/modules/progression/components/SeasonBanner', () => ({ default: () => <div data-testid="stub-season" /> }));

import V2GamificationHome from './V2GamificationHome.jsx';
import { abaDaUrl, HUB_TABS } from '@/v2/components/gamification/hubTabs';

let container = null;
let root = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockFlagState.value = true;
  mockModules.off = new Set();
});

afterEach(() => {
  root.unmount();
  container.remove();
  container = null;
  root = null;
});

function render(url = '/gamification') {
  return new Promise((resolve) => {
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <V2GamificationHome />
      </MemoryRouter>,
    );
    setTimeout(resolve, 60);
  });
}

describe('V2GamificationHome · flag OFF', () => {
  it('mostra empty state amigável', async () => {
    mockFlagState.value = false;
    await render();
    expect(container.textContent).toContain('Gamificação V2 em construção');
    expect(container.querySelector('a[href="/meu-desempenho"]')).toBeTruthy();
  });
});

describe('V2GamificationHome · flag ON · Jornada', () => {
  it('renderiza título + subtítulo', async () => {
    await render();
    expect(container.textContent).toContain('Gamificação');
    expect(container.textContent).toContain('Missões, conquistas, temporada');
  });

  it('cabeçalho mostra tier Aprendiz e o XP composto (3.020)', async () => {
    await render();
    const tierBadge = container.querySelector('[data-testid="tier-badge"]');
    expect(tierBadge.textContent).toContain('Aprendiz');
    expect(container.textContent).toContain('3.020');
  });

  it('cabeçalho mostra a contagem de conquistas medidas (X/Y) com link para todas', async () => {
    await render();
    expect(container.textContent).toMatch(/\d+\/\d+/);
    expect(container.querySelector('a[href="/conquistas"]')).toBeTruthy();
  });

  it('tem as cinco abas, na ordem', async () => {
    await render();
    const nav = container.querySelector('nav[aria-label="Seções da gamificação"]');
    const rotulos = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent.trim());
    expect(rotulos).toEqual(['Jornada', 'Missões', 'Competir', 'Social', 'Recompensas']);
  });

  it('mostra o roteiro de primeiros passos (nenhuma etapa obrigatória: "Pular por agora" à vista)', async () => {
    await render();
    expect(container.querySelector('[data-testid="onboarding-roadmap"]')).toBeTruthy();
    expect(container.textContent).toContain('Pular por agora');
  });

  it('mostra o resumo das missões de hoje, com atalho para a aba', async () => {
    await render();
    expect(container.querySelector('[data-testid="missions-mini"]').textContent).toContain('0 de 2');
  });

  it('mostra conquistas em destaque (até 4)', async () => {
    await render();
    const cards = container.querySelectorAll('[data-testid="achievement-card"]');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(4);
  });

  it('mostra o código de convite PERSISTIDO do usuário', async () => {
    await render();
    const code = container.querySelector('[data-testid="referral-code"]');
    expect(code.textContent.replace(/\s/g, '')).toBe('AB2CD3EF');
  });

  it('mostra 5 skill trees e o escudo da sequência', async () => {
    await render();
    expect(container.querySelectorAll('[data-tree]').length).toBe(5);
    expect(container.querySelector('[data-testid="streak-grace"]')).toBeTruthy();
  });

  it('atalhos: Hall da Fama e Vínculos', async () => {
    await render();
    expect(container.querySelector('[data-testid="link-hall-da-fama"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="link-vinculos"]')).toBeTruthy();
  });
});

describe('V2GamificationHome · abas pela URL', () => {
  it('?aba=missoes abre as missões, com o aviso de que não há botão de marcar', async () => {
    await render('/gamification?aba=missoes');
    expect(container.querySelector('[data-testid="missions-daily"]')).toBeTruthy();
    expect(container.textContent).toContain('Não há botão de marcar');
    expect(container.querySelectorAll('[data-testid="mission-item"]').length).toBe(2);
    expect(container.querySelector('[data-testid="onboarding-roadmap"]')).toBeNull();
  });

  it('?aba=competir mostra temporada, duelo e desafios', async () => {
    await render('/gamification?aba=competir');
    expect(container.querySelector('[data-testid="stub-season"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="stub-duel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="stub-challenges"]')).toBeTruthy();
  });

  it('?aba=social mostra reputação, avaliações e cartas', async () => {
    await render('/gamification?aba=social');
    ['stub-reputation', 'stub-reviews', 'stub-letters'].forEach((id) => expect(container.querySelector(`[data-testid="${id}"]`)).toBeTruthy());
  });

  it('?aba=recompensas mostra as recompensas', async () => {
    await render('/gamification?aba=recompensas');
    expect(container.querySelector('[data-testid="stub-rewards"]')).toBeTruthy();
  });

  it('o link do aviso do duelo (?aba=duelo) cai em Competir', async () => {
    await render('/gamification?aba=duelo');
    expect(container.querySelector('[data-testid="stub-duel"]')).toBeTruthy();
  });

  it('aba desconhecida cai na Jornada, nunca em branco', async () => {
    await render('/gamification?aba=qualquer-coisa');
    expect(container.querySelector('[data-testid="onboarding-roadmap"]')).toBeTruthy();
  });

  it('trocar de aba muda o conteúdo', async () => {
    await render();
    const btn = Array.from(container.querySelectorAll('nav button')).find((b) => b.textContent.trim() === 'Competir');
    btn.click();
    await new Promise((r) => setTimeout(r, 40));
    expect(container.querySelector('[data-testid="stub-duel"]')).toBeTruthy();
  });
});

describe('V2GamificationHome · módulos que o admin desligou', () => {
  it('recompensas desligadas: a aba some e o link direto cai na Jornada', async () => {
    mockModules.off = new Set(['rewards']);
    await render('/gamification?aba=recompensas');
    const nav = container.querySelector('nav[aria-label="Seções da gamificação"]');
    expect(Array.from(nav.querySelectorAll('button')).map((b) => b.textContent.trim())).not.toContain('Recompensas');
    expect(container.querySelector('[data-testid="stub-rewards"]')).toBeNull();
  });

  it('duelo e desafios desligados somem de Competir', async () => {
    mockModules.off = new Set(['duels', 'challenges']);
    await render('/gamification?aba=competir');
    expect(container.querySelector('[data-testid="stub-duel"]')).toBeNull();
    expect(container.querySelector('[data-testid="stub-challenges"]')).toBeNull();
  });

  it('roteiro desligado não aparece na Jornada', async () => {
    mockModules.off = new Set(['onboarding']);
    await render();
    expect(container.querySelector('[data-testid="onboarding-roadmap"]')).toBeNull();
  });
});

describe('abaDaUrl', () => {
  it('resolve alias, valor válido e inválido', () => {
    expect(abaDaUrl('duelo')).toBe('competir');
    expect(abaDaUrl('convite')).toBe('jornada');
    expect(abaDaUrl('missoes')).toBe('missoes');
    expect(abaDaUrl('xyz')).toBe('jornada');
    expect(abaDaUrl(null)).toBe('jornada');
    expect(abaDaUrl('recompensas', HUB_TABS.filter((a) => a.id !== 'recompensas'))).toBe('jornada');
  });
});
