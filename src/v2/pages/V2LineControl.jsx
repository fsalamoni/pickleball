/**
 * V2LineControl — o controle de linhas de um dia de jogo
 * (`/dia-de-jogo/:gameDayId/linhas`, flag `line_control`).
 *
 * Dois usos, escolhidos na entrada (e guardados na URL, `?modo=`):
 *
 * · **Câmera** (`?modo=camera&posicao=…`) — no aparelho que filma: escolher a
 *   posição do arranjo (o desenho mostra onde ela fica), posicionar, abrir a
 *   câmera, marcar os quatro pontos, analisar. Quem organiza ou participa do
 *   dia pode ser câmera; vários aparelhos, de várias pessoas, ao mesmo tempo.
 * · **Central** (`?modo=central`) — as câmeras no ar e os lances já juntados.
 *   Qualquer um que enxerga o dia de jogo abre (mesa, tablet, TV).
 *
 * Quem organiza escolhe o ARRANJO (quantas câmeras e onde). Ver
 * docs/53-CONTROLE-DE-LINHAS.md.
 */

import React from 'react';
import { useParams } from 'react-router-dom';
import { Camera } from 'lucide-react';

import { V2Page, V2PageHeader, V2Button, V2ErrorState, V2EmptyState, V2Skeleton } from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useGameDay, useUpdateGameDay } from '@/modules/games/hooks/useGameDays';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useLineControlLive } from '@/modules/linecall/hooks/useLineControlLive';
import LineControlScreen from '@/v2/components/linecall/LineControlScreen';
import { t } from '@/core/i18n';

/** Quem pode ser uma câmera: quem organiza, o administrador nomeado ou quem participa (a regra confere igual). */
function canBeCamera(gameDay, uid, podeConfigurar) {
  if (!uid) return false;
  return podeConfigurar
    || (gameDay.member_uids || []).includes(uid)
    || (gameDay.admin_uids || []).includes(uid);
}

export default function V2LineControl() {
  const { gameDayId } = useParams();
  const ligada = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  const { user } = useAuth();
  const consulta = useGameDay(ligada ? gameDayId : null);
  const gameDay = consulta.data;
  const { podeConfigurarLinhas: podeConfigurar } = useGameDayRoles(gameDay);
  const update = useUpdateGameDay();
  const ativo = Boolean(ligada && gameDay?.line_control === true);
  const live = useLineControlLive(gameDay?.id, { enabled: ativo });
  const save = {
    mutate: (patch, opts) => update.mutate({ id: gameDay.id, patch }, opts),
    isPending: update.isPending,
  };

  const header = (
    <V2PageHeader
      voltarPara={`/dia-de-jogo/${gameDayId}`}
      voltarLabel={t('Voltar ao dia de jogo')}
      title={t('Controle de linhas')}
      subtitle={gameDay?.title || t('Câmeras, calibração da quadra e marcações')}
    />
  );

  let body;
  if (!ligada) {
    body = <V2EmptyState icon={Camera} title={t('Controle de linhas desligado')} description={t('Esta funcionalidade ainda não foi liberada na plataforma.')} />;
  } else if (consulta.isLoading) {
    body = <V2Skeleton lines={4} />;
  } else if (consulta.isError || !gameDay) {
    body = <V2ErrorState onRetry={consulta.refetch} />;
  } else if (gameDay.line_control !== true) {
    body = podeConfigurar ? (
      <V2EmptyState
        icon={Camera}
        title={t('O controle de linhas está desligado neste jogo')}
        description={t('Ligue para usar as câmeras. Pode ser com o jogo em andamento.')}
        action={<V2Button disabled={update.isPending} onClick={() => save.mutate({ line_control: true })}>{t('Ligar o controle de linhas')}</V2Button>}
      />
    ) : (
      <V2EmptyState icon={Camera} title={t('O controle de linhas está desligado neste jogo')} description={t('Quem organiza o jogo liga o controle de linhas no cartão do dia de jogo.')} />
    );
  } else {
    body = (
      <LineControlScreen
        host={gameDay}
        live={live}
        podeConfigurar={podeConfigurar}
        camera={canBeCamera(gameDay, user?.uid, podeConfigurar)}
        save={save}
        linkBase={`/dia-de-jogo/${gameDay.id}/linhas`}
        cameraHint={t('Para ser uma câmera, entre no dia de jogo como participante (ou peça a quem organiza para usar a conta dele no aparelho).')}
      />
    );
  }

  return (
    <V2Page className="space-y-4">
      {header}
      {body}
    </V2Page>
  );
}
