/**
 * Quem vê o item — e o que vai acontecer ao salvar, dito ANTES ("a equipe
 * revisa antes de publicar"). As opções vêm do papel de quem escreve
 * (`visibilityOptionsFor`); o que a regra recusaria nem é oferecido.
 */
import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { VISIBILITY, VISIBILITY_HINTS, VISIBILITY_LABELS } from '@/modules/training/domain/visibility';

/**
 * @param {{ value: string, onChange: (v: string) => void, options: string[],
 *   notice?: string, publicoTravado?: string }} props `publicoTravado`: o motivo
 *   de "Público" não poder ser escolhido (vazio = pode).
 */
export default function VisibilityPicker({ value, onChange, options = [], notice = '', publicoTravado = '' }) {
  return (
    <fieldset id="campo-visibility" data-dica="treino-editor-visibilidade" className="scroll-mt-4">
      <legend className="mb-1 font-display text-xl font-bold text-ink">Quem pode ver</legend>
      <p className="mb-4 text-sm text-gray-500">Dá para mudar depois. “Só eu” também serve de rascunho guardado na sua conta.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((v) => {
          const travado = v === VISIBILITY.PUBLICO && !!publicoTravado;
          const ativo = value === v;
          return (
            <label
              key={v}
              className={cn(
                'flex min-h-[44px] items-start gap-3 rounded-3xl border p-4 transition-colors focus-within:ring-4 focus-within:ring-acid/30',
                travado ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                ativo ? 'border-ink bg-acid/15' : 'border-gray-200 bg-paper-pure hover:border-ink',
              )}
            >
              <input
                type="radio"
                name="visibilidade-do-item"
                value={v}
                checked={ativo}
                disabled={travado}
                onChange={() => onChange(v)}
                className="mt-1 h-4 w-4 shrink-0 accent-ink"
              />
              <span className="min-w-0">
                <span className="block font-bold text-ink">{VISIBILITY_LABELS[v]}</span>
                <span className="mt-0.5 block text-xs leading-5 text-gray-500">{VISIBILITY_HINTS[v]}</span>
              </span>
            </label>
          );
        })}
      </div>
      {publicoTravado && <p className="mt-3 text-xs text-gray-500">{publicoTravado}</p>}
      {notice && (
        <p role="status" className="mt-3 flex gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </p>
      )}
    </fieldset>
  );
}
