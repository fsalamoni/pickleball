/**
 * CameraStation — este aparelho como UMA câmera do jogo, numa posição.
 *
 * Passo a passo, na ordem em que se faz na quadra: posicionar → abrir a
 * câmera → marcar os quatro pontos (o desenho mostra qual tocar) → ensinar a
 * cor da bola → analisar. As marcações aparecem aqui, com a foto do momento
 * (a foto não sai do aparelho), e vão para a central sem imagem.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Camera, Crosshair, Palette, Play, Pause, Trash2, Check, Radio, AlertTriangle,
} from 'lucide-react';

import { V2Surface, V2Button, V2Badge, V2Select, V2ErrorState } from '@/v2/ui/primitives';
import { useWakeLock } from '@/core/lib/useWakeLock';
import { useLineCallSession } from '@/modules/linecall/hooks/useLineCallSession';
import { applyHomography } from '@/modules/linecall/domain/homography';
import { courtSegments } from '@/modules/linecall/domain/court';
import { CAMERA_LEVEL } from '@/modules/linecall/domain/cameraCheck';
import CourtDiagram from './CourtDiagram';
import PlacementGuide, { DeviceTips } from './PlacementGuide';
import { CALL_TONE, CALL_COLOR, CALL_TEXT, callLabel, callDetail } from './callLabels';
import { cn } from '@/core/lib/utils';
import { t, tk } from '@/core/i18n';

const POINT_LABEL = {
  A1: tk('o canto do fundo do lado A, no lado 1'),
  A2: tk('o canto do fundo do lado A, no lado 2'),
  B1: tk('o canto do fundo do lado B, no lado 1'),
  B2: tk('o canto do fundo do lado B, no lado 2'),
  KA1: tk('a ponta da linha da cozinha do lado A, no lado 1'),
  KA2: tk('a ponta da linha da cozinha do lado A, no lado 2'),
  KB1: tk('a ponta da linha da cozinha do lado B, no lado 1'),
  KB2: tk('a ponta da linha da cozinha do lado B, no lado 2'),
};

function cameraErrorText(code) {
  if (code === 'NotAllowedError') return t('O navegador não deixou usar a câmera. Permita o acesso à câmera para este site e tente de novo.');
  if (code === 'NotFoundError') return t('Nenhuma câmera encontrada. Conecte a câmera (USB ou placa de captura) e tente de novo.');
  if (code === 'OverconstrainedError') return t('Esta câmera não entrega o mínimo de quadros por segundo.');
  if (code === 'NotReadableError') return t('A câmera está em uso por outro aplicativo ou outra aba. Feche-o e tente de novo.');
  if (code === 'camera-unsupported') return t('Este navegador não dá acesso à câmera. Use o Chrome, o Edge ou o Safari atualizados.');
  return t('Não foi possível abrir a câmera.');
}

/** O vídeo com a quadra desenhada por cima; tocar marca os pontos ou a cor da bola. */
function CameraView({ s, mode, onTap }) {
  const canvasRef = useRef(null);
  // As dimensões chegam com o vídeo; guardá-las re-renderiza o desenho.
  const [dims, setDims] = useState({ w: 16, h: 9 });
  const v = s.videoRef.current;
  const { w, h } = dims;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !v?.videoWidth) return;
    cv.width = v.videoWidth;
    cv.height = v.videoHeight;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const lw = Math.max(2, cv.width / 400);
    if (s.Hinv) {
      ctx.strokeStyle = 'rgba(56,189,248,0.9)';
      ctx.lineWidth = lw;
      courtSegments().forEach(([a, b]) => {
        const p = applyHomography(s.Hinv, a);
        const q = applyHomography(s.Hinv, b);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      });
    }
    ctx.fillStyle = '#d4f82e';
    ctx.font = `${lw * 8}px sans-serif`;
    s.calib.corners.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, lw * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(String(i + 1), p.x + lw * 4, p.y - lw * 4);
    });
    if (s.ball) {
      ctx.strokeStyle = '#d4f82e';
      ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, lw * 6, 0, Math.PI * 2); ctx.stroke();
    }
    const last = s.events[0];
    if (last?.imagePoint) {
      ctx.strokeStyle = CALL_COLOR[last.call] || '#fff';
      ctx.lineWidth = lw * 2;
      ctx.beginPath(); ctx.arc(last.imagePoint.x, last.imagePoint.y, lw * 10, 0, Math.PI * 2); ctx.stroke();
    }
  }, [v, dims, s.Hinv, s.calib.corners, s.ball, s.events]);

  const tap = (ev) => {
    if (!mode || !v?.videoWidth) return;
    const r = ev.currentTarget.getBoundingClientRect();
    onTap({ x: ((ev.clientX - r.left) / r.width) * v.videoWidth, y: ((ev.clientY - r.top) / r.height) * v.videoHeight });
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-ink" style={{ aspectRatio: `${w} / ${h}` }}>
      <video
        ref={s.videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={(e) => setDims({ w: e.currentTarget.videoWidth || 16, h: e.currentTarget.videoHeight || 9 })}
        className="absolute inset-0 h-full w-full"
      />
      <canvas
        ref={canvasRef}
        onPointerDown={tap}
        aria-label={mode ? t('Imagem da câmera: toque para marcar') : t('Imagem da câmera')}
        className={cn('absolute inset-0 h-full w-full', mode && 'cursor-crosshair')}
      />
    </div>
  );
}

