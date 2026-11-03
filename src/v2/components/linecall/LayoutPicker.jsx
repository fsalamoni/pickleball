/**
 * LayoutPicker — quantas câmeras e onde. Primeiro o número (1 a 5), depois os
 * arranjos daquele número, cada um com o desenho e para que serve. O
 * recomendado vem marcado.
 */

import React, { useState } from 'react';
import { Check, Star } from 'lucide-react';
import { layoutsByCount, layoutById, layoutJudges } from '@/modules/linecall/domain/cameraLayouts';
import { V2Badge, V2FilterChip } from '@/v2/ui/primitives';
import CourtDiagram from './CourtDiagram';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

const GROUPS = layoutsByCount();

/** @param {{ value: string, onChange?: (id: string) => void, disabled?: boolean }} props */
export default function LayoutPicker({ value, onChange, disabled = false }) {
  const atual = layoutById(value);
  const [count, setCount] = useState(atual.positions.length);
  const opcoes = GROUPS.find(([n]) => n === count)?.[1] || [];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('Quantas câmeras')}>
        <span className="text-xs font-semibold text-gray-500">{t('Quantas câmeras')}</span>
        {GROUPS.map(([n]) => (
          <V2FilterChip key={n} type="button" active={n === count} aria-pressed={n === count} onClick={() => setCount(n)}>
            {n}
          </V2FilterChip>
        ))}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {opcoes.map((l) => {
          const sel = l.id === atual.id;
          const julga = layoutJudges(l.id);
          return (
            <li key={l.id}>
              <button type="button"
                disabled={disabled || !onChange}
                aria-pressed={sel}
                onClick={() => onChange?.(l.id)}
                className={cn(
                  'flex h-full w-full gap-3 rounded-2xl border p-3 text-left transition-colors',
                  sel ? 'border-ink bg-paper' : 'border-gray-100 bg-white hover:border-gray-300',
                  (disabled || !onChange) && !sel && 'opacity-60',
                )}
              >
                <CourtDiagram positions={l.positions} className="w-16 shrink-0 text-ink" label={t(l.label)} />
                <span className="min-w-0 space-y-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                    {sel && <Check className="h-4 w-4" aria-hidden="true" />}
                    {t(l.label)}
                  </span>
                  <span className="block text-xs leading-5 text-gray-600">{t(l.good)}</span>
                  <span className="flex flex-wrap gap-1">
                    {l.recommended && <V2Badge tone="acid"><Star className="mr-1 inline h-3 w-3" aria-hidden="true" />{t('Recomendado')}</V2Badge>}
                    <V2Badge tone="neutral">{t('Dentro/fora')}</V2Badge>
                    {julga.feet
                      ? <V2Badge tone="neutral">{t('Pé na cozinha')}</V2Badge>
                      : <V2Badge tone="amber">{t('Sem pé na cozinha')}</V2Badge>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
