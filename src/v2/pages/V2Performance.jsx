import React from 'react';
import { Award, ListChecks, Medal, Percent, Swords, Trophy } from 'lucide-react';
import { usePlayerStats } from '@/modules/performance/hooks/usePlayerStats';
import { MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useRatingHistory } from '@/modules/rating/hooks/useRating';
import { usePlayerMatchDates } from '@/modules/progression/hooks/useProgression';
import ProgressionCard from '@/modules/progression/components/ProgressionCard';
import GoalsCard from '@/modules/progression/components/GoalsCard';
import RatingSparkline from '@/modules/rating/components/RatingSparkline';
import AchievementsCard from '@/modules/achievements/components/AchievementsCard';
import {
  V2PageIntro,
  V2Skeleton,
  V2StatCard,
  V2Surface,
} from '@/v2/ui/primitives';

function formatPercent(rate) {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

export default function V2Performance() {
  const { user } = useAuth();
  const achievementsOn = useFeatureFlag(FEATURE_FLAG.ACHIEVEMENTS);
  const ratingHistoryOn = useFeatureFlag(FEATURE_FLAG.RATING_HISTORY);
  const progressionOn = useFeatureFlag(FEATURE_FLAG.PLAYER_PROGRESSION);
  const { stats, isLoading } = usePlayerStats();
  const { data: ratingHistory = [] } = useRatingHistory(user?.uid, ratingHistoryOn);
  const { data: matchDates = [] } = usePlayerMatchDates(user?.uid, progressionOn);
  const currentRating = ratingHistory.length ? ratingHistory[ratingHistory.length - 1].rating : 0;
  const formats = Object.entries(stats?.byFormat || {});

  return (
    <div className="mx-auto max-w-[1200px]">
      <V2PageIntro title="Meu desempenho" subtitle="Estatísticas, histórico e evolução dos seus jogos e torneios." />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <V2Skeleton key={i} className="h-40 rounded-4xl" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <V2StatCard icon={Trophy} accent="ink" label="Torneios" value={stats.tournaments} />
            <V2StatCard icon={ListChecks} accent="blue" label="Inscrições" value={stats.registrations} />
            <V2StatCard icon={Swords} accent="ink" label="Jogos" value={stats.played} />
            <V2StatCard icon={Percent} accent="acid" label="Aproveitamento" value={formatPercent(stats.winRate)} hint={`${stats.wins}V – ${stats.losses}D`} />
            <V2StatCard icon={Award} accent="green" label="Títulos" value={stats.titles} />
            <V2StatCard icon={Medal} accent="ink" label="Pódios" value={stats.podiums} />
          </div>

          {formats.length > 0 && (
            <V2Surface className="mt-8">
              <h2 className="mb-4 font-display text-lg font-bold text-ink">Desempenho por formato</h2>
              <div className="space-y-2">
                {formats.map(([format, b]) => (
                  <div key={format} className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-paper p-4">
                    <span className="text-sm font-semibold text-ink">{MODALITY_FORMAT_LABELS[format] || format}</span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      {b.played} jogo(s) · {b.wins}V – {b.losses}D · <strong className="text-ink">{formatPercent(b.winRate)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </V2Surface>
          )}

          {progressionOn && (
            <div className="mt-8"><ProgressionCard summary={stats} matchDates={matchDates} /></div>
          )}

          {ratingHistoryOn && ratingHistory.length >= 2 && (
            <div className="mt-8"><RatingSparkline points={ratingHistory} /></div>
          )}

          {achievementsOn && (
            <div className="mt-8"><AchievementsCard summary={stats} /></div>
          )}

          {progressionOn && (
            <div className="mt-8">
              <GoalsCard
                uid={user?.uid}
                values={{ games: stats.played, wins: stats.wins, tournaments: stats.tournaments, rating: currentRating }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
