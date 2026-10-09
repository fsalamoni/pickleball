/**
 * A semana em sete bolinhas (segunda a domingo), a partir de `weekSummary`.
 * "Ficou para depois" é cinza claro com texto — nunca vermelho: não treinar
 * num dia planejado não é falha.
 */
import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { WEEKDAY_LONG, WEEKDAY_SHORT, weekdayOf } from '@/modules/training/domain/dates';

const ESTADO = {
  feito: { cls: 'bg-acid text-ink', texto: 'treinou' },
  parcial: { cls: 'bg-acid/40 text-ink', texto: 'treinou uma parte' },
  hoje: { cls: 'border-2 border-ink text-ink', texto: 'planejado para hoje' },
  planejado: { cls: 'border border-dashed border-gray-300 text-gray-500', texto: 'planejado' },
  depois: { cls: 'bg-gray-100 text-gray-400', texto: 'ficou para depois' },
  vazio: { cls: 'bg-gray-50 text-gray-300', texto: 'sem treino' },
};

export default function WeekStrip({ summary, className }) {
  return (
    <ol className={cn('grid grid-cols-7 gap-1.5', className)} aria-label="A semana, de segunda a domingo">
      {summary.days.map((d) => {
        const e = ESTADO[d.state] || ESTADO.vazio;
        const wd = weekdayOf(d.date);
        return (
          <li key={d.date} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-bold uppercase text-gray-400" aria-hidden="true">{WEEKDAY_SHORT[wd].slice(0, 3)}</span>
            <span
              className={cn('flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold', e.cls)}
              title={`${WEEKDAY_LONG[wd]}: ${e.texto}`}
            >
              {d.state === 'feito' || d.state === 'parcial'
                ? <Check className="h-4 w-4" aria-hidden="true" />
                : <span aria-hidden="true">{d.date.slice(8, 10)}</span>}
              <span className="sr-only">{`${WEEKDAY_LONG[wd]}, ${d.date.slice(8, 10)}: ${e.texto}`}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
