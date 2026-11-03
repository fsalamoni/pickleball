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
import { useParams, useSearchParams } from 'react-router-dom';
import { Camera, MonitorPlay, ArrowLeftRight, Radio, Plus } from 'lucide-react';
import { toast } from 'sonner';

import {
  V2Page, V2PageHeader, V2Surface, V2Button, V2Badge, V2ErrorState, V2EmptyState, V2Skeleton,
} from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useGameDay, useUpdateGameDay } from '@/modules/games/hooks/useGameDays';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useLineControlLive, useNow } from '@/modules/linecall/hooks/useLineControlLive';
import { CAMERA_POSITIONS, layoutById } from '@/modules/linecall/domain/cameraLayouts';
import { positionOccupancy } from '@/modules/linecall/domain/fusion';
import CameraStation from '@/v2/components/linecall/CameraStation';
import LineCentral from '@/v2/components/linecall/LineCentral';
import LayoutPicker from '@/v2/components/linecall/LayoutPicker';
import SetupGuide, { useDeviceProfile } from '@/v2/components/linecall/SetupGuide';
import CourtDiagram from '@/v2/components/linecall/CourtDiagram';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

/** Quem pode ser uma câmera: quem organiza, o administrador nomeado ou quem participa (a regra confere igual). */
function canBeCamera(gameDay, uid, podeConfigurar) {
  if (!uid) return false;
  return podeConfigurar
    || (gameDay.member_uids || []).includes(uid)
    || (gameDay.admin_uids || []).includes(uid);
}

function Choice({ icon: Icon, title, text, onClick }) {
  return (
    <button type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-3xl border border-gray-100 bg-white p-5 text-left transition-colors hover:border-ink"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acid text-ink"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <span className="space-y-1">
        <span className="block text-base font-semibold text-ink">{title}</span>
        <span className="block text-sm leading-6 text-gray-600">{text}</span>
      </span>
    </button>
  );
}

/** O arranjo do jogo: quem organiza troca; os demais veem. */
function LayoutSection({ gameDay, podeConfigurar }) {
  const update = useUpdateGameDay();
  const layout = layoutById(gameDay.line_control_layout);
  const trocar = (id) => update.mutate(
    { id: gameDay.id, patch: { line_control_layout: id } },
    { onError: (e) => toast.error(e?.message || t('Não foi possível salvar.')) },
  );
  return (
    <V2Surface
      collapsible
      collapseId="linhas-arranjo"
      defaultCollapsed={Boolean(gameDay.line_control_layout)}
      title={t('Arranjo das câmeras')}
      description={t(layout.label)}
      className="p-4"
    >
      {podeConfigurar ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t('Escolha quantas câmeras o jogo vai ter e onde. Dá para trocar depois; quem já está numa posição que saiu do arranjo escolhe outra.')}</p>
          <LayoutPicker value={layout.id} onChange={trocar} disabled={update.isPending} />
        </div>
      ) : (
        <p className="text-sm text-gray-600">{t('Quem organiza o jogo escolheu este arranjo: {l}. {g}', { l: t(layout.label), g: t(layout.good) })}</p>
      )}
    </V2Surface>
  );
}

