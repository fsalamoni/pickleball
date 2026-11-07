/**
 * RemoteCalibration — na CENTRAL, calibrar uma câmera pela foto que ela
 * mandou (docs/53 §5d): câmera presa no alto, atrás do vidro ou longe não
 * precisa de ninguém na tela dela. A marcação é a MESMA do aparelho que filma
 * (`CalibrationMarker`); daqui saem a calibração e o começar/pausar.
 */

import React, { useState } from 'react';
import { X, Send, Play, RefreshCw, Check, Loader2 } from 'lucide-react';

import { V2Surface, V2Button, V2Badge, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useRemoteCalibration } from '@/modules/linecall/hooks/useRemoteCalibration';
import CalibrationMarker from './CalibrationMarker';
import { t, fmtData } from '@/core/i18n';

const hora = (ms) => fmtData(ms, { timeStyle: 'short' });

/**
 * @param {{ host: string, cam: object|null, positionLabel: string, onClose: Function }} props
 *   `cam`: a câmera no ar (`line_cams`); `null` se ela saiu do ar
 */
export default function RemoteCalibration({ host, cam, positionLabel, onClose }) {
  const { user } = useAuth();
  const r = useRemoteCalibration(host, cam, user?.uid);
  const [mode, setMode] = useState(null);
  const pronta = r.calib.corners.length === 4;

  let corpo;
  if (!cam) {
    corpo = <p className="text-sm text-gray-600">{t('Esta câmera saiu do ar. Abra a página da câmera de novo no aparelho para calibrar daqui.')}</p>;
  } else if (r.error) {
    corpo = <V2ErrorState inline title={t('Calibrar pela central')} description={t('Não deu para falar com esta câmera. Confira a internet dos dois aparelhos e tente de novo.')} onRetry={r.pedirFoto} />;
  } else if (r.loading) {
    corpo = <V2Skeleton lines={3} />;
  } else if (r.missing) {
    corpo = <p className="text-sm text-gray-600">{t('Esta câmera ainda não mandou a imagem. Atualize a página da câmera no aparelho e deixe-a aberta.')}</p>;
  } else {
    corpo = (
      <div className="space-y-3">
        {r.still ? (
          <CalibrationMarker s={r} mode={mode} setMode={setMode} />
        ) : (
          <p className="flex items-center gap-2 rounded-2xl bg-paper p-3 text-sm text-ink" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('Esperando a imagem da câmera… Ela chega em alguns segundos se a câmera estiver com a página aberta.')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <V2Button type="button" disabled={!pronta || r.busy || !r.still} onClick={() => { setMode(null); r.send(true); }}>
            <Play className="mr-1.5 h-4 w-4" /> {t('Mandar e começar a analisar')}
          </V2Button>
          <V2Button type="button" variant="secondary" disabled={!pronta || r.busy || !r.still} onClick={() => { setMode(null); r.send(null); }}>
            <Send className="mr-1.5 h-4 w-4" /> {t('Só mandar a calibração')}
          </V2Button>
          <V2Button type="button" variant="ghost" onClick={r.pedirFoto}>
            <RefreshCw className="mr-1.5 h-4 w-4" /> {t('Pedir imagem nova')}
          </V2Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500" aria-live="polite">
          {r.snapMs && r.still && <span>{t('Imagem das {h}', { h: hora(r.snapMs) })}</span>}
          {r.state === 'waiting' && <V2Badge tone="amber">{t('Mandada. Esperando a câmera aplicar…')}</V2Badge>}
          {r.state === 'applied' && (
            <V2Badge tone="green"><Check className="mr-1 inline h-3 w-3" aria-hidden="true" />{t('A câmera aplicou a calibração')}</V2Badge>
          )}
          {r.state === 'applied' && Number.isFinite(cam.check_cm) && <span>{t('erro {n} cm', { n: String(cam.check_cm).replace('.', ',') })}</span>}
        </div>
        {r.state !== 'idle' && !r.still && (
          <p className="text-xs text-gray-500">{t('A imagem sai do banco a cada envio. Para conferir as linhas azuis sobre a quadra, peça uma imagem nova.')}</p>
        )}
      </div>
    );
  }

  return (
    <V2Surface className="space-y-3 p-4" data-dica="linhas-central-calibrar">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Calibrar pela central')}</p>
          <p className="text-base font-semibold text-ink">{positionLabel}{cam?.name ? ` · ${cam.name}` : ''}</p>
          <p className="text-sm text-gray-600">{t('Marque os pontos aqui, sobre a foto que a câmera mandou. A câmera não precisa de ninguém na tela dela.')}</p>
        </div>
        <V2Button type="button" size="sm" variant="ghost" onClick={onClose} aria-label={t('Fechar')}>
          <X className="h-4 w-4" />
        </V2Button>
      </div>
      {corpo}
    </V2Surface>
  );
}
