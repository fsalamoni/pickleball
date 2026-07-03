import React from 'react';
import { Navigate } from 'react-router-dom';
import { Trophy, Swords, Percent, Medal, Award, ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformMetricCard, PlatformSectionHeader, PlatformSurfaceCard } from '@/components/ui/platform-page';
import ErrorState from '@/components/ErrorState';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';
import ParticipationHistoryCard from '@/modules/tournament/components/ParticipationHistoryCard';
import AchievementsCard from '@/modules/achievements/components/AchievementsCard';
import RatingSparkline from '@/modules/rating/components/RatingSparkline';
import { useRatingHistory } from '@/modules/rating/hooks/useRating';
import ProgressionCard from '@/modules/progression/components/ProgressionCard';
import GoalsCard from '@/modules/progression/components/GoalsCard';
import { usePlayerMatchDates } from '@/modules/progression/hooks/useProgression';
import { usePlayerStats } from '../hooks/usePlayerStats.js';

function formatPercent(rate) {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

export default function MyPerformance() {
  const enabled = useFeatureFlag(FEATURE_FLAG.PLAYER_PERFORMANCE);
  const achievementsOn = useFeatureFlag(FEATURE_FLAG.ACHIEVEMENTS);
  const ratingHistoryOn = useFeatureFlag(FEATURE_FLAG.RATING_HISTORY);
  const progressionOn = useFeatureFlag(FEATURE_FLAG.PLAYER_PROGRESSION);
  const { user } = useAuth();
  const { stats, isLoading, isError, refetch } = usePlayerStats();
  const { data: ratingHistory = [] } = useRatingHistory(user?.uid, ratingHistoryOn);
  const { data: matchDates = [] } = usePlayerMatchDates(user?.uid, progressionOn);
  const currentRating = ratingHistory.length ? ratingHistory[ratingHistory.length - 1].rating : 0;

  if (!enabled) return <Navigate to="/inicio" replace />;

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <ErrorState message="Não foi possível carregar seu desempenho." onRetry={refetch} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const formats = Object.entries(stats.byFormat);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PlatformSurfaceCard>
        <PlatformSectionHeader
          eyebrow="Desempenho"
          title="Sua leitura competitiva na plataforma"
          description="Estatísticas, histórico e evolução reunidos para mostrar como você está performando ao longo do tempo."
        />
      </PlatformSurfaceCard>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <PlatformMetricCard icon={Trophy} label="Torneios" value={stats.tournaments} />
        <PlatformMetricCard icon={ListChecks} label="Inscrições" value={stats.registrations} />
        <PlatformMetricCard icon={Swords} label="Jogos" value={stats.played} />
        <PlatformMetricCard
          icon={Percent}
          label="Aproveitamento"
          value={formatPercent(stats.winRate)}
          description={`${stats.wins}V – ${stats.losses}D`}
        />
        <PlatformMetricCard icon={Award} label="Títulos" value={stats.titles} description="Torneios encerrados" />
        <PlatformMetricCard icon={Medal} label="Pódios" value={stats.podiums} description="Top 3 em encerrados" />
      </div>

      {formats.length > 0 && (
        <PlatformSurfaceCard contentClassName="p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">Desempenho por formato</h2>
            <div className="space-y-2">
              {formats.map(([format, b]) => (
                <div
                  key={format}
                  className="flex items-center justify-between gap-4 rounded-md border border-gray-200 p-3"
                >
                  <span className="text-sm font-medium text-gray-600">
                    {MODALITY_FORMAT_LABELS[format] || format}
                  </span>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {b.played} jogo(s) · {b.wins}V – {b.losses}D ·{' '}
                    <strong className="text-ink">{formatPercent(b.winRate)}</strong>
                  </span>
                </div>
              ))}
            </div>
        </PlatformSurfaceCard>
      )}

      {progressionOn && <ProgressionCard summary={stats} matchDates={matchDates} />}

      {ratingHistoryOn && <RatingSparkline points={ratingHistory} />}

      {achievementsOn && <AchievementsCard summary={stats} />}

      {progressionOn && (
        <GoalsCard
          uid={user?.uid}
          values={{ games: stats.played, wins: stats.wins, tournaments: stats.tournaments, rating: currentRating }}
        />
      )}

      <ParticipationHistoryCard />
    </div>
  );
}
