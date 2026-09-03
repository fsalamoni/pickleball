import React, { useMemo } from 'react';
import { Flame, Shield, ShieldCheck, Snowflake, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/core/lib/utils';
import { computeXpV2, XP_WEIGHTS_V2, levelFromXpV2 } from '../domain/progressionV2.js';
import { tierProgress } from '../domain/tiers.js';
import { buildSkillTrees } from '../domain/skillTrees.js';
import { computeProtectedStreak } from '../domain/streakProtection.js';
import TierBadge from './TierBadge.jsx';
import SkillTreeBars from './SkillTreeBars.jsx';

/**
 * ProgressionCardV2 — card completo de progressão V2.
 *
 * Mostra:
 *  - Tier com nome + ícone (Calouro → Imortal)
 *  - Nível e XP (mesma curva V1, total)
 *  - Streak de semanas (com 🛡️ se usou grace day)
 *  - 5 Skill Trees (barras paralelas)
 *  - Próximo tier com progresso
 *
 * Recebe:
 *  - `summary` (de `buildPlayerStats`) para compat com V1
 *  - `xpBySource` (opcional) — se passado, computa XP V2 multi-fonte
 *  - `matchDates` (ms[]) — para calcular streak com proteção
 *  - `streakMeta` (opcional) — meta persistido (grace, freeze)
 *  - `compact` (boolean) — esconde skill trees pra caber em sidebar
 *
 * **Regra**: 100% presentational. Não lê Firestore, não chama hooks.
 * Quem chama passa os dados prontos.
 */
export default function ProgressionCardV2({
  summary = null,
  xpBySource = null,
  matchDates = [],
  streakMeta = null,
  compact = false,
  className,
}) {
  // XP total: prefere V2 multi-fonte se xpBySource foi passado; senão usa V1.
  const xpTotal = useMemo(() => {
    if (xpBySource) return computeXpV2(xpBySource).xpTotal;
    if (summary) {
      return (
        (Number(summary.played) || 0) * (XP_WEIGHTS_V2.game_played ?? 10)
        + (Number(summary.wins) || 0) * (XP_WEIGHTS_V2.game_won ?? 20)
        + (Number(summary.podiums) || 0) * (XP_WEIGHTS_V2.tournament_podium ?? 40)
        + (Number(summary.titles) || 0) * (XP_WEIGHTS_V2.tournament_title ?? 120)
        + (Number(summary.tournaments) || 0) * (XP_WEIGHTS_V2.tournament_attended ?? 30)
      );
    }
    return 0;
  }, [xpBySource, summary]);

  const level = useMemo(() => levelFromXpV2(xpTotal), [xpTotal]);

  // Skill trees (se xpBySource foi passado, computa; senão zera)
  const trees = useMemo(() => {
    if (xpBySource) return buildSkillTrees(xpBySource, XP_WEIGHTS_V2).trees;
    return null;
  }, [xpBySource]);

  // Streak com proteção
  const streakInfo = useMemo(
    () => computeProtectedStreak(matchDates, { meta: streakMeta, now: new Date() }),
    [matchDates, streakMeta],
  );

  // Tier atual + próximo (tierProgress já devolve o tier corrente em `.current`)
  const tierProg = useMemo(() => tierProgress(xpTotal), [xpTotal]);

  return (
    <Card data-testid="progression-card-v2" className={className}>
      <CardContent className="p-4 space-y-4">
        {/* Header: tier + nível + XP total */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <TierBadge xp={xpTotal} size="sm" />
                <span className="text-sm font-bold text-ink">Nível {level.level}</span>
              </div>
              <div className="text-xs text-gray-500 tabular-nums">{xpTotal.toLocaleString('pt-BR')} XP</div>
            </div>
          </div>
          <StreakIndicator info={streakInfo} />
        </div>

        {/* Barra de progresso (XP no nível) */}
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${Math.round(level.progress * 100)}%` }}
            />
          </div>
          <div className="mt-1 text-right text-[11px] text-gray-400 tabular-nums">
            {level.xpIntoLevel}/{level.xpForNext.toLocaleString('pt-BR')} XP para o nível {level.level + 1}
          </div>
        </div>

        {/* Próximo tier */}
        {tierProg.next && (
          <div className="rounded-2xl bg-paper p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Próximo tier: <strong className="text-ink">{tierProg.next.name}</strong> {tierProg.next.icon}</span>
              <span className="font-bold tabular-nums text-ink">{Math.round(tierProg.progress * 100)}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                style={{ width: `${Math.round(tierProg.progress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Skill trees (se tiver xpBySource) */}
        {trees && !compact && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Trilhas paralelas</p>
            <SkillTreeBars trees={trees} compact />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StreakIndicator({ info }) {
  if (!info) return null;
  const weeks = info.weeks || 0;
  const frozen = info.frozen;
  const usedGrace = info.usedGrace;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5 text-sm text-gray-600">
        {frozen ? (
          <Snowflake className={cn('h-5 w-5', 'text-blue-500')} />
        ) : (
          <Flame className={cn('h-5 w-5', weeks > 0 ? 'text-orange-500' : 'text-gray-300')} />
        )}
        <span className="tabular-nums font-semibold">{weeks} sem.</span>
      </div>
      {usedGrace && (
        <span title="Você usou o dia de folga deste mês" className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600">
          <Shield className="h-3 w-3" /> grace
        </span>
      )}
      {frozen && (
        <span title="Modo férias ativo" className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600">
          <ShieldCheck className="h-3 w-3" /> férias
        </span>
      )}
    </div>
  );
}
