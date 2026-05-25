import { useMemo } from 'react';
import { Calculator, Medal, Sparkles, Trophy } from 'lucide-react';
import { useTournamentStaticData, useAllTournamentMatches, usePoolCompetitors, useAllPoolMatches } from '@/modules/tournament/hooks/useTournament';
import { useMyBets } from '@/modules/bets/hooks/useBets';
import { computeMatchPoints, defaultBet, HIT_TYPES } from '@/core/domain/scoringEngine';
import { getPoolScoringTiers, getPoolStages, POOL_TEMPLATE_CODES } from '@/modules/pool/domain/poolSettings';
import { hasPenaltyScore } from '@/modules/pool/domain/penaltyShootout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TournamentNotInitialized } from './TournamentNotInitialized';

const STAGE_LABELS = {
  group: 'Grupos',
  r16: '16-avos',
  qf: 'Oitavas',
  sf: 'Quartas',
  semi: 'Semis',
  third: '3º Lugar',
  final: 'Final',
};

const HIT_LABELS = {
  [HIT_TYPES.EXACT_SCORE]: 'Bucha',
  [HIT_TYPES.WINNER_PLUS_DIFF]: 'Vencedor + diferença',
  [HIT_TYPES.WINNER_PLUS_TEAM_GOALS]: 'Vencedor + nº gols',
  [HIT_TYPES.WINNER_ONLY]: 'Apenas vencedor',
  [HIT_TYPES.TEAM_GOALS_ONLY]: 'Apenas nº gols',
  [HIT_TYPES.NONE]: 'Sem acerto',
};

export function PoolScoringTab({ poolId, pool }) {
  if (pool?.template_code === POOL_TEMPLATE_CODES.custom && !pool?.tournament_id) return <CustomPoolScoringTab poolId={poolId} pool={pool} />;
  return <TournamentPoolScoringTab poolId={poolId} pool={pool} />;
}

function TournamentPoolScoringTab({ poolId, pool }) {
  const { tournament, teams, isLoading: staticLoading } = useTournamentStaticData(pool?.tournament_id);
  const { matches, isLoading: matchesLoading } = useAllTournamentMatches(tournament?.id);
  const { betsByMatch, isLoading: betsLoading } = useMyBets(poolId);

  const teamsById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams]);
  const tiersByStage = useMemo(() => {
    const arr = getPoolScoringTiers(pool);
    return Object.fromEntries(arr.map((t) => [t.stage_code, t]));
  }, [pool]);

  const finishedMatches = useMemo(
    () => matches.filter((m) => m.status === 'finished' && typeof m.official_home_score === 'number' && typeof m.official_away_score === 'number'),
    [matches],
  );

  const rows = useMemo(() => {
    return finishedMatches.map((m) => {
      const bet = betsByMatch[m.id];
      const tier = tiersByStage[m.stage_code];
      const scoredMatch = pool?.settings?.zebras_enabled === false ? { ...m, zebra_team_id: null, zebra_multiplier: null } : m;
      let result = null;
      if (tier) {
        try {
          result = computeMatchPoints(bet || defaultBet(), scoredMatch, tier);
        } catch {
          result = null;
        }
      }
      return { match: m, bet, result };
    });
  }, [finishedMatches, betsByMatch, tiersByStage, pool?.settings?.zebras_enabled]);

  if (staticLoading || matchesLoading || betsLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!tournament) {
    return <TournamentNotInitialized />;
  }

  return <ScoringContent rows={rows} teamsById={teamsById} />;
}

function CustomPoolScoringTab({ poolId, pool }) {
  const { competitors, isLoading: competitorsLoading } = usePoolCompetitors(poolId);
  const { matches, isLoading: matchesLoading } = useAllPoolMatches(poolId);
  const { betsByMatch, isLoading: betsLoading } = useMyBets(poolId);
  const teamsById = useMemo(() => Object.fromEntries(competitors.map((c) => [c.id, c])), [competitors]);
  const stageLabels = useMemo(
    () => Object.fromEntries(getPoolStages(pool).map((stage) => [stage.code, stage.label])),
    [pool],
  );
  const tiersByStage = useMemo(() => Object.fromEntries(getPoolScoringTiers(pool).map((t) => [t.stage_code, t])), [pool]);
  const rows = useMemo(() => {
    return matches
      .filter((m) => m.status === 'finished' && typeof m.official_home_score === 'number' && typeof m.official_away_score === 'number')
      .map((m) => {
        const bet = betsByMatch[m.id];
        const tier = tiersByStage[m.stage_code];
        const scoredMatch = pool?.settings?.zebras_enabled === false ? { ...m, zebra_team_id: null, zebra_multiplier: null } : m;
        let result = null;
        if (tier) {
          try {
            result = computeMatchPoints(bet || defaultBet(), scoredMatch, tier);
          } catch {
            result = null;
          }
        }
        return { match: m, bet, result };
      });
  }, [matches, betsByMatch, tiersByStage, pool?.settings?.zebras_enabled]);

  if (competitorsLoading || matchesLoading || betsLoading) return <Skeleton className="h-64" />;
  return <ScoringContent rows={rows} teamsById={teamsById} stageLabels={stageLabels} />;
}

