import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Swords, MapPin, Medal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import ChatLauncherButton from '@/modules/chat/components/ChatLauncherButton';
import { useNationalRanking } from '../hooks/useRating.js';
import { rankMatchmakingCandidates, DEFAULT_MAX_RATING_DIFF } from '../domain/matchmaking.js';

export default function FindPlayers() {
  const ratingOn = useFeatureFlag(FEATURE_FLAG.PLAYER_RATING);
  const matchmakingOn = useFeatureFlag(FEATURE_FLAG.MATCHMAKING);
  const enabled = ratingOn && matchmakingOn;
  const { user, userProfile } = useAuth();
  const { data: players = [], isLoading } = useNationalRanking();
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
        <Card>
          <CardContent className="p-8 text-center">
            <Medal className="mx-auto mb-3 h-8 w-8 text-emerald-600" />
            <h2 className="text-lg font-semibold text-slate-900">Você ainda não tem rating</h2>
            <p className="mt-2 text-sm text-slate-600">
              Dispute jogos em torneios da plataforma para receber seu rating e encontrar
              adversários do seu nível. Veja o{' '}
              <Link to="/ranking" className="text-emerald-700 underline">ranking nacional</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardContent className="p-5">
          <h1 className="flex items-center gap-2 text-2xl font-bold arena-heading">
            <Swords className="h-6 w-6 text-emerald-600" /> Encontrar jogadores
          </h1>
          <p className="mt-1 text-sm text-slate-600">
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
        </CardContent>
      </Card>

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">
            Nenhum jogador encontrado para os filtros atuais. Tente ampliar a faixa de nível ou a cidade.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center gap-3 p-4">
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-900 text-base font-semibold text-emerald-50">
                    {String(p.platform_name || 'A')[0]?.toUpperCase()}
                  </span>
                )}
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
