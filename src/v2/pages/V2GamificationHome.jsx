import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Award, ChevronRight, CircleHelp, Flame, Settings2, Sparkles, Target, Trophy, Users, Zap,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useKudoActions } from '@/modules/progression/hooks/useKudoActions';
import { useUserReferralCode } from '@/modules/progression/hooks/useUserReferralCode';
import { useScopedMissions } from '@/modules/progression/hooks/useScopedMissions';
import { useCelebrationListener } from '@/modules/progression/hooks/useCelebrationListener';
import { useGamificationTracker } from '@/modules/progression/hooks/useGamificationTracker';
import { useGamificationEngine } from '@/modules/progression/hooks/useGamificationEngine';
import { usePeriodReview } from '@/modules/progression/hooks/usePeriodReview';
import { useGameRecords } from '@/modules/progression/hooks/useGameRecords';
import { useUserCurrentSeason } from '@/modules/progression/hooks/useUserSeasonRanking';
import { buildEligibilitySnapshot } from '@/modules/progression/domain/rewards';
import { ACHIEVEMENTS_V2 } from '@/modules/achievements/domain/achievementsV2';
import TierBadge from '@/modules/progression/components/TierBadge';
import SkillTreeBars from '@/modules/progression/components/SkillTreeBars';
import ReferralCard from '@/modules/progression/components/ReferralCard';
import MissionCompleteToast from '@/modules/progression/components/MissionCompleteToast';
import SeasonBanner from '@/modules/progression/components/SeasonBanner';
import AchievementCardV2 from '@/modules/achievements/components/AchievementCardV2';
import AchievementUnlockToast from '@/modules/achievements/components/AchievementUnlockToast';
import MissionsPanel from '@/v2/components/gamification/MissionsPanel';
import StreakCard from '@/v2/components/gamification/StreakCard';
import HowItWorks from '@/v2/components/gamification/HowItWorks';
import TermHint from '@/v2/components/gamification/TermHint';
import OnboardingRoadmap from '@/v2/components/gamification/OnboardingRoadmap';
import PeriodReviewCard from '@/v2/components/gamification/PeriodReviewCard';
import CelebrationHost from '@/v2/components/gamification/CelebrationHost';
import XpBreakdownCard from '@/v2/components/gamification/XpBreakdownCard';
import DuelCard from '@/v2/components/gamification/DuelCard';
import ChallengesPanel from '@/v2/components/gamification/ChallengesPanel';
import ReviewsPanel from '@/v2/components/gamification/ReviewsPanel';
import LettersPanel from '@/v2/components/gamification/LettersPanel';
import ReputationCard from '@/v2/components/gamification/ReputationCard';
import RewardsPanel from '@/v2/components/gamification/RewardsPanel';
import IssuerShortcuts from '@/v2/components/gamification/IssuerShortcuts';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2PageIntro, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { V2SectionNav } from '@/v2/ui/V2SectionNav';
import { HUB_TABS, abaDaUrl } from '@/v2/components/gamification/hubTabs';
import { useHashScroll } from '@/v2/ui/useHashScroll';

/**
 * V2GamificationHome — o hub da gamificação, em cinco abas:
 * Jornada (progresso, primeiros passos, revisão), Missões (dia, semana, mês),
 * Competir (temporada, duelo, desafios), Social (avaliações, cartas, reputação)
 * e Recompensas. Cada módulo some se o admin o desligou.
 *
 * Gated por GAMIFICATION_V2.
 */
export default function V2GamificationHome() {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  if (!gamificationOn) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <V2PageIntro title="Gamificação" subtitle="Veja missões, conquistas, trilhas de XP e convites em um só lugar." />
        <V2Surface>
          <V2EmptyState
            icon={Sparkles}
            title="Gamificação V2 em construção"
            description="Esta seção estará disponível em breve. Por enquanto, explore as conquistas clássicas em 'Meu desempenho'."
            action={<V2Button asChild><Link to="/meu-desempenho">Ir para Meu desempenho</Link></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }
  return <V2GamificationHomeOn />;
}

