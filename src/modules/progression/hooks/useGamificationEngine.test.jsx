/**
 * O motor do cliente: compõe o XP, as conquistas, o roteiro e os marcos, e só
 * ESCREVE quando todas as fontes essenciais chegaram (total parcial apresentado
 * como total é o defeito que este hook existe para não ter).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ getQueryData: () => [], setQueryData: () => {} }) }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1', metadata: {} }, userProfile: { platform_name: 'Ana', photo_url: 'x.jpg', created_at: Date.now() - 86_400_000 } }) }));
vi.mock('@/core/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const s = {};
const reset = () => Object.assign(s, {
  stats: { stats: { tournaments: 2, played: 20, wins: 12, podiums: 1, titles: 0 }, history: [], gameDayGames: [], isLoading: false, isError: false, refetch: vi.fn() },
  facts: { facts: { unknown: [], known: () => true, profile: { hasPhoto: true, hasLevel: false, registrationComplete: false }, counts: { follows: 0, clubsJoined: 0, tournamentRegistrations: 0, referralsSignedUp: 0 }, dates: {} }, sources: {}, isLoading: false, isError: false, refetch: vi.fn() },
  prefs: { prefs: { onboarding: { done: {}, dismissed: false }, celebrated: {}, display: {} }, loaded: true, error: null, update: vi.fn(() => Promise.resolve({})) },
  grants: { grants: [{ id: 'g1', uid: 'u1', kind: 'season', xp: 100 }], isLoading: false, isError: false },
  missionXp: { total: 60, docs: null, isLoading: false, isError: false },
  progression: { progression: null, isLoading: false },
  streakMeta: { meta: null, isLoading: false },
  matchDates: [],
  ach: { unlocked: [], unlockedIds: new Set(['career_first_title']), isLoading: false },
  setProgression: vi.fn(() => Promise.resolve()), syncAch: vi.fn(),
});
reset();

vi.mock('@/modules/performance/hooks/usePlayerStats', () => ({ usePlayerStats: () => s.stats }));
vi.mock('@/modules/rating/hooks/useRating', () => ({ useNationalRanking: () => ({ data: [] }), useRatingHistory: () => ({ data: [] }) }));
vi.mock('./useProgression', () => ({ usePlayerMatchDates: () => ({ data: s.matchDates }), PLAYER_RECORDS_KEY: (u) => ['rec', u] }));
vi.mock('./useActivityFacts', () => ({ useActivityFacts: () => s.facts }));
vi.mock('./useGamificationPrefs', () => ({ useGamificationPrefs: () => s.prefs }));
vi.mock('./useGamificationConfig', async () => {
  const { normalizeGamificationConfig } = await import('../domain/gamificationConfig');
  return { useGamificationConfig: () => ({ config: normalizeGamificationConfig(null), isModuleOn: () => true }) };
});
vi.mock('./useXpGrants', () => ({ useXpGrants: () => s.grants }));
vi.mock('./useMissionXpTotal', () => ({ useMissionXpTotal: () => s.missionXp }));
vi.mock('./useUserProgressionV2', () => ({ useUserProgressionV2: () => s.progression }));
vi.mock('./useStreakMetaV2', () => ({ useStreakMetaV2: () => s.streakMeta }));
vi.mock('@/modules/achievements/hooks/useUserAchievementsV2', () => ({ useUserAchievementsV2: () => s.ach }));
vi.mock('@/modules/achievements/hooks/useSyncAchievementsV2', () => ({ useSyncAchievementsV2: (...a) => s.syncAch(...a) }));
vi.mock('@/modules/progression/services/progressionV2Service', () => ({ setUserProgressionV2: (...a) => s.setProgression(...a) }));

import { useGamificationEngine } from './useGamificationEngine';

let container; let root; let engine;
function Probe({ opts }) { engine = useGamificationEngine('u1', opts); return null; }
beforeEach(() => { reset(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); engine = null; });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (opts = {}) => act(async () => { root.render(<Probe opts={opts} />); });

describe('useGamificationEngine · composição', () => {
  it('o XP soma atividade + conquistas + missões + roteiro + prêmios do servidor, e explica cada parcela', async () => {
    s.prefs.prefs.onboarding.done = { photo: 1 }; // +30 XP do roteiro (gravado)
    await render();
    const b = engine.xp.breakdown;
    expect(b.activity).toBeGreaterThan(0);
    expect(b.achievements).toBeGreaterThan(0); // bônus da conquista registrada
    expect(b.missions).toBe(60);
    expect(b.onboarding).toBe(30);
    expect(b.grants).toBe(100);
    expect(engine.xp.total).toBe(b.activity + b.achievements + b.missions + b.onboarding + b.grants);
  });

  it('as conquistas vêm medidas com os fatos; as que a plataforma não mede ficam em "em breve", fora da conta', async () => {
    await render();
    expect(engine.achievements.soon.length).toBeGreaterThan(0);
    expect(engine.achievements.total).toBe(engine.achievements.unlocked.length + engine.achievements.locked.length);
    // foto de perfil dos fatos destrava a conquista de foto (se existir no catálogo)
    expect(engine.achievements.unlocked.length).toBeGreaterThan(0);
  });

  it('o roteiro detecta a etapa pelos FATOS (foto), não por declaração', async () => {
    await render();
    expect(engine.onboarding.steps.find((x) => x.id === 'photo').complete).toBe(true);
    expect(engine.onboarding.toRecord).toContain('photo');
    expect(engine.onboarding.visible).toBe(true);
  });

  it('os marcos saem do tier, do nível, dos jogos e da sequência', async () => {
    await render();
    expect(engine.marks.some((m) => m.family === 'games')).toBe(true);
  });
});

const SEMANA = 7 * 24 * 3600_000;
const semanasAtras = (n) => Date.now() - n * SEMANA;

describe('useGamificationEngine · sequência e trilhas', () => {
  it('jogou nas últimas semanas: a sequência é a de agora, com o recorde e o estado', async () => {
    s.matchDates = [0, 1, 2, 3].map(semanasAtras);
    await render();
    expect(engine.streak.weeks).toBeGreaterThanOrEqual(3);
    expect(engine.streak.best).toBeGreaterThanOrEqual(engine.streak.weeks);
    expect(['ativa', 'em_risco']).toContain(engine.streak.status);
  });

  it('🐞 quem parou há meses NÃO segue com a sequência antiga — mas a conquista de sequência é do RECORDE', async () => {
    s.matchDates = [30, 31, 32, 33, 34].map(semanasAtras);
    await render();
    expect(engine.streak.weeks).toBe(0);
    expect(engine.streak.status).toBe('quebrada');
    expect(engine.streak.best).toBe(5);
    const ids = engine.achievements.unlocked.map((a) => a.id);
    expect(ids).toContain('career_streak_4');
  });

  it('as férias da pessoa entram na conta', async () => {
    s.matchDates = [0, 6, 7].map(semanasAtras);
    s.streakMeta = { meta: { vacations: [{ from: semanasAtras(5), to: semanasAtras(2) }] }, isLoading: false };
    await render();
    expect(engine.streak.weeks).toBe(3); // as semanas de férias ligam as duas pontas sem somar
  });

  it('as trilhas de Social, Arena, Aulas e Clube saem dos fatos (não ficam zeradas por construção)', async () => {
    s.facts.facts.counts = { ...s.facts.facts.counts, follows: 3, bookingsPlayed: 2, lessonsCompleted: 1, clubsJoined: 1 };
    await render();
    expect(engine.skillTrees.social.xp).toBeGreaterThan(0);
    expect(engine.skillTrees.arena.xp).toBeGreaterThan(0);
    expect(engine.skillTrees.coach.xp).toBeGreaterThan(0);
    expect(engine.skillTrees.club.xp).toBeGreaterThan(0);
  });
});

describe('useGamificationEngine · quem escreve', () => {
  it('sem `sync` não grava NADA (hub só olhando, revisão, conquistas de outra tela)', async () => {
    await render({ sync: false });
    expect(s.setProgression).not.toHaveBeenCalled();
    expect(s.prefs.update).not.toHaveBeenCalled();
    expect(s.syncAch.mock.calls.at(-1)[3]).toBe(false);
  });

  it('com `sync` e tudo carregado: grava a progressão (com a origem do XP) e o roteiro detectado', async () => {
    await render({ sync: true });
    expect(s.setProgression).toHaveBeenCalledTimes(1);
    const doc = s.setProgression.mock.calls[0][1];
    expect(doc.xpTotal).toBe(engine.xp.total);
    expect(doc.grantsXp).toBe(100);
    expect(doc.xpBreakdown.missions).toBe(60);
    expect(doc.source).toBe('seed');
    expect(s.prefs.update).toHaveBeenCalledWith({ onboarding: { done: { photo: expect.any(Number) } } });
    expect(s.syncAch.mock.calls.at(-1)[3]).toBe(true);
  });

  it('não grava duas vezes o mesmo resultado (re-render não reescreve o documento)', async () => {
    await render({ sync: true });
    await render({ sync: true });
    expect(s.setProgression).toHaveBeenCalledTimes(1);
  });

  it('documento já em dia não é reescrito (nem a cada abertura do app)', async () => {
    await render({ sync: true });
    const gravado = s.setProgression.mock.calls[0][1];
    act(() => root.unmount());
    container.remove();
    // outra abertura do app: o documento gravado já diz o mesmo
    s.setProgression.mockClear();
    s.progression.progression = gravado;
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
    await render({ sync: true });
    expect(s.setProgression).not.toHaveBeenCalled();
  });

  const naoGrava = async (preparar, motivo) => {
    preparar();
    await render({ sync: true });
    expect(s.setProgression, motivo).not.toHaveBeenCalled();
    expect(engine.ready, motivo).toBe(false);
  };

  it('⭐ com QUALQUER fonte essencial faltando ou em erro, nada é gravado (total parcial não vira total)', async () => {
    await naoGrava(() => { s.stats.isError = true; }, 'estatísticas em erro');
    reset(); await naoGrava(() => { s.stats.isLoading = true; }, 'estatísticas carregando');
    reset(); await naoGrava(() => { s.missionXp.isError = true; }, 'XP de missões em erro');
    reset(); await naoGrava(() => { s.grants.isError = true; }, 'prêmios em erro');
    reset(); await naoGrava(() => { s.prefs.error = new Error('x'); }, 'preferências em erro');
    reset(); await naoGrava(() => { s.prefs.loaded = false; }, 'preferências carregando');
    reset(); await naoGrava(() => { s.facts.facts = null; }, 'fatos ainda sem chegar');
    reset(); await naoGrava(() => { s.progression.isLoading = true; }, 'progressão carregando');
  });

  it('a falha na gravação reabre a tentativa (não congela a progressão até recarregar)', async () => {
    s.setProgression.mockRejectedValueOnce(new Error('rede'));
    await render({ sync: true });
    expect(s.setProgression).toHaveBeenCalledTimes(1);
    // nova renderização com o mesmo resultado tenta de novo
    await render({ sync: true, force: 1 });
    await render({ sync: true, force: 2 });
    expect(s.setProgression.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('desabilitado (sem conta/flag): nada é gravado', async () => {
    await render({ enabled: false, sync: true });
    expect(s.setProgression).not.toHaveBeenCalled();
  });
});
