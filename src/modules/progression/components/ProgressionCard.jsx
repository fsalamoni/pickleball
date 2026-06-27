import React, { useMemo } from 'react';
import { Zap, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { computeXp, levelFromXp, computeWeekStreak } from '../domain/progression.js';

/**
 * XP/nível de perfil + streak de semanas ativas. Presentational — o gating pela
 * flag `player_progression` é feito pelo componente pai.
 *
 * @param {{ summary: object, matchDates?: number[] }} props
 */
export default function ProgressionCard({ summary, matchDates = [] }) {
  const level = useMemo(() => levelFromXp(computeXp(summary)), [summary]);
  const streak = useMemo(() => computeWeekStreak(matchDates), [matchDates]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">Nível {level.level}</div>
              <div className="text-xs text-slate-500 tabular-nums">{level.xp} XP</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Flame className={`h-5 w-5 ${streak > 0 ? 'text-orange-500' : 'text-slate-300'}`} />
            <span className="tabular-nums">{streak} semana(s) seguidas</span>
          </div>
        </div>
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round(level.progress * 100)}%` }} />
          </div>
          <div className="mt-1 text-right text-[11px] text-slate-400 tabular-nums">
            {level.xpIntoLevel}/{level.xpForNext} XP para o nível {level.level + 1}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