function V2GamificationHomeOn() {
  const { user, userProfile } = useAuth();
  const uid = user?.uid;
  useHashScroll();
  const [params, setParams] = useSearchParams();
  const { track, enabled: telemetryOn } = useGamificationTracker();

  // O motor do cliente: XP, conquistas, roteiro e marcos — e as gravações do dono.
  const engine = useGamificationEngine(uid, { enabled: !!uid, sync: true });
  const { isModuleOn, config } = engine;
  const records = useGameRecords(uid, !!uid);

  const abasVisiveis = useMemo(
    () => HUB_TABS.filter((a) => !a.modules || a.modules.some((m) => isModuleOn(m))),
    [isModuleOn],
  );
  const aba = abaDaUrl(params.get('aba'), abasVisiveis);
  const trocarAba = (a) => {
    const next = new URLSearchParams(params);
    if (a.id === 'jornada') next.delete('aba'); else next.set('aba', a.id);
    setParams(next, { replace: true });
  };

  const { index: kudoIndex } = useKudoActions(uid, !!uid);
  const { code: referralCode } = useUserReferralCode(uid, !!uid);
  const streakMeta = engine.streakMeta;
  const tier = engine.xp.tier.name;

  // Fontes de ATIVIDADE REAL das missões — nenhuma vem de clique.
  const activity = useMemo(() => ({
    matchDates: engine.matchDates,
    gameDayDates: engine.dates.gameDayDates,
    tournamentDates: engine.dates.tournamentDates,
    kudoIndex, referralCode, facts: engine.facts,
  }), [engine.matchDates, engine.dates, kudoIndex, referralCode, engine.facts]);

  const modulesCfg = config.modules;
  const missionsReady = !!uid && engine.ready;
  const daily = useScopedMissions(uid, 'daily', { tier, enabled: missionsReady, activity, modules: modulesCfg });
  const weekly = useScopedMissions(uid, 'weekly', { tier, enabled: missionsReady && isModuleOn('missions_weekly'), activity, modules: modulesCfg });
  const monthly = useScopedMissions(uid, 'monthly', { tier, enabled: missionsReady && isModuleOn('missions_monthly'), activity, modules: modulesCfg });
  const scopes = { daily, weekly, monthly };

  const review = usePeriodReview(engine, 'week', 0);
  const season = useUserCurrentSeason(uid, !!uid && isModuleOn('hall_of_fame'));

  // Toasts: missão do dia cumprida e conquista desbloqueada.
  const [celebratedMission, setCelebratedMission] = useState(null);
  const [celebratedAchievement, setCelebratedAchievement] = useState(null);
  useCelebrationListener({
    missions: daily.missions,
    unlockedAchievements: engine.persistedAchievements,
    onMissionCompleted: (m) => {
      setCelebratedMission(m);
      if (telemetryOn) track('gamification_mission_completed', { mission_id: m.id, xp: m.xp });
    },
    onAchievementUnlocked: (a) => {
      setCelebratedAchievement(ACHIEVEMENTS_V2.find((def) => def.id === a.achievementId) || null);
      if (telemetryOn) track('gamification_achievement_unlocked', { achievement_id: a.achievementId, family: a.family, rarity: a.rarity });
    },
  });

  // O retrato de quem pede uma recompensa.
  const eligibility = useMemo(() => buildEligibilitySnapshot({
    tier, level: engine.xp.level.level, achievementIds: engine.persistedIds,
    seasonPercent: season.season?.percent ?? null,
    streakWeeks: engine.streak.weeks, games: engine.stats?.played || 0,
  }), [tier, engine.xp.level.level, engine.persistedIds, engine.streak.weeks, engine.stats?.played, season.season]);

  const unlockedHighlights = useMemo(() => {
    const items = [...engine.achievements.unlocked.slice(-3).reverse().map((a) => ({ ...a, unlocked: true }))];
    if (items.length < 4) items.push(...engine.achievements.locked.filter((a) => a.progress > 0).sort((a, b) => b.progress - a.progress).slice(0, 4 - items.length).map((a) => ({ ...a, unlocked: false })));
    if (items.length < 4) items.push(...engine.achievements.locked.slice(0, 4 - items.length).map((a) => ({ ...a, unlocked: false })));
    return items.slice(0, 4);
  }, [engine.achievements]);

  if (engine.isLoading) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <V2PageIntro title="Gamificação" subtitle="..." />
        <V2Skeleton className="h-96 rounded-4xl" />
      </div>
    );
  }
  if (engine.isError && !engine.stats) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <V2PageIntro title="Gamificação" subtitle="Missões, conquistas e competição." />
        <V2Surface><V2ErrorState title="Não deu para carregar a sua jornada" onRetry={engine.refetch} /></V2Surface>
      </div>
    );
  }

  const { xp, streak } = engine;
  const totalAch = engine.achievements.total;

  return (
    <div className="mx-auto max-w-[1100px] space-y-5" data-testid="gamification-hub">
      <V2PageIntro
        title="Gamificação"
        subtitle="Missões, conquistas, temporada, desafios e recompensas — tudo medido pelo que você joga de verdade."
        action={
          <div className="flex items-center gap-2">
            <V2Badge tone="green"><Zap className="h-3.5 w-3.5" /> {xp.total.toLocaleString('pt-BR')} XP</V2Badge>
            <V2Button asChild variant="ghost" size="sm"><Link to="/gamification/como-funciona" data-dica="gamificacao-guia" aria-label="Como funciona a gamificação"><CircleHelp className="h-4 w-4" /></Link></V2Button>
            <V2Button asChild variant="ghost" size="sm"><Link to="/gamification/configuracoes" data-dica="gamificacao-preferencias" aria-label="Preferências da gamificação"><Settings2 className="h-4 w-4" /></Link></V2Button>
          </div>
        }
      />

      {/* Cabeçalho fixo: tier, nível, sequência e conquistas */}
      <V2Surface data-dica="gamificacao-resumo">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Sparkles className="h-5 w-5" /></div>
            <div>
              <div className="flex items-center gap-1"><TierBadge xp={xp.total} size="sm" /><TermHint term="tier" /></div>
              <p className="mt-0.5 flex items-center gap-0.5 text-xs text-gray-500">Nível {xp.level.level} · {xp.level.xpIntoLevel}/{xp.level.xpForNext} XP <TermHint term="nivel" className="h-5 w-5" /></p>
            </div>
          </div>
          <Link to="/gamification#sequencia-card" className="flex items-center gap-3 rounded-2xl hover:bg-paper">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"><Flame className="h-5 w-5" aria-hidden="true" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-ink">{streak.weeks}</p>
              <p className="text-xs text-gray-500">{streak.weeks === 1 ? 'semana seguida' : 'semanas seguidas'}{streak.status === 'em_risco' ? ' · jogue até domingo' : ''}</p>
            </div>
          </Link>
          <Link to="/conquistas" className="flex items-center gap-3 rounded-2xl hover:bg-paper">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><Award className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-ink">{engine.achievements.unlockedCount}<span className="text-sm text-gray-400">/{totalAch}</span></p>
              <p className="text-xs text-gray-500">conquistas · ver todas</p>
            </div>
          </Link>
        </div>
        {xp.tierProgress.next && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Próximo tier: <strong className="text-ink">{xp.tierProgress.next.name}</strong> {xp.tierProgress.next.icon}</span>
              <span className="font-bold tabular-nums text-ink">{Math.round(xp.tierProgress.progress * 100)}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500" style={{ width: `${Math.round(xp.tierProgress.progress * 100)}%` }} />
            </div>
          </div>
        )}
      </V2Surface>

      <V2SectionNav sections={abasVisiveis} activeId={aba} onSelect={trocarAba} ariaLabel="Seções da gamificação" dica="gamificacao-abas" />

      <HowItWorks tab={aba} />

      {aba === 'jornada' && (
        <div className="space-y-5">
          {isModuleOn('onboarding') && engine.onboarding.visible && (
            <OnboardingRoadmap state={engine.onboarding} onDismiss={() => engine.updatePrefs({ onboarding: { dismissed: true } })} />
          )}
          <MissionsMini daily={daily} onOpen={() => trocarAba({ id: 'missoes' })} />
          {isModuleOn('weekly_review') && !review.isLoading && review.review && <PeriodReviewCard review={review.review} />}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Award className="h-5 w-5" /> Conquistas em destaque <TermHint term="conquistas" /></h2>
              <Link to="/conquistas" className="inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline">Ver todas <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {unlockedHighlights.map((a) => <AchievementCardV2 key={a.id} achievement={a} compact />)}
            </div>
          </div>
          <div id="sequencia-card" className="scroll-mt-6"><StreakCard
            streak={streak}
            meta={streakMeta.meta}
            onStartVacation={streakMeta.enableVacation}
            onEndVacation={streakMeta.disableVacation}
            busy={streakMeta.isMutating}
            error={streakMeta.vacationError}
          /></div>
          <XpBreakdownCard uid={uid} xp={xp} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <V2Surface>
              <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink"><Target className="h-5 w-5" /> Trilhas paralelas <TermHint term="trilhas" /></h2>
              <SkillTreeBars trees={engine.skillTrees} compact />
            </V2Surface>
            <div id="convite" className="scroll-mt-6">
              <ReferralCard
                user={{ uid, platform_name: user?.displayName }}
                code={referralCode?.code || null}
                origin={typeof window !== 'undefined' ? window.location.origin : ''}
                referralsCount={referralCode?.totalSignups || 0}
                onShare={() => {
                  if (telemetryOn) track('gamification_referral_shared', { code: referralCode?.code });
                  engine.updatePrefs({ onboarding: { done: { share: Date.now() } } });
                }}
              />
            </div>
          </div>
          <LinkTiles hallOn={isModuleOn('hall_of_fame')} bondsOn={isModuleOn('social_bonds')} />
        </div>
      )}

      {aba === 'missoes' && <MissionsPanel scopes={scopes} isModuleOn={isModuleOn} onTrack={(scope, xpv) => telemetryOn && track('gamification_mission_bonus_claimed', { scope, xp: xpv })} />}

      {aba === 'competir' && (
        <div className="space-y-5">
          <SeasonBanner />
          {isModuleOn('duels') && <DuelCard uid={uid} records={records.records} />}
          {isModuleOn('challenges') && <ChallengesPanel uid={uid} />}
          <LinkTiles hallOn={isModuleOn('hall_of_fame')} bondsOn={false} />
        </div>
      )}

      {aba === 'social' && (
        <div className="space-y-5">
          {isModuleOn('match_reviews') && <ReputationCard uid={uid} minForPublicScore={config.reviews.minForPublicScore} />}
          {isModuleOn('match_reviews') && (
            <ReviewsPanel
              uid={uid} records={records.records} windowDays={config.reviews.windowDays}
              recordsLoading={records.isLoading} recordsError={records.isError} onRetry={records.refetch}
            />
          )}
          {isModuleOn('partner_letters') && <LettersPanel uid={uid} fromName={userProfile?.platform_name || user?.displayName || ''} records={records.records} />}
          {isModuleOn('social_bonds') && (
            <Link to="/vinculos" className="flex items-center gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4 transition-colors hover:border-gray-200 hover:bg-paper">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-700"><Users className="h-5 w-5" aria-hidden="true" /></div>
              <div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink">Vínculos</p><p className="text-xs text-gray-500">Rivais, crews e mentorias</p></div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      {aba === 'recompensas' && (
        <div className="space-y-5">
          <RewardsPanel uid={uid} user={{ uid, displayName: userProfile?.platform_name || user?.displayName }} snapshot={eligibility} />
          <IssuerShortcuts />
        </div>
      )}

      {aba !== 'recompensas' && <IssuerShortcuts />}

      <CelebrationHost marks={engine.marks} prefs={engine.prefs} ready={engine.ready} update={engine.updatePrefs} enabled={isModuleOn('celebrations')} />
      <MissionCompleteToast mission={celebratedMission} onClose={() => setCelebratedMission(null)} />
      {celebratedAchievement && <AchievementUnlockToast achievement={celebratedAchievement} onClose={() => setCelebratedAchievement(null)} />}
    </div>
  );
}

