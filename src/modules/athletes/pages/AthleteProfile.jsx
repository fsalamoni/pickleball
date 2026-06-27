import React from 'react';
import { Navigate, useParams, Link } from 'react-router-dom';
import { Trophy, MapPin, Award, Medal, Swords, Percent, Building2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorState from '@/components/ErrorState';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import ChatLauncherButton from '@/modules/chat/components/ChatLauncherButton';
import AchievementsCard from '@/modules/achievements/components/AchievementsCard';
import RatingSparkline from '@/modules/rating/components/RatingSparkline';
import HeadToHeadCard from '@/modules/rating/components/HeadToHeadCard';
import { useRatingHistory } from '@/modules/rating/hooks/useRating';
import { useHeadToHead } from '@/modules/rating/hooks/useHeadToHead';
import FollowButton from '@/modules/social/components/FollowButton';
import { useFollowers } from '@/modules/social/hooks/useFollow';
import { genderLabel } from '@/modules/athletes/domain/constants';
import { MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';
import { useAthleteProfile } from '../hooks/useAthleteProfile.js';

function formatPercent(rate) {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

function StatTile({ icon: Icon, label, value, hint }) {
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

export default function AthleteProfile() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ATHLETE_PROFILE_PAGE);
  const achievementsOn = useFeatureFlag(FEATURE_FLAG.ACHIEVEMENTS);
  const ratingHistoryOn = useFeatureFlag(FEATURE_FLAG.RATING_HISTORY);
  const headToHeadOn = useFeatureFlag(FEATURE_FLAG.HEAD_TO_HEAD);
  const followOn = useFeatureFlag(FEATURE_FLAG.FOLLOW_ATHLETES);
  const { uid } = useParams();
  const { data, isLoading, isError, refetch } = useAthleteProfile(uid);
  const { data: ratingHistory = [] } = useRatingHistory(uid, ratingHistoryOn);
  const { data: h2hData } = useHeadToHead(uid, headToHeadOn);
  const { data: followers = [] } = useFollowers(uid, followOn);

  if (!enabled) return <Navigate to="/atletas" replace />;

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState message="Não foi possível carregar o perfil do atleta." onRetry={refetch} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const athlete = data?.athlete;
  if (!athlete) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <Trophy className="mx-auto h-10 w-10 text-slate-300" />
        <h2 className="mt-3 font-semibold">Atleta não encontrado</h2>
        <Link to="/atletas" className="mt-1 inline-block text-sm text-emerald-700 underline">
          Voltar ao diretório
        </Link>
      </div>
    );
  }

  const { rating, history = [], stats } = data;
  const location = [athlete.city, athlete.state].filter(Boolean).join(' / ');
  const formats = Object.entries(stats.byFormat);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Cabeçalho */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          {athlete.photo_url ? (
            <img src={athlete.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-900 text-2xl font-semibold text-emerald-50">
              {String(athlete.platform_name || 'A')[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{athlete.platform_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              {Number.isFinite(athlete.age) && <span>{athlete.age} anos</span>}
              {genderLabel(athlete.gender) && <span>· {genderLabel(athlete.gender)}</span>}
              {location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {location}</span>}
              {athlete.level && <span className="inline-flex items-center gap-1"><Award className="h-3.5 w-3.5" /> {athlete.level}</span>}
              {followOn && <span>· {followers.length} seguidor(es)</span>}
            </div>
            {(athlete.clubs || []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {athlete.clubs.map((c) => (
                  <Link key={c.id} to={`/clubes/${c.id}`}>
                    <Badge variant="success" className="rounded-full hover:opacity-90">
                      <Building2 className="mr-1 h-3 w-3" /> {c.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {followOn && <FollowButton targetUid={uid} />}
            <ChatLauncherButton athlete={athlete} label="Conversar" />
          </div>
        </CardContent>
      </Card>

      {/* Rating */}
      {rating && (
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <Medal className="h-7 w-7 text-emerald-600" />
              <div>
                <div className="text-2xl font-bold text-emerald-700 tabular-nums">{rating.rating}</div>
                <div className="text-xs text-slate-500">Rating · {rating.position ? `${rating.position}º no ranking` : 'sem posição'}</div>
              </div>
            </div>
            <div className="text-right text-sm text-slate-600 tabular-nums">
              {rating.wins}V – {rating.losses}D <span className="text-slate-400">· {rating.games} jogo(s)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desempenho */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile icon={Trophy} label="Torneios" value={stats.tournaments} />
        <StatTile icon={Swords} label="Jogos" value={stats.played} />
        <StatTile icon={Percent} label="Aproveitamento" value={formatPercent(stats.winRate)} hint={`${stats.wins}V – ${stats.losses}D`} />
        <StatTile icon={Award} label="Títulos" value={stats.titles} />
        <StatTile icon={Medal} label="Pódios" value={stats.podiums} />
        <StatTile icon={Trophy} label="Inscrições" value={stats.registrations} />
      </div>

      {formats.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Desempenho por formato</h2>
            <div className="space-y-2">
              {formats.map(([format, b]) => (
                <div key={format} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-3">
                  <span className="text-sm font-medium text-slate-700">{MODALITY_FORMAT_LABELS[format] || format}</span>
                  <span className="text-xs text-slate-600 tabular-nums">
                    {b.played} jogo(s) · {b.wins}V – {b.losses}D · <strong className="text-slate-900">{formatPercent(b.winRate)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ratingHistoryOn && <RatingSparkline points={ratingHistory} />}

      {achievementsOn && <AchievementsCard summary={{ ...stats, rating: rating?.rating }} />}

      {headToHeadOn && h2hData?.h2h?.length > 0 && <HeadToHeadCard records={h2hData.h2h} />}

      {/* Torneios recentes */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Torneios recentes</h2>
            <div className="space-y-2">
              {history.slice(0, 8).map((g) => (
                <Link
                  key={g.tournamentId}
                  to={`/torneios/${g.tournamentId}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 hover:bg-emerald-50/50"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                    {g.tournament?.name || 'Torneio'}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
