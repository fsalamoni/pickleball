/**
 * LineControlScreen — o miolo do controle de linhas com o controle LIGADO: a
 * escolha (câmera ou central), a estação da câmera e a central. É o mesmo para
 * o dia de jogo (`V2LineControl`) e para a quadra de um torneio
 * (`V2TournamentLineControl`); muda só o "anfitrião" (onde câmeras e marcações
 * moram), quem pode ser câmera e como o arranjo é gravado (`save`).
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, MonitorPlay, ArrowLeftRight, Radio, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { V2Surface, V2Button, V2Badge, V2ErrorState } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useNow } from '@/modules/linecall/hooks/useLineControlLive';
import { CAMERA_POSITIONS, layoutById } from '@/modules/linecall/domain/cameraLayouts';
import { positionOccupancy } from '@/modules/linecall/domain/fusion';
import CameraStation from './CameraStation';
import LineCentral from './LineCentral';
import LayoutPicker from './LayoutPicker';
import SetupGuide, { useDeviceProfile } from './SetupGuide';
import CourtDiagram from './CourtDiagram';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

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
function LayoutSection({ host, podeConfigurar, save }) {
  const layout = layoutById(host.line_control_layout);
  const trocar = (id) => save.mutate(
    { line_control_layout: id },
    { onError: (e) => toast.error(e?.message || t('Não foi possível salvar.')) },
  );
  return (
    <V2Surface
      collapsible
      collapseId="linhas-arranjo"
      defaultCollapsed={Boolean(host.line_control_layout)}
      title={t('Arranjo das câmeras')}
      description={t(layout.label)}
      className="p-4"
    >
      {podeConfigurar ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t('Escolha quantas câmeras o jogo vai ter e onde. Dá para trocar depois; quem já está numa posição que saiu do arranjo escolhe outra.')}</p>
          <LayoutPicker value={layout.id} onChange={trocar} disabled={save.isPending} />
        </div>
      ) : (
        <p className="text-sm text-gray-600">{t('Quem organiza o jogo escolheu este arranjo: {l}. {g}', { l: t(layout.label), g: t(layout.good) })}</p>
      )}
    </V2Surface>
  );
}

function PositionPicker({ host, live, uid, onPick }) {
  const now = useNow();
  const layout = layoutById(host.line_control_layout);
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

/**
 * @param {{
 *   host: { id: string, line_control_layout?: string, title?: string },
 *   live: object, podeConfigurar: boolean, camera: boolean,
 *   save: { mutate: (patch: object, opts?: object) => void, isPending: boolean },
 *   linkBase: string, cameraHint: string,
 * }} props
 *   `host.id`: o id do dia de jogo ou o caminho da quadra de torneio;
 *   `linkBase`: o caminho desta página (para o QR e para a outra aba)
 */
export default function LineControlScreen({ host, live, podeConfigurar, camera, save, linkBase, cameraHint }) {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const device = useDeviceProfile();
  const modo = params.get('modo');
  const posicao = CAMERA_POSITIONS[params.get('posicao')] ? params.get('posicao') : null;
  const ir = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: false });
  };
  const layout = layoutById(host.line_control_layout);
  const sep = linkBase.includes('?') ? '&' : '?';

  if (modo === 'camera' && camera) {
    return (
      <div className="space-y-4">
        <LayoutSection host={host} podeConfigurar={podeConfigurar} save={save} />
        {posicao && layout.positions.includes(posicao) ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-600">{t('Este aparelho é a câmera: {p}', { p: t(CAMERA_POSITIONS[posicao].label) })}</p>
              <div className="flex flex-wrap gap-2">
                {device.kind === 'computer' && (
                  <V2Button size="sm" variant="secondary"
                    onClick={() => window.open(`${linkBase}${sep}modo=camera`, '_blank', 'noopener,noreferrer')}
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
            <CameraStation key={posicao} gameDayId={host.id} position={posicao} layout={layout.id} layoutPositions={layout.positions} />
          </>
        ) : (
          <PositionPicker host={host} live={live} uid={user?.uid} onPick={(p) => ir({ posicao: p })} />
        )}
      </div>
    );
  }
  if (modo === 'central') {
    return (
      <div className="space-y-4">
        {podeConfigurar && <LayoutSection host={host} podeConfigurar save={save} />}
        <LineCentral gameDay={host} live={live} podeLimpar={podeConfigurar} linkBase={linkBase} />
      </div>
    );
  }
  return (
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
      {!camera && <p className="text-sm text-gray-600">{cameraHint}</p>}
      <SetupGuide gameDay={host} podeConfigurar={podeConfigurar} save={save} />
      <LayoutSection host={host} podeConfigurar={podeConfigurar} save={save} />
    </div>
  );
}
