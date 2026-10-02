import React from 'react';
import { cn } from '@/core/lib/utils';

/** Um número com rótulo, compacto: para grades de resumo (o V2StatCard é grande demais para isso). */
export default function MiniStat({ label, value, hint, className }) {
  return (
    <div className={cn('rounded-2xl border border-gray-100 bg-paper-pure p-4 text-center shadow-organic-sm', className)}>
      <p className="font-display text-3xl font-black tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
  );
}
