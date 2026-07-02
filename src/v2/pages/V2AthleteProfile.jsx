import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Building2, ChevronRight, Medal, Percent, Swords, Trophy } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAthleteProfile } from '@/modules/athletes/hooks/useAthleteProfile';
import { genderLabel } from '@/modules/athletes/domain/constants';
import { MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import { V2Avatar, V2Badge, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

function formatPercent(rate) {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`;
}

function clubNames(athlete) {
  return (athlete?.clubs || []).map((c) => (typeof c === 'string' ? { id: c, name: c } : c)).filter((c) => c?.name);
}

export default function V2AthleteProfile() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ATHLETE_PROFILE_PAGE);
  const { uid } = useParams();
  const { data, isLoading, isError } = useAthleteProfile(uid);

  if (!enabled) return <Navigate to="/v2/atletas" replace />;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1000px] space-y-6">
        <V2Skeleton className="h-64 rounded-4xl" />
        <V2Skeleton className="h-40 rounded-4xl" />
      </div>
    );
  }

  const athlete = data?.athlete;
  if (isError || !athlete) {
    return (
      <div className="mx-auto max-w-[700px]">
        <V2Surface>
          <V2EmptyState
            icon={Trophy}
            title="Atleta não encontrado"
            description="O perfil que você procura não existe ou não está mais disponível."
            action={<Link to="/v2/atletas" className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">Voltar aos atletas</Link>}
          />
        </V2Surface>
      </div>
    );
  }

  const { rating, history = [], stats } = data;
  const location = [athlete.city, athlete.state].filter(Boolean).join(' / ');
  const clubs = clubNames(athlete);
  const formats = Object.entries(stats?.byFormat || {});

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link to="/v2/atletas" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar aos atletas
      </Link>

      {/* Hero */}
      <div className="overflow-hidden rounded-4xl border border-gray-100 bg-paper-pure shadow-organic-sm">
        <div className="relative h-44 bg-mesh">
          <div className="absolute inset-0 bg-gradient-to-t from-paper-pure to-transparent" />
        </div>
        <div className="px-6 pb-8 sm:px-8">
          <div className="-mt-16 mb-6 flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="rounded-full border-8 border-paper-pure bg-paper-pure shadow-md">
              <V2Avatar name={athlete.platform_name} photoUrl={athlete.photo_url} size="xl" className="h-32 w-32 text-4xl" />
            </div>
            <div className="w-full sm:w-auto">
              <V2ChatLauncherButton athlete={athlete} label="Conversar" className="w-full sm:w-auto" />
            </div>
          </div>

          <div className="text-center sm:text-left">
            <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{athlete.platform_name}</h1>
            <p className="mt-1 font-medium text-gray-500">
              {[
                Number.isFinite(athlete.age) ? `${athlete.age} anos` : null,
                genderLabel(athlete.gender),
                location,
              ].filter(Boolean).join(' • ') || 'Atleta da comunidade'}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
              {rating && (
                <div className="flex items-center gap-2 rounded-2xl border border-acid/40 bg-acid/15 px-4 py-2 text-sm font-semibold text-ink">
                  <Medal className="h-4 w-4" /> Rating {rating.rating}{rating.position ? ` · ${rating.position}º` : ''}
                </div>
              )}
              {athlete.level && (
                <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-paper px-4 py-2 text-sm font-semibold text-gray-600">
                  <Award className="h-4 w-4" /> {athlete.level}
                </div>
              )}
            </div>

            {clubs.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                {clubs.map((c) => (
                  <Link key={c.id} to={`/v2/clubes/${c.id}`}>
                    <V2Badge tone="neutral"><Building2 className="h-3 w-3" /> {c.name}</V2Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MiniStat icon={Trophy} label="Torneios" value={stats.tournaments} />
        <MiniStat icon={Swords} label="Jogos" value={stats.played} />
        <MiniStat icon={Percent} label="Aproveit." value={formatPercent(stats.winRate)} />
        <MiniStat icon={Award} label="Títulos" value={stats.titles} />
        <MiniStat icon={Medal} label="Pódios" value={stats.podiums} />
        <MiniStat icon={Trophy} label="Inscrições" value={stats.registrations} />
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

      {history.length > 0 && (
        <V2Surface className="mt-8">
          <h2 className="mb-4 font-display text-lg font-bold text-ink">Torneios recentes</h2>
          <div className="space-y-2">
            {history.slice(0, 8).map((g) => (
              <Link
                key={g.tournamentId}
                to={`/v2/torneios/${g.tournamentId}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper p-4 transition-colors hover:border-gray-200"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{g.tournament?.name || 'Torneio'}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
              </Link>
            ))}
          </div>
        </V2Surface>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-4xl border border-gray-100 bg-paper-pure p-5 text-center shadow-organic-sm">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-paper text-ink"><Icon className="h-5 w-5" /></div>
      <p className="font-display text-2xl font-bold text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}
