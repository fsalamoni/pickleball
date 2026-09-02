import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Gift, Sparkles, Target, TrendingUp, Zap, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { useRatingHistory, useNationalRanking } from '@/modules/rating/hooks/useRating';
import { usePlayerMatchDates } from '@/modules/progression/hooks/useProgression';
import { useAchievementsV2 } from '@/modules/achievements/hooks/useAchievementsV2';
import { computeXpV2, levelFromXpV2, XP_WEIGHTS_V2 } from '@/modules/progression/domain/progressionV2';
import { tierFromXp, tierProgress } from '@/modules/progression/domain/tiers';
import { buildSkillTrees } from '@/modules/progression/domain/skillTrees';
import { computeProtectedStreak } from '@/modules/progression/domain/streakProtection';
import { generateMissions, MISSION_BONUS_XP } from '@/modules/progression/domain/missions';
import {
  generateReferralCode,
  buildReferralUrl,
  REFERRAL_REWARDS,
} from '@/modules/progression/domain/referrals';
import { useGamificationTracker } from '@/modules/progression/hooks/useGamificationTracker';
import TierBadge from '@/modules/progression/components/TierBadge';
import SkillTreeBars from '@/modules/progression/components/SkillTreeBars';
import MissionList from '@/modules/progression/components/MissionList';
import AchievementCardV2 from '@/modules/achievements/components/AchievementCardV2';
import {
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

/**
 * V2GamificationHome — hub unificado de gamificação.
 *
 * Mostra num só lugar:
 *  - Header com tier + nível + XP
 *  - Card de missões diárias (geradas agora)
 *  - Top 4 conquistas recentes (locked + unlocked mix)
 *  - Card de referral com código
 *  - Quick stats (skill trees, streak, achievements)
 *  - Atalhos: ver todas as conquistas, missões semanais/mensais
 *
 * Gated por GAMIFICATION_V2.
 */
export default function V2GamificationHome() {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  if (!gamificationOn) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <V2PageIntro
          title="Gamificação"
          subtitle="Veja missões, conquistas, skill trees e referrals em um só lugar."
        />
        <V2Surface>
          <V2EmptyState
            icon={Sparkles}
            title="Gamificação V2 em construção"
            description="Esta seção estará disponível em breve. Por enquanto, explore as conquistas clássicas em 'Meu desempenho'."
            action={
              <V2Button asChild>
                <Link to="/meu-desempenho">Ir para Meu desempenho</Link>
              </V2Button>
            }
          />
        </V2Surface>
      </div>
    );
  }
  return <V2GamificationHomeOn />;
}

