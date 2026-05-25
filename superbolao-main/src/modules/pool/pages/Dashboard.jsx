import { Link } from 'react-router-dom';
import { AlertCircle, Hash, Plus, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useDashboardSummaries, HIT_TYPE_LABELS } from '@/modules/pool/hooks/useDashboardSummaries';
import { useMyPools } from '@/modules/pool/hooks/usePools';
import { useAllTournamentMatches, useTournamentStaticData } from '@/modules/tournament/hooks/useTournament';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { userProfile } = useAuth();
  const { pools, isLoading } = useMyPools();
  const { tournament, stages } = useTournamentStaticData();
  const { matches } = useAllTournamentMatches(tournament?.id);
  const summariesByPool = useDashboardSummaries({ pools, matches, stages });

  const missingAlerts = useMemo(
    () => pools
      .map((pool) => ({ pool, missing: summariesByPool[pool.id]?.missing }))
      .filter(({ missing }) => (missing?.total || 0) > 0),
    [pools, summariesByPool],
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="arena-panel-strong rounded-lg p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Painel do jogador</p>
        <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
          Ola, {userProfile?.full_name?.split(' ')[0] || 'jogador'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85">Acompanhe seus boloes, palpites pendentes e classificacao em uma visao rapida de rodada.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <StatCard label="Boloes" value={pools.length} />
        <MissingPredictionsCard alerts={missingAlerts} />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Boloes</CardTitle>
            <CardDescription>Classificacao, pontos e detalhamento dos seus acertos por fase.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/boloes/ingressar"><Hash className="w-4 h-4" /> Ingressar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/boloes/criar"><Plus className="w-4 h-4" /> Criar bolao</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : pools.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Voce ainda nao esta em nenhum bolao"
              description="Crie um novo ou entre com um codigo de convite."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <Link to="/boloes/criar"><Plus className="w-4 h-4" /> Criar bolao</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/boloes/ingressar"><Hash className="w-4 h-4" /> Tenho um codigo</Link>
                  </Button>
                </div>
              }
            />
          ) : (
            <PoolSummaryTable pools={pools} summariesByPool={summariesByPool} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <Card className="bg-gradient-to-br from-white/90 to-emerald-50/75">
      <CardContent className="p-4">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-emerald-900 text-emerald-50">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}

function MissingPredictionsCard({ alerts }) {
  if (!alerts.length) {
    return (
      <Card className="border-emerald-700/20 bg-gradient-to-br from-emerald-100 to-teal-50">
        <CardContent className="flex min-h-[124px] items-center gap-3 p-4 text-emerald-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-900 text-emerald-50">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Palpites em dia</p>
            <p className="text-sm text-emerald-800">Nao ha palpites pendentes nos prazos abertos.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = alerts.reduce((sum, item) => sum + item.missing.total, 0);

  return (
    <Card className="border-amber-300/50 bg-gradient-to-br from-amber-100 to-white">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 text-amber-900">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-2">
            <div>
              <p className="font-semibold">{total} palpite{total === 1 ? '' : 's'} pendente{total === 1 ? '' : 's'}</p>
              <p className="text-sm text-amber-800">Finalize os cartoes antes do encerramento dos prazos.</p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap">
              {alerts.slice(0, 4).map(({ pool, missing }) => (
                <Button key={pool.id} asChild variant="outline" size="sm" className="h-auto max-w-full justify-start whitespace-normal border-amber-300 bg-white py-2 text-left leading-snug hover:bg-amber-100 sm:w-auto">
                  <Link to={`/boloes/${pool.id}/cartao`}>
                    {pool.name}: {missing.total}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PoolSummaryTable({ pools, summariesByPool }) {
  return (
    <div className="arena-table-wrap">
      <table className="min-w-[980px] w-full text-sm">
        <thead className="bg-emerald-950 text-left text-xs uppercase text-emerald-50">
          <tr>
            <th className="px-4 py-3 font-semibold">Bolao</th>
            <th className="px-4 py-3 font-semibold">Classificacao</th>
            <th className="px-4 py-3 font-semibold">Pontos</th>
            <th className="px-4 py-3 font-semibold">Pendencias</th>
            <th className="px-4 py-3 font-semibold">Acertos por fase</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-emerald-950/10 bg-white/65">
          {pools.map((pool) => {
            const summary = summariesByPool[pool.id];
            return (
              <tr key={pool.id} className="align-top transition-colors hover:bg-emerald-50/70">
                <td className="px-4 py-4">
                  <Link to={`/boloes/${pool.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                    {pool.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(pool.userRole === 'owner' || pool.userRole === 'admin') && (
                      <Badge variant="success" className="text-[10px]">Admin</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] bg-white/70">
                      {summary?.participants || pool.stats?.members_count || 1} participantes
                    </Badge>
                  </div>
                </td>
                <td className="px-4 py-4 font-semibold text-slate-900">
                  {summary?.rank ? `${summary.rank}o` : '-'}
                </td>
                <td className="px-4 py-4">
                  <span className="text-xl font-bold text-slate-900">{pool.userPoints || 0}</span>
                </td>
                <td className="px-4 py-4">
                  <PendingBadge missing={summary?.missing} poolId={pool.id} />
                </td>
                <td className="px-4 py-4">
                  <StageBreakdown stages={summary?.stages || []} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PendingBadge({ missing, poolId }) {
  if (!missing || missing.total === 0) {
    return <Badge className="bg-emerald-100 text-emerald-700">Em dia</Badge>;
  }

  return (
    <Button asChild variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-50">
      <Link to={`/boloes/${poolId}/cartao`}>
        {missing.total} pendente{missing.total === 1 ? '' : 's'}
      </Link>
    </Button>
  );
}

function StageBreakdown({ stages }) {
  const visibleStages = stages.filter((stage) => stage.points > 0 || Object.values(stage.counts).some(Boolean));

  if (!visibleStages.length) {
    return <span className="text-slate-500">Sem pontuacao processada</span>;
  }

  return (
    <div className="flex min-w-[520px] flex-wrap gap-2">
      {visibleStages.map((stage) => (
        <div key={stage.stageCode} className="rounded-md border border-emerald-950/10 bg-emerald-50/70 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-slate-800">{stage.label}</span>
            <Badge variant="outline">{stage.points} pts</Badge>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
            {Object.entries(stage.counts)
              .filter(([, count]) => count > 0)
              .map(([hitType, count]) => (
                <span key={hitType}>{HIT_TYPE_LABELS[hitType]}: {count}</span>
              ))}
            {stage.penalties > 0 && <span>Penaltis: {stage.penalties}</span>}
            {stage.zebras > 0 && <span>Zebras: {stage.zebras}</span>}
            {stage.superBuchas > 0 && <span>Super: {stage.superBuchas}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
