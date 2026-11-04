/**
 * V2LineControl — o controle de linhas de um dia de jogo, QUADRA POR QUADRA
 * (`/dia-de-jogo/:gameDayId/linhas`, flag `line_control`).
 *
 * · Sem `?quadra=`: as quadras do dia — quem organiza liga cada uma e escolhe
 *   o arranjo dela (uma quadra pode ter uma câmera e a outra cinco).
 * · `?quadra=court-N`: a quadra, com os dois usos (guardados na URL, `?modo=`):
 *   **Câmera** (`&modo=camera&posicao=…`) no aparelho que filma — quem
 *   organiza ou participa do dia pode ser câmera, vários aparelhos ao mesmo
 *   tempo; e **Central** (`&modo=central`), as câmeras da quadra e os lances
 *   já juntados, para qualquer um que enxerga o dia.
 *
 * Câmeras e marcações moram embaixo da quadra
 * (`game_days/{id}/line_courts/court-N`). Ver docs/53-CONTROLE-DE-LINHAS.md.
 */

import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';

import { V2Page, V2PageHeader, V2Button, V2ErrorState, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useGameDay, useGameDayGames } from '@/modules/games/hooks/useGameDays';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useLineControlLive } from '@/modules/linecall/hooks/useLineControlLive';
import { useGameDayLineCourts, useSaveGameDayLineCourts } from '@/modules/linecall/hooks/useGameDayLineCourts';
import { canBeLineCamera, gameDayLineCourts, gameDayLineHost, gameDayLinePage, lineCourtNumber } from '@/modules/linecall/domain/gameDayLine';
import LineControlScreen from '@/v2/components/linecall/LineControlScreen';
import LineCourtsBoard from '@/v2/components/linecall/LineCourtsBoard';
import { t } from '@/core/i18n';

function CourtScreen({ gameDay, court, doc, podeConfigurar, camera, salvar }) {
  const host = {
    id: gameDayLineHost(gameDay.id, court.id),
    line_control: doc?.line_control === true,
    line_control_layout: doc?.line_control_layout || null,
    title: `${gameDay.title || t('Dia de jogo')} · ${t('Quadra {n}', { n: court.index })}`,
  };
  const live = useLineControlLive(host.id, { enabled: host.line_control });
  const save = {
    mutate: (patch, opts) => salvar.mutate([{ gameDayId: gameDay.id, courtId: court.id, patch, exists: Boolean(doc) }], opts),
    isPending: salvar.isPending,
  };

  if (!host.line_control) {
    return podeConfigurar ? (
      <V2EmptyState
        icon={Camera}
        title={t('O controle de linhas está desligado nesta quadra')}
        description={t('Ligue para usar as câmeras. Pode ser com o jogo em andamento.')}
        action={<V2Button disabled={salvar.isPending} onClick={() => save.mutate({ line_control: true })}>{t('Ligar o controle de linhas')}</V2Button>}
      />
    ) : (
      <V2EmptyState icon={Camera} title={t('O controle de linhas está desligado nesta quadra')} description={t('Quem organiza o jogo liga o controle de linhas de cada quadra.')} />
    );
  }
  return (
    <LineControlScreen
      host={host}
      live={live}
      podeConfigurar={podeConfigurar}
      camera={camera}
      save={save}
      linkBase={gameDayLinePage(gameDay.id, court.id)}
      cameraHint={t('Para ser uma câmera, entre no dia de jogo como participante (ou peça a quem organiza para usar a conta dele no aparelho).')}
    />
  );
}

export default function V2LineControl() {
  const { gameDayId } = useParams();
  const [params] = useSearchParams();
  const quadra = params.get('quadra');
  const ligada = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  const { user } = useAuth();
  const consulta = useGameDay(ligada ? gameDayId : null);
  const gameDay = consulta.data;
  const linhas = useGameDayLineCourts(gameDayId, { enabled: ligada });
  const jogos = useGameDayGames(ligada ? gameDayId : null);
  const salvar = useSaveGameDayLineCourts();
  const { podeConfigurarLinhas: podeConfigurar } = useGameDayRoles(gameDay);

  const docs = Object.fromEntries((linhas.data || []).map((d) => [d.id, d]));
  const courts = gameDay ? gameDayLineCourts(gameDay, { games: jogos.data || [], docs: linhas.data || [] }) : [];
  // Uma quadra fora da lista do dia ainda abre pelo link (ela pode ter câmeras).
  const n = lineCourtNumber(quadra);
  const court = n ? courts.find((c) => c.index === n) || { id: quadra, index: n } : null;
  const camera = gameDay ? canBeLineCamera(gameDay, user?.uid, podeConfigurar) : false;

  const header = (
    <V2PageHeader
      voltarPara={court ? gameDayLinePage(gameDayId) : `/dia-de-jogo/${gameDayId}`}
      voltarLabel={court ? t('Todas as quadras') : t('Voltar ao dia de jogo')}
      title={t('Controle de linhas')}
      subtitle={gameDay
        ? (court ? `${gameDay.title || t('Dia de jogo')} · ${t('Quadra {n}', { n: court.index })}` : gameDay.title)
        : t('Câmeras, calibração da quadra e marcações')}
    />
  );

  let body;
  if (!ligada) {
    body = <V2EmptyState icon={Camera} title={t('Controle de linhas desligado')} description={t('Esta funcionalidade ainda não foi liberada na plataforma.')} />;
  } else if (consulta.isLoading || linhas.isLoading) {
    body = <V2Skeleton lines={4} />;
  } else if (consulta.isLoadingError || linhas.isLoadingError || !gameDay || !linhas.data) {
    // Erro só SEM dado (`isLoadingError`, não `isError`): numa releitura que
    // falha (o Wi-Fi caiu um instante) a câmera que está filmando segue com o
    // que já tinha — o React Query guarda o dado; derrubar a tela desligaria a
    // câmera no meio do jogo.
    body = <V2ErrorState onRetry={() => { consulta.refetch(); linhas.refetch(); }} />;
  } else if (quadra && !court) {
    body = <V2EmptyState icon={Camera} title={t('Quadra não encontrada neste dia de jogo')} action={<V2Button asChild size="sm"><Link to={gameDayLinePage(gameDayId)}>{t('Ver as quadras')}</Link></V2Button>} />;
  } else if (court) {
    body = <CourtScreen key={court.id} gameDay={gameDay} court={court} doc={docs[court.id]} podeConfigurar={podeConfigurar} camera={camera} salvar={salvar} />;
  } else if (!podeConfigurar && !courts.some((c) => docs[c.id]?.line_control === true)) {
    body = <V2EmptyState icon={Camera} title={t('Nenhuma quadra com controle de linhas ligado')} description={t('Quem organiza o jogo liga o controle de linhas de cada quadra.')} />;
  } else {
    body = (
      <V2Surface className="p-4">
        <LineCourtsBoard
          courts={courts}
          docs={docs}
          staff={podeConfigurar}
          camera={camera}
          pageFor={(id) => gameDayLinePage(gameDay.id, id)}
          onSave={(items) => salvar.mutate(items.map((i) => ({ ...i, gameDayId: gameDay.id })), {
            onSuccess: (r) => { if (r.failed) toast.error(t('{n} quadra(s) não foram salvas. Tente de novo.', { n: r.failed })); },
            onError: (e) => toast.error(e?.message || t('Não foi possível salvar.')),
          })}
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