/** O resumo das missões de hoje, com atalho para a aba de missões. */
function MissionsMini({ daily, onOpen }) {
  if (daily.isLoading || !daily.doc) return null;
  const lista = daily.missions;
  const feitas = lista.filter((m) => (m.current || 0) >= (m.target || 1)).length;
  return (
    <V2Surface data-testid="missions-mini" className="!p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Target className="h-5 w-5" /> Missões de hoje</h2>
          <p className="text-sm text-gray-500">{feitas} de {lista.length} cumpridas. {feitas === lista.length && lista.length > 0 ? 'Bônus do dia liberado!' : 'Jogue e elas avançam sozinhas.'}</p>
        </div>
        <V2Button size="sm" variant="secondary" onClick={onOpen}>Ver missões</V2Button>
      </div>
    </V2Surface>
  );
}

function LinkTiles({ hallOn, bondsOn }) {
  if (!hallOn && !bondsOn) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {bondsOn && (
        <Link to="/vinculos" data-testid="link-vinculos" className="flex items-center gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4 transition-colors hover:border-gray-200 hover:bg-paper">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-100 text-purple-700"><Users className="h-5 w-5" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink">Vínculos</p><p className="text-xs text-gray-500">Rivais, crews e mentorias</p></div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        </Link>
      )}
      {hallOn && (
        <Link to="/hall-da-fama" data-testid="link-hall-da-fama" className="flex items-center gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4 transition-colors hover:border-gray-200 hover:bg-paper">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Trophy className="h-5 w-5" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold text-ink">Hall da Fama</p><p className="text-xs text-gray-500">Temporada do mês e os maiores de todos os tempos</p></div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
