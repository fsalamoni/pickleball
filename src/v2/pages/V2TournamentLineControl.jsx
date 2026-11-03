/**
 * Controle de linhas nas QUADRAS de um torneio (flag `line_control`,
 * docs/53 §9). `/torneios/:id/linhas` lista as quadras do agendamento; a
 * equipe do torneio (criador, administradores do torneio e quem gere a arena
 * sede) liga cada uma e escolhe o arranjo. `?quadra=court-N` abre a mesma
 * tela do dia de jogo (câmera ou central), com as câmeras e marcações embaixo
 * de `tournament_line_courts/{torneio}_{quadra}`. Só a equipe pode ser câmera
 * — a regra confere igual; qualquer pessoa logada acompanha a central.
 */

import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Camera, MonitorPlay } from 'lucide-react';

import { V2Page, V2PageHeader, V2Button, V2ErrorState, V2EmptyState, V2Skeleton, V2Surface, V2Toggle, V2Badge } from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useTournament, useIsTournamentAdmin, useModalities } from '@/modules/tournament/hooks/useTournament';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useTournamentLineCourts, useSaveTournamentLineCourt } from '@/modules/linecall/hooks/useTournamentLineCourts';
import { useLineControlLive } from '@/modules/linecall/hooks/useLineControlLive';
import { tournamentCourts, tournamentLineHost, tournamentLinePage, isTournamentCourtId } from '@/modules/linecall/domain/tournamentLine';
import { layoutById } from '@/modules/linecall/domain/cameraLayouts';
import LineControlScreen from '@/v2/components/linecall/LineControlScreen';
import { t } from '@/core/i18n';

function CourtScreen({ tournament, court, doc, staff }) {
  const host = {
    id: tournamentLineHost(tournament.id, court.id),
    line_control: doc?.line_control === true,
    line_control_layout: doc?.line_control_layout || null,
    title: `${tournament.name} · ${court.name}`,
  };
  const live = useLineControlLive(host.id, { enabled: host.line_control });
  const salvar = useSaveTournamentLineCourt(tournament.id);
  const save = {
    mutate: (patch, opts) => salvar.mutate({ court, patch, exists: Boolean(doc) }, opts),
    isPending: salvar.isPending,
  };

  if (!host.line_control) {
    return staff ? (
      <V2EmptyState
        icon={Camera}
        title={t('O controle de linhas está desligado nesta quadra')}
        description={t('Ligue para usar as câmeras. Pode ser com o jogo em andamento.')}
        action={<V2Button disabled={salvar.isPending} onClick={() => save.mutate({ line_control: true })}>{t('Ligar o controle de linhas')}</V2Button>}
      />
    ) : (
      <V2EmptyState icon={Camera} title={t('O controle de linhas está desligado nesta quadra')} description={t('Quem organiza o torneio liga o controle de linhas de cada quadra.')} />
    );
  }
  return (
    <LineControlScreen
      host={host}
      live={live}
      podeConfigurar={staff}
      camera={staff}
      save={save}
      linkBase={tournamentLinePage(tournament.id, court.id)}
      cameraHint={t('Só contas da equipe do torneio podem ser câmera. No aparelho da câmera, entre com a conta de quem organiza ou de um administrador do torneio.')}
    />
  );
}

