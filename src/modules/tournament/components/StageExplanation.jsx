import React from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, ListChecks } from 'lucide-react';
import { explainStage } from '@/modules/tournament/domain/formatExplain';

const STATUS_STYLES = {
  ok: {
    container: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    Icon: CheckCircle2,
    iconClass: 'text-emerald-600',
  },
  info: {
    container: 'border-sky-200 bg-sky-50 text-sky-950',
    Icon: Info,
    iconClass: 'text-sky-600',
  },
  warn: {
    container: 'border-amber-300 bg-amber-50 text-amber-900',
    Icon: AlertTriangle,
    iconClass: 'text-amber-600',
  },
  error: {
    container: 'border-rose-200 bg-rose-50 text-rose-900',
    Icon: XCircle,
    iconClass: 'text-rose-600',
  },
};

/**
 * Mostra a explicação exata de um sistema de competição para um dado número de
 * jogadores: total de jogos, rodadas, byes, jogos por jogador e limitações
 * matemáticas. Usa o domínio puro `explainStage`.
 *
 * @param {{
 *   stageType: string,
 *   playerCount: number,
 *   groupCount?: number,
 *   seedCount?: number,
 *   showStats?: boolean,
 * }} props
 */
export default function StageExplanation({
  stageType,
  playerCount,
  groupCount = 1,
  seedCount = 0,
  showStats = true,
}) {
  if (!stageType) return null;
  const explanation = explainStage({ stageType, playerCount, groupCount, seedCount });
  const style = STATUS_STYLES[explanation.status] || STATUS_STYLES.info;
  const { Icon } = style;

  return (
    <div className={`rounded-md border p-3 text-xs ${style.container}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconClass}`} />
        <div className="space-y-2">
          {showStats && explanation.stats && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-semibold">
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-3 w-3" />
                {explanation.stats.totalMatches} jogos no total
              </span>
              {explanation.stats.rounds > 0 && (
                <span>{explanation.stats.rounds} rodadas</span>
              )}
            </div>
          )}
          {explanation.lines.length > 0 && (
            <ul className="list-disc space-y-1 pl-4">
              {explanation.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          {explanation.recommendation && (
            <p className="italic opacity-90">{explanation.recommendation}</p>
          )}
        </div>
      </div>
    </div>
  );
}
