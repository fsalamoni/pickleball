import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { V2Surface } from '@/v2/ui/primitives';
import { reviewHeadline, reviewHighlights } from '@/modules/progression/domain/periodReview';
import { achievementName } from './achievementName';
import { cn } from '@/core/lib/utils';
import TermHint from './TermHint';

/** O corpo da revisão (manchete + destaques). Reaproveitado no card e na página. */
export function ReviewBody({ review, limit = null }) {
  const linhas = reviewHighlights(review, { nameOf: achievementName });
  const mostrar = limit ? linhas.slice(0, limit) : linhas;
  return (
    <div className="space-y-3">
      <p className="font-display text-base font-bold text-ink">{reviewHeadline(review)}</p>
      {review.incomplete?.length > 0 && (
        <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Alguns dados não carregaram ({review.incomplete.join(', ')}). Os números abaixo podem estar incompletos.
        </p>
      )}
      {mostrar.length > 0 && (
        <ul className="space-y-1.5">
          {mostrar.map((l) => (
            <li key={l.id} className="flex items-start gap-2 text-sm">
              <span aria-hidden="true" className="w-5 shrink-0 text-center">{l.icon}</span>
              <span className={cn(l.tone === 'good' ? 'font-semibold text-ink' : 'text-gray-600')}>{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** O card do hub: a semana em andamento (ou a que acabou), com atalho para a página. */
export default function PeriodReviewCard({ review }) {
  if (!review) return null;
  return (
    <V2Surface data-testid="period-review-card" data-dica="revisao-semana">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <CalendarDays className="h-5 w-5" aria-hidden="true" /> Sua semana em revisão <TermHint term="revisao" />
        </h2>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{review.window.label}</span>
      </div>
      <ReviewBody review={review} limit={4} />
      <Link
        to="/gamification/revisao"
        className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline"
      >
        Ver a revisão completa <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </V2Surface>
  );
}
