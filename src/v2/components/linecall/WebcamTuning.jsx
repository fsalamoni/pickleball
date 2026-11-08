/**
 * WebcamTuning — o obturador da webcam e os quadros que ela ENTREGA de verdade
 * (`domain/webcamTuning.js`). Só aparece com câmera do aparelho (USB, celular);
 * a câmera IP chega pela ponte e não aceita esses ajustes.
 */

import React, { useEffect, useState } from 'react';
import { Aperture, Lock, Maximize } from 'lucide-react';

import { V2Button, V2Badge } from '@/v2/ui/primitives';
import {
  shutterOptions, shutterConstraints, deliveredFps, fpsShortfall, lockOptions, lockConstraints, wideZoom,
} from '@/modules/linecall/domain/webcamTuning';
import { t } from '@/core/i18n';

const lerStats = (track) => {
  const st = track?.stats;
  return st && Number.isFinite(st.deliveredFrames) ? { deliveredFrames: st.deliveredFrames, at: performance.now() } : null;
};

/** @param {{ stream: MediaStream, announcedFps?: number }} props */
export default function WebcamTuning({ stream, announcedFps }) {
  const track = stream?.getVideoTracks?.()[0];
  const [caps, setCaps] = useState(null);
  const [atual, setAtual] = useState(null); // id do tempo escolhido; null = automático
  const [erro, setErro] = useState(false);
  const [entregue, setEntregue] = useState(null);
  const [travado, setTravado] = useState(false);
  const [largo, setLargo] = useState(false);

  useEffect(() => {
    try { setCaps(track?.getCapabilities?.() || null); } catch { setCaps(null); }
    setAtual(null);
    setTravado(false);
    setLargo(false);
  }, [track]);

  // Mede os quadros que chegaram, de 2 em 2 segundos.
  useEffect(() => {
    if (!track) return undefined;
    let antes = lerStats(track);
    if (!antes) return undefined;
    const id = setInterval(() => {
      const agora = lerStats(track);
      const n = deliveredFps(antes, agora);
      if (n !== null) setEntregue(n);
      antes = agora;
    }, 2000);
    return () => clearInterval(id);
  }, [track]);

  const opcoes = shutterOptions(caps);
  const aplicar = async (step) => {
    setErro(false);
    try {
      await track.applyConstraints(shutterConstraints(step, caps));
      setAtual(step?.id || null);
    } catch {
      setErro(true);
    }
  };
  const curto = fpsShortfall(announcedFps, entregue);
  const trava = lockOptions(caps);
  const podeTravar = trava.focus || trava.color;
  const grande = wideZoom(caps);
  const mudar = async (constraints, ok) => {
    setErro(false);
    if (!constraints) return;
    try {
      await track.applyConstraints(constraints);
      ok();
    } catch {
      setErro(true);
    }
  };
  const travar = (on) => mudar(lockConstraints(caps, track?.getSettings?.(), on), () => setTravado(on));
  const angular = (on) => mudar({ advanced: [{ zoom: on ? grande : 1 }] }, () => setLargo(on));
  if (!opcoes.length && entregue === null && !podeTravar && grande === null) return null;

  return (
    <div className="space-y-2 rounded-2xl bg-paper p-3" data-dica="linhas-webcam-ajuste">
      {entregue !== null && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink" aria-live="polite">
          <V2Badge tone={curto ? 'amber' : 'green'}>{t('Chegando {n} quadros/s', { n: entregue })}</V2Badge>
          {curto && t('A câmera anuncia {a}, mas entrega {n}: falta luz (ela alonga a exposição). Acenda mais luz ou use um obturador mais curto.', { a: Math.round(announcedFps), n: entregue })}
        </p>
      )}
      {opcoes.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Aperture className="h-4 w-4" aria-hidden="true" /> {t('Obturador (bola nítida)')}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Obturador (bola nítida)')}>
            <V2Button type="button" size="sm" variant={atual === null ? 'primary' : 'secondary'} aria-pressed={atual === null} onClick={() => aplicar(null)}>
              {t('Automático')}
            </V2Button>
            {opcoes.map((o) => (
              <V2Button key={o.id} type="button" size="sm" variant={atual === o.id ? 'primary' : 'secondary'} aria-pressed={atual === o.id} onClick={() => aplicar(o)}>
                {o.label} s
              </V2Button>
            ))}
          </div>
          <p className="text-sm text-gray-500">{t('Mais curto deixa a bola nítida e escurece a imagem. Comece por 1/500 e confira se a quadra continua clara.')}</p>
        </div>
      )}
      {(podeTravar || grande !== null) && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {grande !== null && (
              <V2Button type="button" size="sm" variant={largo ? 'primary' : 'secondary'} aria-pressed={largo} onClick={() => angular(!largo)}>
                <Maximize className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {t('Grande-angular ({z}×)', { z: String(grande).replace('.', ',') })}
              </V2Button>
            )}
            {podeTravar && (
              <V2Button type="button" size="sm" variant={travado ? 'primary' : 'secondary'} aria-pressed={travado} onClick={() => travar(!travado)}>
                <Lock className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {travado ? t('Foco e cor travados') : t('Travar foco e cor')}
              </V2Button>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {t('Escolha a lente antes de calibrar (trocar depois desfaz a calibração). Com a quadra enquadrada e nítida, trave o foco e a cor: o foco automático mexe na imagem quando alguém passa perto da câmera.')}
          </p>
        </div>
      )}
      {erro && <p className="text-sm text-red-700" role="alert">{t('A câmera não aceitou esse ajuste.')}</p>}
    </div>
  );
}
