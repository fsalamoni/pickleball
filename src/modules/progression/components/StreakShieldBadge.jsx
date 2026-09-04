import React from 'react';
import { Shield, Snowflake, Umbrella, Sparkles, Lock } from 'lucide-react';
import { V2Badge, V2Surface } from '@/v2/ui/primitives';

/**
 * StreakShieldBadge — visual do estado de proteção da sequência.
 * Mostra dias de folga, congelamentos, modo férias e bônus de retorno.
 *
 * 4 estados:
 *  - dias de folga (verde-água)
 *  - congelamentos (azul)
 *  - modo férias (amarelo)
 *  - bônus de retorno (roxo)
 */
export default function StreakShieldBadge({ meta, onToggleVacation, onUseFreeze, className }) {
  if (!meta) {
    return (
      <V2Surface className={className}>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Shield className="h-4 w-4" aria-hidden="true" />
          <span>Carregando proteção da sequência…</span>
        </div>
      </V2Surface>
    );
  }
  const grace = meta.graceDaysRemaining || 0;
  const freezes = meta.freezesAvailable || 0;
  const onVacation = meta.vacationMode;
  const comeback = meta.comebackBonus || 0;

  return (
    <V2Surface className={className}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
          <Shield className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Proteção da sequência</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {grace > 0 && (
              <V2Badge tone="cyan" data-testid="streak-grace">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {grace} {grace === 1 ? 'dia de folga' : 'dias de folga'}
              </V2Badge>
            )}
            {freezes > 0 && (
              <V2Badge tone="blue" data-testid="streak-freeze">
                <Snowflake className="h-3 w-3" aria-hidden="true" />
                {freezes} {freezes === 1 ? 'congelamento' : 'congelamentos'}
              </V2Badge>
            )}
            {onVacation && (
              <V2Badge tone="amber" data-testid="streak-vacation">
                <Umbrella className="h-3 w-3" aria-hidden="true" /> Férias ativas
              </V2Badge>
            )}
            {comeback > 0 && (
              <V2Badge tone="purple" data-testid="streak-comeback">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                +{comeback} XP de retorno
              </V2Badge>
            )}
            {grace === 0 && freezes === 0 && !onVacation && comeback === 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Lock className="h-3 w-3" aria-hidden="true" /> Sem proteções ativas
              </span>
            )}
          </div>
        </div>
      </div>

      {(onUseFreeze || onToggleVacation) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {onUseFreeze && freezes > 0 && (
            <button
              type="button"
              data-testid="use-freeze-btn"
              onClick={onUseFreeze}
              className="inline-flex items-center gap-1 rounded-2xl bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-200"
            >
              <Snowflake className="h-3.5 w-3.5" aria-hidden="true" /> Usar 1 congelamento
            </button>
          )}
          {onToggleVacation && (
            <button
              type="button"
              data-testid="toggle-vacation-btn"
              onClick={onToggleVacation}
              className={`inline-flex items-center gap-1 rounded-2xl px-3 py-1.5 text-xs font-bold ${
                onVacation
                  ? 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Umbrella className="h-3.5 w-3.5" aria-hidden="true" />
              {onVacation ? 'Sair de férias' : 'Entrar de férias'}
            </button>
          )}
        </div>
      )}
    </V2Surface>
  );
}
