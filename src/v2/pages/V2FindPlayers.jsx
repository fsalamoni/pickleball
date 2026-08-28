import React, { useMemo, useState } from 'react';
import { MapPin, Medal, Sparkles, Swords } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { rankMatchmakingCandidates, DEFAULT_MAX_RATING_DIFF } from '@/modules/rating/domain/matchmaking';
import { rankSmartMatchmaking } from '@/modules/rating/domain/smartMatchmaking';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { sanitizeInterests } from '@/modules/athletes/domain/profileMeta';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import {
  V2Avatar,
  V2Badge,
  V2EmptyState,
  V2FilterChip,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

/** Cor do selo de compatibilidade conforme a força do match. */
function compatTone(score) {
  if (score >= 70) return 'acid';
  if (score >= 45) return 'blue';
  return 'neutral';
}

export default function V2FindPlayers() {
  const { user, userProfile } = useAuth();
  const smartOn = useFeatureFlag(FEATURE_FLAG.SMART_MATCHMAKING);
  const { data: players = [], isLoading } = useNationalRanking();
  // Diretório (lado da quadra + interesses) só é buscado no modo inteligente.
  const { data: directory = [] } = useAthletes(smartOn);
  const [sameCityOnly, setSameCityOnly] = useState(false);
  const [closeLevelOnly, setCloseLevelOnly] = useState(true);

  const me = useMemo(() => players.find((p) => p.id === user?.uid || p.uid === user?.uid) || null, [players, user?.uid]);
  const myCity = me?.city || userProfile?.city || null;

  const dirById = useMemo(() => {
    const map = {};
    directory.forEach((a) => { if (a?.id) map[a.id] = a; });
    return map;
  }, [directory]);

  const suggestions = useMemo(() => {
    if (!me) return [];
    const others = players.filter((p) => p.id !== user?.uid && p.uid !== user?.uid);

    if (smartOn) {
      // Enriquecer candidatos com lado da quadra/interesses do diretório.
      const enriched = others.map((p) => {
        const key = p.uid || p.id;
        const prof = dirById[key] || {};
        return {
          ...p,
          court_side: prof.court_side ?? null,
          interests: prof.interests ?? [],
          city: p.city || prof.city || null,
        };
      });
      const meProfile = {
        rating: me.rating,
        city: myCity,
        court_side: userProfile?.court_side || null,
        interests: sanitizeInterests(userProfile?.interests),
      };
      let ranked = rankSmartMatchmaking(meProfile, enriched);
      if (closeLevelOnly) {
        ranked = ranked.filter((c) => Math.abs((Number(c.rating) || 0) - (Number(me.rating) || 0)) <= DEFAULT_MAX_RATING_DIFF);
      }
      if (sameCityOnly && myCity) {
        const mc = String(myCity).trim().toLowerCase();
        ranked = ranked.filter((c) => String(c.city || '').trim().toLowerCase() === mc);
      }
      return ranked;
    }

    return rankMatchmakingCandidates(me.rating, others, {
      city: sameCityOnly ? myCity : null,
      maxDiff: closeLevelOnly ? DEFAULT_MAX_RATING_DIFF : null,
    });
  }, [me, players, user?.uid, smartOn, dirById, userProfile?.court_side, userProfile?.interests, sameCityOnly, closeLevelOnly, myCity]);

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
      <V2PageIntro
        title="Encontrar jogadores"
        subtitle={smartOn
          ? 'Compatibilidade calculada pelo seu nível, lado da quadra, cidade e interesses.'
          : 'A leitura parte do seu rating atual para sugerir parcerias coerentes.'}
      />

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
                <div className="flex items-center gap-2">
                  <p className="truncate font-bold text-ink">{p.platform_name}</p>
                  {smartOn && p.compatibility && (
                    <V2Badge tone={compatTone(p.compatibility.score)} className="shrink-0">
                      <Sparkles className="h-3 w-3" /> {p.compatibility.score}%
                    </V2Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <V2Badge tone="acid">Rating {p.rating}</V2Badge>
                  {[p.city, p.state].filter(Boolean).length > 0 && <span>{[p.city, p.state].filter(Boolean).join(' / ')}</span>}
                  {!smartOn && <span className="text-gray-400">· Δ {p.ratingDiff}</span>}
                </div>
                {smartOn && p.compatibility?.reasons?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.compatibility.reasons.map((r) => (
                      <span key={r} className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-gray-600">{r}</span>
                    ))}
                  </div>
                )}
              </div>
              <V2ChatLauncherButton athlete={p} size="sm" iconOnly />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
