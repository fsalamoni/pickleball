/**
 * "Em destaque" — os banners de campanha no alto da página da arena (Onda CC).
 *
 * É o espaço da arena falar primeiro: a promoção da semana, o torneio que
 * abriu inscrição, o produto novo. Cada banner leva ao destino que a arena
 * escolheu (reservar, jogo aberto, dia de jogo, torneio, produto, planos…).
 *
 * Um banner: largura inteira. Dois ou mais: uma fileira que desliza, com o
 * próximo aparecendo na borda — é o que diz "tem mais" sem precisar de texto.
 * Nada gira sozinho aqui: a página é lida com calma, e movimento que ninguém
 * pediu tira a atenção da reserva logo abaixo.
 *
 * Some quando não há banner no ar — e também quando a leitura falha: esta
 * seção não afirma nada sobre o que falta, só mostra o que existe.
 */
import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { useArenaModules } from '@/modules/arenas/hooks/useArenaModules';
import { useArenaCampaignBanners } from '@/modules/arenas/hooks/useCampaignBanners';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { arenaCampaignBanners } from '@/modules/arenas/domain/campaignBanner';
import { todayISO } from '@/modules/arenas/domain/subscription';
import { cn } from '@/core/lib/utils';
import CampaignBanner from './CampaignBanner';

export default function ArenaCampaignsSection({ arena }) {
  const arenaId = arena?.id;
  const { isOn, isLoading } = useArenaModules(arenaId);
  const ligado = isOn(ARENA_MODULE_ID.MARKETING) && isOn(ARENA_MODULE_ID.MARKETING_CAMPAIGNS);
  const q = useArenaCampaignBanners(ligado ? arenaId : null);
  const today = todayISO();
  const banners = useMemo(() => arenaCampaignBanners(q.data || [], { today }), [q.data, today]);

  if (isLoading || !ligado || q.isError || banners.length === 0) return null;

  const varios = banners.length > 1;
  return (
    <section className="mt-6" aria-label={`Em destaque na ${arena?.name || 'arena'}`}>
      <h3 className="mb-2 flex items-center gap-1.5 font-display text-base font-bold text-ink">
        <Sparkles className="h-4 w-4" aria-hidden /> Em destaque
      </h3>
      <ul
        className={cn(
          varios && 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2',
        )}
      >
        {banners.map((c) => (
          <li
            key={c.id}
            className={cn(varios && 'w-[86%] shrink-0 snap-start sm:w-[calc(50%-0.375rem)]')}
          >
            <CampaignBanner campaign={c} ratio={varios ? 'phone' : 'auto'} />
          </li>
        ))}
      </ul>
    </section>
  );
}
