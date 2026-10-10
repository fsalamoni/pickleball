import React from 'react';
import { Plus, X } from 'lucide-react';
import { V2Input } from '@/v2/ui/primitives';
import { MAX_SETS, resultFromSets } from '@/modules/games/domain/gameSets';

/**
 * O placar de uma partida, por sets. Começa com UM set (a regra) e oferece
 * "Adicionar set" na hora do lançamento; com dois ou mais, cada set tem o seu
 * X para remover e a linha de baixo diz como fica (2 × 1) ou o que falta.
 *
 * Controlado: `value` é a lista de sets digitados ({ a, b } em texto) e
 * `onChange` recebe a lista nova. A validação é a do domínio
 * (`resultFromSets`), a mesma que o serviço refaz antes de gravar.
 */
export default function SetScoreEditor({
  value, onChange, labelA = 'Lado A', labelB = 'Lado B', disabled = false, size = 'md',
}) {
  const sets = Array.isArray(value) && value.length > 0 ? value : [{ a: '', b: '' }];
  const varios = sets.length > 1;
  const largura = size === 'sm' ? 'w-16' : 'w-20';

  const alterar = (i, lado, v) => onChange(sets.map((s, k) => (k === i ? { ...s, [lado]: v } : s)));
  const remover = (i) => onChange(sets.filter((_, k) => k !== i));
  const adicionar = () => onChange([...sets, { a: '', b: '' }]);

  const preenchidos = sets.every((s) => s.a !== '' && s.b !== '');
  const resumo = varios && preenchidos ? resultFromSets(sets) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-gray-500">
        {varios && <span className="w-12" aria-hidden="true" />}
        <span className={`${largura} truncate text-center`} title={labelA}>{labelA}</span>
        <span className="w-3" aria-hidden="true" />
        <span className={`${largura} truncate text-center`} title={labelB}>{labelB}</span>
        {varios && <span className="w-7" aria-hidden="true" />}
      </div>
      {sets.map((s, i) => (
        <div key={i} className="flex items-center justify-center gap-2">
          {varios && <span className="w-12 text-right text-[11px] font-semibold text-gray-500">Set {i + 1}</span>}
          <V2Input
            className={`${largura} text-center tabular-nums`}
            inputMode="numeric"
            value={s.a}
            disabled={disabled}
            onChange={(e) => alterar(i, 'a', e.target.value)}
            placeholder="0"
            aria-label={varios ? `Set ${i + 1}, ${labelA}` : `Placar, ${labelA}`}
          />
          <span className="w-3 text-center text-xs text-gray-500">×</span>
          <V2Input
            className={`${largura} text-center tabular-nums`}
            inputMode="numeric"
            value={s.b}
            disabled={disabled}
            onChange={(e) => alterar(i, 'b', e.target.value)}
            placeholder="0"
            aria-label={varios ? `Set ${i + 1}, ${labelB}` : `Placar, ${labelB}`}
          />
          {varios && (
            <button
              type="button"
              onClick={() => remover(i)}
              disabled={disabled}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-red-600"
              aria-label={`Remover o set ${i + 1}`}
              title={`Remover o set ${i + 1}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      <div className="flex flex-col items-center gap-1">
        {sets.length < MAX_SETS && (
          <button
            type="button"
            onClick={adicionar}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-ink disabled:opacity-50"
          >
            <Plus className="h-3 w-3" /> Adicionar set
          </button>
        )}
        {resumo && (
          <p className={`text-[11px] ${resumo.ok ? 'text-gray-500' : 'text-amber-700'}`} role="status">
            {resumo.ok
              ? `Por sets: ${resumo.fields.score_a} × ${resumo.fields.score_b} (${resumo.fields.points_a} × ${resumo.fields.points_b} em pontos)`
              : resumo.error}
          </p>
        )}
      </div>
    </div>
  );
}
