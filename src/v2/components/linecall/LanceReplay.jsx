/**
 * LanceReplay — o REPLAY de um lance, no aparelho que filmou: os quadros de
 * pouco antes a pouco depois do quique, em câmera lenta ou quadro a quadro,
 * com o rastro da bola, as linhas da quadra da calibração e o ponto do toque.
 * Ao lado, a marca ampliada (`CourtMark`).
 *
 * Teclado: ← e → passam quadro a quadro, espaço toca/pausa.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, Crosshair } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { V2Button, V2Badge } from '@/v2/ui/primitives';
import { applyHomography } from '@/modules/linecall/domain/homography';
import { courtSegments, nearestBoundary } from '@/modules/linecall/domain/court';
import { frameIndexAt } from '@/modules/linecall/domain/replay';
import CourtMark from './CourtMark';
import { CALL_COLOR, CALL_TONE, callLabel, callDetail } from './callLabels';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

const SPEEDS = [1, 0.5, 0.25, 0.1];

/** O desenho por cima do quadro: linhas, rastro até aqui, o toque. */
function useOverlay(canvasRef, { clip, index, Hinv, event }) {
  useEffect(() => {
    const cv = canvasRef.current;
    const f = clip?.frames[index];
    if (!cv || !f) return;
    const k = clip.scale;
    cv.width = Math.round(clip.vw * k);
    cv.height = Math.round(clip.vh * k);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const lw = Math.max(1.5, cv.width / 320);
    if (Hinv) {
      ctx.strokeStyle = 'rgba(56,189,248,0.55)';
      ctx.lineWidth = lw;
      courtSegments().forEach(([a, b]) => {
        const p = applyHomography(Hinv, a);
        const q = applyHomography(Hinv, b);
        ctx.beginPath(); ctx.moveTo(p.x * k, p.y * k); ctx.lineTo(q.x * k, q.y * k); ctx.stroke();
      });
    }
    // O rastro: as posições da bola até este quadro, cada vez mais fortes.
    const trail = clip.frames.slice(0, index + 1).filter((x) => x.ball);
    trail.forEach((x, i) => {
      ctx.fillStyle = `rgba(212,248,46,${0.25 + (0.75 * (i + 1)) / trail.length})`;
      ctx.beginPath(); ctx.arc(x.ball.x * k, x.ball.y * k, lw * 1.6, 0, Math.PI * 2); ctx.fill();
    });
    if (f.t >= clip.eventT && event.imagePoint) {
      ctx.strokeStyle = CALL_COLOR[event.call] || '#fff';
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath(); ctx.arc(event.imagePoint.x * k, event.imagePoint.y * k, lw * 7, 0, Math.PI * 2); ctx.stroke();
    }
  }, [canvasRef, clip, index, Hinv, event]);
}

/**
 * @param {{ event: object|null, Hinv: number[]|null, onClose: () => void }} props
 */
export default function LanceReplay({ event, Hinv, onClose }) {
  const clip = event?.clip || null;
  const hit = useMemo(() => (clip ? frameIndexAt(clip.frames, clip.eventT) : 0), [clip]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.25);
  const canvasRef = useRef(null);
  const n = clip?.frames.length || 0;

  // Abriu outro lance: volta ao começo e toca em câmera lenta.
  useEffect(() => { setIndex(0); setPlaying(true); }, [clip]);

  useEffect(() => {
    if (!playing || !n) return undefined;
    const f = clip.frames;
    const step = Math.max(10, ((f[Math.min(index + 1, n - 1)].t - f[index].t) * 1000) / speed || 33 / speed);
    const id = setTimeout(() => {
      if (index >= n - 1) setPlaying(false);
      else setIndex(index + 1);
    }, step);
    return () => clearTimeout(id);
  }, [playing, index, n, speed, clip]);

  useOverlay(canvasRef, { clip, index, Hinv, event });

  const go = (i) => { setPlaying(false); setIndex(Math.max(0, Math.min(n - 1, i))); };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
  };

  const kind = event?.type || event?.kind;
  const bounce = kind === 'bounce';
  const rally = bounce && event?.point && !event.serve && ['long', 'wide', undefined, null].includes(event.reason);
  const line = rally ? nearestBoundary(event.point).line : null;
  const f = clip?.frames[index];

  return (
    <Dialog open={Boolean(event)} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto" onKeyDown={onKey}>
        <DialogHeader>
          <DialogTitle>{t('Replay do lance')}</DialogTitle>
          <DialogDescription>
            {t('Câmera lenta e quadro a quadro. ← e → passam um quadro; espaço toca e pausa.')}
          </DialogDescription>
        </DialogHeader>
        {event && (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-3">
              {clip && f ? (
                <div className="relative w-full overflow-hidden rounded-2xl bg-ink" style={{ aspectRatio: `${clip.vw} / ${clip.vh}` }}>
                  <img src={f.url} alt={t('Quadro {i} de {n}', { i: index + 1, n })} className="absolute inset-0 h-full w-full" />
                  <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
                  <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-xs font-semibold text-white">
                    {t('{s} s', { s: (f.t - clip.eventT >= 0 ? '+' : '') + (f.t - clip.eventT).toFixed(2) })}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <img src={event.image} alt={callLabel(event)} className="w-full rounded-2xl" />
                  <p className="text-sm text-gray-500">{t('O replay deste lance não está mais guardado (o aparelho guarda só os mais recentes). Esta é a foto do momento.')}</p>
                </div>
              )}
              {clip && (
                <>
                  <input
                    type="range"
                    min={0}
                    max={n - 1}
                    value={index}
                    onChange={(e) => go(Number(e.target.value))}
                    aria-label={t('Posição no replay')}
                    className="w-full accent-ink"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <V2Button size="sm" variant="secondary" onClick={() => go(index - 1)} aria-label={t('Quadro anterior')}>
                      <ChevronLeft className="h-4 w-4" />
                    </V2Button>
                    <V2Button size="sm" onClick={() => { if (index >= n - 1) setIndex(0); setPlaying(!playing); }}>
                      {playing ? <><Pause className="mr-1.5 h-4 w-4" /> {t('Pausar')}</> : <><Play className="mr-1.5 h-4 w-4" /> {t('Tocar')}</>}
                    </V2Button>
                    <V2Button size="sm" variant="secondary" onClick={() => go(index + 1)} aria-label={t('Próximo quadro')}>
                      <ChevronRight className="h-4 w-4" />
                    </V2Button>
                    <V2Button size="sm" variant="ghost" onClick={() => go(hit)}>
                      <Crosshair className="mr-1.5 h-4 w-4" /> {bounce ? t('Ir ao quique') : t('Ir à batida')}
                    </V2Button>
                    <span className="flex items-center gap-1" role="group" aria-label={t('Velocidade')}>
                      {SPEEDS.map((s) => (
                        <button type="button"
                          key={s}
                          onClick={() => setSpeed(s)}
                          aria-pressed={speed === s}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-semibold coarse:min-h-11',
                            speed === s ? 'bg-ink text-white' : 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {s === 1 ? '1×' : `${String(s).replace('.', ',')}×`}
                        </button>
                      ))}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-3">
              <V2Badge tone={CALL_TONE[event.call]}>{callLabel(event)}</V2Badge>
              <p className="text-sm text-gray-600">{callDetail(event)}</p>
              <CourtMark
                kind={kind}
                call={event.call}
                marginM={bounce ? event.marginM : event.depthM}
                uncertaintyM={event.uncertaintyM}
                lineName={line}
                reason={event.reason}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
