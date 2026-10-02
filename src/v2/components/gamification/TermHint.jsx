import React from 'react';
import { Link } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { ChevronRight, CircleHelp } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useGamificationGuide } from '@/modules/progression/hooks/useGamificationGuide';

/**
 * O "?" ao lado de um conceito: explica em uma frase e leva ao glossário.
 *
 * É um POPOVER (toque/Enter), não um tooltip: tooltip depende de passar o mouse
 * e não existe no celular — que é onde a maioria das pessoas usa a plataforma.
 * Fecha com Esc ou tocando fora; o foco volta para o botão.
 *
 * O texto vem do guia (`gamificationGuide.js`), com os números da configuração
 * do admin — nunca escrito na tela.
 *
 * @param {{ term: string, className?: string, side?: 'top'|'bottom'|'left'|'right', label?: string }} props
 */
export default function TermHint({ term, className, side = 'bottom', label }) {
  const { guide } = useGamificationGuide();
  const t = guide.byId[term];
  if (!t) return null;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label || `O que é ${t.title}?`}
          data-term={t.id}
          className={cn(
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors',
            'hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40',
            className,
          )}
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          data-testid="term-hint"
          className="z-[70] w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-gray-100 bg-paper-pure p-4 text-left shadow-organic outline-none"
        >
          <p className="font-display text-sm font-bold text-ink">{t.title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-600">{t.short}</p>
          <Link
            to={`/gamification/como-funciona?termo=${t.id}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline"
          >
            Entender melhor <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
