import React, { useMemo, useState } from 'react';
import { MapPin, Medal, Sparkles, Swords } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';

import { useNavRotulos } from '@/core/lib/useNavRotulos';

import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { useDuprMode, useVerifiedDuprProfiles } from '@/modules/rating/hooks/useDuprMode';
import { buildOfficialDuprRanking } from '@/modules/rating/domain/duprOfficialRanking';
import { rankMatchmakingCandidates, DEFAULT_MAX_RATING_DIFF } from '@/modules/rating/domain/matchmaking';
import { rankSmartMatchmaking } from '@/modules/rating/domain/smartMatchmaking';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { sanitizeInterests } from '@/modules/athletes/domain/profileMeta';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { distanceLabel } from '@/core/domain/region';
import RegionBar, { RegionEmptyHint } from '@/v2/components/region/RegionBar';
import {
  V2Avatar,
  V2Badge,
  V2EmptyState,
  V2ErrorState,
  V2FilterChip,
  V2PageIntro,
  V2Skeleton,
  V2Surface, V2Page,
} from '@/v2/ui/primitives';
import { t, fmtNumero } from '@/core/i18n';

const DUPR_TO_ELO_SCALE = 300;

/** Cor do selo de compatibilidade conforme a força do match. */
function compatTone(score) {
  if (score >= 70) return 'acid';
  if (score >= 45) return 'blue';
  return 'neutral';
}

