/**
 * CalibrationView — a imagem da câmera com a quadra desenhada por cima, ZOOM
 * e os controles da marcação DENTRO da imagem.
 *
 * · Zoom: pinça com dois dedos (que também arrasta), roda do mouse, botões
 *   + e −. Os pontos ficam guardados em pixels do VÍDEO, então o zoom não
 *   move ponto nenhum: eles ficam presos na quadra (`zoomMath.js`).
 * · Um dedo marca (ou, em "ajustar", arrasta um ponto). Para arrastar a
 *   imagem com um dedo há a mãozinha; sem nada para marcar, um dedo arrasta.
 * · A LUPA segue mostrando o ponto ampliado num canto (o dedo esconde o que
 *   está embaixo dele).
 * · Os avisos ficam numa faixa em cima, os botões embaixo e o zoom na lateral,
 *   longe do meio da imagem; dá para esconder tudo e para abrir em tela cheia.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Hand, Maximize2, Minimize2, Eye, EyeOff, Scan } from 'lucide-react';

import { applyHomography } from '@/modules/linecall/domain/homography';
import { COURT, courtSegments } from '@/modules/linecall/domain/court';
import { pickHeadline } from '@/modules/linecall/domain/fusion';
import CourtDiagram from './CourtDiagram';
import { CALL_COLOR } from './callLabels';
import { NO_ZOOM, MAX_ZOOM, pinchView, zoomAt, panView } from './zoomMath';
import { cn } from '@/core/lib/utils';
import { t } from '@/core/i18n';

const LOUPE = 132; // px na tela
const LOUPE_ZOOM = 4;
const GRAB_PX = 28; // distância, na tela, para pegar um ponto e arrastar
const STEP = 1.6; // quanto cada toque no + ou no − aproxima

/** Os botões sobre a imagem: o toque neles não marca ponto. */
const isUi = (ev) => Boolean(ev.target?.closest?.('[data-sobre-imagem]'));

function OverlayButton({ label, onClick, pressed, children, disabled }) {
  return (
    <button
      type="button"
      data-sobre-imagem=""
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg backdrop-blur transition-colors disabled:opacity-40',
        pressed ? 'bg-acid text-ink' : 'bg-black/60 hover:bg-black/75',
      )}
    >
      {children}
    </button>
  );
}

/**
 * @param {{ s: object, mode: string|null, onTap: Function, zone: object, hint: React.ReactNode,
 *   status?: React.ReactNode, toolbar?: React.ReactNode, diagram?: object }} props
 *   `diagram`: as props do mapa pequeno (`CourtDiagram`) no canto da imagem
 */
