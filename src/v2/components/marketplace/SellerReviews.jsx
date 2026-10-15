/**
 * SellerReviews — as avaliações que um vendedor recebeu de quem comprou:
 * nota, histograma e a lista. A MESMA peça na vitrine pública
 * (`V2MarketSeller`) e no painel de quem vende (Negociações → Avaliações).
 */
import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { t, fmtData, fmtNumero } from '@/core/i18n';
import { summarizeReviews, MIN_REVIEWS_FOR_RATING, REVIEW_REVEAL_DAYS } from '@/modules/marketplace/domain/reputation';
import { useSellerReviews } from '@/modules/marketplace/hooks/useMarket';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { Stars } from '@/v2/components/marketplace/marketUi';

export default function SellerReviews({ sellerKey, title = t('Avaliações de quem comprou'), emptyText }) {
  const q = useSellerReviews(sellerKey);
  if (q.isError) return <V2ErrorState inline onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={3} />;
  const all = (q.data || []).filter((r) => r.visible && r.author_role === 'buyer');
  const resumo = summarizeReviews(all);
  return (
    <section aria-labelledby={`aval-${sellerKey}`} className="space-y-4">
      <h2 id={`aval-${sellerKey}`} className="font-display text-xl font-bold text-ink">{title}</h2>
      {!resumo.count ? (
        <p className="text-sm text-gray-500">{emptyText || t('Ainda sem avaliações. As avaliações aparecem depois das primeiras vendas concluídas.')} {t('Cada avaliação fica escondida até os dois lados avaliarem ou passarem {n} dias.', { n: REVIEW_REVEAL_DAYS })}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
          <div className="space-y-2">
            <p className="font-display text-5xl font-bold text-ink">{resumo.showRating ? fmtNumero(Number(resumo.avg.toFixed(1)), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</p>
            <Stars avg={resumo.avg} count={resumo.count} />
            {!resumo.showRating && <p className="text-xs text-gray-500">{t('A nota aparece a partir de {n} avaliações.', { n: MIN_REVIEWS_FOR_RATING })}</p>}
            <ul className="space-y-1 pt-2">
              {[5, 4, 3, 2, 1].map((n) => (
                <li key={n} className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-3">{n}</span><Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper">
                    <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(resumo.histogram[n] / resumo.count) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right">{resumo.histogram[n]}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="divide-y divide-gray-100">
            {all.slice(0, 20).map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex" aria-label={t('{nota} de 5', { nota: r.rating })}>
                    {[1, 2, 3, 4, 5].map((i) => <Star key={i} aria-hidden="true" className={cn('h-3.5 w-3.5', i <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />)}
                  </span>
                  <span className="text-xs text-gray-500">{r.author_name} · {r.created_at_ms ? fmtData(r.created_at_ms, { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}</span>
                </div>
                {r.listing_title && <p className="mt-1 text-xs text-gray-500">{t('Comprou: {titulo}', { titulo: r.listing_title })}</p>}
                {r.comment && <p className="mt-1 text-sm text-ink">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