function PositionPicker({ gameDay, live, uid, onPick }) {
  const now = useNow();
  const layout = layoutById(gameDay.line_control_layout);
  const occ = positionOccupancy(layout.positions, live.cams, now);
  return (
    <V2Surface className="space-y-4 p-4">
      <div>
        <p className="text-base font-semibold text-ink">{t('Em que posição este aparelho vai ficar?')}</p>
        <p className="text-sm text-gray-600">{t('Cada aparelho fica numa posição. O número no desenho é o da lista.')}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,160px)_1fr]">
        <CourtDiagram
          positions={layout.positions}
          taken={layout.positions.filter((p) => occ[p] && occ[p].uid !== uid)}
          className="mx-auto w-full max-w-[160px] text-ink"
          label={t('As posições do arranjo no desenho da quadra')}
        />
        {live.isError ? <V2ErrorState inline onRetry={live.retry} description={t('Não deu para ver quais posições já têm câmera. Você pode escolher assim mesmo.')} /> : null}
        <ul className="space-y-2">
          {layout.positions.map((p, i) => {
            const c = occ[p];
            const outro = c && c.uid !== uid;
            return (
              <li key={p}>
                <button type="button"
                  onClick={() => onPick(p)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors hover:border-ink',
                    outro ? 'border-gray-100 bg-paper' : 'border-gray-100 bg-white',
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white" aria-hidden="true">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{t(CAMERA_POSITIONS[p].label)}</span>
                    <span className="block text-xs text-gray-500">{t(CAMERA_POSITIONS[p].where)}</span>
                  </span>
                  {outro && <V2Badge tone="green"><Radio className="mr-1 inline h-3 w-3" aria-hidden="true" />{c.name || t('Ocupada')}</V2Badge>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </V2Surface>
  );
}

export default function V2LineControl() {
  const { gameDayId } = useParams();
  const [params, setParams] = useSearchParams();
  const ligada = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  const { user } = useAuth();
  const consulta = useGameDay(ligada ? gameDayId : null);
  const gameDay = consulta.data;
  const { podeConfigurarLinhas: podeConfigurar } = useGameDayRoles(gameDay);
  const update = useUpdateGameDay();
  const ativo = Boolean(ligada && gameDay?.line_control === true);
  const live = useLineControlLive(gameDay?.id, { enabled: ativo });
  const device = useDeviceProfile();

  const modo = params.get('modo');
  const posicao = CAMERA_POSITIONS[params.get('posicao')] ? params.get('posicao') : null;
  const ir = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: false });
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
        action={<V2Button disabled={update.isPending} onClick={() => update.mutate({ id: gameDay.id, patch: { line_control: true } })}>{t('Ligar o controle de linhas')}</V2Button>}
      />
    ) : (
      <V2EmptyState icon={Camera} title={t('O controle de linhas está desligado neste jogo')} description={t('Quem organiza o jogo liga o controle de linhas no cartão do dia de jogo.')} />
    );
  } else {
    const layout = layoutById(gameDay.line_control_layout);
    const camera = canBeCamera(gameDay, user?.uid, podeConfigurar);
    if (modo === 'camera' && camera) {
      body = (
        <div className="space-y-4">
          <LayoutSection gameDay={gameDay} podeConfigurar={podeConfigurar} />
          {posicao && layout.positions.includes(posicao) ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">{t('Este aparelho é a câmera: {p}', { p: t(CAMERA_POSITIONS[posicao].label) })}</p>
                <div className="flex flex-wrap gap-2">
                  {device.kind === 'computer' && (
                    <V2Button size="sm" variant="secondary"
                      onClick={() => window.open(`/dia-de-jogo/${gameDay.id}/linhas?modo=camera`, '_blank', 'noopener,noreferrer')}
                      data-dica="linhas-outra-aba"
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> {t('Abrir outra câmera neste computador')}
                    </V2Button>
                  )}
                  <V2Button size="sm" variant="ghost" onClick={() => ir({ posicao: null })}>
                    <ArrowLeftRight className="mr-1.5 h-4 w-4" /> {t('Trocar posição')}
                  </V2Button>
                </div>
              </div>
              <CameraStation key={posicao} gameDayId={gameDay.id} position={posicao} layout={layout.id} layoutPositions={layout.positions} />
            </>
          ) : (
            <PositionPicker gameDay={gameDay} live={live} uid={user?.uid} onPick={(p) => ir({ posicao: p })} />
          )}
        </div>
      );
    } else if (modo === 'central') {
      body = (
        <div className="space-y-4">
          {podeConfigurar && <LayoutSection gameDay={gameDay} podeConfigurar />}
          <LineCentral gameDay={gameDay} live={live} podeLimpar={podeConfigurar} />
        </div>
      );
    } else {
      body = (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {camera && (
              <Choice
                icon={Camera}
                title={t('Usar este aparelho como câmera')}
                text={t('Celular, tablet ou computador com webcam: escolha a posição, posicione e calibre. Pode ter várias câmeras, de várias pessoas.')}
                onClick={() => ir({ modo: 'camera' })}
              />
            )}
            <Choice
              icon={MonitorPlay}
              title={t('Ver a central')}
              text={t('As câmeras no ar e cada lance, já juntando o que todas viram. Boa para a mesa da organização ou uma TV.')}
              onClick={() => ir({ modo: 'central' })}
            />
          </div>
          {!camera && (
            <p className="text-sm text-gray-600">{t('Para ser uma câmera, entre no dia de jogo como participante (ou peça a quem organiza para usar a conta dele no aparelho).')}</p>
          )}
          <SetupGuide gameDay={gameDay} podeConfigurar={podeConfigurar} />
          <LayoutSection gameDay={gameDay} podeConfigurar={podeConfigurar} />
        </div>
      );
    }
  }

  return (
    <V2Page className="space-y-4">
      {header}
      {body}
    </V2Page>
  );
}
