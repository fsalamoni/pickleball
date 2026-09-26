/**
 * O banner de uma campanha da plataforma ou de um professor, CLICÁVEL — leva
 * ao destino escolhido (Onda CG). O mesmo desenho do banner da arena
 * (`BannerArt`): o banner inteiro é um link só, com um nome acessível só.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { bannerAltText } from '@/modules/arenas/domain/campaignBanner';
import { promoDestinationCta, promoDestinationLink } from '@/modules/promo/domain/promo';
import { cn } from '@/core/lib/utils';
import BannerArt from '@/v2/components/arenas/marketing/campaigns/BannerArt';
import { issuerDisplayName } from './promoUi';

/**
 * @param {{ campaign: object, inArt?: boolean, ratio?: string, className?: string }} props
 *   `inArt=false`: o nome do emissor vai só para o nome acessível (quem mostra
 *   é uma legenda fora da arte — a tela inicial).
 */
export default function PromoCampaignBanner({ campaign, inArt = true, ratio = 'auto', className }) {
  if (!campaign?.banner) return null;
  const link = promoDestinationLink(campaign.destination, {
    issuerType: campaign.issuer_type, issuerId: campaign.issuer_id, campaignId: campaign.id,
  });
  const cta = promoDestinationCta(campaign.destination, campaign.banner.design);
  const alt = bannerAltText(campaign.banner) || campaign.name || 'Campanha';
  const dono = issuerDisplayName(campaign);
  return (
    <Link
      to={link}
      aria-label={`${alt}. ${cta} — ${dono}`}
      className={cn(
        'block rounded-3xl transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-4 focus-visible:ring-acid focus-visible:ring-offset-2',
        className,
      )}
    >
      <BannerArt banner={campaign.banner} cta={campaign.banner.source === 'upload' ? '' : cta}
        arenaName={inArt ? dono : ''} ratio={ratio} />
    </Link>
  );
}
