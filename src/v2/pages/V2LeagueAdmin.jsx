/**
 * /ligas/:leagueId/gerenciar — a GESTÃO da liga, numa página própria como a
 * do torneio (`/torneios/:id/gerenciar`): o mesmo cabeçalho compacto, a mesma
 * faixa "Hub administrativo" e a mesma barra de seções. As seções e o
 * `?secao=` são os de sempre (`LeagueManage`). Quem não gere volta para a
 * página da liga sem ver nada da gestão.
 */
import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { t } from '@/core/i18n';
import { V2BackLink, V2Button, V2ErrorState, V2Page, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { CompetitionAdminHeader } from '@/v2/components/competition/CompetitionHero';
import { LEAGUE_STATUS_LABELS } from '@/modules/leagues/domain/leagueFormats';
import LeaguesGate from '@/v2/components/leagues/LeaguesGate';
import LeagueManage from '@/v2/components/leagues/LeagueManage';
import { useLeagueData } from '@/v2/components/leagues/useLeagueData';

export default function V2LeagueAdmin() {
  return <LeaguesGate><Gestao /></LeaguesGate>;
}

function Gestao() {
  const { leagueId } = useParams();
  const { liga, divisoes, inscricoes, jogos, gere, acessoCarregando } = useLeagueData(leagueId);

  if (liga.isLoading || acessoCarregando) {
    return (
      <V2Page className="space-y-4">
        <V2Skeleton className="h-16 rounded-2xl" />
        <V2Skeleton className="h-96 rounded-2xl" />
      </V2Page>
    );
  }
  if (liga.isError) {
    return (
      <V2Page>
        <V2Surface><V2ErrorState title={t('Não foi possível abrir a liga')} description={t('A conexão falhou. A liga continua lá.')} onRetry={() => liga.refetch()} /></V2Surface>
      </V2Page>
    );
  }
  // Não gere (ou a liga não existe): volta para a página da liga, sem vazar a gestão.
  if (!liga.data || !gere) return <Navigate to={`/ligas/${leagueId}`} replace />;

  const l = liga.data;
  return (
    <V2Page>
      <CompetitionAdminHeader kicker={t('Gestão da liga')} title={l.name} status={t(LEAGUE_STATUS_LABELS[l.status] || l.status || '')}>
        <V2Button asChild size="sm" variant="ghost">
          <Link to={`/ligas/${l.id}`} data-dica="liga-pagina-publica"><Eye className="h-4 w-4" aria-hidden="true" /> {t('Ver página da liga')}</Link>
        </V2Button>
      </CompetitionAdminHeader>

      <V2BackLink to="/ligas?aba=minhas" className="mb-4">{t('Minhas ligas')}</V2BackLink>

      <LeagueManage league={l} divisions={divisoes} entries={inscricoes} matches={jogos} canManage />
    </V2Page>
  );
}
