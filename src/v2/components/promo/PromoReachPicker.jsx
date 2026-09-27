/**
 * "Até onde aparece" na tela inicial: o Brasil todo, um estado ou uma cidade.
 *
 * O filtro da tela inicial é por LOCALIDADE, como o das promoções das arenas
 * (Onda BZ): quem abre a tela vê o que é nacional e o que é da região dela.
 */
import React from 'react';
import { BR_UFS, PROMO_REACH, normalizeReach } from '@/modules/promo/domain/promo';
import { V2Field, V2Input, V2Select } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const OPCOES = [
  { v: PROMO_REACH.BRASIL, label: 'Todo o Brasil' },
  { v: PROMO_REACH.ESTADO, label: 'Um estado' },
  { v: PROMO_REACH.CIDADE, label: 'Uma cidade' },
];

/**
 * @param {{ idPrefix: string, value: { mode, state, city }, onChange: Function, legend?: string }} props
 */
export default function PromoReachPicker({ idPrefix, value, onChange, legend = 'Até onde aparece na tela inicial' }) {
  const v = value || { mode: PROMO_REACH.BRASIL, state: '', city: '' };
  const erro = normalizeReach(v).errors.reach;
  const set = (patch) => onChange({ ...v, ...patch });
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={legend}>
        {OPCOES.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={v.mode === o.v} onClick={() => set({ mode: o.v })}
            className={cn('rounded-full border px-3.5 py-1.5 text-xs font-bold transition sm:text-sm',
              v.mode === o.v ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink')}>
            {o.label}
          </button>
        ))}
      </div>
      {v.mode !== PROMO_REACH.BRASIL && (
        <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <V2Field label="Estado" htmlFor={`${idPrefix}-uf`}>
            <V2Select id={`${idPrefix}-uf`} value={v.state || ''} onChange={(e) => set({ state: e.target.value })}>
              <option value="">UF…</option>
              {BR_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </V2Select>
          </V2Field>
          {v.mode === PROMO_REACH.CIDADE && (
            <V2Field label="Cidade" htmlFor={`${idPrefix}-cidade`}>
              <V2Input id={`${idPrefix}-cidade`} maxLength={80} placeholder="Porto Alegre"
                value={v.city || ''} onChange={(e) => set({ city: e.target.value })} />
            </V2Field>
          )}
        </div>
      )}
      {erro && <p className="text-xs font-semibold text-amber-700">{erro}</p>}
      <p className="text-xs text-gray-500">
        {v.mode === PROMO_REACH.BRASIL
          ? 'Aparece para todo mundo — inclusive quem ainda não informou a cidade.'
          : 'Aparece para quem é dessa região (pela cidade do perfil) ou escolheu vê-la.'}
      </p>
    </fieldset>
  );
}
