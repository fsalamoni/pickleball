import React, { useEffect, useState } from 'react';
import { X, Share2, Sparkles } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Badge } from '@/v2/ui/primitives';
import {
  ACHIEVEMENT_RARITY_META,
  ACHIEVEMENT_FAMILY_META,
} from '../domain/achievementsV2.js';

/**
 * Toast celebratório de conquista desbloqueada.
 *
 * Aparece no canto da tela (toast) com:
 *  - animação de entrada (slide + fade)
 *  - ícone da conquista
 *  - nome + descrição
 *  - XP bônus (se houver)
 *  - botão de compartilhar (opcional)
 *  - botão de fechar
 *
 * Auto-dismiss após `autoCloseMs` (default 8000ms). `0` desabilita.
 *
 * **Importante**: este é um componente CONTROLADO. Quem decide quando
 * mostrar e quando sumir é o pai (geralmente um `AchievementUnlockQueue`).
 *
 * @param {{
 *   achievement: object,
 *   onClose?: () => void,
 *   onShare?: (a) => void,
 *   autoCloseMs?: number,
 *   className?: string,
 * }} props
 */
export default function AchievementUnlockToast({
  achievement,
  onClose,
  onShare,
  autoCloseMs = 8000,
  className,
}) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!achievement) return undefined;
    // pequeno delay pra animação de entrada
    const t1 = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t1);
    // Só o id importa: reanimar a cada nova conquista, não a cada re-render
    // que recria o objeto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement?.id]);

  useEffect(() => {
    if (!achievement || autoCloseMs <= 0) return undefined;
    const t = setTimeout(() => {
      handleClose();
    }, autoCloseMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement?.id, autoCloseMs]);

  if (!achievement) return null;

  const { name, description, family, rarity, icon, xpBonus, shareable } = achievement;
  const familyMeta = FAMILY_ACCENT[family] || FAMILY_ACCENT.career;
  const rarityMeta = ACHIEVEMENT_RARITY_META[rarity] || ACHIEVEMENT_RARITY_META.common;
  const isLegendary = rarity === 'legendary';

  function handleClose() {
    setExiting(true);
    setTimeout(() => onClose?.(), 220);
  }

  return (
    <div
      data-testid="achievement-unlock-toast"
      data-rarity={rarity}
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))]',
        'transform-gpu transition-all duration-200 ease-out',
        visible && !exiting ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className,
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-gray-100 bg-paper-pure p-4 shadow-organic',
          isLegendary && 'ring-2 ring-amber-300/50',
        )}
      >
        {/* Brilho no fundo pra lendária */}
        {isLegendary && (
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
        )}

        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
              familyMeta.iconBg,
            )}
          >
            <span aria-hidden="true">{icon || '🏅'}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Conquista desbloqueada
              </p>
            </div>
            <h4 className="mt-0.5 truncate font-display text-base font-bold text-ink">{name}</h4>
            <p className="mt-0.5 text-xs text-gray-600">{description}</p>

            <div className="mt-2 flex items-center gap-1.5">
              <V2Badge tone={RARITY_TONE_TO_BADGE[rarity] || 'neutral'}>{rarityMeta.name}</V2Badge>
              {family && ACHIEVEMENT_FAMILY_META[family] && (
                <V2Badge tone="neutral">{ACHIEVEMENT_FAMILY_META[family].name}</V2Badge>
              )}
              {xpBonus > 0 && (
                <V2Badge tone="amber">+{xpBonus} XP</V2Badge>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-ink"
            aria-label="Fechar notificação de conquista"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {shareable && onShare && (
          <div className="mt-3 flex justify-end border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => onShare(achievement)}
              className="inline-flex items-center gap-1.5 rounded-full bg-acid px-3 py-1.5 text-xs font-bold text-ink transition-transform hover:scale-105"
            >
              <Share2 className="h-3.5 w-3.5" /> Compartilhar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const FAMILY_ACCENT = {
  career:    { iconBg: 'bg-amber-100 text-amber-700' },
  social:    { iconBg: 'bg-blue-100 text-blue-700' },
  discovery: { iconBg: 'bg-green-100 text-green-700' },
  seasonal:  { iconBg: 'bg-pink-100 text-pink-700' },
  community: { iconBg: 'bg-purple-100 text-purple-700' },
};

const RARITY_TONE_TO_BADGE = {
  common:    'neutral',
  uncommon:  'green',
  rare:      'blue',
  epic:      'red',
  legendary: 'amber',
};
