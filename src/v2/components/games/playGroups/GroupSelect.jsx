/**
 * O seletor de grupo — um `<select>` nativo, de propósito.
 *
 * No celular, na beira da quadra, o seletor do próprio sistema é o que há de
 * mais rápido e de mais acessível: roda sozinho, abre em tela cheia e não
 * depende de um menu flutuante que a rolagem do cartão poderia cortar. O valor
 * "sem grupo" é `null` para quem chama (`NO_GROUP` só existe dentro do
 * controle). Com `autoLabel` há um terceiro estado, "Automático": o valor é
 * `undefined` (a quadra escolhe sozinha pela política do dia).
 */
import React from 'react';
import { cn } from '@/core/lib/utils';
import { NO_GROUP } from '@/modules/games/domain/playGroups';

const AUTO = '__auto__';

/**
 * @param {{
 *   value?: string|null, groups: Array<{id:string,name:string}>,
 *   onChange: (groupId: string|null) => void, label: string,
 *   noneLabel?: string|null, autoLabel?: string|null, disabled?: boolean, className?: string,
 * }} props
 *   `noneLabel: null` tira a opção "sem grupo" (quando a escolha é obrigatória);
 *   `autoLabel` acrescenta "Automático" — e então `value: undefined` é ele.
 */
export default function GroupSelect({
  value, groups, onChange, label, noneLabel = 'Sem grupo', autoLabel = null, disabled = false, className,
}) {
  const atual = autoLabel && value === undefined ? AUTO : (value ?? NO_GROUP);
  return (
    <select
      aria-label={label}
      title={label}
      disabled={disabled}
      value={atual}
      onChange={(e) => {
        const v = e.target.value;
        if (v === AUTO) onChange(undefined);
        else onChange(v === NO_GROUP ? null : v);
      }}
      className={cn(
        'max-w-[10.5rem] rounded-full border border-gray-200 bg-paper-pure px-3 py-1.5 text-xs font-semibold text-ink',
        'transition-colors hover:border-ink focus:outline-none focus:ring-4 focus:ring-gray-100 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      {autoLabel && <option value={AUTO}>{autoLabel}</option>}
      {noneLabel !== null && <option value={NO_GROUP}>{noneLabel}</option>}
      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  );
}
