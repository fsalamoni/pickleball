import React, { useMemo } from 'react';
import { cn } from '@/core/lib/utils';
import {
  buildSkillTrees,
  listSkillTrees,
  SKILL_TREE_META,
} from '../domain/skillTrees.js';
import { XP_WEIGHTS_V2 } from '../domain/progressionV2.js';

/**
 * Mapa de cor Tailwind por token de cor da skill tree.
 */
const TREE_COLORS = {
  amber:  { bar: 'bg-amber-400',  track: 'bg-amber-100',  text: 'text-amber-700' },
  blue:   { bar: 'bg-blue-400',   track: 'bg-blue-100',   text: 'text-blue-700' },
  teal:   { bar: 'bg-teal-400',   track: 'bg-teal-100',   text: 'text-teal-700' },
  purple: { bar: 'bg-purple-400', track: 'bg-purple-100', text: 'text-purple-700' },
  green:  { bar: 'bg-green-400',  track: 'bg-green-100',  text: 'text-green-700' },
};

/**
 * SkillTreeBars — visualização das 5 trilhas paralelas de XP.
 *
 * @param {{
 *   xpBySource?: object,   // mapa fonte → count (opcional)
 *   trees?: object,        // alternativa: trees já calculadas
 *   compact?: boolean,     // se true, esconde o XP e mostra só barra+nível
 *   className?: string,
 * }} props
 */
export default function SkillTreeBars({
  xpBySource = null,
  trees = null,
  compact = false,
  className,
}) {
  const computed = useMemo(() => {
    if (trees) return trees;
    if (xpBySource) return buildSkillTrees(xpBySource, XP_WEIGHTS_V2).trees;
    return {
      tournament: { xp: 0, level: 1 },
      social: { xp: 0, level: 1 },
      arena: { xp: 0, level: 1 },
      coach: { xp: 0, level: 1 },
      club: { xp: 0, level: 1 },
    };
  }, [xpBySource, trees]);

  const items = useMemo(() => listSkillTrees(computed), [computed]);

  return (
    <div
      data-testid="skill-tree-bars"
      className={cn('space-y-3', className)}
    >
      {items.map((item) => {
        const colors = TREE_COLORS[item.color] || TREE_COLORS.blue;
        // progress baseado no XP do próximo nível (mesma curva 500*L)
        const needNext = 500 * item.level;
        const ratio = Math.min(1, item.xp / Math.max(1, needNext));
        return (
          <div
            key={item.key}
            data-tree={item.key}
            data-tree-level={item.level}
            data-tree-xp={item.xp}
            className="space-y-1"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span aria-hidden="true">{item.icon}</span>
                <span className="font-semibold text-ink">{item.name}</span>
              </div>
              <div className={cn('tabular-nums font-bold', colors.text)}>
                Nv {item.level}
                {!compact && (
                  <span className="ml-1.5 text-gray-500">{item.xp} XP</span>
                )}
              </div>
            </div>
            <div className={cn('h-2 w-full overflow-hidden rounded-full', colors.track)}>
              <div
                className={cn('h-full rounded-full transition-all', colors.bar)}
                style={{ width: `${Math.round(ratio * 100)}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
