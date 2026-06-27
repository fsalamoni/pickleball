import React from 'react';
import { Navigate } from 'react-router-dom';
import { Trophy, Swords, Percent, Medal, Award, ListChecks } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
          {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyPerformance() {
  const enabled = useFeatureFlag(FEATURE_FLAG.PLAYER_PERFORMANCE);
  const achievementsOn = useFeatureFlag(FEATURE_FLAG.ACHIEVEMENTS);
  const ratingHistoryOn = useFeatureFlag(FEATURE_FLAG.RATING_HISTORY);
  const progressionOn = useFeatureFlag(FEATURE_FLAG.PLAYER_PROGRESSION);
  const { user } = useAuth();
  const { stats, isLoading } = usePlayerStats();
  const { data: ratingHistory = [] } = useRatingHistory(user?.uid, ratingHistoryOn);
  const { data: matchDates = [] } = usePlayerMatchDates(user?.uid, progressionOn);
  const currentRating = ratingHistory.length ? ratingHistory[ratingHistory.length - 1].rating : 0;

  if (!enabled) return <Navigate to="/inicio" replace />;

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
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Trophy} label="Torneios" value={stats.tournaments} />
        <StatCard icon={ListChecks} label="Inscrições" value={stats.registrations} />
        <StatCard icon={Swords} label="Jogos" value={stats.played} />
        <StatCard
          icon={Percent}
          label="Aproveitamento"
          value={formatPercent(stats.winRate)}
          hint={`${stats.wins}V – ${stats.losses}D`}
        />
        <StatCard icon={Award} label="Títulos" value={stats.titles} hint="Torneios encerrados" />
        <StatCard icon={Medal} label="Pódios" value={stats.podiums} hint="Top 3 em encerrados" />
      </div>

      {formats.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Desempenho por formato</h2>
            <div className="space-y-2">
              {formats.map(([format, b]) => (
                <div
                  key={format}
                  className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-3"
                >
                  <span className="text-sm font-medium text-slate-700">
                    {MODALITY_FORMAT_LABELS[format] || format}
                  </span>
                  <span className="text-xs text-slate-600 tabular-nums">
                    {b.played} jogo(s) · {b.wins}V – {b.losses}D ·{' '}
                    <strong className="text-slate-900">{formatPercent(b.winRate)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