function CourtList({ tournament, courts, docs, staff }) {
  const salvar = useSaveTournamentLineCourt(tournament.id);
  const visiveis = staff ? courts : courts.filter((c) => docs[c.id]?.line_control === true);
  if (!visiveis.length) {
    return <V2EmptyState icon={Camera} title={t('Nenhuma quadra com controle de linhas ligado')} description={t('Quem organiza o torneio liga o controle de linhas de cada quadra.')} />;
  }
  return (
    <div className="space-y-3">
      {visiveis.map((c) => {
        const d = docs[c.id];
        const on = d?.line_control === true;
        return (
          <V2Surface key={c.id} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-xs text-gray-500">{on ? t(layoutById(d?.line_control_layout).label) : t('Desligado')}</p>
              </div>
              {on && <V2Badge tone="green">{t('Ligado')}</V2Badge>}
            </div>
            {staff && (
              <V2Toggle
                id={`linhas-${c.id}`}
                checked={on}
                disabled={salvar.isPending}
                onChange={(v) => salvar.mutate({ court: c, patch: { line_control: v }, exists: Boolean(d) })}
                label={t('Controle de linhas nesta quadra')}
              />
            )}
            {on && (
              <div className="flex flex-wrap gap-2">
                {staff && (
                  <V2Button asChild size="sm"><Link to={`${tournamentLinePage(tournament.id, c.id)}&modo=camera`}><Camera className="h-4 w-4" /> {t('Abrir câmera')}</Link></V2Button>
                )}
                <V2Button asChild size="sm" variant="secondary"><Link to={`${tournamentLinePage(tournament.id, c.id)}&modo=central`}><MonitorPlay className="h-4 w-4" /> {t('Abrir central')}</Link></V2Button>
              </div>
            )}
          </V2Surface>
        );
      })}
    </div>
  );
}

export default function V2TournamentLineControl() {
  const { tournamentId } = useParams();
  const [params] = useSearchParams();
  const quadra = params.get('quadra');
  const ligada = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  const { user } = useAuth();
  const torneio = useTournament(ligada ? tournamentId : null);
  const admin = useIsTournamentAdmin(ligada ? tournamentId : null);
  const modalidades = useModalities(ligada ? tournamentId : null);
  const linhas = useTournamentLineCourts(tournamentId, { enabled: ligada });
  const { data: arenasGeridas = [] } = useMyManagedArenas();
  const tournament = torneio.data;

  const staff = Boolean(user?.uid && tournament && (
    admin.data === true
    || tournament.creator_uid === user.uid
    || (tournament.arena_id && arenasGeridas.some((a) => a?.id === tournament.arena_id))
  ));
  const docs = Object.fromEntries((linhas.data || []).map((d) => [d.court_id, d]));
  const courts = tournamentCourts(modalidades.data || [], linhas.data || []);
  const court = isTournamentCourtId(quadra) ? courts.find((c) => c.id === quadra) || null : null;

  const header = (
    <V2PageHeader
      voltarPara={court ? tournamentLinePage(tournamentId) : `/torneios/${tournamentId}`}
      voltarLabel={court ? t('Todas as quadras') : t('Voltar ao torneio')}
      title={t('Controle de linhas')}
      subtitle={tournament ? (court ? `${tournament.name} · ${court.name}` : tournament.name) : t('Câmeras, calibração da quadra e marcações')}
    />
  );

  let body;
  if (!ligada) {
    body = <V2EmptyState icon={Camera} title={t('Controle de linhas desligado')} description={t('Esta funcionalidade ainda não foi liberada na plataforma.')} />;
  } else if (torneio.isLoading || linhas.isLoading || modalidades.isLoading || admin.isLoading) {
    body = <V2Skeleton lines={4} />;
  } else if (torneio.isError || !tournament || linhas.isError || modalidades.isError) {
    body = <V2ErrorState onRetry={() => { torneio.refetch(); linhas.refetch(); modalidades.refetch(); }} />;
  } else if (quadra && !court) {
    body = <V2EmptyState icon={Camera} title={t('Quadra não encontrada neste torneio')} action={<V2Button asChild size="sm"><Link to={tournamentLinePage(tournamentId)}>{t('Ver as quadras')}</Link></V2Button>} />;
  } else if (court) {
    body = <CourtScreen key={court.id} tournament={tournament} court={court} doc={docs[court.id]} staff={staff} />;
  } else {
    body = <CourtList tournament={tournament} courts={courts} docs={docs} staff={staff} />;
  }

  return (
    <V2Page className="space-y-4">
      {header}
      {body}
    </V2Page>
  );
}
