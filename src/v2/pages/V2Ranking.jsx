import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Search, TrendingUp } from 'lucide-react';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  V2Avatar,
  V2EmptyState,
  V2PageIntro,
  V2SearchInput,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

function medalEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

export default function V2Ranking() {
  const { data: players = [], isLoading } = useNationalRanking();
  const profilePageOn = useFeatureFlag(FEATURE_FLAG.ATHLETE_PROFILE_PAGE);
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return players;
    return players.filter((p) => [p.platform_name, p.city, p.state, p.level]
      .filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [players, search]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro title="Ranking nacional" subtitle="Rating calculado a partir dos jogos disputados nos torneios da plataforma." />

      <V2Surface className="mb-8">
        <V2SearchInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, cidade, estado ou nível"
        />
      </V2Surface>

      {isLoading ? (
        <V2Skeleton className="h-96 rounded-4xl" />
      ) : filtered.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={TrendingUp}
            title={players.length === 0 ? 'O ranking ainda não foi calculado' : 'Nenhum atleta para o filtro'}
            description={players.length === 0
              ? 'Assim que houver jogos finalizados e o recálculo for feito, os atletas aparecerão aqui.'
              : 'Ajuste a busca para ampliar a leitura do ranking.'}
          />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const isMe = p.id === user?.uid || p.uid === user?.uid;
            const medal = medalEmoji(p.position);
            const row = (
              <div
                className={cn(
                  'flex items-center gap-4 rounded-3xl border p-4 shadow-organic-sm transition-all',
                  isMe ? 'border-acid/40 bg-acid/10' : 'border-gray-100 bg-paper-pure hover:shadow-organic',
                )}
              >
                <div className={cn('w-8 text-center font-display text-xl font-black', p.position <= 3 ? 'text-ink' : 'text-gray-400')}>
                  {medal || p.position}
                </div>
                <div className="relative">
                  <V2Avatar name={p.platform_name} photoUrl={p.photo_url} size="md" />
                  {p.position === 1 && (
                    <div className="absolute -right-1 -top-1 rounded-full bg-white text-xs text-yellow-500"><Crown className="h-3.5 w-3.5" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{p.platform_name}{isMe && <span className="ml-2 text-xs font-bold text-ink-lighter">(você)</span>}</p>
                  <p className="text-xs text-gray-500">{[p.city, p.state].filter(Boolean).join(' / ') || 'Local não informado'}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-xs uppercase tracking-wide text-gray-400">V–D</p>
                  <p className="font-semibold text-ink tabular-nums">{p.wins}–{p.losses}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-400">Rating</p>
                  <p className="font-display text-xl font-bold text-ink tabular-nums">{p.rating}</p>
                </div>
              </div>
            );
            return profilePageOn ? (
              <Link key={p.id} to={`/v2/atleta/${p.id}`} className="block">{row}</Link>
            ) : (
              <div key={p.id}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
