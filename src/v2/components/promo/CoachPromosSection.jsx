/**
 * "Promoções" no PERFIL do professor (Onda CG, flag `coach_marketing`).
 *
 * Os banners que o professor pôs no perfil e os cupons que ele divulga, no
 * ar agora — com o código para copiar e, no desconto e na aula experimental,
 * "Usar ao pedir a aula", que abre o pedido já com o cupom conferido.
 *
 * "Só para os meus alunos" é respeitado. É vitrine: sem nada no ar (ou com a
 * leitura falhando), a seção some — ela não afirma nada.
 */
import React, { useMemo } from 'react';
import { CalendarPlus, Tag } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { couponKind } from '@/modules/arenas/domain/marketing';
import { todayISO } from '@/modules/arenas/domain/subscription';
import {
  LESSON_COUPON_KINDS, isVisibleTo, livePromoBanners, livePromoCoupons,
} from '@/modules/promo/domain/promo';
import { useCoachPublicPromos, usePromoViewer } from '@/modules/promo/hooks/usePromo';
import { V2Button, V2Surface } from '@/v2/ui/primitives';
import PromoCampaignBanner from './PromoCampaignBanner';
import PromoCouponCard from './PromoCouponCard';

/**
 * @param {{ coachId: string, onUseInLesson?: (code: string) => void }} props
 *   `onUseInLesson` só vem quando a pessoa pode pedir aula a este professor.
 */
export default function CoachPromosSection({ coachId, onUseInLesson }) {
  const ligado = useFeatureFlag(FEATURE_FLAG.COACH_MARKETING);
  const q = useCoachPublicPromos(ligado ? coachId : null);
  const quem = usePromoViewer({ enabled: ligado });
  const today = todayISO();

  const { banners, cupons } = useMemo(() => {
    const visivel = (d) => isVisibleTo(d, quem);
    return {
      banners: livePromoBanners(q.data?.campaigns || [], { today, lugar: 'page' }).filter(visivel),
      cupons: livePromoCoupons(q.data?.coupons || []).filter(visivel),
    };
  }, [q.data, quem, today]);

  if (!ligado || !q.isSuccess || (banners.length === 0 && cupons.length === 0)) return null;

  return (
    <div id="professor-promocoes" className="scroll-mt-4">
      <V2Surface>
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <Tag className="h-4 w-4" aria-hidden /> Promoções
        </h3>
        {banners.length > 0 && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {banners.map((c) => <PromoCampaignBanner key={c.id} campaign={c} />)}
          </div>
        )}
        {cupons.length > 0 && (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {cupons.map((c) => (
              <div key={c.id} className="space-y-2">
                <PromoCouponCard coupon={c} showIssuer={false} />
                {onUseInLesson && LESSON_COUPON_KINDS.includes(couponKind(c)) && (
                  <V2Button size="sm" variant="secondary" onClick={() => onUseInLesson(c.code)}>
                    <CalendarPlus className="h-4 w-4" aria-hidden /> Usar ao pedir a aula
                  </V2Button>
                )}
              </div>
            ))}
          </div>
        )}
      </V2Surface>
    </div>
  );
}
