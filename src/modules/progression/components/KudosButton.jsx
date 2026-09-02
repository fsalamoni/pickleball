import React, { useMemo, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { KUDOS_TARGET_TYPE } from '../domain/kudos.js';

/**
 * KudosButton — botão universal de "👏 dado".
 *
 * Presentational + stateful (controlled via `given` prop).
 *
 * @param {{
 *   targetType: string,         // KUDOS_TARGET_TYPE
 *   targetId: string,
 *   count?: number,             // quantos kudos já recebeu (default 0)
 *   given?: boolean,            // o user atual já deu?
 *   onToggle?: (next: boolean) => void,
 *   size?: 'sm'|'md'|'lg',
 *   variant?: 'inline'|'floating',  // inline (default) ou flutuante
 *   className?: string,
 *   disabled?: boolean,
 * }} props
 */
export default function KudosButton({
  targetType,
  targetId,
  count = 0,
  given = false,
  onToggle,
  size = 'md',
  variant = 'inline',
  className,
  disabled = false,
}) {
  const [optimistic, setOptimistic] = useState(false);
  const isGiven = given || optimistic;
  const displayCount = count + (isGiven && !given ? 1 : 0);

  const sizeClass = useMemo(() => {
    if (size === 'sm') return 'h-7 px-2 text-[11px]';
    if (size === 'lg') return 'h-11 px-5 text-base';
    return 'h-9 px-3 text-xs';
  }, [size]);

  function handleClick() {
    if (disabled) return;
    const next = !isGiven;
    setOptimistic(next);
    onToggle?.(next);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={isGiven ? 'Kudos dado — clique para remover' : 'Dar kudos'}
      data-testid="kudos-button"
      data-target-type={targetType}
      data-target-id={targetId}
      data-given={String(isGiven)}
      data-variant={variant}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-bold transition-all',
        isGiven
          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
          : 'bg-paper text-gray-600 hover:bg-gray-100 hover:text-ink',
        sizeClass,
        disabled && 'cursor-not-allowed opacity-50',
        variant === 'floating' && 'shadow-organic',
        className,
      )}
    >
      <ThumbsUp className={cn('h-3.5 w-3.5', isGiven && 'fill-current')} />
      <span className="tabular-nums">{displayCount || ''}</span>
      {displayCount > 0 && size === 'lg' && <span className="ml-1 font-normal">kudos</span>}
    </button>
  );
}
