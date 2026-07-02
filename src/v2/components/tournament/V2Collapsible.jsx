import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/core/lib/utils';

/**
 * Seção colapsável nativa v2 (usada nas abas de ranking/jogos do torneio).
 */
export default function V2Collapsible({ title, subtitle, badges, defaultOpen = true, children, tone = 'surface' }) {
  const [open, setOpen] = useState(defaultOpen);
  const container = tone === 'nested'
    ? 'rounded-3xl border border-gray-100 bg-paper'
    : 'rounded-4xl border border-gray-100 bg-paper-pure shadow-organic-sm';

  return (
    <div className={cn('overflow-hidden', container)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="font-display text-base font-bold text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 text-xs text-gray-500">{subtitle}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badges}
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>
      {open && <div className="border-t border-gray-100 p-4 sm:p-5">{children}</div>}
    </div>
  );
}
