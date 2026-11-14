/**
 * A navegação que o torneio e a liga dividem:
 * - `CompetitionTabs`: a barra de abas em pílula (a capa de cada um e as
 *   listas "Públicos / Meus"). Quebra em linhas, nunca rola para o lado.
 * - `CompetitionStepper`: os passos do assistente de criação.
 * - `CompetitionWizardFooter`: Cancelar/Voltar e Avançar/Criar do assistente.
 */
import React from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { t } from '@/core/i18n';
import { cn } from '@/core/lib/utils';
import { V2Button } from '@/v2/ui/primitives';
import { moverFocoComSetas } from '@/v2/ui/V2SectionNav';

/**
 * @param {{
 *   tabs: Array<{ value: string, label: string, icon?: React.ComponentType<any> }>,
 *   active: string,
 *   onSelect: (value: string) => void,
 *   ariaLabel: string,
 *   dica?: string,
 *   className?: string,
 * }} props
 */
export function CompetitionTabs({ tabs, active, onSelect, ariaLabel, dica, className }) {
  return (
    <nav
      aria-label={ariaLabel}
      data-dica={dica}
      onKeyDown={moverFocoComSetas}
      className={cn('inline-flex flex-wrap gap-1.5 rounded-3xl border border-gray-100 bg-paper-pure p-1.5 shadow-sm', className)}
    >
      {tabs.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onSelect(value)}
          aria-current={active === value ? 'page' : undefined}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors coarse:min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink',
            active === value ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink',
          )}
        >
          {Icon && <Icon className="h-4 w-4" aria-hidden="true" />} {label}
        </button>
      ))}
    </nav>
  );
}

/**
 * Os passos do assistente: o atual em tinta, os feitos com ✓ (voltáveis), os
 * de depois travados.
 * @param {{ steps: Array<{ id: string, label: string }>, current: number, onGo: (i: number) => void, dica?: string }} props
 */
export function CompetitionStepper({ steps, current, onGo, dica }) {
  return (
    <ol data-dica={dica} className="flex items-center gap-2" aria-label={t('Passos')}>
      {steps.map((s, i) => {
        const feito = i < current;
        const ativo = i === current;
        return (
          <React.Fragment key={s.id}>
            <li>
              <button
                type="button"
                onClick={() => (i <= current ? onGo(i) : null)}
                disabled={i > current}
                aria-current={ativo ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                  ativo ? 'bg-ink text-white' : feito ? 'bg-acid/20 text-ink' : 'bg-paper text-gray-500',
                )}
              >
                <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-2xs', ativo ? 'bg-acid text-ink' : feito ? 'bg-ink text-acid' : 'bg-gray-200 text-gray-500')}>
                  {feito ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{t(s.label)}</span>
              </button>
            </li>
            {i < steps.length - 1 && <li aria-hidden="true" className="h-px flex-1 bg-gray-200" />}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

/**
 * O rodapé do assistente de criação: "Cancelar" no primeiro passo e "Voltar"
 * nos outros; "Avançar" até o último, e lá o botão de criar.
 *
 * @param {{
 *   step: number,
 *   last: boolean,
 *   onCancel: () => void,
 *   onBack: () => void,
 *   next: { onClick: () => void, disabled?: boolean, dica?: string },
 *   create: { label: string, onClick?: () => void, submit?: boolean, busy?: boolean, disabled?: boolean, dica?: string },
 * }} props
 */
export function CompetitionWizardFooter({ step, last, onCancel, onBack, next, create }) {
  return (
    <div className="flex justify-between gap-2 pt-2">
      <V2Button type="button" variant="ghost" onClick={step === 0 ? onCancel : onBack}>
        {step === 0 ? t('Cancelar') : <><ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('Voltar')}</>}
      </V2Button>
      {last ? (
        <V2Button
          type={create.submit ? 'submit' : 'button'}
          onClick={create.submit ? undefined : create.onClick}
          disabled={create.busy || create.disabled}
          data-dica={create.dica}
        >
          {create.busy ? t('Criando…') : create.label} <Check className="h-4 w-4" aria-hidden="true" />
        </V2Button>
      ) : (
        <V2Button type="button" onClick={next.onClick} disabled={next.disabled} data-dica={next.dica}>
          {t('Avançar')} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </V2Button>
      )}
    </div>
  );
}
