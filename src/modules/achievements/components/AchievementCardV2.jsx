import React from 'react';
import { Lock, Sparkles, Share2 } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Badge } from '@/v2/ui/primitives';
import {
  ACHIEVEMENT_RARITY,
  ACHIEVEMENT_RARITY_META,
  ACHIEVEMENT_FAMILY_META,
} from '../domain/achievementsV2.js';

/**
 * Mapa de cor por família (visualmente distinto do rarity).
 * Usamos `text-{color}` Tailwind + um fundo `bg-{color}-50` para suavizar.
 */
const FAMILY_ACCENT = {
  career:    { ring: 'ring-amber-200',   badge: 'bg-amber-50 text-amber-700',   iconBg: 'bg-amber-100 text-amber-700' },
  social:    { ring: 'ring-blue-200',    badge: 'bg-blue-50 text-blue-700',     iconBg: 'bg-blue-100 text-blue-700' },
  discovery: { ring: 'ring-green-200',   badge: 'bg-green-50 text-green-700',   iconBg: 'bg-green-100 text-green-700' },
  seasonal:  { ring: 'ring-pink-200',    badge: 'bg-pink-50 text-pink-700',     iconBg: 'bg-pink-100 text-pink-700' },
  community: { ring: 'ring-purple-200',  badge: 'bg-purple-50 text-purple-700', iconBg: 'bg-purple-100 text-purple-700' },
};

const RARITY_GLOW = {
  common:    '',
  uncommon:  'shadow-[0_0_0_1px_rgba(20,184,166,0.15)]',
  rare:      'shadow-[0_0_0_2px_rgba(59,130,246,0.18),0_0_18px_-2px_rgba(59,130,246,0.35)]',
  epic:      'shadow-[0_0_0_2px_rgba(168,85,247,0.22),0_0_22px_-2px_rgba(168,85,247,0.45)]',
  legendary: 'shadow-[0_0_0_2px_rgba(245,158,11,0.32),0_0_28px_-2px_rgba(245,158,11,0.55)]',
};

const RARITY_TONE_TO_BADGE = {
  common:    'neutral',
  uncommon:  'green',
  rare:      'blue',
  epic:      'red',
  legendary: 'amber',
};

/**
 * AchievementCardV2 — card visual de uma conquista V2.
 *
 * Suporta os estados:
 *  - **unlocked** (visual cheio, glow, badge de raridade, botão de share opcional)
 *  - **locked** (visual desbotado, ícone Lock, mostra progresso 0-1)
 *  - **hidden** (só mostra quando desbloqueada, senão "Conquista oculta")
 *
 * Presentational puro — não faz I/O. Quem chama decide se renderiza
 * o botão de share e como.
 *
 * @param {{
 *   achievement: { id, name, description, family, rarity, icon, lore, xpBonus, shareable, progress, hidden },
 *   onShare?: (achievement) => void,
 *   compact?: boolean,
 *   className?: string,
 * }} props
 */
export default function AchievementCardV2({ achievement, onShare, compact = false, className }) {
  if (!achievement) return null;

  const {
    name,
    description,
    family,
    rarity,
    icon,
    lore,
    xpBonus,
    shareable,
    progress = 0,
    unlocked = false,
    hidden = false,
  } = achievement;

  const isHidden = hidden && !unlocked;
  const familyMeta = FAMILY_ACCENT[family] || FAMILY_ACCENT.career;
  const rarityMeta = ACHIEVEMENT_RARITY_META[rarity] || ACHIEVEMENT_RARITY_META.common;
  const glow = unlocked ? RARITY_GLOW[rarity] : '';
  const tone = RARITY_TONE_TO_BADGE[rarity] || 'neutral';

  return (
    <div
      data-testid="achievement-card"
      data-achievement-id={achievement.id}
      data-rarity={rarity}
      data-family={family}
      data-unlocked={String(unlocked)}
      className={cn(
        'group relative flex h-full flex-col gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm transition-all',
        unlocked ? 'hover:shadow-organic' : 'opacity-80',
        unlocked && `ring-1 ${familyMeta.ring}`,
        glow,
        className,
      )}
    >
      {/* Header: ícone + badges */}
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
            unlocked ? familyMeta.iconBg : 'bg-gray-100 text-gray-400',
          )}
        >
          {unlocked ? (
            <span aria-hidden="true">{icon || rarityMeta.emoji || '🏅'}</span>
          ) : (
            <Lock className="h-5 w-5" />
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <V2Badge tone={tone}>{rarityMeta.name}</V2Badge>
          {family && ACHIEVEMENT_FAMILY_META[family] && (
            <V2Badge tone="neutral">{ACHIEVEMENT_FAMILY_META[family].name}</V2Badge>
          )}
        </div>
      </div>

      {/* Título + descrição */}
      <div className="min-w-0">
        <h3
          className={cn(
            'truncate font-display text-base font-bold',
            unlocked ? 'text-ink' : 'text-gray-500',
          )}
        >
          {isHidden ? 'Conquista oculta' : name}
        </h3>
        <p
          className={cn(
            'mt-1 text-sm leading-5',
            unlocked ? 'text-gray-600' : 'text-gray-400',
          )}
        >
          {isHidden ? 'Continue jogando para revelar.' : description}
        </p>
        {unlocked && lore && !compact && (
          <p className="mt-2 italic text-xs text-gray-500">&ldquo;{lore}&rdquo;</p>
        )}
      </div>

      {/* Progresso (se locked) */}
      {!unlocked && !isHidden && Number.isFinite(progress) && progress > 0 && (
        <div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="mt-1 text-right text-[11px] tabular-nums text-gray-400">
            {Math.round(progress * 100)}%
          </div>
        </div>
      )}

      {/* Footer: xp bônus + share */}
      {(unlocked && (xpBonus > 0 || (shareable && onShare))) && (
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-3">
          {xpBonus > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
              <Sparkles className="h-3.5 w-3.5" /> +{xpBonus} XP
            </span>
          ) : (
            <span />
          )}
          {shareable && onShare && (
            <button
              type="button"
              onClick={() => onShare(achievement)}
              className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-ink"
              aria-label={`Compartilhar ${name}`}
            >
              <Share2 className="h-3 w-3" /> Compartilhar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