function ScoringContent({ rows, teamsById, stageLabels = STAGE_LABELS }) {
  const totalPoints = rows.reduce((s, r) => s + (r.result?.total_points || 0), 0);
  const buchas = rows.reduce((s, r) => s + (r.result?.bucha_count ?? (r.result?.is_bucha ? 1 : 0)), 0);
  const superBuchas = rows.reduce((s, r) => s + (r.result?.super_bucha_count ?? (r.result?.is_super_bucha ? 1 : 0)), 0);

  if (!rows.length) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-600">
          Nenhum jogo finalizado ainda. A pontuação aparecerá aqui assim que os primeiros resultados forem oficializados.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Trophy} label="Pontos" value={totalPoints} />
        <Stat icon={Medal} label="Buchas" value={buchas} />
        <Stat icon={Sparkles} label="Super Buchas" value={superBuchas} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-emerald-950/10 bg-white/45 p-4 sm:p-5">
          <CardTitle className="flex items-center gap-2 text-base text-slate-950">
            <Calculator className="h-4 w-4 text-emerald-800" /> Sua pontuação por jogo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="arena-table-wrap rounded-none border-0 shadow-none">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-900/40 bg-emerald-950 text-left text-emerald-50">
                  <th className="py-2 px-3">Fase</th>
                  <th className="py-2 px-3">Jogo</th>
                  <th className="py-2 px-3 text-center">Resultado</th>
                  <th className="py-2 px-3 text-center">Seu palpite</th>
                  <th className="py-2 px-3">Acerto</th>
                  <th className="py-2 px-3 text-right">Pontos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-950/10 bg-white/65">
                {rows.map(({ match, bet, result }) => {
                  const home = teamsById[match.home_team_id]?.name || match.home_placeholder || '—';
                  const away = teamsById[match.away_team_id]?.name || match.away_placeholder || '—';
                  return (
                    <tr key={match.id} className="transition-colors hover:bg-emerald-50/70">
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="text-[10px]">
                           {stageLabels[match.stage_code] || STAGE_LABELS[match.stage_code] || match.stage_code}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 truncate">
                        {home} <span className="text-emerald-900/40">x</span> {away}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {match.official_home_score} x {match.official_away_score}
                        {hasPenaltyScore(match.official_home_penalties, match.official_away_penalties) && (
                          <div className="text-[10px] font-normal text-slate-500">
                            Pen. {match.official_home_penalties} x {match.official_away_penalties}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        {bet ? `${bet.predicted_home} x ${bet.predicted_away}` : <span className="text-slate-500">0 x 0</span>}
                        {hasPenaltyScore(bet?.predicted_home_penalties, bet?.predicted_away_penalties) && (
                          <div className="text-[10px] font-normal text-slate-500">
                            Pen. {bet.predicted_home_penalties} x {bet.predicted_away_penalties}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-600">
                        {result ? (
                          <span className="flex items-center gap-1">
                            {HIT_LABELS[result.hit_type]}
                            {result.penalty_hit_type && (
                              <Badge variant="outline" className="text-[10px] bg-white/70">
                                Pen.: {HIT_LABELS[result.penalty_hit_type] || result.penalty_hit_type}
                              </Badge>
                            )}
                            {result.is_super_bucha && <Badge variant="warning" className="text-[10px]">Super</Badge>}
                            {result.zebra_applied && <Badge variant="outline" className="text-[10px] bg-white/70">Zebra x{result.multiplier}</Badge>}
                          </span>
                        ) : (
                          <span className="text-slate-400">Sem cálculo</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-bold">
                        {result?.total_points ?? 0}
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

function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="bg-gradient-to-br from-white/90 to-emerald-50/75">
      <CardContent className="p-4">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-900 text-emerald-50">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xs font-medium text-emerald-800">{label}</div>
        <div className="mt-1 text-2xl font-bold text-slate-950 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
