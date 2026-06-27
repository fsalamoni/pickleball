import React, { useMemo } from 'react';
import { Award, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { computeAchievements } from '../domain/achievements.js';

/**
 * Mostra as conquistas do jogador (desbloqueadas e pendentes) a partir de um
 * resumo (`buildPlayerStats` + rating opcional). Presentational — o gating pela
 * flag `achievements` é feito pelo componente pai.
 *
 * @param {{ summary: object, title?: string }} props
 */
export default function AchievementsCard({ summary, title = 'Conquistas' }) {
  const { unlocked, locked, unlockedCount, total } = useMemo(
    () => computeAchievements(summary),
    [summary],
  );

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Award className="h-4 w-4 text-emerald-600" /> {title}
          </h2>
          <span className="text-xs text-slate-500 tabular-nums">{unlockedCount}/{total}</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {unlocked.map((a) => (
            <div key={a.id} className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
              <Award className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-900">{a.name}</div>
                <div className="text-xs text-slate-600">{a.description}</div>
              </div>
            </div>
          ))}
          {locked.map((a) => (
            <div key={a.id} className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 opacity-70">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-500">{a.name}</div>
                <div className="text-xs text-slate-400">{a.description}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
