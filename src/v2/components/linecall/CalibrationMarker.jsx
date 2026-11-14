/**
 * CalibrationMarker — marcar os pontos da quadra sobre a imagem de UMA câmera:
 * a área vigiada, os quatro pontos (com zoom, lupa e ajuste fino), "Grudar na
 * linha", a conferência com o 5º ponto e o teste com a bola parada.
 *
 * O MESMO no aparelho que filma (sobre o vídeo) e na central (sobre a foto que
 * a câmera mandou, docs/53 §5d): `s` é a sessão da câmera
 * (`useLineCallSession`) ou a remota (`useRemoteCalibration`), as duas com a
 * conta de `useCalibration`. O modo (marcar, ajustar, conferir…) fica com
 * quem chama, porque ele também pausa a análise.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Crosshair, Move, Target, ScanSearch, Magnet } from 'lucide-react';

import { V2Button, V2Badge } from '@/v2/ui/primitives';
import { applyHomography } from '@/modules/linecall/domain/homography';
import { insideMargin, kitchenDepth, COURT_POINTS } from '@/modules/linecall/domain/court';
import { spotInView, viewSides, cameraViewRotation } from '@/modules/linecall/domain/cameraLayouts';
import { CAMERA_ZONES, zoneById } from '@/modules/linecall/domain/zones';
import { CHECK_LEVEL } from '@/modules/linecall/domain/calibrationCheck';
import CourtDiagram from './CourtDiagram';
import CalibrationView from './CalibrationView';
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
  N1: tk('o ponto onde a rede cruza a lateral do lado 1'),
  N2: tk('o ponto onde a rede cruza a lateral do lado 2'),
};
const CHECK_LABEL = {
  KTA: tk('o "T" onde a linha central encontra a linha da cozinha do lado A'),
  KTB: tk('o "T" onde a linha central encontra a linha da cozinha do lado B'),
  TA: tk('o meio da linha de fundo do lado A (onde começa a linha central)'),
  TB: tk('o meio da linha de fundo do lado B (onde começa a linha central)'),
};
const CHECK_TEXT = {
  [CHECK_LEVEL.GREAT]: tk('Ótima: erro de {n} cm.'),
  [CHECK_LEVEL.GOOD]: tk('Boa: erro de {n} cm. Dá para jogar; com ajuste fino fica melhor.'),
  [CHECK_LEVEL.REDO]: tk('Erro de {n} cm: ajuste os pontos (arrastando, com a lupa) ou marque de novo.'),
};
const CHECK_TONE = { [CHECK_LEVEL.GREAT]: 'green', [CHECK_LEVEL.GOOD]: 'amber', [CHECK_LEVEL.REDO]: 'red' };

/** O que a calibração diz do ponto tocado no teste com a bola. */
function inspectText(H, pt) {
  const g = applyHomography(H, pt);
  const m = insideMargin(g);
  const k = kitchenDepth(g);
  const cm = (x) => Math.round(Math.abs(x) * 100);
  const quadra = m >= 0
    ? t('{d} cm para dentro da quadra', { d: cm(m) })
    : t('{d} cm para fora da quadra', { d: cm(m) });
  const cozinha = k >= 0
    ? t('{d} cm dentro da cozinha', { d: cm(k) })
    : t('{d} cm fora da cozinha', { d: cm(k) });
  return `${quadra} · ${cozinha}`;
}

/**
 * @param {{ s: object, mode: string|null, setMode: Function, ready?: boolean, extra?: React.ReactNode }} props
 *   `ready`: a imagem já existe (câmera aberta / foto chegou); `extra`: botões a mais na barra
 */
