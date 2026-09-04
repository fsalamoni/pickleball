import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Sparkles, Target, TrendingUp, Trophy, Users, Zap, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { useKudoActions } from '@/modules/progression/hooks/useKudoActions';
import { usePlayerMatchDates } from '@/modules/progression/hooks/useProgression';
import { useAchievementsV2 } from '@/modules/achievements/hooks/useAchievementsV2';
import { ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2';
import { useUserAchievementsV2 } from '@/modules/achievements/hooks/useUserAchievementsV2';
import { useSyncAchievementsV2 } from '@/modules/achievements/hooks/useSyncAchievementsV2';
import { useUserProgressionV2 } from '@/modules/progression/hooks/useUserProgressionV2';
import { useUserMissionsV2 } from '@/modules/progression/hooks/useUserMissionsV2';
import { useSyncProgressionV2 } from '@/modules/progression/hooks/useSyncProgressionV2';
import { useStreakMetaV2 } from '@/modules/progression/hooks/useStreakMetaV2';
import { useCelebrationListener } from '@/modules/progression/hooks/useCelebrationListener';
import { computeXpV2, levelFromXpV2, XP_WEIGHTS_V2 } from '@/modules/progression/domain/progressionV2';
import { extractActivityDates } from '@/modules/progression/domain/missionMetrics';
import { tierProgress } from '@/modules/progression/domain/tiers';
import { buildSkillTrees } from '@/modules/progression/domain/skillTrees';
import { computeProtectedStreak } from '@/modules/progression/domain/streakProtection';
import { MISSION_BONUS_XP } from '@/modules/progression/domain/missions';
import { useUserReferralCode } from '@/modules/progression/hooks/useUserReferralCode';
import { useGamificationTracker } from '@/modules/progression/hooks/useGamificationTracker';
import TierBadge from '@/modules/progression/components/TierBadge';
import SkillTreeBars from '@/modules/progression/components/SkillTreeBars';
import MissionList from '@/modules/progression/components/MissionList';
import ReferralCard from '@/modules/progression/components/ReferralCard';
import MissionCompleteToast from '@/modules/progression/components/MissionCompleteToast';
import StreakShieldBadge from '@/modules/progression/components/StreakShieldBadge';
import SeasonBanner from '@/modules/progression/components/SeasonBanner';
import AchievementCardV2 from '@/modules/achievements/components/AchievementCardV2';
import AchievementUnlockToast from '@/modules/achievements/components/AchievementUnlockToast';
import {
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

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
          subtitle="Veja missões, conquistas, trilhas de XP e convites em um só lugar."
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
  const { stats, history, gameDayGames, isLoading: statsLoading } = usePlayerStats();
  const { data: matchDates = [] } = usePlayerMatchDates(user?.uid, true);
  const { result: achievements } = useAchievementsV2();
  const { track, enabled: telemetryOn } = useGamificationTracker();

  // ===== Persistência V2 (Firestore) =====
  // Sincroniza stats V1 → doc materializado V2 (cria/atualiza se preciso)
  const { unlocked: unlockedFromDb, unlockedIds: persistedIds } = useUserAchievementsV2(user?.uid, !!user);
  // O XP agora soma atividade + bônus das conquistas registradas + missões
  // concluídas, então o sync precisa dos ids persistidos.
  useSyncProgressionV2(user?.uid, stats, !!user, persistedIds);
  const { progression } = useUserProgressionV2(user?.uid, !!user);

  // Registra em `user_achievements_v2` o que o cálculo diz que o atleta já
  // ganhou. Sem isso o cálculo nunca virava registro: perfil público e Hall
  // da Fama mostravam 0 para todo mundo e o toast jamais disparava.
  useSyncAchievementsV2(user?.uid, achievements?.unlocked, persistedIds, !!user);
  const { index: kudoIndex } = useKudoActions(user?.uid, !!user);
  // O código de convite tem de ser o PERSISTIDO do usuário. Antes a página
  // chamava `generateReferralCode()` no render: o atleta via um código
  // aleatório diferente a cada carregamento, que não pertencia a ninguém e
  // nunca era gravado — ou seja, nenhuma indicação jamais seria creditada.
  const { code: referralCode } = useUserReferralCode(user?.uid, !!user);

  // Fontes de ATIVIDADE REAL que alimentam o progresso das missões. Nenhuma
  // vem de clique do usuário — missão não é auto-declaração. A extração das
  // datas mora no domínio (`extractActivityDates`), testada contra o formato
  // real: adivinhar os nomes dos campos aqui já deixou missão parada em zero.
  const { tournamentDates, gameDayDates } = useMemo(
    () => extractActivityDates({ history, gameDayGames }),
    [history, gameDayGames],
  );

  const {
    missions: dailyMissions,
    doc: missionsDoc,
    claimBonus: doClaimBonus,
    isClaiming,
  } = useUserMissionsV2(
    user?.uid,
    progression?.tier || 'Calouro',
    !!user,
    {
      matchDates, gameDayDates, tournamentDates, kudoIndex, referralCode,
    },
  );
  const streakMeta = useStreakMetaV2(user?.uid, !!user);

  // Celebration listener — dispara toasts quando missões/achievements desbloqueiam
  const [celebratedMission, setCelebratedMission] = React.useState(null);
  const [celebratedAchievement, setCelebratedAchievement] = React.useState(null);
  useCelebrationListener({
    missions: dailyMissions,
    unlockedAchievements: unlockedFromDb,
    onMissionCompleted: (m) => {
      setCelebratedMission(m);
      if (telemetryOn) track('gamification_mission_completed', { mission_id: m.id, xp: m.xp });
    },
    onAchievementUnlocked: (a) => {
      // O toast de conquista existia mas nunca era renderizado — o unlock
      // acontecia em silêncio. Aqui ele finalmente aparece.
      setCelebratedAchievement(
        ACHIEVEMENTS_V2.find((def) => def.id === a.achievementId) || null,
      );
      if (telemetryOn) track('gamification_achievement_unlocked', { achievement_id: a.achievementId, family: a.family, rarity: a.rarity });
    },
  });

  // ===== XP/tier/skills =====
  // Prioriza dados persistidos; fallback pra cálculo do V1
  const xpBySource = useMemo(() => ({
    tournament_attended: stats?.tournaments || 0,
    tournament_podium: stats?.podiums || 0,
    tournament_title: stats?.titles || 0,
    game_played: stats?.played || 0,
    game_won: stats?.wins || 0,
  }), [stats]);

  const xpTotal = progression?.xpTotal ?? computeXpV2(xpBySource).xpTotal;
  const level = useMemo(
    () => (progression ? { level: progression.level, xpIntoLevel: 0, xpForNext: 500 } : levelFromXpV2(xpTotal)),
    [progression, xpTotal],
  );
  const trees = progression?.skillTrees ?? buildSkillTrees(xpBySource, XP_WEIGHTS_V2).trees;
  const streak = useMemo(
    () => computeProtectedStreak(matchDates, { now: new Date() }),
    [matchDates],
  );
  const tierProg = useMemo(() => tierProgress(xpTotal), [xpTotal]);

  // ===== Referral =====
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // ===== Handlers =====
  function handleClaimBonus(scope) {
    if (telemetryOn) track('gamification_mission_bonus_claimed', { scope, xp: MISSION_BONUS_XP[scope] });
    doClaimBonus();
  }
  function handleShareReferral() {
    if (telemetryOn) track('gamification_referral_shared', { code: referralCode?.code });
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
        subtitle="Missões, conquistas, trilhas de XP e convites. Tudo num só lugar."
        action={
          <V2Badge tone="green">
            <Zap className="h-3.5 w-3.5" /> {xpTotal.toLocaleString('pt-BR')} XP
          </V2Badge>
        }
      />

      <SeasonBanner className="mb-6" />

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
                {progression?.achievementsUnlocked ?? achievements.unlockedCount}<span className="text-sm text-gray-400">/{progression?.achievementsTotal ?? achievements.total}</span>
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
      <div className="mb-3">
        <StreakShieldBadge
          meta={streakMeta.meta}
          onUseFreeze={streakMeta.useFreeze}
          onToggleVacation={streakMeta.meta?.vacationMode ? streakMeta.disableVacation : streakMeta.enableVacation}
        />
      </div>
      <V2Surface className="mb-6">
        <MissionList
          missions={dailyMissions.map((m) => ({
            ...m,
            done: (m.current || 0) >= (m.target || 1),
            xpReward: m.xp,
            description: m.description || m.title,
          }))}
          scope="daily"
          bonusClaimed={missionsDoc?.bonusClaimed || false}
          isClaiming={isClaiming}
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

        {/* Convite */}
        <ReferralCard
          user={{ uid: user?.uid, platform_name: user?.displayName }}
          code={referralCode?.code || null}
          origin={origin}
          referralsCount={referralCode?.totalSignups || 0}
          onShare={handleShareReferral}
        />
      </div>

      {/* Atalhos para as outras seções da gamificação */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/vinculos"
          data-testid="link-vinculos"
          className="flex items-center gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4 transition-colors hover:border-gray-200 hover:bg-paper"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Vínculos</p>
            <p className="text-xs text-gray-500">Rivais, crews e mentorias</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        </Link>
        <Link
          to="/hall-da-fama"
          data-testid="link-hall-da-fama"
          className="flex items-center gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4 transition-colors hover:border-gray-200 hover:bg-paper"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Hall da Fama</p>
            <p className="text-xs text-gray-500">Os maiores da plataforma</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        </Link>
      </div>

      {/* Info de telemetria (dev) */}
      {telemetryOn && (
        <p className="mt-6 text-center text-[10px] text-gray-400">
          Telemetria de gamificação ativa · eventos emitidos pra Firebase Analytics
        </p>
      )}

      {/* Toasts de celebração (missão completada / conquista desbloqueada) */}
      <MissionCompleteToast
        mission={celebratedMission}
        onClose={() => setCelebratedMission(null)}
      />
      {celebratedAchievement && (
        <AchievementUnlockToast
          achievement={celebratedAchievement}
          onClose={() => setCelebratedAchievement(null)}
        />
      )}
    </div>
  );
}
