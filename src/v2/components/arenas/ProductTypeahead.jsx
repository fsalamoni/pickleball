/**
 * ProductTypeahead — seletor ágil de produto por digitação.
 *
 * Em vez de um dropdown com todos os produtos, o usuário digita parte do nome
 * (ou marca) e a lista filtra em tempo real. Usado nas Entradas (todos os
 * produtos do mercado) e nas Saídas (apenas o que está em estoque).
 *
 * Sem Radix/portal — dropdown inline, acessível ao toque.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Search, Check, X } from 'lucide-react';
import { searchProducts } from '@/modules/arenas/domain/inventory';
import { cn } from '@/core/lib/utils';
import { V2Input } from '@/v2/ui/primitives';

export default function ProductTypeahead({
  products = [], value, onSelect, placeholder = 'Digite para buscar o produto…',
  metaFor, emptyHint = 'Nenhum produto encontrado.', autoFocus = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef(null);
  const selected = useMemo(() => products.find((p) => p.id === value) || null, [products, value]);

  const matches = useMemo(() => searchProducts(products, query).slice(0, 40), [products, query]);

  function choose(p) {
    onSelect?.(p);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onSelect?.(null);
    setQuery('');
    setOpen(true);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <V2Input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
          placeholder={selected ? selected.name : placeholder}
          className="pl-9"
        />
      </div>

      {selected && !open && (
        <div className="mt-1 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50/60 px-3 py-1.5 text-sm">
          <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
          <span className="min-w-0 flex-1 truncate font-semibold text-ink">{selected.name}</span>
          {metaFor && <span className="shrink-0 text-xs text-gray-500">{metaFor(selected)}</span>}
          <button type="button" onMouseDown={(e) => { e.preventDefault(); clear(); }} className="shrink-0 text-gray-400 hover:text-ink" aria-label="Trocar produto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {open && (
        <div
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-paper-pure shadow-organic"
          onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current); }}
        >
          {matches.length === 0 ? (
            <p className="p-3 text-sm text-gray-500">{emptyHint}</p>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(p); }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-green-50',
                  p.id === value && 'bg-green-50',
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold text-ink">{p.name}</span>
                  {p.brand && <span className="text-gray-400"> · {p.brand}</span>}
                </span>
                {metaFor && <span className="shrink-0 text-xs text-gray-500">{metaFor(p)}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