export default function CalibrationMarker({ s, mode, setMode, ready = true, extra = null }) {
  // Resultado do "Grudar na linha" (quantos cantos andaram); mexer nos pontos de outro jeito o apaga.
  const [snapped, setSnapped] = useState(null);
  useEffect(() => { if (mode) setSnapped(null); }, [mode]);
  const [inspected, setInspected] = useState(null);

  const onTap = useCallback((pt) => {
    if (mode === 'color') { s.learnBallColor(pt); setMode(null); return; }
    if (mode === 'check') { s.setCheckTap(pt); setMode(null); return; }
    if (mode === 'inspect') { setInspected(pt); return; }
    s.addCorner(pt);
    if (s.calib.corners.length === 3) setMode('check');
  }, [mode, s, setMode]);

  const ids = s.targets.map((p) => p.id);
  const nextPoint = mode === 'corners' ? ids[Math.min(s.calib.corners.length, 3)] : null;
  const calibrada = Boolean(s.H);
  const posId = s.position.id;
  // O nome do ponto e ONDE ele aparece na imagem desta câmera ("longe, à direita").
  const where = (label, p) => {
    const spot = p && spotInView(posId, p);
    return spot ? `${t(label)} (${t(spot)})` : t(label);
  };
  const sides = viewSides(posId);

  let hint = null;
  if (mode === 'corners' && nextPoint) hint = t('Ponto {n} de 4: toque em {p}. Aproxime com dois dedos ou com o +; com zoom o ponto continua preso na quadra.', { n: s.calib.corners.length + 1, p: where(POINT_LABEL[nextPoint], COURT_POINTS[nextPoint]) });
  else if (mode === 'adjust') hint = t('Arraste um ponto amarelo para o lugar exato, olhando a lupa. Toque em "Pronto" ao terminar.');
  else if (mode === 'check') hint = t('Agora toque em {p}. É a prova de que a calibração está certa.', { p: where(CHECK_LABEL[s.checkPoint.id], s.checkPoint) });
  else if (mode === 'inspect') hint = t('Ponha a bola parada sobre uma linha e toque nela: a tela diz onde a calibração acha que ela está.');
  else if (mode === 'color') hint = t('Toque na bola, parada no chão.');
  else if (calibrada) hint = t('Calibrada. Confira se as linhas azuis caem em cima das linhas da quadra; se não, ajuste os pontos.');
  else hint = t('Toque nos quatro pontos, na ordem que o desenho mostra. Use a borda EXTERNA da linha.');

  const zona = zoneById(s.zone);
  // Os botões da marcação, sobre a imagem.
  const toolbar = mode && mode !== 'color' ? (
    <V2Button size="sm" onClick={() => { setMode(null); setInspected(null); }}>
      <Check className="mr-1.5 h-4 w-4" /> {t('Pronto')}
    </V2Button>
  ) : (
    <>
      <V2Button size="sm" variant={calibrada ? 'secondary' : 'primary'} onClick={() => { s.resetCorners(); setMode('corners'); }}>
        <Crosshair className="mr-1.5 h-4 w-4" /> {calibrada ? t('Marcar de novo') : t('Começar a marcar')}
      </V2Button>
      {calibrada && (
        <>
          <V2Button size="sm" variant="secondary" onClick={() => setMode('adjust')}>
            <Move className="mr-1.5 h-4 w-4" /> {t('Ajustar os pontos')}
          </V2Button>
          <V2Button size="sm" variant="secondary" onClick={() => setSnapped(s.snapCorners())}>
            <Magnet className="mr-1.5 h-4 w-4" /> {t('Grudar na linha')}
          </V2Button>
          <V2Button size="sm" variant={s.check ? 'secondary' : 'primary'} onClick={() => setMode('check')}>
            <Target className="mr-1.5 h-4 w-4" /> {s.check ? t('Conferir de novo') : t('Conferir com o 5º ponto')}
          </V2Button>
          <V2Button size="sm" variant="secondary" onClick={() => { setInspected(null); setMode('inspect'); }} data-dica="linhas-testar-bola">
            <ScanSearch className="mr-1.5 h-4 w-4" /> {t('Testar com a bola')}
          </V2Button>
        </>
      )}
      {extra}
    </>
  );
  // Os avisos da marcação, sobre a imagem (logo abaixo da dica).
  const status = (s.check || (mode === 'inspect' && inspected && s.H) || (snapped != null && !mode)) ? (
    <div className="space-y-1">
      {s.check && (
        <V2Badge tone={CHECK_TONE[s.check.level]}>{t(CHECK_TEXT[s.check.level], { n: String(s.check.cm).replace('.', ',') })}</V2Badge>
      )}
      {mode === 'inspect' && inspected && s.H && (
        <p className="rounded-xl bg-white/90 px-3 py-1.5 text-sm font-semibold text-ink" aria-live="polite">{inspectText(s.H, inspected)}</p>
      )}
      {snapped != null && !mode && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-white/90 px-3 py-1.5 text-sm text-ink" aria-live="polite">
          {snapped > 0
            ? t('{n} canto(s) da quadra foram para a borda de fora da linha. Confira com o 5º ponto.', { n: snapped })
            : t('Não achei a linha branca com certeza perto dos cantos: os pontos ficaram como estavam.')}
          {snapped > 0 && (
            <V2Button size="sm" variant="ghost" onClick={() => { s.undoSnap(); setSnapped(null); }}>
              {t('Desfazer')}
            </V2Button>
          )}
        </p>
      )}
    </div>
  ) : null;

  // O desenho fica como ESTA câmera vê a quadra (a lateral, deitada), com os pontos numerados.
  const diagram = {
    points: ids, current: nextPoint, done: ids.slice(0, s.calib.corners.length), view: posId, numbered: true,
    wide: cameraViewRotation(posId) % 180 !== 0,
    label: t('Os pontos da calibração no desenho da quadra, como esta câmera a vê'),
  };
  // Na lateral, cada área diz de que lado da imagem ela fica.
  const zoneLabel = (z) => {
    const lado = sides && (/_a$/.test(z.id) ? sides.A : /_b$/.test(z.id) ? sides.B : null);
    return lado ? `${t(z.label)} · ${lado === 'right' ? t('à direita') : t('à esquerda')}` : t(z.label);
  };

  return (
    <>
      {ready && (
        <fieldset className="space-y-2" data-dica="linhas-area">
          <legend className="text-xs font-semibold text-gray-500">{t('O que esta câmera vigia')}</legend>
          <div className="flex flex-wrap gap-2">
            {CAMERA_ZONES.map((z) => (
              <V2Button
                key={z.id}
                size="sm"
                variant={zona.id === z.id ? 'primary' : 'secondary'}
                aria-pressed={zona.id === z.id}
                onClick={() => { if (zona.id !== z.id) { s.setZone(z.id); setMode(null); } }}
              >
                {zoneLabel(z)}
              </V2Button>
            ))}
          </div>
          {sides && (
            <p className="text-xs font-semibold text-ink">
              {t('Desta câmera você olha a quadra de lado, a partir do {l}: o lado A fica à {a} da imagem e o lado B à {b}. Perto da câmera é o {l}; longe, o {o}.', {
                l: posId === 'rede_2' ? t('lado 2') : t('lado 1'),
                o: posId === 'rede_2' ? t('lado 1') : t('lado 2'),
                a: sides.A === 'right' ? t('direita') : t('esquerda'),
                b: sides.B === 'right' ? t('direita') : t('esquerda'),
              })}
            </p>
          )}
          <p className="text-xs text-gray-500">
            {zona.id === 'full'
              ? t('A câmera marca os lances da quadra toda.')
              : t('Você marca os quatro cantos só desta parte, e a câmera só marca lances que caem nela. O resto fica com as outras câmeras. Trocar a parte apaga os pontos marcados.')}
          </p>
        </fieldset>
      )}
      <div className={cn(!ready && 'hidden')}>
        {/* A imagem fica montada desde o início: o vídeo recebe a câmera assim que ela abre. */}
        <CalibrationView
          s={s}
          mode={mode}
          onTap={onTap}
          zone={zona}
          hint={ready ? hint : null}
          status={status}
          toolbar={ready ? toolbar : null}
          diagram={diagram}
        />
      </div>
      {ready && (
        <div className="flex items-start gap-3">
          <CourtDiagram
            {...diagram}
            positions={[posId]}
            active={posId}
            zone={zona}
            className={cn('shrink-0 text-ink', diagram.wide ? 'w-40' : 'w-24')}
          />
          <p className="text-xs text-gray-500">{t('Os botões e os avisos ficam sobre a imagem. Use a tela cheia para marcar com mais precisão.')}</p>
        </div>
      )}
    </>
  );
}
