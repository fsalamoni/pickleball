import { Crown, Medal, User } from 'lucide-react';
import { usePoolScoreBreakdown, RANKING_SCORE_COLUMNS } from '@/modules/pool/hooks/usePoolScoreBreakdown';
import { usePoolLeaderboard } from '@/modules/pool/hooks/usePools';
import { useAllTournamentMatches, useTournamentStaticData, useAllPoolMatches } from '@/modules/tournament/hooks/useTournament';
import { getPoolStages, POOL_TEMPLATE_CODES } from '@/modules/pool/domain/poolSettings';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { compareForGeneralRanking } from '@/core/domain/scoringEngine';
import { cn } from '@/core/lib/utils';
import { isConfirmedForRanking } from '@/modules/pool/domain/paymentStatus';

export function PoolLeaderboard({ poolId, pool }) {
  const { user } = useAuth();
  const { memberships, isLoading } = usePoolLeaderboard(poolId);
  const isCustom = pool?.template_code === POOL_TEMPLATE_CODES.custom && !pool?.tournament_id;
  const { tournament, stages: tournamentStages } = useTournamentStaticData(isCustom ? false : pool?.tournament_id);
  const { matches } = useAllTournamentMatches(tournament?.id);
  const { matches: customMatches } = useAllPoolMatches(isCustom ? poolId : null);
  const activeMatches = isCustom ? customMatches : matches;
  const activeStages = isCustom ? getPoolStages(pool) : tournamentStages;
  const { breakdownByUser, stageDefinitions } = usePoolScoreBreakdown(poolId, { matches: activeMatches, stages: activeStages });
  const visibleStages = stageDefinitions;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </CardContent>
      </Card>
    );
  }

  const sorted = memberships.filter(isConfirmedForRanking).sort(compareForGeneralRanking);
  const myIndex = sorted.findIndex((m) => m.user_id === user?.uid);
  const myEntry = myIndex >= 0 ? sorted[myIndex] : null;

  const getMedal = (pos) => {
    if (pos === 0) return { icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-100', label: '1º Lugar' };
    if (pos === 1) return { icon: Medal, color: 'text-slate-400', bg: 'bg-slate-100', label: '2º Lugar' };
    if (pos === 2) return { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-50', label: '3º Lugar' };
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Destaque da posição do usuário */}
      {myEntry && (
        <Card className={cn(
          'border-2',
          myIndex === 0 ? 'border-amber-400 bg-gradient-to-r from-amber-100 to-white' :
          myIndex === 1 ? 'border-slate-300 bg-gradient-to-r from-slate-100 to-white' :
          myIndex === 2 ? 'border-amber-500 bg-gradient-to-r from-orange-100 to-white' :
          'border-emerald-400 bg-gradient-to-r from-emerald-100 to-white',
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
                myIndex === 0 ? 'bg-yellow-400 text-white' :
                myIndex === 1 ? 'bg-slate-400 text-white' :
                myIndex === 2 ? 'bg-amber-500 text-white' :
                'bg-emerald-500 text-white',
              )}>
                {myIndex + 1}º
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" />
                  <p className="font-semibold text-slate-900">Sua posição</p>
                  {myIndex < 3 && (
                    <Badge variant={myIndex === 0 ? 'warning' : 'outline'} className="text-xs">
                      {myIndex === 0 ? 'Líder' : myIndex === 1 ? 'Vice' : 'Bronze'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                  <span><strong>{myEntry.points || 0}</strong> pontos</span>
                  <span><strong>{myEntry.buchas || 0}</strong> buchas</span>
                  <span><strong>{myEntry.super_buchas || 0}</strong> super buchas</span>
                </div>
              </div>
              {myIndex > 0 && (
                <div className="text-right text-sm text-slate-500">
                  <p>{sorted[myIndex - 1].points - (myEntry.points || 0)} pts atrás</p>
                  <p className="text-xs">do {myIndex}º lugar</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de classificação */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4">
          <CardTitle>Classificação geral</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="arena-table-wrap rounded-none border-0 shadow-none">
            <table className="min-w-[1180px] w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-900/40 bg-emerald-950 text-left text-emerald-50">
                  <th className="py-3 px-3 w-12 text-center" rowSpan={2}>#</th>
                  <th className="py-3 px-3 min-w-[220px]" rowSpan={2}>Participante</th>
                  <th className="py-3 px-3 text-right" rowSpan={2}>Pontos</th>
                  {visibleStages.map((stage) => (
                    <th key={stage.code} className="border-l border-emerald-800/70 py-2 px-3 text-center" colSpan={RANKING_SCORE_COLUMNS.length}>
                      {stage.label}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right" rowSpan={2}>Buchas</th>
                  <th className="py-3 px-3 text-right" rowSpan={2}>Super</th>
                </tr>
                <tr className="border-b border-emerald-900/40 bg-teal-950 text-xs text-emerald-50/80">
                  {visibleStages.map((stage) => (
                    RANKING_SCORE_COLUMNS.map((column) => (
                      <th key={`${stage.code}_${column.key}`} className="border-l border-emerald-800/70 py-2 px-2 text-right font-medium">
                        {column.label}
                      </th>
                    ))
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((m, i) => {
                  const isMe = m.user_id === user?.uid;
                  const medal = getMedal(i);
                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        'border-b border-emerald-950/10 last:border-b-0 transition-colors hover:bg-emerald-50/70',
                        isMe && 'bg-emerald-100/65',
                        i < 3 && !isMe && 'bg-white/70',
                      )}
                    >
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {medal ? (
                            <medal.icon className={cn('w-4 h-4', medal.color)} />
                          ) : (
                            <span className="font-mono text-slate-500">{i + 1}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('font-medium', isMe && 'text-emerald-700')}>
                            {m.user_name_snapshot}
                          </span>
                          {isMe && (
                            <Badge variant="success" className="text-[10px] px-1.5 py-0">Você</Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{m.user_email_snapshot}</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={cn('font-bold text-base', isMe ? 'text-emerald-700' : 'text-slate-900')}>
                          {m.points || 0}
                        </span>
                      </td>
                      {visibleStages.map((stage) => (
                        <StageScoreCells key={`${m.id}_${stage.code}`} stats={breakdownByUser[m.user_id]?.[stage.code]} />
                      ))}
                      <td className="py-3 px-3 text-right text-slate-700">
                        {m.buchas || 0}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700">
                        {m.super_buchas || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StageScoreCells({ stats }) {
  return RANKING_SCORE_COLUMNS.map((column) => {
    const value = getStageValue(stats, column.key);
    const isSubtotal = column.key === 'points';
    return (
      <td
        key={column.key}
        className={cn(
          'border-l py-3 px-2 text-right tabular-nums text-slate-700',
          isSubtotal && 'font-semibold text-slate-900 bg-emerald-50/70',
        )}
      >
        {value || '-'}
      </td>
    );
  });
}

function getStageValue(stats, key) {
  if (!stats) return 0;
  if (key in stats.counts) return stats.counts[key] || 0;
  return stats[key] || 0;
}




 
