import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/core/lib/utils';

/**
 * Seção colapsável reutilizável. O cabeçalho (título + chevron) é o gatilho de
 * abrir/fechar; o slot `actions` fica fora do botão para que botões de ação
 * (ex.: Sortear) não disparem o toggle.
 *
 * @param {object} props
 * @param {React.ReactNode} props.title       título principal
 * @param {React.ReactNode} [props.subtitle]  linha secundária (resumo)
 * @param {React.ReactNode} [props.badges]    badges ao lado do título
 * @param {React.ReactNode} [props.actions]   ações à direita (não disparam toggle)
 * @param {boolean} [props.defaultOpen=true]
 * @param {string} [props.className]
 * @param {string} [props.headerClassName]
 */
export function CollapsibleSection({
  title,
  subtitle,
  badges,
  actions,
  defaultOpen = true,
  className,
  headerClassName,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('rounded-md border border-gray-200 bg-white', className)}>
      <div className={cn('flex items-center justify-between gap-2 px-3 py-2', headerClassName)}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', !open && '-rotate-90')}
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-ink truncate">{title}</span>
              {badges}
            </span>
            {subtitle && <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>}
          </span>
        </button>
        {actions && <div className="flex shrink-0 items-center gap-1 flex-wrap justify-end">{actions}</div>}
      </div>
      {open && <div className="px-3 pb-3 pt-0">{children}</div>}
    </div>
  );
}
