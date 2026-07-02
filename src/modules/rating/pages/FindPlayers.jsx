import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MapPin, Medal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PlatformSectionHeader, PlatformSurfaceCard } from '@/components/ui/platform-page';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import ChatLauncherButton from '@/modules/chat/components/ChatLauncherButton';
import ErrorState from '@/components/ErrorState';
import { useNationalRanking } from '../hooks/useRating.js';
import { rankMatchmakingCandidates, DEFAULT_MAX_RATING_DIFF } from '../domain/matchmaking.js';

export default function FindPlayers() {
  const ratingOn = useFeatureFlag(FEATURE_FLAG.PLAYER_RATING);
  const matchmakingOn = useFeatureFlag(FEATURE_FLAG.MATCHMAKING);
  const enabled = ratingOn && matchmakingOn;
  const { user, userProfile } = useAuth();
  const { data: players = [], isLoading, isError, refetch } = useNationalRanking();
  const [sameCityOnly, setSameCityOnly] = useState(false);
  const [closeLevelOnly, setCloseLevelOnly] = useState(true);

  const me = useMemo(() => players.find((p) => p.id === user?.uid) || null, [players, user?.uid]);
  const myCity = me?.city || userProfile?.city || null;

  const suggestions = useMemo(() => {
    if (!me) return [];
    const others = players.filter((p) => p.id !== user?.uid);
    return rankMatchmakingCandidates(me.rating, others, {
      city: sameCityOnly ? myCity : null,
      maxDiff: closeLevelOnly ? DEFAULT_MAX_RATING_DIFF : null,
    });
  }, [me, players, user?.uid, sameCityOnly, closeLevelOnly, myCity]);

  if (!enabled) return <Navigate to="/inicio" replace />;

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorState message="Não foi possível carregar os jogadores." onRetry={refetch} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-2xl">
        <PlatformSurfaceCard contentClassName="p-8 text-center">
            <Medal className="mx-auto mb-3 h-8 w-8 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Você ainda não tem rating</h2>
            <p className="mt-2 text-sm text-slate-600">
              Dispute jogos em torneios da plataforma para receber seu rating e encontrar
              adversários do seu nível. Veja o{' '}
              <Link to="/ranking" className="text-emerald-700 underline">ranking nacional</Link>.
            </p>
        </PlatformSurfaceCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PlatformSurfaceCard>
        <PlatformSectionHeader
          eyebrow="Matchmaking"
          title="Encontre atletas com proximidade real de nível"
          description="A leitura parte do seu rating atual e ajuda a descobrir parceiros ou adversários mais coerentes com a sua faixa competitiva."
        />
      </PlatformSurfaceCard>

      <PlatformSurfaceCard contentClassName="p-5">
          <p className="text-sm text-slate-600">
            Seu rating: <strong className="text-emerald-700">{me.rating}</strong>
            {myCity ? <> · {myCity}</> : null}. Sugestões de parceiros e adversários do seu nível.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <FilterChip active={closeLevelOnly} onClick={() => setCloseLevelOnly((v) => !v)}>
              Nível parecido (±{DEFAULT_MAX_RATING_DIFF})
            </FilterChip>
            <FilterChip active={sameCityOnly} onClick={() => setSameCityOnly((v) => !v)} disabled={!myCity}>
              <MapPin className="mr-1 inline h-3.5 w-3.5" /> Minha cidade
            </FilterChip>
          </div>
      </PlatformSurfaceCard>

      {suggestions.length === 0 ? (
        <PlatformSurfaceCard contentClassName="p-2">
          <EmptyState
            icon={MapPin}
            title="Nenhum jogador encontrado para os filtros atuais"
            description="Tente ampliar a faixa de nível ou remover a restrição de cidade para encontrar mais combinações possíveis."
          />
        </PlatformSurfaceCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((p) => (
            <Card key={p.id} className="match-surface rounded-[1.75rem] border-white/80 bg-white/85">
              <CardContent className="flex items-center gap-3 p-4">
                <UserAvatar
                  name={p.platform_name}
                  photoUrl={p.photo_url}
                  size="md"
                  className="h-12 w-12 text-base"
                  zoomable={Boolean(p.photo_url)}
                  lightboxTitle={p.platform_name || 'Atleta'}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">{p.platform_name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                    <Badge variant="secondary" className="rounded-full">Rating {p.rating}</Badge>
                    {[p.city, p.state].filter(Boolean).length > 0 && (
                      <span>{[p.city, p.state].filter(Boolean).join(' / ')}</span>
                    )}
                    <span className="text-slate-400">· Δ {p.ratingDiff}</span>
                  </div>
                </div>
                <ChatLauncherButton athlete={p} size="sm" iconOnly />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'border-emerald-600 bg-emerald-600 text-white'
          : 'border-emerald-950/15 bg-white/80 text-slate-700 hover:bg-emerald-50'
      }`}
    >
      {children}
    </button>
  );
}