export default function V2FindPlayers() {
  const { user, userProfile } = useAuth();
  const rotulos = useNavRotulos();
  const smartOn = true;
  // Com o DUPR oficial valendo, o nível de referência é o rating do DUPR (de
  // quem conectou a conta) — o ELO próprio sai da tela.
  const { ownRatingOff } = useDuprMode();
  const nacional = useNationalRanking();
  const duprProfiles = useVerifiedDuprProfiles({ enabled: ownRatingOff });
  const fonte = ownRatingOff ? duprProfiles : nacional;
  const { isLoading, isError, refetch } = fonte;
  const players = useMemo(() => (ownRatingOff
    ? buildOfficialDuprRanking(duprProfiles.data, 'doubles').map((r) => ({
      ...r, id: r.uid, platform_name: r.name, dupr: r.rating,
      // ponytail: os motores de afinidade usam a escala do ELO (±150); o DUPR
      // entra ×300 (±0,5 DUPR). Um motor na escala 2–8 dispensa a conversão.
      rating: Math.round(r.rating * DUPR_TO_ELO_SCALE),
    }))
    : nacional.data || []), [ownRatingOff, duprProfiles.data, nacional.data]);
  // Diretório (lado da quadra + interesses) só é buscado no modo inteligente.
  const { data: directory = [] } = useAthletes(smartOn);
  const [sameCityOnly, setSameCityOnly] = useState(false);
  const [closeLevelOnly, setCloseLevelOnly] = useState(true);
  // Com a MINHA REGIÃO, o recorte de lugar é a região (cidade + raio, estado…),
  // ligado por padrão — é quem pode, de fato, jogar com você.
  const regiaoOn = true;
  const [soRegiao, setSoRegiao] = useState(true);

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

  const regional = useRegionalList(suggestions, (p) => ({ city: p.city, state: p.state }), {
    ignorar: !regiaoOn || !soRegiao,
  });
  const lista = regiaoOn ? regional.itens : suggestions;

  if (isLoading) {
    return (
      <V2Page>
        <V2PageIntro title={rotulos.pessoas} subtitle={t('Parceiros e adversários do seu nível, prontos para um jogo.')} />
        <V2Skeleton className="h-64 rounded-4xl" />
      </V2Page>
    );
  }

  // Com o ranking falhando, `me` sai nulo — e a tela diria "Você ainda não tem
  // rating" a quem tem. Falha não é vazio (docs/27-FALHA-NAO-E-VAZIO.md).
  if (isError) {
    return (
      <V2Page>
        <V2PageIntro title={rotulos.pessoas} subtitle={t('Parceiros e adversários do seu nível.')} />
        <V2Surface>
          <V2ErrorState
            title={t('Não foi possível carregar as sugestões')}
            description={t('Seu rating continua o mesmo — só não conseguimos buscar o ranking agora.')}
            onRetry={() => refetch()}
          />
        </V2Surface>
      </V2Page>
    );
  }

  if (!me) {
    return (
      <V2Page>
        <V2PageIntro title={rotulos.pessoas} subtitle={t('Parceiros e adversários do seu nível.')} />
        <V2Surface>
          <V2EmptyState
            icon={Medal}
            title={ownRatingOff ? t('Conecte a sua conta DUPR') : t('Você ainda não tem rating')}
            description={ownRatingOff
              ? t('O nível de referência agora é o rating do DUPR. Conecte a sua conta em Perfil → Editar perfil para ver parceiros do seu nível.')
              : t('Dispute jogos em torneios da plataforma para receber seu rating e liberar as sugestões de parceiros do seu nível.')}
          />
        </V2Surface>
      </V2Page>
    );
  }

  return (
    <V2Page>
      <V2PageIntro
        title={rotulos.pessoas}
        subtitle={smartOn
          ? t('Compatibilidade calculada pelo seu nível, lado da quadra, cidade e interesses.')
          : t('A leitura parte do seu rating atual para sugerir parcerias coerentes.')}
      />

      <V2Surface className="mb-8" data-dica="jogadores-filtros">
        <p className="text-sm text-gray-500">
          {ownRatingOff ? t('Seu rating DUPR:') : t('Seu rating:')} <strong className="text-ink">{ownRatingOff ? me.dupr.toFixed(3) : me.rating}</strong>{myCity ? <> · {myCity}</> : null}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <V2FilterChip active={closeLevelOnly} onClick={() => setCloseLevelOnly((v) => !v)}>
            {ownRatingOff
              ? t('Nível parecido (±{n} DUPR)', { n: fmtNumero(DEFAULT_MAX_RATING_DIFF / DUPR_TO_ELO_SCALE, { maximumFractionDigits: 1 }) })
              : t('Nível parecido (±{n})', { n: DEFAULT_MAX_RATING_DIFF })}
          </V2FilterChip>
          {regiaoOn ? (
            <V2FilterChip active={soRegiao} onClick={() => setSoRegiao((v) => !v)}>
              <MapPin className="h-3.5 w-3.5" /> {t('Na minha região')}
            </V2FilterChip>
          ) : (
            <V2FilterChip active={sameCityOnly} onClick={() => setSameCityOnly((v) => !v)} disabled={!myCity}>
              <MapPin className="h-3.5 w-3.5" /> {t('Minha cidade')}
            </V2FilterChip>
          )}
        </div>
        {regiaoOn && soRegiao && <RegionBar regional={regional} className="mt-4" nomeItens={[t('jogador'), t('jogadores')]} />}
      </V2Surface>

      {lista.length === 0 && regional.fora > 0 ? (
        <RegionEmptyHint regional={regional} oque={t('Nenhum jogador para os filtros atuais')} />
      ) : lista.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Swords}
            title={t('Nenhum jogador para os filtros atuais')}
            description={regiaoOn
              ? t('Amplie a faixa de nível ou a sua região para ver mais combinações.')
              : t('Amplie a faixa de nível ou remova a restrição de cidade para ver mais combinações.')}
          />
        </V2Surface>
      ) : (
        <div data-dica="jogadores-lista" className="grid gap-4 sm:grid-cols-2">
          {lista.map((p) => (
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
                  <V2Badge tone="acid">{ownRatingOff ? `DUPR ${p.dupr.toFixed(3)}` : `Rating ${p.rating}`}</V2Badge>
                  {[p.city, p.state].filter(Boolean).length > 0 && (
                    <span>
                      {[p.city, p.state].filter(Boolean).join(' / ')}
                      {regiaoOn && distanceLabel(regional.infoDe(p)?.km) ? ` · ${distanceLabel(regional.infoDe(p)?.km)}` : ''}
                    </span>
                  )}
                  {!smartOn && <span className="text-gray-400">· Δ {p.ratingDiff}</span>}
                </div>
                {smartOn && p.compatibility?.reasons?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.compatibility.reasons.map((r) => (
                      <span key={r} className="rounded-full bg-paper px-2 py-0.5 text-2xs font-medium text-gray-600">{r}</span>
                    ))}
                  </div>
                )}
              </div>
              <V2ChatLauncherButton athlete={p} size="sm" iconOnly />
            </div>
          ))}
        </div>
      )}
    </V2Page>
  );
}
