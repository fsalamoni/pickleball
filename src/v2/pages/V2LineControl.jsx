/**
 * V2LineControl — a tela da CÂMERA do controle de linhas de um dia de jogo
 * (`/dia-de-jogo/:gameDayId/linhas`, flag `line_control`).
 *
 * Abre no aparelho que filma a quadra (celular no tripé, notebook com webcam
 * USB, computador com placa de captura): escolher a câmera → tocar nos quatro
 * cantos da quadra → tocar na bola para ensinar a cor → analisar. As
 * marcações aparecem aqui, com a foto do momento, e nada sai do aparelho.
 *
 * Quem abre é quem CONFIGURA o dia (criador, gestor da arena, admin do clube);
 * o jogo precisa estar com o controle ligado. Ver docs/53-CONTROLE-DE-LINHAS.md.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, Crosshair, Palette, Play, Pause, Trash2 } from 'lucide-react';

import {
  V2Page, V2PageHeader, V2Surface, V2Button, V2Badge, V2Select, V2ErrorState, V2EmptyState, V2Skeleton,
} from '@/v2/ui/primitives';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useWakeLock } from '@/core/lib/useWakeLock';
import { useGameDay, useUpdateGameDay } from '@/modules/games/hooks/useGameDays';
import { useGameDayRoles } from '@/modules/games/hooks/useGameDayRoles';
import { useLineCallSession } from '@/modules/linecall/hooks/useLineCallSession';
import { applyHomography } from '@/modules/linecall/domain/homography';
import { courtSegments } from '@/modules/linecall/domain/court';
import { CAMERA_LEVEL, CAMERA_MIN, CAMERA_GOOD } from '@/modules/linecall/domain/cameraCheck';
import { cn } from '@/core/lib/utils';
import { t, tk } from '@/core/i18n';

const CORNER_HINTS = [
  tk('Toque no canto do fundo do lado de LÁ, à esquerda.'),
  tk('Agora no canto do fundo de lá, à direita.'),
  tk('Agora no canto do fundo do lado da câmera, à direita.'),
  tk('Por fim, no canto do fundo do lado da câmera, à esquerda.'),
];

const CALL_LABEL = {
  bounce: { in: tk('Dentro'), out: tk('Fora'), review: tk('Revisar') },
  volley: { fault: tk('Falta: pé na cozinha'), clean: tk('Voleio sem falta'), review: tk('Revisar o pé') },
};
const CALL_TONE = { in: 'green', out: 'red', review: 'yellow', fault: 'red', clean: 'green' };
const CALL_COLOR = { in: '#16a34a', out: '#dc2626', review: '#ca8a04', fault: '#dc2626', clean: '#16a34a' };

const cm = (m) => Math.round(Math.abs(m) * 100);

function detailOf(e) {
  if (e.type === 'bounce') {
    return e.marginM >= 0
      ? t('{d} cm para dentro da linha (±{u} cm)', { d: cm(e.marginM), u: cm(e.uncertaintyM) })
      : t('{d} cm para fora da linha (±{u} cm)', { d: cm(e.marginM), u: cm(e.uncertaintyM) });
  }
  if (e.depthM == null) return t('Os pés ficaram fora da cozinha durante o voleio e o impulso.');
  return e.depthM >= 0
    ? t('Pé {d} cm dentro da cozinha (±{u} cm)', { d: cm(e.depthM), u: cm(e.uncertaintyM) })
    : t('Pé a {d} cm da linha da cozinha (±{u} cm)', { d: cm(e.depthM), u: cm(e.uncertaintyM) });
}

function cameraErrorText(code) {
  if (code === 'NotAllowedError') return t('O navegador não deixou usar a câmera. Permita o acesso à câmera para este site e tente de novo.');
  if (code === 'NotFoundError') return t('Nenhuma câmera encontrada. Conecte a câmera (USB ou placa de captura) e tente de novo.');
  if (code === 'OverconstrainedError') return t('Esta câmera não entrega o mínimo de quadros por segundo.');
  if (code === 'camera-unsupported') return t('Este navegador não dá acesso à câmera. Use o Chrome, o Edge ou o Safari atualizados.');
  return t('Não foi possível abrir a câmera.');
}

/** O vídeo com a quadra desenhada por cima; tocar marca cantos ou a cor da bola. */
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
    ctx.fillStyle = '#ccff00';
    ctx.font = `${lw * 8}px sans-serif`;
    s.calib.corners.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, lw * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(String(i + 1), p.x + lw * 4, p.y - lw * 4);
    });
    if (s.ball) {
      ctx.strokeStyle = '#ccff00';
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

function Requirements() {
  return (
    <V2Surface className="space-y-2 p-4 text-sm text-gray-600">
      <p className="font-semibold text-ink">{t('O que a câmera precisa')}</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>{t('Mínimo {f} quadros por segundo e {r}p; o bom é {f2} quadros e {r2}p (quanto mais quadros, menor a faixa de "revisar").', { f: CAMERA_MIN.fps, r: CAMERA_MIN.height, f2: CAMERA_GOOD.fps, r2: CAMERA_GOOD.height })}</li>
        <li>{t('Fixa num tripé, alta (3 a 6 m) e atrás do fundo da quadra, enxergando os quatro cantos. Mexeu a câmera, marque os cantos de novo.')}</li>
        <li>{t('Ligação: a câmera do próprio celular ou tablet, webcam USB, ou câmera de ação/filmadora por placa de captura HDMI-USB. Câmera Wi-Fi (IP/RTSP) só por um programa de ponte no computador, como o OBS. Bluetooth não transmite vídeo.')}</li>
        <li>{t('Luz boa e bola de cor viva. Para a linha da cozinha, a câmera precisa ver os pés de quem está na rede.')}</li>
      </ul>
    </V2Surface>
  );
}

function Session({ gameDayId }) {
  const s = useLineCallSession(gameDayId);
  const [deviceId, setDeviceId] = useState('');
  const [mode, setMode] = useState(null); // 'corners' | 'color' | null
  useWakeLock(Boolean(s.stream));

  const onTap = (pt) => {
    if (mode === 'color') { s.learnBallColor(pt); setMode(null); return; }
    s.addCorner(pt);
    if (s.calib.corners.length === 3) setMode(null);
  };
  const cornerStep = mode === 'corners' ? Math.min(s.calib.corners.length, 3) : null;
  const last = s.events[0];
  const bloqueada = s.cameraChecks.some((c) => c.level === CAMERA_LEVEL.BLOCK);

  return (
    <div className="space-y-4">
      <V2Surface className="flex flex-wrap items-end gap-2 p-4">
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
      </V2Surface>

      {s.cameraError && <V2ErrorState inline title={t('Câmera')} description={cameraErrorText(s.cameraError)} />}

      {s.stream && (
        <>
          <div className="flex flex-wrap gap-2">
            {s.cameraChecks.map((c) => (
              <V2Badge key={c.key} tone={c.level === CAMERA_LEVEL.OK ? 'green' : c.level === CAMERA_LEVEL.WARN ? 'yellow' : 'red'}>
                {c.key === 'fps'
                  ? t('{n} quadros/s', { n: c.value ? Math.round(c.value) : '?' })
                  : t('{n}p', { n: c.value || '?' })}
              </V2Badge>
            ))}
            {s.cmPerPixel != null && (
              <V2Badge tone={s.cmPerPixel <= 3 ? 'green' : 'yellow'}>
                {t('Fundo de lá: {n} cm por pixel', { n: s.cmPerPixel.toFixed(1) })}
              </V2Badge>
            )}
            {s.running && <V2Badge tone="neutral">{t('Analisando {n} quadros/s', { n: s.fps })}</V2Badge>}
            {s.running && s.poseState === 'loading' && <V2Badge tone="neutral">{t('Carregando o detector de pés…')}</V2Badge>}
            {s.poseState === 'failed' && <V2Badge tone="red">{t('Detector de pés indisponível: só dentro/fora')}</V2Badge>}
          </div>
          {bloqueada && (
            <p className="text-sm text-red-600">{t('Esta câmera está abaixo do mínimo. As marcações ficariam imprecisas demais; use outra câmera.')}</p>
          )}

          <CameraView s={s} mode={mode} onTap={onTap} />

          {mode && (
            <p className="rounded-xl bg-paper p-3 text-sm font-semibold text-ink" role="status">
              {mode === 'color' ? t('Toque na bola, parada no chão, para ensinar a cor dela.') : t(CORNER_HINTS[cornerStep])}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <V2Button variant="secondary" onClick={() => { s.resetCorners(); setMode('corners'); }}>
              <Crosshair className="mr-1.5 h-4 w-4" /> {s.H ? t('Marcar os cantos de novo') : t('Marcar os cantos da quadra')}
            </V2Button>
            <V2Button variant="ghost" onClick={() => setMode('color')}>
              <Palette className="mr-1.5 h-4 w-4" /> {t('Ensinar a cor da bola')}
            </V2Button>
            <V2Button disabled={!s.H || bloqueada} onClick={() => s.setRunning(!s.running)}>
              {s.running
                ? <><Pause className="mr-1.5 h-4 w-4" /> {t('Pausar')}</>
                : <><Play className="mr-1.5 h-4 w-4" /> {t('Começar a analisar')}</>}
            </V2Button>
          </div>
        </>
      )}

      {last && (
        <V2Surface className="p-4" aria-live="polite">
          <p className={cn('text-3xl font-black', last.call === 'out' || last.call === 'fault' ? 'text-red-600' : last.call === 'review' ? 'text-yellow-700' : 'text-green-700')}>
            {t(CALL_LABEL[last.type][last.call])}
          </p>
          <p className="text-sm text-gray-600">{detailOf(last)}</p>
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
                  <img src={e.image} alt={t(CALL_LABEL[e.type][e.call])} className="block w-full" />
                  {e.imagePoint && (
                    <span
                      className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                      style={{ left: `${(e.imagePoint.x * 100) / e.vw}%`, top: `${(e.imagePoint.y * 100) / e.vh}%`, borderColor: CALL_COLOR[e.call] }}
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <V2Badge tone={CALL_TONE[e.call]}>{t(CALL_LABEL[e.type][e.call])}</V2Badge>
                  <p className="mt-1 text-xs text-gray-500">{detailOf(e)}</p>
                </div>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}

      <Requirements />
    </div>
  );
}

export default function V2LineControl() {
  const { gameDayId } = useParams();
  const ligada = useFeatureFlag(FEATURE_FLAG.LINE_CONTROL);
  const consulta = useGameDay(ligada ? gameDayId : null);
  const gameDay = consulta.data;
  const { podeConfigurar } = useGameDayRoles(gameDay);
  const update = useUpdateGameDay();

  const header = (
    <V2PageHeader
      voltarPara={`/dia-de-jogo/${gameDayId}`}
      voltarLabel={t('Voltar ao dia de jogo')}
      title={t('Controle de linhas')}
      subtitle={gameDay?.title || t('Câmera, calibração da quadra e marcações')}
    />
  );

  let body;
  if (!ligada) {
    body = <V2EmptyState icon={Camera} title={t('Controle de linhas desligado')} description={t('Esta funcionalidade ainda não foi liberada na plataforma.')} />;
  } else if (consulta.isLoading) {
    body = <V2Skeleton lines={4} />;
  } else if (consulta.isError || !gameDay) {
    body = <V2ErrorState onRetry={consulta.refetch} />;
  } else if (!podeConfigurar) {
    body = <V2EmptyState icon={Camera} title={t('Só quem organiza liga a câmera')} description={t('O criador do dia de jogo (ou quem gere a arena ou o clube dele) abre o controle de linhas.')} />;
  } else if (gameDay.line_control !== true) {
    body = (
      <V2EmptyState
        icon={Camera}
        title={t('O controle de linhas está desligado neste jogo')}
        description={t('Ligue para usar a câmera. Pode ser com o jogo em andamento.')}
        action={<V2Button disabled={update.isPending} onClick={() => update.mutate({ id: gameDay.id, patch: { line_control: true } })}>{t('Ligar o controle de linhas')}</V2Button>}
      />
    );
  } else {
    body = <Session gameDayId={gameDay.id} />;
  }

  return (
    <V2Page className="space-y-4">
      {header}
      {body}
    </V2Page>
  );
}
