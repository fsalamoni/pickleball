/**
 * Campo de número com botões − e + ao lado.
 *
 * Para contagens pequenas com limite (quadras, rodadas, vagas, semanas): no
 * celular, tocar no + é mais rápido e mais certo que abrir o teclado. O campo
 * do meio continua digitável — e apagável (ver `useNumberDraft`). Os botões
 * param no mínimo e no máximo, e falam com a tela pelo MESMO `onChange` do
 * campo (um evento com `target.value`), então quem usa não precisa de um
 * segundo caminho.
 *
 * `compacto`: altura do campo dos diálogos (o `Input` de `components/ui`,
 * 40 px). Sem ele, a do `V2Input` (48 px). Nunca se passa `h-10` ao `V2Input`.
 */
import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';
import { Input } from '@/components/ui/input';
import { V2Input } from './primitives';

const BOTAO = 'flex shrink-0 items-center justify-center border text-ink transition-colors hover:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200';
const SEM_SETAS = 'min-w-0 flex-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/** O próximo valor ao tocar em − (`direcao` -1) ou + (1), dentro dos limites. */
export function stepNumber(value, direcao, { min, max, step = 1 } = {}) {
  const passo = Number(step) > 0 ? Number(step) : 1;
  const lo = min === undefined || min === '' ? -Infinity : Number(min);
  const hi = max === undefined || max === '' ? Infinity : Number(max);
  const atual = Number(value);
  // Campo vazio: o primeiro toque leva ao mínimo (ou ao zero).
  let next = value === '' || value == null || !Number.isFinite(atual)
    ? (Number.isFinite(lo) ? lo : 0)
    : atual + direcao * passo;
  // Corrige a soma de decimais (0,1 + 0,2) pelo número de casas do passo.
  const casas = (String(passo).split('.')[1] || '').length;
  next = Number(next.toFixed(casas));
  return Math.min(hi, Math.max(lo, next));
}

export function V2NumberInput({ value, onChange, min, max, step = 1, disabled, compacto = false, className, inputClassName, rotulo, ...props }) {
  const atual = Number(value);
  const vazio = value === '' || value == null || !Number.isFinite(atual);
  const podeMenos = !disabled && (vazio || min === undefined || atual > Number(min));
  const podeMais = !disabled && (vazio || max === undefined || atual < Number(max));
  const inteiro = Number.isInteger(Number(step) || 1);
  const emitir = (direcao) => {
    const next = String(stepNumber(value, direcao, { min, max, step }));
    onChange?.({ target: { value: next }, currentTarget: { value: next } });
  };
  const Campo = compacto ? Input : V2Input;
  const botao = cn(BOTAO, compacto ? 'h-10 w-10 coarse:h-11 coarse:w-11 rounded-md border-input bg-background' : 'h-12 w-12 rounded-2xl border-gray-200 bg-paper-pure');
  return (
    <div className={cn('flex items-center', compacto ? 'gap-1.5' : 'gap-2', className)}>
      <button type="button" className={botao} onClick={() => emitir(-1)} disabled={!podeMenos}
        aria-label={rotulo ? t('Diminuir {label}', { label: rotulo }) : t('Diminuir')}>
        <Minus aria-hidden="true" className="h-4 w-4" />
      </button>
      <Campo
        type="number"
        inputMode={inteiro && !(Number(min) < 0) ? 'numeric' : 'decimal'}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={cn(SEM_SETAS, compacto && 'px-1 coarse:h-11', inputClassName)}
        {...props}
      />
      <button type="button" className={botao} onClick={() => emitir(1)} disabled={!podeMais}
        aria-label={rotulo ? t('Aumentar {label}', { label: rotulo }) : t('Aumentar')}>
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

export default V2NumberInput;
