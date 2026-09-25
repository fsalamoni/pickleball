/**
 * O banner de uma campanha, CLICÁVEL — leva ao destino que a arena escolheu
 * (Onda CC). É o que aparece na página da arena e na tela inicial.
 *
 * O banner inteiro é um link só: um alvo grande, e o leitor de tela anuncia
 * UMA coisa ("Terça com 20% de desconto. Reservar agora"), não cada pedaço de
 * texto do desenho.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  bannerAltText, destinationCta, destinationLink,
} from '@/modules/arenas/domain/campaignBanner';
import { cn } from '@/core/lib/utils';
import BannerArt from './BannerArt';

/**
 * @param {{ campaign: object, arenaName?: string, arenaInArt?: boolean, ratio?: string, className?: string }} props
 *   `arenaInArt=false`: o nome da arena vai só para o nome acessível do link —
 *   quem mostra a arena é uma legenda fora da arte (a tela inicial).
 */
export default function CampaignBanner({ campaign, arenaName = '', arenaInArt = true, ratio = 'auto', className }) {
  if (!campaign?.banner) return null;
  const link = destinationLink(campaign.destination, { arenaId: campaign.arena_id, campaignId: campaign.id });
  const cta = destinationCta(campaign.destination, campaign.banner.design);
  const alt = bannerAltText(campaign.banner) || campaign.name || 'Campanha';
  return (
    <Link
      to={link}
      aria-label={`${alt}. ${cta}${arenaName ? ` — ${arenaName}` : ''}`}
      className={cn(
        'block rounded-3xl transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-4 focus-visible:ring-acid focus-visible:ring-offset-2',
        className,
      )}
    >
      <BannerArt banner={campaign.banner} cta={campaign.banner.source === 'upload' ? '' : cta} arenaName={arenaInArt ? arenaName : ''} ratio={ratio} />
    </Link>
  );
}