function V2GamificationHomeOn() {
  const { user } = useAuth();
  const { stats, isLoading: statsLoading } = usePlayerStats();
  const { data: ratingHistory = [] } = useRatingHistory(user?.uid, true);
  const { data: matchDates = [] } = usePlayerMatchDates(user?.uid, true);
  const { data: ranking = [] } = useNationalRanking();
  const { result: achievements } = useAchievementsV2();
  const { track, enabled: telemetryOn } = useGamificationTracker();
  const [missionsClaimed, setMissionsClaimed] = useState(false);

  // XP total + tier + skill trees (mesma lógica de V2Achievements / ProgressionCardV2)
  const xpBySource = useMemo(() => ({
    tournament_attended: stats?.tournaments || 0,
    tournament_podium: stats?.podiums || 0,
    tournament_title: stats?.titles || 0,
    game_played: stats?.played || 0,
    game_won: stats?.wins || 0,
  }), [stats]);

  const xpTotal = useMemo(() => computeXpV2(xpBySource).xpTotal, [xpBySource]);
  const level = useMemo(() => levelFromXpV2(xpTotal), [xpTotal]);
  const trees = useMemo(() => buildSkillTrees(xpBySource, XP_WEIGHTS_V2).trees, [xpBySource]);
  const streak = useMemo(
    () => computeProtectedStreak(matchDates, { now: new Date() }),
    [matchDates],
  );
  const currentTier = useMemo(() => tierFromXp(xpTotal), [xpTotal]);
  const tierProg = useMemo(() => tierProgress(xpTotal), [xpTotal]);

  // Referral
  const code = useMemo(() => generateReferralCode(), []);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const referralUrl = useMemo(() => buildReferralUrl(origin, code), [origin, code]);

  // Missões diárias (geradas com seed determinístico baseado no dia)
  const dailyMissions = useMemo(() => {
    const seed = new Date().setHours(0, 0, 0, 0) + 100;
    const m = generateMissions({
      uid: user?.uid || '',
      scope: 'daily',
      currentTier: currentTier.name,
      seed,
    });
    // adiciona current progress fictício (1 jogo, 1 kudos) só pra demo
    return m.map((mission) => {
      if (mission.metric === 'game_played') return { ...mission, current: 1 };
      if (mission.metric === 'kudos_given') return { ...mission, current: 2 };
      return mission;
    });
  }, [user?.uid, currentTier.name]);

  function handleProgress(mission, delta) {
    if (telemetryOn) track('gamification_mission_progress', { mission_id: mission.id, delta });
  }
  function handleClaimBonus(scope) {
    if (telemetryOn) track('gamification_mission_bonus_claimed', { scope, xp: MISSION_BONUS_XP[scope] });
    setMissionsClaimed(true);
  }
  function handleShareReferral() {
    if (telemetryOn) track('gamification_referral_shared', { code });
  }

  // Top 4 conquistas: prioriza unlocked recentes, depois "próximas" (locked com tier baixo)
  // SEMPRE antes de qualquer return condicional (regras dos Hooks).
  const recentAchievements = useMemo(() => {
    const items = [];
    for (const a of achievements.unlocked.slice(-3).reverse()) {
      items.push({ ...a, unlocked: true });
    }
    if (items.length < 4) {
      const needed = 4 - items.length;
      items.push(...achievements.locked.slice(0, needed).map((a) => ({ ...a, unlocked: false })));
    }
    return items.slice(0, 4);
  }, [achievements]);

  const isLoading = statsLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <V2PageIntro title="Gamificação" subtitle="..." />
        <V2Skeleton className="h-96 rounded-4xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro
        title="Gamificação"
        subtitle="Missões, conquistas, skill trees e referral. Tudo num só lugar."
        action={
          <V2Badge tone="green">
            <Zap className="h-3.5 w-3.5" /> {xpTotal.toLocaleString('pt-BR')} XP
          </V2Badge>
        }
      />

      {/* Header: tier + nível + streak + progresso de tier */}
      <V2Surface className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <TierBadge xp={xpTotal} size="sm" />
              <p className="mt-1 text-xs text-gray-500">
                Nível {level.level} · {level.xpIntoLevel}/{level.xpForNext} XP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink tabular-nums">{streak.weeks}</p>
              <p className="text-xs text-gray-500">semanas seguidas</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink tabular-nums">
                {achievements.unlockedCount}<span className="text-sm text-gray-400">/{achievements.total}</span>
              </p>
              <p className="text-xs text-gray-500">conquistas</p>
            </div>
          </div>
        </div>

        {tierProg.next && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Próximo tier: <strong className="text-ink">{tierProg.next.name}</strong> {tierProg.next.icon}</span>
              <span className="font-bold tabular-nums text-ink">{Math.round(tierProg.progress * 100)}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                style={{ width: `${Math.round(tierProg.progress * 100)}%` }}
              />
            </div>
          </div>
        )}
      </V2Surface>

      {/* Missões diárias */}
      <V2Surface className="mb-6">
        <MissionList
          missions={dailyMissions}
          scope="daily"
          bonusClaimed={missionsClaimed}
          onProgress={handleProgress}
          onClaimBonus={handleClaimBonus}
        />
      </V2Surface>

      {/* Conquistas recentes */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Award className="h-5 w-5" /> Conquistas em destaque
          </h2>
          <Link
            to="/conquistas"
            className="inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline"
          >
            Ver todas <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {recentAchievements.map((a) => (
            <AchievementCardV2 key={a.id} achievement={a} compact />
          ))}
        </div>
      </div>

      {/* 2-col: skill trees + referral */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Skill trees */}
        <V2Surface>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Target className="h-5 w-5" /> Trilhas paralelas
          </h2>
          <SkillTreeBars trees={trees} compact />
        </V2Surface>

        {/* Referral */}
        <V2Surface>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Gift className="h-5 w-5" /> Convide amigos
          </h2>
          <p className="text-sm text-gray-600">
            Cada amigo que entra pelo seu código rende XP para vocês dois.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-paper p-3">
            <span data-testid="home-referral-code" className="flex-1 text-center font-mono text-2xl font-bold tracking-widest text-ink">
              {code.slice(0, 4)} {code.slice(4)}
            </span>
          </div>
          {referralUrl && (
            <p className="mt-2 break-all rounded-2xl bg-paper p-2 text-xs text-gray-500">
              {referralUrl}
            </p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
            {Object.values(REFERRAL_REWARDS).map((r, i) => (
              <div key={i} className="rounded-2xl bg-paper p-2 text-center">
                <p className="text-base font-bold text-amber-600 tabular-nums">+{r.referrerXp}</p>
                <p className="mt-0.5 text-[10px] text-gray-500">
                  {i === 0 ? 'Signup' : i === 1 ? '5+ jogos' : '1 torneio'}
                </p>
              </div>
            ))}
          </div>
          <V2Button onClick={handleShareReferral} className="mt-4 w-full">
            Compartilhar convite
          </V2Button>
        </V2Surface>
      </div>

      {/* Info de telemetria (dev) */}
      {telemetryOn && (
        <p className="mt-6 text-center text-[10px] text-gray-400">
          Telemetria de gamificação ativa · eventos emitidos pra Firebase Analytics
        </p>
      )}
    </div>
  );
}
