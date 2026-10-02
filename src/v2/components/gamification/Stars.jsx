import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/core/lib/utils';

/** Seletor de estrelas (1–5), acessível por teclado e leitor de tela. */
export function StarPicker({ value = 0, onChange, label = 'Nota' }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
          onClick={() => onChange?.(n)}
          className="rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <Star className={cn('h-7 w-7 transition-colors', n <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
        </button>
      ))}
    </div>
  );
}

/** Estrelas só de leitura. */
export function StarsStatic({ value = 0, className }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} aria-label={`${value} de 5 estrelas`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('h-4 w-4', n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300')} />
      ))}
    </span>
  );
}
