/**
 * V2PromoCampaign — a página "saiba mais" de uma campanha da PLATAFORMA ou de
 * um PROFESSOR (Onda CG). Rota: `/campanhas/:campaignId`.
 *
 * É para onde o banner leva quando o destino é "Página da campanha" — e para
 * onde o AVISO leva quando o destino tem âncora (a regra de `notifications`
 * não aceita `#`). Mostra o banner, a mensagem inteira, quem divulga, até
 * quando vale e o caminho.
 *
 * Os mesmos três estados da página de campanha da arena, que não se
 * confundem: a leitura FALHOU (diz que falhou, com "Tentar de novo"); a
 * campanha não existe (diz isso, e leva às promoções); a campanha terminou ou
 * foi pausada (mostra o que era e diz que não está mais valendo).
 */
import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarClock, GraduationCap, Tag } from 'lucide-react';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { BANNER_STATE, campaignBannerState } from '@/modules/arenas/domain/campaignBanner';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import {
  PROMO_DESTINATION, PROMO_ISSUER, promoDestinationCta, promoDestinationLink,
} from '@/modules/promo/domain/promo';
import { usePromoCampaign } from '@/modules/promo/hooks/usePromo';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import BannerArt from '@/v2/components/arenas/marketing/campaigns/BannerArt';
import PromoCampaignBanner from '@/v2/components/promo/PromoCampaignBanner';
import { issuerDisplayName } from '@/v2/components/promo/promoUi';

function Voltar() {
  return (
    <Link to="/promocoes" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-ink">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Promoções
    </Link>
  );
}

export default function V2PromoCampaign() {
  const { campaignId } = useParams();
  const { flags, isLoading: flagsCarregando } = useFeatureFlags();
  const ligado = Boolean(flags?.[FEATURE_FLAG.PLATFORM_MARKETING] || flags?.[FEATURE_FLAG.COACH_MARKETING]);
  const q = usePromoCampaign(ligado ? campaignId : null);
  const campanha = q.data;
  const today = todayISO();

  if (!flagsCarregando && !ligado) return <Navigate to="/" replace />;

  if (flagsCarregando || q.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <V2Skeleton lines={1} />
        <div className="aspect-[16/9] animate-pulse rounded-3xl bg-gray-100 sm:aspect-[2/1]" />
        <V2Skeleton lines={3} />
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Voltar />
        <V2ErrorState
          title="Não foi possível carregar a campanha"
          description="A conexão falhou. A campanha continua lá — tente de novo em instantes."
          onRetry={() => q.refetch()}
        />
      </div>
    );
  }

  if (!campanha) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Voltar />
        <V2Surface className="text-center">
          <p className="font-display text-lg font-bold text-ink">Esta campanha não está mais disponível</p>
          <p className="mt-1 text-sm text-gray-500">Ela pode ter sido retirada. Veja as promoções que estão no ar agora.</p>
          <V2Button asChild className="mt-4"><Link to="/promocoes">Ver promoções</Link></V2Button>
        </V2Surface>
      </div>
    );
  }

  const estado = campaignBannerState(campanha, { today });
  // Cancelada (a conta do professor foi excluída): mesmo sem banner, não vale.
  const cancelada = campanha.status === 'cancelled';
  const valendo = !cancelada && (estado === BANNER_STATE.LIVE || estado === BANNER_STATE.NONE);
  const destino = campanha.destination || {};
  const vaiParaOutroLugar = destino.type && destino.type !== PROMO_DESTINATION.DETAILS;
  const ctx = { issuerType: campanha.issuer_type, issuerId: campanha.issuer_id, campaignId: campanha.id };
  const linkDestino = promoDestinationLink(destino, ctx);
  const ctaDestino = promoDestinationCta(destino, campanha.banner?.design);
  const dono = issuerDisplayName(campanha);
  const ehProfessor = campanha.issuer_type === PROMO_ISSUER.COACH;
  const linkProfessor = ehProfessor && !cancelada;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Voltar />

      {campanha.banner && (valendo && vaiParaOutroLugar ? (
        <PromoCampaignBanner campaign={campanha} />
      ) : (
        <BannerArt banner={campanha.banner} arenaName={dono} cta="" />
      ))}

      <V2Surface>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="font-display text-2xl font-black text-ink">{campanha.name}</h1>
          {!valendo && <V2Badge tone="neutral">{estado === BANNER_STATE.PAUSED ? 'Pausada' : 'Encerrada'}</V2Badge>}
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
          {ehProfessor ? <GraduationCap className="h-4 w-4" aria-hidden /> : <Tag className="h-4 w-4" aria-hidden />}
          {linkProfessor
            ? <Link to={`/coaches/${campanha.issuer_id}`} className="font-semibold text-ink hover:underline">{dono}</Link>
            : dono}
        </p>
        {campanha.message && <p className="mt-4 whitespace-pre-line text-base leading-7 text-ink">{campanha.message}</p>}
        {campanha.banner_until && (
          <p className="mt-4 flex items-center gap-1.5 text-sm text-gray-500">
            <CalendarClock className="h-4 w-4" aria-hidden />
            {estado === BANNER_STATE.ENDED
              ? `Valeu até ${formatDateShortBR(campanha.banner_until)}.`
              : `Vale até ${formatDateShortBR(campanha.banner_until)}.`}
          </p>
        )}
        {!valendo && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Esta campanha não está mais no ar. Veja as promoções que valem agora.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {valendo && vaiParaOutroLugar && (
            <V2Button asChild>
              <Link to={linkDestino}>{ctaDestino} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </V2Button>
          )}
          {linkProfessor && destino.type !== PROMO_DESTINATION.PROFILE && (
            <V2Button asChild variant={valendo && vaiParaOutroLugar ? 'secondary' : 'primary'}>
              <Link to={`/coaches/${campanha.issuer_id}`}><GraduationCap className="h-4 w-4" aria-hidden /> Conhecer o professor</Link>
            </V2Button>
          )}
          <V2Button asChild variant="ghost"><Link to="/promocoes">Ver promoções</Link></V2Button>
        </div>
      </V2Surface>
    </div>
  );
}
