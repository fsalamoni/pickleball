import React, { useMemo } from 'react';
import { Check, Circle, Sparkles, Target } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Badge } from '@/v2/ui/primitives';
import {
  MISSION_BONUS_XP,
} from '../domain/missions.js';

/**
 * MissionList — lista de missões (diárias / semanais / mensais).
 *
 * Presentational puro e SOMENTE LEITURA do progresso.
 *
 * Não existe botão de "marcar progresso": missão avança pela atividade real
 * do atleta (`missionMetrics`). O botão que existia aqui deixava qualquer um
 * concluir "Jogue 3 partidas" sem entrar em quadra.
 *
 * @param {{
 *   missions: Array<object>,
 *   scope: 'daily'|'weekly'|'monthly',
 *   onClaimBonus?: (scope) => void,
 *   bonusClaimed?: boolean,
 *   className?: string,
 * }} props
 */
export default function MissionList({
  missions = [],
  scope = 'daily',
  onClaimBonus,
  bonusClaimed = false,
  className,
}) {
  const allDone = useMemo(
    () => missions.length > 0 && missions.every((m) => m.done),
    [missions],
  );

  const bonus = MISSION_BONUS_XP[scope] || 0;

  const scopeLabel = {
    daily: 'Missões de hoje',
    weekly: 'Missões da semana',
    monthly: 'Missões do mês',
  }[scope] || 'Missões';

  return (
    <div data-testid="mission-list" data-scope={scope} className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <Target className="h-4 w-4" /> {scopeLabel}
        </h3>
        {allDone && !bonusClaimed && (
          <button
            type="button"
            onClick={() => onClaimBonus?.(scope)}
            data-testid="mission-bonus-claim"
            className="inline-flex items-center gap-1.5 rounded-full bg-acid px-3 py-1 text-xs font-bold text-ink transition-transform hover:scale-105"
          >
            <Sparkles className="h-3.5 w-3.5" /> Resgatar +{bonus} XP
          </button>
        )}
        {allDone && bonusClaimed && (
          <V2Badge tone="green">Bônus resgatado</V2Badge>
        )}
      </div>

      {missions.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma missão disponível agora.</p>
      ) : (
        <ul className="space-y-2">
          {missions.map((m) => (
            <li
              key={m.id}
              data-testid="mission-item"
              data-mission-id={m.id}
              data-done={String(m.done)}
              className={cn(
                'flex items-center gap-3 rounded-2xl border p-3 transition-colors',
                m.done
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-100 bg-paper-pure',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  m.done ? 'bg-green-500 text-white' : 'border-2 border-gray-300 text-transparent',
                )}
              >
                {m.done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-semibold', m.done ? 'text-gray-500 line-through' : 'text-ink')}>
                  {m.description}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div
                    role="progressbar"
                    aria-valuenow={m.current}
                    aria-valuemin={0}
                    aria-valuemax={m.target}
                    aria-label={`${m.description}: ${m.current} de ${m.target}`}
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200"
                  >
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${Math.min(100, Math.round((m.current / Math.max(1, m.target)) * 100))}%` }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-gray-500">
                    {m.current}/{m.target}
                  </span>
                </div>
              </div>
              <V2Badge tone={m.done ? 'green' : 'amber'}>+{m.xpReward} XP</V2Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