function Step({ n, done, active, title, children }) {
  return (
    <li className={cn('flex gap-3', !active && !done && 'opacity-60')}>
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          done ? 'bg-green-600 text-white' : active ? 'bg-acid text-ink' : 'bg-gray-100 text-gray-500',
        )}
        aria-hidden="true"
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2 pb-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * @param {{ gameDayId: string, position: string, layout: string, layoutPositions: string[] }} props
 */
export default function CameraStation({ gameDayId, position, layout, layoutPositions }) {
  const s = useLineCallSession(gameDayId, position, { layout });
  const [deviceId, setDeviceId] = useState('');
  const [mode, setMode] = useState(null); // 'corners' | 'color' | null
  useWakeLock(Boolean(s.stream));

  const onTap = (pt) => {
    if (mode === 'color') { s.learnBallColor(pt); setMode(null); return; }
    s.addCorner(pt);
    if (s.calib.corners.length === 3) setMode(null);
  };
  const ids = s.targets.map((p) => p.id);
  const nextPoint = mode === 'corners' ? ids[Math.min(s.calib.corners.length, 3)] : null;
  const last = s.events[0];
  const bloqueada = s.cameraChecks.some((c) => c.level === CAMERA_LEVEL.BLOCK);
  const calibrada = Boolean(s.H);

  return (
    <div className="space-y-4">
      <V2Surface
        collapsible
        collapseId="linhas-posicionar"
        title={t('Como posicionar esta câmera')}
        description={t(s.position.label)}
        className="p-4"
      >
        <div className="space-y-4">
          <PlacementGuide position={s.position.id} layoutPositions={layoutPositions} />
          <DeviceTips />
        </div>
      </V2Surface>

      <V2Surface className="space-y-4 p-4">
        <ol className="space-y-4">
          <Step n={1} done={Boolean(s.stream)} active={!s.stream} title={t('Abra a câmera')}>
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-xs font-semibold text-gray-500">
                {t('Câmera')}
                <V2Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="mt-1">
                  <option value="">{t('Câmera traseira / padrão')}</option>
                  {s.cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </V2Select>
              </label>
              <V2Button onClick={() => s.start(deviceId || undefined)}>
                <Camera className="mr-1.5 h-4 w-4" /> {s.stream ? t('Trocar câmera') : t('Abrir câmera')}
              </V2Button>
            </div>
            {s.stream && (
              <div className="flex flex-wrap gap-2">
                {s.cameraChecks.map((c) => (
                  <V2Badge key={c.key} tone={c.level === CAMERA_LEVEL.OK ? 'green' : c.level === CAMERA_LEVEL.WARN ? 'amber' : 'red'}>
                    {c.key === 'fps'
                      ? t('{n} quadros/s', { n: c.value ? Math.round(c.value) : '?' })
                      : t('{n}p', { n: c.value || '?' })}
                  </V2Badge>
                ))}
                {s.cmPerPixel != null && (
                  <V2Badge tone={s.cmPerPixel <= 3 ? 'green' : 'amber'}>
                    {t('Ponto mais longe: {n} cm por pixel', { n: s.cmPerPixel.toFixed(1) })}
                  </V2Badge>
                )}
              </div>
            )}
            {bloqueada && (
              <p className="text-sm text-red-600">{t('Esta câmera está abaixo do mínimo. As marcações ficariam imprecisas demais; use outra câmera.')}</p>
            )}
          </Step>

          <Step n={2} done={calibrada} active={Boolean(s.stream) && !calibrada} title={t('Marque os quatro pontos da quadra')}>
            {s.stream && (
              <>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,120px)_1fr] sm:items-start">
                  <CourtDiagram
                    positions={[s.position.id]}
                    active={s.position.id}
                    points={ids}
                    current={nextPoint}
                    done={ids.slice(0, s.calib.corners.length)}
                    className="mx-auto w-full max-w-[120px] text-ink"
                    label={t('Os pontos da calibração no desenho da quadra')}
                  />
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600" role="status">
                      {mode === 'corners' && nextPoint
                        ? t('Toque, na imagem, em {p} (o ponto piscando no desenho).', { p: t(POINT_LABEL[nextPoint]) })
                        : calibrada
                          ? t('Calibrada. Confira se as linhas azuis caem em cima das linhas da quadra; se não, marque de novo.')
                          : t('Toque nos quatro pontos, na ordem que o desenho mostra. Use a borda EXTERNA da linha.')}
                    </p>
                    <V2Button variant={calibrada ? 'secondary' : 'primary'} onClick={() => { s.resetCorners(); setMode('corners'); }}>
                      <Crosshair className="mr-1.5 h-4 w-4" /> {calibrada ? t('Marcar de novo') : t('Começar a marcar')}
                    </V2Button>
                  </div>
                </div>
              </>
            )}
          </Step>

          <Step n={3} done={Boolean(s.calib.hueSet)} active={calibrada && !s.calib.hueSet} title={t('Ensine a cor da bola (opcional)')}>
            {calibrada && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">{mode === 'color' ? t('Toque na bola, parada no chão.') : t('Já vem pronta para bola amarela/verde-limão. Com outra cor, toque na bola parada.')}</p>
                <V2Button variant="ghost" onClick={() => setMode('color')}>
                  <Palette className="mr-1.5 h-4 w-4" /> {t('Ensinar a cor da bola')}
                </V2Button>
              </div>
            )}
          </Step>

          <Step n={4} done={false} active={calibrada} title={t('Analise o jogo')}>
            {calibrada && (
              <div className="flex flex-wrap items-center gap-2">
                <V2Button disabled={bloqueada} onClick={() => s.setRunning(!s.running)}>
                  {s.running
                    ? <><Pause className="mr-1.5 h-4 w-4" /> {t('Pausar')}</>
                    : <><Play className="mr-1.5 h-4 w-4" /> {t('Começar a analisar')}</>}
                </V2Button>
                {s.running && <V2Badge tone="neutral">{t('Analisando {n} quadros/s', { n: s.fps })}</V2Badge>}
                {s.running && s.poseState === 'loading' && <V2Badge tone="neutral">{t('Carregando o detector de pés…')}</V2Badge>}
                {s.poseState === 'failed' && <V2Badge tone="red">{t('Detector de pés indisponível: só dentro/fora')}</V2Badge>}
                {s.poseState === 'off' && <V2Badge tone="neutral">{t('Câmera de cima: só dentro/fora')}</V2Badge>}
                {s.stream && !s.shareError && <V2Badge tone="green"><Radio className="mr-1 inline h-3 w-3" aria-hidden="true" />{t('Ligada à central')}</V2Badge>}
                {s.shareError && <V2Badge tone="amber"><AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" />{t('Sem conexão com a central: as marcações ficam só aqui')}</V2Badge>}
              </div>
            )}
          </Step>
        </ol>
      </V2Surface>

      {s.cameraError && <V2ErrorState inline title={t('Câmera')} description={cameraErrorText(s.cameraError)} />}

      {/* O vídeo fica montado desde o início: o elemento recebe a câmera assim que ela abre. */}
      <div className={cn(!s.stream && 'hidden')}>
        <CameraView s={s} mode={mode} onTap={onTap} />
      </div>

      {last && (
        <V2Surface className="p-4" aria-live="polite">
          <p className={cn('text-3xl font-black', CALL_TEXT[last.call])}>{callLabel(last)}</p>
          <p className="text-sm text-gray-600">{callDetail(last)}</p>
        </V2Surface>
      )}

      {s.events.length > 0 && (
        <V2Surface className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">{t('Marcações deste aparelho')}</p>
            <V2Button size="sm" variant="ghost" onClick={s.clearEvents}>
              <Trash2 className="mr-1.5 h-4 w-4" /> {t('Limpar')}
            </V2Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {s.events.map((e, i) => (
               
              <li key={`${e.at}-${i}`} className="flex gap-3">
                <div className="relative w-32 shrink-0 overflow-hidden rounded-lg">
                  <img src={e.image} alt={callLabel(e)} className="block w-full" />
                  {e.imagePoint && (
                    <span
                      className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                      style={{ left: `${(e.imagePoint.x * 100) / e.vw}%`, top: `${(e.imagePoint.y * 100) / e.vh}%`, borderColor: CALL_COLOR[e.call] }}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <V2Badge tone={CALL_TONE[e.call]}>{callLabel(e)}</V2Badge>
                  <p className="mt-1 text-xs text-gray-500">{callDetail(e)}</p>
                </div>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}
    </div>
  );
}
