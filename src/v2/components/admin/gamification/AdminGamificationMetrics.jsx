import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useAdminMetrics } from '@/modules/progression/hooks/useGamificationAdmin';
import MiniStat from '@/v2/components/gamification/MiniStat';
import { V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

/** Barras simples (sem biblioteca): o último valor de cada dia, normalizado. */
function Spark({ dados, campo, label }) {
  const max = Math.max(1, ...dados.map((d) => Number(d[campo]) || 0));
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-500">{label}</p>
      <div className="flex h-14 items-end gap-0.5" role="img" aria-label={`${label}: ${dados.map((d) => d[campo] || 0).join(', ')}`}>
        {dados.map((d) => (
          <div key={d.id} title={`${d.day}: ${d[campo] || 0}`} className="flex-1 rounded-t bg-acid" style={{ height: `${Math.max(4, ((Number(d[campo]) || 0) / max) * 100)}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Painel admin → Gamificação → Métricas: o funil e o uso, um retrato por dia. */
export default function AdminGamificationMetrics() {
  const q = useAdminMetrics();
  const dados = q.metrics;
  const ultimo = dados[dados.length - 1];
  const taxaAtivos = useMemo(() => (ultimo && ultimo.athletes ? Math.round((ultimo.active30 / ultimo.athletes) * 100) : null), [ultimo]);

  if (q.isLoading) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (q.isError) return <V2Surface><V2ErrorState title="Não deu para carregar as métricas" onRetry={q.refetch} /></V2Surface>;
  if (!ultimo) return <V2Surface><V2EmptyState icon={Activity} title="Ainda sem métricas" description="O retrato diário é gravado pelo servidor, uma vez por dia, depois que a gamificação é ligada." /></V2Surface>;

  return (
    <div className="space-y-5" data-testid="admin-gamification-metrics">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MiniStat label="Atletas com progressão" value={ultimo.athletes} hint={`Ativos em 30 dias: ${ultimo.active30}${taxaAtivos != null ? ` (${taxaAtivos}%)` : ''}`} />
        <MiniStat label="Ativos em 7 dias" value={ultimo.active7} />
        <MiniStat label="Convites ativados" value={`${ultimo.referralsActivated}/${ultimo.referrals}`} />
        <MiniStat label="Desafios ativos" value={ultimo.challengesActive} />
        <MiniStat label="Duelos em andamento" value={ultimo.duelsActive} />
        <MiniStat label="Avaliações (7 dias)" value={ultimo.reviews7} hint={`${ultimo.letters7} cartas · ${ultimo.kudos7} kudos`} />
        <MiniStat label="Pedidos de recompensa abertos" value={ultimo.rewardClaimsOpen} />
        <MiniStat label="Sinais de integridade abertos" value={ultimo.flagsOpen} />
      </div>
      <V2Surface className="space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">Evolução (últimos {dados.length} dias)</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Spark dados={dados} campo="active7" label="Ativos em 7 dias" />
          <Spark dados={dados} campo="athletes" label="Atletas com progressão" />
          <Spark dados={dados} campo="reviews7" label="Avaliações por semana" />
          <Spark dados={dados} campo="kudos7" label="Kudos por semana" />
        </div>
        <p className="text-[11px] text-gray-400">Último retrato: {ultimo.day}. {ultimo.prefsDocs} pessoas já abriram as preferências da gamificação.</p>
      </V2Surface>
    </div>
  );
}
