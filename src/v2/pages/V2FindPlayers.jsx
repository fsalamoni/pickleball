import React, { useMemo, useState } from 'react';
import { MapPin, Medal, Swords } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { rankMatchmakingCandidates, DEFAULT_MAX_RATING_DIFF } from '@/modules/rating/domain/matchmaking';
import ChatLauncherButton from '@/modules/chat/components/ChatLauncherButton';
import {
  V2Avatar,
  V2Badge,
  V2EmptyState,
  V2FilterChip,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

export default function V2FindPlayers() {
  const { user, userProfile } = useAuth();
  const { data: players = [], isLoading } = useNationalRanking();
  const [sameCityOnly, setSameCityOnly] = useState(false);
  const [closeLevelOnly, setCloseLevelOnly] = useState(true);

  const me = useMemo(() => players.find((p) => p.id === user?.uid || p.uid === user?.uid) || null, [players, user?.uid]);
  const myCity = me?.city || userProfile?.city || null;

  const suggestions = useMemo(() => {
    if (!me) return [];
    const others = players.filter((p) => p.id !== user?.uid && p.uid !== user?.uid);
    return rankMatchmakingCandidates(me.rating, others, {
      city: sameCityOnly ? myCity : null,
      maxDiff: closeLevelOnly ? DEFAULT_MAX_RATING_DIFF : null,
    });
  }, [me, players, user?.uid, sameCityOnly, closeLevelOnly, myCity]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <V2PageIntro title="Encontrar jogadores" subtitle="Parceiros e adversários do seu nível, prontos para um jogo." />
        <V2Skeleton className="h-64 rounded-4xl" />
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-[900px]">
        <V2PageIntro title="Encontrar jogadores" subtitle="Parceiros e adversários do seu nível." />
        <V2Surface>
          <V2EmptyState
            icon={Medal}
            title="Você ainda não tem rating"
            description="Dispute jogos em torneios da plataforma para receber seu rating e liberar as sugestões de parceiros do seu nível."
          />
        </V2Surface>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro title="Encontrar jogadores" subtitle="A leitura parte do seu rating atual para sugerir parcerias coerentes." />

      <V2Surface className="mb-8">
        <p className="text-sm text-gray-500">
          Seu rating: <strong className="text-ink">{me.rating}</strong>{myCity ? <> · {myCity}</> : null}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <V2FilterChip active={closeLevelOnly} onClick={() => setCloseLevelOnly((v) => !v)}>
            Nível parecido (±{DEFAULT_MAX_RATING_DIFF})
          </V2FilterChip>
          <V2FilterChip active={sameCityOnly} onClick={() => setSameCityOnly((v) => !v)} disabled={!myCity}>
            <MapPin className="h-3.5 w-3.5" /> Minha cidade
          </V2FilterChip>
        </div>
      </V2Surface>

      {suggestions.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Swords}
            title="Nenhum jogador para os filtros atuais"
            description="Amplie a faixa de nível ou remova a restrição de cidade para ver mais combinações."
          />
        </V2Surface>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {suggestions.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-4xl border border-gray-100 bg-paper-pure p-4 shadow-organic-sm">
              <V2Avatar name={p.platform_name} photoUrl={p.photo_url} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{p.platform_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <V2Badge tone="acid">Rating {p.rating}</V2Badge>
                  {[p.city, p.state].filter(Boolean).length > 0 && <span>{[p.city, p.state].filter(Boolean).join(' / ')}</span>}
                  <span className="text-gray-400">· Δ {p.ratingDiff}</span>
                </div>
              </div>
              <ChatLauncherButton athlete={p} size="sm" iconOnly />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
