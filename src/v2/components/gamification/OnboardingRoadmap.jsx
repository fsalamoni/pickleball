import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Rocket, X } from 'lucide-react';
import { V2Badge, V2Button, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

/**
 * Roteiro de "Primeiros passos". Nenhuma etapa é obrigatória — "Pular por
 * agora" fica à vista — e nenhuma é auto-declarada: cada uma é detectada.
 *
 * @param {{ state: ReturnType<import('@/modules/progression/domain/onboarding').evaluateOnboarding>, onDismiss?: Function, compact?: boolean }} props
 */
export default function OnboardingRoadmap({ state, onDismiss, compact = false }) {
  if (!state) return null;
  const { steps, doneCount, total, progress, xpAvailable, next } = state;
  const pct = Math.round(progress * 100);
  const lista = compact ? steps.filter((s) => !s.complete).slice(0, 3) : steps;

  return (
    <V2Surface data-testid="onboarding-roadmap" data-dica="primeiros-passos" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acid/30 text-ink">
            <Rocket className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Primeiros passos</h2>
            <p className="text-xs text-gray-500">
              {doneCount} de {total} · ainda dá para ganhar <strong className="text-ink">{xpAvailable} XP</strong>
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-paper hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Pular por agora
          </button>
        )}
      </div>

      <div
        role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-label="Progresso dos primeiros passos"
        className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
      >
        <div className="h-full rounded-full bg-acid transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-2">
        {lista.map((s) => {
          const isNext = next?.id === s.id;
          return (
            <li
              key={s.id}
              data-step={s.id}
              data-done={String(s.complete)}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3',
                s.complete ? 'border-green-100 bg-green-50/60' : isNext ? 'border-acid bg-acid/10' : 'border-gray-100 bg-paper-pure',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  s.complete ? 'bg-green-500 text-white' : 'border-2 border-gray-300 text-transparent',
                )}
              >
                <Check className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-bold', s.complete ? 'text-gray-500 line-through' : 'text-ink')}>{s.label}</p>
                {!s.complete && <p className="text-xs text-gray-500">{s.hint}</p>}
              </div>
              {s.complete ? (
                <V2Badge tone="green">+{s.xp} XP</V2Badge>
              ) : (
                <V2Button asChild size="sm" variant={isNext ? 'primary' : 'secondary'}>
                  <Link to={s.to} aria-label={`${s.cta} (+${s.xp} XP)`}>
                    {s.cta} <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </V2Button>
              )}
            </li>
          );
        })}
      </ul>
    </V2Surface>
  );
}