export default function CalibrationView({ s, mode, onTap, zone, hint, status, toolbar, diagram }) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const loupeRef = useRef(null);
  const [dims, setDims] = useState({ w: 16, h: 9 });
  const [press, setPress] = useState(null); // { x, y (vídeo), sx, sy (tela 0–1), drag?: index }
  const [view, setView] = useState(NO_ZOOM);
  const [hand, setHand] = useState(false);
  const [full, setFull] = useState(false);
  const [hidden, setHidden] = useState(false);
  const pointers = useRef(new Map());
  const gesture = useRef(null); // { kind: 'pinch'|'pan', start, from, d0 }
  const v = s.videoRef.current;
  const { w, h } = dims;
  const z = view.z;

  // O desenho: as linhas da calibração, a área vigiada, os pontos, a bola e o último lance.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !v?.videoWidth) return;
    // Redimensionar realoca o canvas (Full HD = 8 MB): só quando o vídeo muda de tamanho.
    if (cv.width !== v.videoWidth || cv.height !== v.videoHeight) { cv.width = v.videoWidth; cv.height = v.videoHeight; }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    // Com zoom, o traço afina na mesma conta: segue fino na tela e não cobre a linha.
    const lw = Math.max(2, cv.width / 400) / z;
    if (s.Hinv) {
      ctx.strokeStyle = 'rgba(56,189,248,0.9)';
      ctx.lineWidth = lw;
      courtSegments().forEach(([a, b]) => {
        const p = applyHomography(s.Hinv, a);
        const q = applyHomography(s.Hinv, b);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      });
      if (zone && zone.id !== 'full') {
        const quad = [[0, zone.y0], [COURT.WIDTH, zone.y0], [COURT.WIDTH, zone.y1], [0, zone.y1]]
          .map(([x, y]) => applyHomography(s.Hinv, { x, y }));
        ctx.strokeStyle = '#d4f82e';
        ctx.lineWidth = lw * 1.5;
        ctx.setLineDash([lw * 6, lw * 4]);
        ctx.beginPath();
        quad.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);
      }
      if (mode === 'check') {
        const cp = applyHomography(s.Hinv, s.checkPoint);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.setLineDash([lw * 3, lw * 3]);
        ctx.beginPath(); ctx.arc(cp.x, cp.y, lw * 12, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // O ponto é um anel com um pingo no centro: a linha embaixo dele continua à vista.
    ctx.font = `bold ${lw * 8}px sans-serif`;
    s.calib.corners.forEach((p, i) => {
      const r = lw * (mode === 'adjust' ? 7 : 5);
      ctx.strokeStyle = '#0b0f19';
      ctx.lineWidth = lw * 2.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#d4f82e';
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#d4f82e';
      ctx.beginPath(); ctx.arc(p.x, p.y, lw * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(String(i + 1), p.x + r + lw * 2, p.y - r);
    });
    if (s.calib.checkTap) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = lw;
      const c = s.calib.checkTap;
      ctx.beginPath(); ctx.moveTo(c.x - lw * 6, c.y); ctx.lineTo(c.x + lw * 6, c.y); ctx.moveTo(c.x, c.y - lw * 6); ctx.lineTo(c.x, c.y + lw * 6); ctx.stroke();
    }
    if (s.ball) {
      ctx.strokeStyle = '#d4f82e';
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.arc(s.ball.x, s.ball.y, lw * 6, 0, Math.PI * 2); ctx.stroke();
    }
    const last = pickHeadline(s.events);
    if (last?.imagePoint) {
      ctx.strokeStyle = CALL_COLOR[last.call] || '#fff';
      ctx.lineWidth = lw * 2;
      ctx.beginPath(); ctx.arc(last.imagePoint.x, last.imagePoint.y, lw * 10, 0, Math.PI * 2); ctx.stroke();
    }
  }, [v, dims, z, zone, s.Hinv, s.calib.corners, s.calib.checkTap, s.ball, s.events, s.checkPoint, mode]);

  // A lupa: o pedaço do vídeo em volta do dedo, ampliado, com a mira.
  useEffect(() => {
    const cv = loupeRef.current;
    if (!cv || !press || !v?.videoWidth) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = LOUPE * dpr;
    cv.height = LOUPE * dpr;
    const ctx = cv.getContext('2d');
    const r = v.getBoundingClientRect(); // já com o zoom: a lupa amplia o que a tela mostra
    const src = (LOUPE / LOUPE_ZOOM) * (v.videoWidth / r.width);
    ctx.drawImage(v, press.x - src / 2, press.y - src / 2, src, src, 0, 0, cv.width, cv.height);
    ctx.strokeStyle = '#d4f82e';
    ctx.lineWidth = 2 * dpr;
    const c = cv.width / 2;
    ctx.beginPath(); ctx.moveTo(c - 14 * dpr, c); ctx.lineTo(c + 14 * dpr, c); ctx.moveTo(c, c - 14 * dpr); ctx.lineTo(c, c + 14 * dpr); ctx.stroke();
  }, [press, v]);

  const box = () => viewportRef.current?.getBoundingClientRect() || { left: 0, top: 0, width: 1, height: 1 };
  const local = (ev) => { const r = box(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };

  /** Do dedo ao pixel do VÍDEO, pelo retângulo do desenho já com o zoom. */
  const toVideo = (ev) => {
    const r = canvasRef.current.getBoundingClientRect();
    const sx = (ev.clientX - r.left) / r.width;
    const sy = (ev.clientY - r.top) / r.height;
    return { x: sx * v.videoWidth, y: sy * v.videoHeight, sx, sy, scale: v.videoWidth / r.width };
  };

  const zoomBy = useCallback((factor, p) => {
    const r = viewportRef.current?.getBoundingClientRect();
    if (!r) return;
    setView((old) => zoomAt(old, factor, p || { x: r.width / 2, y: r.height / 2 }, r.width, r.height));
  }, []);

  // Roda do mouse: zoom em volta do cursor (o React não deixa cancelar a rolagem pelo onWheel).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (ev) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(ev.deltaY < 0 ? 1.15 : 1 / 1.15, { x: ev.clientX - r.left, y: ev.clientY - r.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // Tela cheia: Esc sai.
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (ev) => { if (ev.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);
  // Mudou o tamanho da janela (tela cheia, girar o celular): a imagem volta inteira.
  useEffect(() => { setView(NO_ZOOM); }, [full]);

  const panning = hand || !mode;

  const down = (ev) => {
    if (isUi(ev) || !v?.videoWidth) return;
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    pointers.current.set(ev.pointerId, local(ev));
    if (pointers.current.size === 2) {
      // Dois dedos: pinça. O ponto que estava sendo marcado é abandonado.
      setPress(null);
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', start: view, from: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
      return;
    }
    if (pointers.current.size > 2) return;
    if (panning) {
      if (z > 1) gesture.current = { kind: 'pan', start: view, from: local(ev) };
      return;
    }
    const p = toVideo(ev);
    let drag = null;
    if (mode === 'adjust') {
      const near = s.calib.corners
        .map((c, i) => ({ i, d: Math.hypot(c.x - p.x, c.y - p.y) / p.scale }))
        .sort((a, b) => a.d - b.d)[0];
      if (!near || near.d > GRAB_PX) return;
      drag = near.i;
    }
    setPress({ ...p, drag });
  };

  const move = (ev) => {
    if (!pointers.current.has(ev.pointerId)) return;
    pointers.current.set(ev.pointerId, local(ev));
    const g = gesture.current;
    const r = box();
    if (g?.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setView(pinchView(g.start, g.from, mid, Math.hypot(a.x - b.x, a.y - b.y) / g.d0, r.width, r.height));
      return;
    }
    if (g?.kind === 'pan') {
      const p = local(ev);
      setView(panView(g.start, p.x - g.from.x, p.y - g.from.y, r.width, r.height));
      return;
    }
    if (!press) return;
    const p = toVideo(ev);
    setPress((old) => ({ ...p, drag: old?.drag ?? null }));
    if (press.drag != null) s.moveCorner(press.drag, { x: p.x, y: p.y });
  };

  const up = (ev) => {
    pointers.current.delete(ev.pointerId);
    if (gesture.current) {
      // Fim da pinça só quando os dois dedos saem; o dedo que sobra não marca nada.
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    if (!press) return;
    const p = toVideo(ev);
    if (press.drag == null) onTap({ x: p.x, y: p.y });
    setPress(null);
  };

  const cancel = (ev) => {
    pointers.current.delete(ev.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    setPress(null);
  };

  // Janela estreita (celular em pé, fora da tela cheia): a imagem fica baixa
  // demais para levar a dica e os botões por cima — eles descem para logo
  // abaixo dela, e na imagem ficam só o zoom e a tela cheia.
  const [frameW, setFrameW] = useState(0);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setFrameW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const compact = frameW > 0 && frameW < 560;

  const loupeLeft = press ? press.sx > 0.5 : false;
  const ratio = `${w} / ${h}`;

  const hintBox = (hint || status) && (
    <div className="space-y-1">
      {hint && (
        <p
          className={cn('w-fit max-w-full rounded-xl px-3 py-1.5 text-sm', compact ? 'bg-paper text-ink' : 'bg-black/65 text-white backdrop-blur')}
          role="status"
        >
          {hint}
        </p>
      )}
      {status && <div data-sobre-imagem="" className="pointer-events-auto w-fit max-w-full">{status}</div>}
    </div>
  );

  return (
    <div className={cn(full ? 'fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-black p-2' : 'relative')}>
      <div
        ref={viewportRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        className={cn('relative touch-none select-none overflow-hidden bg-ink', full ? '' : 'w-full rounded-2xl')}
        style={full ? { aspectRatio: ratio, width: `min(100%, calc((100dvh - 1rem) * ${w} / ${h}))` } : { aspectRatio: ratio }}
      >
        <div
          className="absolute inset-0 origin-top-left"
          style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${z})` }}
        >
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
            aria-label={mode ? t('Imagem da câmera: toque para marcar') : t('Imagem da câmera')}
            className={cn('absolute inset-0 h-full w-full', mode && !panning ? 'cursor-crosshair' : z > 1 && 'cursor-grab')}
          />
        </div>

        {/* Por cima da imagem, nas bordas: nada aqui recebe o toque, só os botões. */}
        <div className="pointer-events-none absolute inset-0">
          {!compact && !hidden && hintBox && (
            <div className="absolute left-2 right-16 top-2">{hintBox}</div>
          )}

          {!compact && !hidden && diagram && (
            <div className="absolute bottom-2 left-2 w-14 rounded-lg bg-black/50 p-1 backdrop-blur">
              <CourtDiagram {...diagram} zone={zone} className="w-full text-white" />
            </div>
          )}

          <div className={cn('absolute right-2 flex gap-2', compact ? 'top-2 flex-row' : 'top-2 flex-col')}>
            {!compact && (
              <OverlayButton label={hidden ? t('Mostrar os controles') : t('Esconder os controles')} onClick={() => setHidden(!hidden)}>
                {hidden ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </OverlayButton>
            )}
            {!hidden && (
              <>
                <OverlayButton label={full ? t('Sair da tela cheia') : t('Tela cheia')} onClick={() => setFull(!full)}>
                  {full ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </OverlayButton>
                <OverlayButton label={t('Aproximar')} onClick={() => zoomBy(STEP)} disabled={z >= MAX_ZOOM}>
                  <ZoomIn className="h-5 w-5" />
                </OverlayButton>
                <OverlayButton label={t('Afastar')} onClick={() => zoomBy(1 / STEP)} disabled={z <= 1}>
                  <ZoomOut className="h-5 w-5" />
                </OverlayButton>
                {z > 1 && (
                  <OverlayButton label={t('Imagem inteira')} onClick={() => setView(NO_ZOOM)}>
                    <Scan className="h-5 w-5" />
                  </OverlayButton>
                )}
                {mode && (
                  <OverlayButton label={hand ? t('Voltar a marcar') : t('Arrastar a imagem com um dedo')} pressed={hand} onClick={() => setHand(!hand)}>
                    <Hand className="h-5 w-5" />
                  </OverlayButton>
                )}
              </>
            )}
          </div>

          {z > 1 && (
            <span className={cn('absolute rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white', compact ? 'left-2 top-2' : 'bottom-2 right-2')}>
              {`${String(Math.round(z * 10) / 10).replace('.', ',')}×`}
            </span>
          )}

          {!compact && !hidden && toolbar && (
            <div data-sobre-imagem="" className="pointer-events-auto absolute bottom-2 left-20 right-16 flex flex-wrap justify-center gap-2">
              {toolbar}
            </div>
          )}
        </div>

        {press && (
          <canvas
            ref={loupeRef}
            aria-hidden="true"
            style={{ width: LOUPE, height: LOUPE }}
            className={cn(
              'pointer-events-none absolute top-14 rounded-full border-2 border-acid shadow-lg',
              loupeLeft ? 'left-2' : 'right-16',
            )}
          />
        )}
      </div>
      {compact && (hintBox || toolbar) && (
        <div className={cn('mt-2 space-y-2', full && 'w-full max-w-xl')}>
          {hintBox}
          {toolbar && <div className="flex flex-wrap gap-2">{toolbar}</div>}
        </div>
      )}
    </div>
  );
}
