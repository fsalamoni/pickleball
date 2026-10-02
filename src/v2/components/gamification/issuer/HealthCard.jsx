import React from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, TriangleAlert } from 'lucide-react';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const BAR = { green: 'bg-green-500', blue: 'bg-blue-500', amber: 'bg-amber-400', red: 'bg-red-500', neutral: 'bg-gray-300' };

const CONF = {
  high: 'Baseado em dados suficientes.',
  medium: 'Baseado em poucos dados — leia como uma indicação.',
  low: 'Ainda há pouco movimento para medir. O número vai ganhar sentido com o tempo.',
};

/**
 * O retrato de saúde de quem oferece. Só o próprio dono vê (nunca é ranking nem
 * selo): serve para orientar. Cada dimensão diz o número que a motivou; o que
 * não dá para medir aparece como "ainda sem dados", nunca como zero.
 *
 * @param {{ health: ReturnType<import('@/modules/progression/domain/supplyHealth').combineHealth>, suggestions?: Array<object>, unknown?: string[], title?: string, basePath?: string }} props
 */
export default function HealthCard({ health, suggestions = [], unknown = [], title = 'Saúde', basePath = '' }) {
  const band = health.band;
  return (
    <V2Surface data-testid="health-card" data-dica="oferta-saude" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <p className="text-xs text-gray-500">{CONF[health.confidence]} Medido em {health.measured} de {health.totalDimensions} dimensões.</p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-black tabular-nums text-ink">{health.score ?? '—'}</p>
          <V2Badge tone={band.tone}>{band.label}</V2Badge>
        </div>
      </div>

      {unknown.length > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Não deu para carregar: {unknown.join(', ')}. As dimensões que dependem disso ficaram de fora do cálculo.
        </p>
      )}

      <ul className="space-y-3">
        {health.dimensions.map((d) => (
          <li key={d.id} data-dim={d.id}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">{d.label}</span>
              <span className="tabular-nums text-gray-600">{d.score ?? 'ainda sem dados'}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
              <div className={cn('h-full rounded-full', BAR[d.score == null ? 'neutral' : d.score >= 85 ? 'green' : d.score >= 70 ? 'blue' : d.score >= 50 ? 'amber' : 'red'])} style={{ width: `${d.score ?? 0}%` }} />
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">{d.detail}</p>
          </li>
        ))}
      </ul>

      {suggestions.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400"><Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> O que dá para melhorar</p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.id} className={cn('rounded-xl p-3 text-sm', s.tone === 'warn' ? 'bg-amber-50 text-amber-900' : 'bg-paper text-gray-700')}>
                {s.text}{' '}
                {s.to && <Link to={`${basePath}${s.to}`} className="font-bold text-ink underline">Abrir</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </V2Surface>
  );
}
