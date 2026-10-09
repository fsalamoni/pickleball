/**
 * A primeira escolha do editor: o TIPO do item. Ele decide que seções
 * aparecem, então vem antes de tudo — com a frase do que é cada tipo.
 * Rádios de verdade (setas do teclado navegam), desenhados como cartões.
 */
import React from 'react';
import { cn } from '@/core/lib/utils';
import { ITEM_KINDS, ITEM_KIND_HINTS, ITEM_KIND_LABELS } from '@/modules/training/domain/taxonomy';
import { KindIcon } from '@/v2/components/training/ItemCard';

export default function KindPicker({ value, onChange, erro }) {
  return (
    <fieldset id="campo-kind" data-dica="treino-editor-tipo" className="scroll-mt-4">
      <legend className="mb-1 font-display text-xl font-bold text-ink">Que tipo de item?</legend>
      <p className="mb-4 text-sm text-gray-500">Escolha pelo que a pessoa vai FAZER com ele. O tipo decide quais partes da ficha aparecem.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEM_KINDS.map((k) => {
          const ativo = value === k;
          return (
            <label
              key={k}
              className={cn(
                'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-3xl border p-4 transition-colors focus-within:ring-4 focus-within:ring-acid/30',
                ativo ? 'border-ink bg-acid/15' : 'border-gray-200 bg-paper-pure hover:border-ink',
              )}
            >
              <input
                type="radio"
                name="tipo-do-item"
                value={k}
                checked={ativo}
                onChange={() => onChange(k)}
                className="sr-only"
              />
              <KindIcon kind={k} size="sm" />
              <span className="min-w-0">
                <span className="block font-bold text-ink">{ITEM_KIND_LABELS[k]}</span>
                <span className="mt-0.5 block text-xs leading-5 text-gray-500">{ITEM_KIND_HINTS[k]}</span>
              </span>
            </label>
          );
        })}
      </div>
      {erro && <p className="mt-2 text-xs font-medium text-red-500">{erro}</p>}
    </fieldset>
  );
}
