/**
 * V2ArenaCampaign — a página "saiba mais" de uma campanha (Onda CC).
 *
 * Rota: `/arenas/:arenaId/campanhas/:campaignId`
 *
 * É para onde o banner leva quando a arena escolhe o destino "Detalhes da
 * campanha" — e para onde o AVISO da campanha leva, nesse caso. Mostra o
 * banner, a mensagem inteira, até quando vale, e os caminhos que fazem
 * sentido a partir dali: o destino da campanha (se for outro), reservar e
 * ver a arena.
 *
 * Três estados que NÃO se confundem:
 *  - a leitura FALHOU → diz que falhou, com "Tentar de novo" (a campanha
 *    continua lá; afirmar que ela acabou mandaria a pessoa embora à toa);
 *  - a campanha não existe (apagada, link errado) → diz isso, e leva à arena;
 *  - a campanha terminou ou foi pausada → mostra o que era, diz que não está
 *    mais valendo, e leva à arena.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarClock, LayoutGrid, MapPin } from 'lucide-react';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import { useCampaign } from '@/modules/arenas/hooks/useCampaignBanners';
import {
  BANNER_STATE, CAMPAIGN_DESTINATION, campaignBannerState, destinationCta, destinationLink,
} from '@/modules/arenas/domain/campaignBanner';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import {
  V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import BannerArt from '@/v2/components/arenas/marketing/campaigns/BannerArt';
import CampaignBanner from '@/v2/components/arenas/marketing/campaigns/CampaignBanner';

function Voltar({ arenaId, arenaName }) {
  return (
    <Link to={`/arenas/${arenaId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> {arenaName || 'Voltar para a arena'}
    </Link>
  );
}

export default function V2ArenaCampaign() {
  const { arenaId, campaignId } = useParams();
  const q = useCampaign(campaignId);
  const campanha = q.data;
  const arenaDaCampanha = campanha?.arena_id || arenaId;
  const { data: arena } = useArena(arenaDaCampanha);
  const today = todayISO();

  if (q.isLoading) {
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
        <Voltar arenaId={arenaId} />
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
        <Voltar arenaId={arenaId} arenaName={arena?.name} />
        <V2Surface className="text-center">
          <p className="font-display text-lg font-bold text-ink">Esta campanha não está mais disponível</p>
          <p className="mt-1 text-sm text-gray-500">A arena pode tê-la retirado. Veja o que ela tem agora.</p>
          <V2Button asChild className="mt-4">
            <Link to={`/arenas/${arenaId}`}>Ver a arena</Link>
          </V2Button>
        </V2Surface>
      </div>
    );
  }

  const estado = campaignBannerState(campanha, { today });
  const valendo = estado === BANNER_STATE.LIVE || estado === BANNER_STATE.NONE;
  const destino = campanha.destination || {};
  const vaiParaOutroLugar = destino.type && destino.type !== CAMPAIGN_DESTINATION.DETAILS;
  const linkDestino = destinationLink(destino, { arenaId: arenaDaCampanha, campaignId: campanha.id });
  const ctaDestino = destinationCta(destino, campanha.banner?.design);
  const reservarLink = `/arenas/${arenaDaCampanha}#arena-reservar`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Voltar arenaId={arenaDaCampanha} arenaName={arena?.name} />

      {/* No ar e levando a outro lugar, o banner é o link (o botão desenhado
          nele funciona). Encerrado, ou levando a esta própria página, ele é
          só imagem — e sem botão desenhado, que tocado não faria nada. */}
      {campanha.banner && (valendo && vaiParaOutroLugar ? (
        <CampaignBanner campaign={{ ...campanha, arena_id: arenaDaCampanha }} arenaName={arena?.name || ''} />
      ) : (
        <BannerArt banner={campanha.banner} arenaName={arena?.name || ''} cta="" />
      ))}

      <V2Surface>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="font-display text-2xl font-black text-ink">{campanha.name}</h1>
          {!valendo && (
            <V2Badge tone="neutral">{estado === BANNER_STATE.PAUSED ? 'Pausada pela arena' : 'Encerrada'}</V2Badge>
          )}
        </div>
        {arena?.name && (
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <MapPin className="h-4 w-4" aria-hidden /> {arena.name}{arena.city ? ` · ${arena.city}` : ''}
          </p>
        )}
        {campanha.message && (
          <p className="mt-4 whitespace-pre-line text-base leading-7 text-ink">{campanha.message}</p>
        )}
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
            Esta campanha não está mais no ar. Confira na página da arena o que ela oferece agora.
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {valendo && vaiParaOutroLugar && (
            <V2Button asChild>
              <Link to={linkDestino}>{ctaDestino} <ArrowRight className="h-4 w-4" /></Link>
            </V2Button>
          )}
          {destino.type !== CAMPAIGN_DESTINATION.BOOKING && (
            <V2Button asChild variant={valendo && vaiParaOutroLugar ? 'secondary' : 'primary'}>
              <Link to={reservarLink}><LayoutGrid className="h-4 w-4" /> Reservar um horário</Link>
            </V2Button>
          )}
          <V2Button asChild variant="ghost">
            <Link to={`/arenas/${arenaDaCampanha}`}>Ver a arena</Link>
          </V2Button>
        </div>
      </V2Surface>
    </div>
  );
}
