import React from 'react';
import { Crown } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { tierFromXp, TIERS } from '../domain/tiers.js';

/**
 * Mapa de cor Tailwind por token de cor do tier.
 * Mantido sincronizado com `TIERS[].color`.
 */
const COLOR_CLASSES = {
  gray:    { bg: 'bg-gray-100',    text: 'text-gray-700',    ring: 'ring-gray-200' },
  green:   { bg: 'bg-green-100',   text: 'text-green-700',   ring: 'ring-green-200' },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-700',    ring: 'ring-teal-200' },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    ring: 'ring-cyan-200' },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-700',    ring: 'ring-blue-200' },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  ring: 'ring-indigo-200' },
  purple:  { bg: 'bg-purple-100',  text: 'text-purple-700',  ring: 'ring-purple-200' },
  pink:    { bg: 'bg-pink-100',    text: 'text-pink-700',    ring: 'ring-pink-200' },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-200' },
};

const TIER_RANK = Object.freeze(
  TIERS.reduce((acc, t) => {
    acc[t.name] = t.tier;
    return acc;
  }, {}),
);

/**
 * TierBadge — badge visual de tier do usuário.
 *
 * @param {{
 *   xp?: number,
 *   tier?: object,        // se quiser passar o tier diretamente
 *   showName?: boolean,   // exibe o nome do tier (default true)
 *   showIcon?: boolean,   // exibe o emoji (default true)
 *   size?: 'sm'|'md'|'lg',
 *   className?: string,
 *   withCrown?: boolean,  // adiciona ícone Crown pra tier 5 (Imortal)
 * }} props
 */
export default function TierBadge({
  xp = 0,
  tier: tierProp = null,
  showName = true,
  showIcon = true,
  size = 'md',
  className,
  withCrown = true,
}) {
  const tier = tierProp || tierFromXp(xp);
  const colors = COLOR_CLASSES[tier.color] || COLOR_CLASSES.gray;

  const sizeClass = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  }[size] || 'px-3 py-1 text-xs';

  return (
    <span
      data-testid="tier-badge"
      data-tier={tier.name}
      data-tier-rank={TIER_RANK[tier.name] || 1}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-bold ring-1',
        colors.bg,
        colors.text,
        colors.ring,
        sizeClass,
        className,
      )}
      title={tier.description}
    >
      {showIcon && <span aria-hidden="true">{tier.icon}</span>}
      {showName && <span>{tier.name}</span>}
      {withCrown && tier.name === 'Imortal' && (
        <Crown className="h-3 w-3" />
      )}
    </span>
  );
}
