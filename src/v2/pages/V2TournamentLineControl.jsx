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
import { Camera } from 'lucide-react';
import { toast } from 'sonner';

import { V2Page, V2PageHeader, V2Button, V2ErrorState, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useTournament, useIsTournamentAdmin, useModalities } from '@/modules/tournament/hooks/useTournament';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useTournamentLineCourts, useSaveTournamentLineCourts } from '@/modules/linecall/hooks/useTournamentLineCourts';
import { useLineControlLive } from '@/modules/linecall/hooks/useLineControlLive';
import { tournamentCourts, tournamentLineHost, tournamentLinePage, isTournamentCourtId } from '@/modules/linecall/domain/tournamentLine';
import LineControlScreen from '@/v2/components/linecall/LineControlScreen';
import LineCourtsBoard from '@/v2/components/linecall/LineCourtsBoard';
import { t } from '@/core/i18n';

/** O nome que a tela mostra ("Quadra 2", no idioma da pessoa). */
const courtName = (court) => t('Quadra {n}', { n: court.index });

function CourtScreen({ tournament, court, doc, staff, salvar }) {
  const host = {
    id: tournamentLineHost(tournament.id, court.id),
    line_control: doc?.line_control === true,
    line_control_layout: doc?.line_control_layout || null,
    title: `${tournament.name} · ${courtName(court)}`,
  };
  const live = useLineControlLive(host.id, { enabled: host.line_control });
  const save = {
    mutate: (patch, opts) => salvar.mutate([{ court, patch, exists: Boolean(doc) }], opts),
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
  const salvar = useSaveTournamentLineCourts(tournamentId);
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
      subtitle={tournament ? (court ? `${tournament.name} · ${courtName(court)}` : tournament.name) : t('Câmeras, calibração da quadra e marcações')}
    />
  );

  let body;
  if (!ligada) {
    body = <V2EmptyState icon={Camera} title={t('Controle de linhas desligado')} description={t('Esta funcionalidade ainda não foi liberada na plataforma.')} />;
  } else if (torneio.isLoading || linhas.isLoading || modalidades.isLoading || admin.isLoading) {
    body = <V2Skeleton lines={4} />;
  } else if (torneio.isLoadingError || linhas.isLoadingError || modalidades.isLoadingError
    || !tournament || !linhas.data || !modalidades.data) {
    // Erro só SEM dado (`isLoadingError`, não `isError`): a releitura que
    // falha não desliga a câmera que filma.
    body = <V2ErrorState onRetry={() => { torneio.refetch(); linhas.refetch(); modalidades.refetch(); }} />;
  } else if (quadra && !court) {
    body = <V2EmptyState icon={Camera} title={t('Quadra não encontrada neste torneio')} action={<V2Button asChild size="sm"><Link to={tournamentLinePage(tournamentId)}>{t('Ver as quadras')}</Link></V2Button>} />;
  } else if (court) {
    body = <CourtScreen key={court.id} tournament={tournament} court={court} doc={docs[court.id]} staff={staff} salvar={salvar} />;
  } else if (!staff && !courts.some((c) => docs[c.id]?.line_control === true)) {
    body = <V2EmptyState icon={Camera} title={t('Nenhuma quadra com controle de linhas ligado')} description={t('Quem organiza o torneio liga o controle de linhas de cada quadra.')} />;
  } else {
    const porId = Object.fromEntries(courts.map((c) => [c.id, c]));
    body = (
      <V2Surface className="p-4">
        <LineCourtsBoard
          courts={courts}
          docs={docs}
          staff={staff}
          pageFor={(id) => tournamentLinePage(tournament.id, id)}
          onSave={(items) => salvar.mutate(
            items.map((i) => ({ court: porId[i.courtId], patch: i.patch, exists: i.exists })),
            {
              onSuccess: (r) => { if (r.failed) toast.error(t('{n} quadra(s) não foram salvas. Tente de novo.', { n: r.failed })); },
              onError: (e) => toast.error(e?.message || t('Não foi possível salvar.')),
            },
          )}
          saving={salvar.isPending}
        />
      </V2Surface>
    );
  }

  return (
    <V2Page className="space-y-4">
      {header}
      {body}
    </V2Page>
  );
}
