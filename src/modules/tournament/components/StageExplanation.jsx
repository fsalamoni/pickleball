import React from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, ListChecks, Lightbulb } from 'lucide-react';
import { explainStage } from '@/modules/tournament/domain/formatExplain';
import { suggestGroupPlans } from '@/modules/tournament/domain/groupPlan';
import { TOURNAMENT_STAGE_TYPE } from '@/modules/tournament/domain/constants';

const STATUS_STYLES = {
  ok: {
    container: 'border-green-200 bg-green-50 text-green-800',
    Icon: CheckCircle2,
    iconClass: 'text-green-600',
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
 * Numa fase de GRUPOS mostra também as outras divisões possíveis para aquele
 * número de inscritos — porque a pergunta de quem organiza nunca é "está certo
 * o que eu escolhi?", e sim "em quantos grupos eu divido isto?". Ver
 * `groupPlan.js`.
 *
 * @param {{
 *   stageType: string,
 *   playerCount: number,
 *   groupCount?: number,
 *   seedCount?: number,
 *   qualifiersPerGroup?: number,
 *   legs?: number,
 *   showStats?: boolean,
 *   showAlternatives?: boolean,
 * }} props
 */
export default function StageExplanation({
  stageType,
  playerCount,
  groupCount = 1,
  seedCount = 0,
  qualifiersPerGroup = 2,
  legs = 1,
  showStats = true,
  showAlternatives = true,
}) {
  if (!stageType) return null;
  const explanation = explainStage({
    stageType, playerCount, groupCount, seedCount, qualifiersPerGroup, legs,
  });
  const alternativas = (showAlternatives && stageType === TOURNAMENT_STAGE_TYPE.GROUPS)
    ? suggestGroupPlans(playerCount, { qualifiersPerGroup, legs, limit: 3 })
      .filter((p) => p.groupCount !== Number(groupCount))
      .slice(0, 2)
    : [];
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
          {alternativas.length > 0 && (
            <div className="space-y-1 border-t border-current/15 pt-2">
              <p className="inline-flex items-center gap-1 font-semibold">
                <Lightbulb aria-hidden="true" className="h-3 w-3" /> Outras divisões possíveis
              </p>
              <ul className="space-y-0.5">
                {alternativas.map((p) => (
                  <li key={p.groupCount}>
                    <strong>{p.groupCount} {p.groupCount === 1 ? 'grupo' : 'grupos'}</strong>
                    {' '}({p.sizes.join('+')}) · {p.totalMatches} jogos ·{' '}
                    {p.qualifiers} classificados → chave de {p.bracket.size}
                    {p.bracket.byes > 0 ? ` com ${p.bracket.byes} bye(s)` : ' cheia'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
