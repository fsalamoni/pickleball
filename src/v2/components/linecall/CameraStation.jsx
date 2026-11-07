/**
 * CameraStation — este aparelho como UMA câmera do jogo, numa posição.
 *
 * Passo a passo, na ordem em que se faz na quadra: posicionar → abrir a
 * câmera → marcar os quatro pontos (com lupa, e ajuste fino arrastando) →
 * conferir com um 5º ponto → ensinar a cor da bola → analisar. Dá para testar
 * a calibração com a bola parada em cima da linha antes de começar.
 *
 * Cada marcação aparece aqui com o REPLAY do lance (câmera lenta, quadro a
 * quadro), que não sai do aparelho; para a central vai só a marcação.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera, Crosshair, Palette, Play, Pause, Trash2, Check, Radio, AlertTriangle,
  Move, Target, ScanSearch, Volume2, VolumeX, Film, BatteryLow, Magnet,
  Bell, BellOff,
} from 'lucide-react';

import { V2Surface, V2Button, V2Badge, V2Select, V2Input, V2ErrorState } from '@/v2/ui/primitives';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { parseBridgeUrl, IP_BRIDGE_EXAMPLE } from '@/modules/linecall/domain/ipCamera';
import { useWakeLock } from '@/core/lib/useWakeLock';
import { useLineCallSession } from '@/modules/linecall/hooks/useLineCallSession';
import { useAnnounce, canSpeak, speak } from '@/modules/linecall/hooks/useAnnounce';
import { applyHomography } from '@/modules/linecall/domain/homography';
import { insideMargin, kitchenDepth } from '@/modules/linecall/domain/court';
import { CAMERA_ZONES, zoneById } from '@/modules/linecall/domain/zones';
import { CAMERA_LEVEL } from '@/modules/linecall/domain/cameraCheck';
import { cameraSource, CAMERA_SOURCE_TIP } from '@/modules/linecall/domain/setupKits';
import { CHECK_LEVEL } from '@/modules/linecall/domain/calibrationCheck';
import { pickHeadline } from '@/modules/linecall/domain/fusion';
import { hasReplay } from '@/modules/linecall/domain/replay';
import { stationCheck, STATION_NEXT } from '@/modules/linecall/domain/stationCheck';
import CourtDiagram from './CourtDiagram';
import IpBridgeWizard from './IpBridgeWizard';
import CalibrationView from './CalibrationView';
import PlacementGuide, { DeviceTips } from './PlacementGuide';
import LanceReplay from './LanceReplay';
import CallFlash from './CallFlash';
import { CALL_TONE, CALL_COLOR, CALL_TEXT, callLabel, callDetail, callSpoken } from './callLabels';
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

function cameraErrorText(code) {
  if (code === 'NotAllowedError') return t('O navegador não deixou usar a câmera. Permita o acesso à câmera para este site e tente de novo.');
  if (code === 'NotFoundError') return t('Nenhuma câmera encontrada. Conecte a câmera (USB ou placa de captura) e tente de novo.');
  if (code === 'OverconstrainedError') return t('Esta câmera não entrega o mínimo de quadros por segundo.');
  if (code === 'NotReadableError') return t('A câmera está em uso por outro aplicativo ou outra aba. Feche-o e tente de novo.');
  if (code === 'camera-unsupported') return t('Este navegador não dá acesso à câmera. Use o Chrome, o Edge ou o Safari atualizados.');
  if (code === 'ip-unreachable') return t('A ponte não respondeu. Confira se a go2rtc está aberta e o endereço está certo. Se o Chrome perguntou sobre a rede local, permita. No iPhone e no Safari, use um computador com o Chrome.');
  if (code === 'ip-refused') return t('A ponte respondeu, mas não conhece essa câmera. Confira o nome da câmera no fim do endereço (src=…).');
  if (code === 'ip-no-video') return t('A ponte conectou, mas o vídeo não chegou. Confira se a câmera está ligada e manda H.264.');
  return t('Não foi possível abrir a câmera.');
}

const IP_ERROR = {
  'ip-url-invalid': tk('Esse não é um endereço válido. Exemplo: {ex}'),
  'ip-rtsp': tk('Esse é o endereço da câmera (rtsp). Ele vai no arquivo da ponte; aqui vai o endereço da ponte. Exemplo: {ex}'),
  'ip-credentials': tk('Tire o usuário e a senha do endereço: eles ficam só no arquivo da ponte, no computador da arena.'),
};
const IP_OPTION = '__ip__';
const IP_PREF = 'linhas:camera-ip:ponte';
/** A última câmera aberta neste aparelho (id do sistema, `padrao` ou a ponte). */
const LAST_PREF = 'linhas:camera:ultima';

/** A câmera já foi permitida para este site? (sem perguntar nada à pessoa) */
async function cameraPermitida() {
  try {
    const st = await navigator.permissions?.query?.({ name: 'camera' });
    return st?.state === 'granted';
  } catch { return false; }
}

const NEXT_TEXT = {
  [STATION_NEXT.OPEN]: { title: tk('Abra a câmera'), text: tk('Escolha a câmera e toque em "Abrir câmera". O navegador pede permissão na primeira vez.'), action: tk('Abrir câmera') },
  [STATION_NEXT.CAMERA]: { title: tk('Troque de câmera'), text: tk('Esta câmera entrega menos do que o mínimo (30 quadros/s e 720p). Escolha outra na lista.'), action: null },
  [STATION_NEXT.MARK]: { title: tk('Marque os quatro pontos da quadra'), text: tk('Toque nos cantos na ordem do desenho, na borda de fora da linha. Leva cerca de um minuto.'), action: tk('Começar a marcar') },
  [STATION_NEXT.REMARK]: { title: tk('Marque os pontos de novo'), text: tk('A calibração não confere com a quadra (a câmera mexeu ou o erro passou de 6 cm).'), action: tk('Marcar de novo') },
  [STATION_NEXT.CHECK]: { title: tk('Confira com o 5º ponto'), text: tk('Um toque a mais diz o erro da calibração em centímetros. Sem isso ninguém sabe se a câmera mede certo.'), action: tk('Conferir agora') },
  [STATION_NEXT.START]: { title: tk('Tudo pronto: comece a analisar'), text: tk('A câmera passa a marcar os lances e a mandar para a central.'), action: tk('Começar a analisar') },
};
const ITEM_TEXT = {
  camera: tk('Câmera'), moved: tk('A câmera saiu do lugar'), calibration: tk('Calibração'), far: tk('Fundo longe demais (mais de 3 cm por pixel)'),
  analysis: tk('Análise'), pose: tk('Detector de pés'), light: tk('Luz'), battery: tk('Bateria'), central: tk('Ligação com a central'),
};
const LEVEL_TONE = { ok: 'green', todo: 'neutral', warn: 'amber', block: 'red' };
const LEVEL_TEXT = { ok: tk('ok'), todo: tk('falta'), warn: tk('atenção'), block: tk('resolver') };
function Step({ n, done, active, title, children, dica }) {
  return (
    <li className={cn('flex gap-3', !active && !done && 'opacity-60')} data-dica={dica}>
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
 * @param {{ gameDayId: string, position: string, layout: string, layoutPositions: string[] }} props
 */
export default function CameraStation({ gameDayId, position, layout, layoutPositions, sink = null }) {
  const s = useLineCallSession(gameDayId, position, { layout, sink });
  const { user: conta } = useAuth();
  // A câmera convidada (sem conta) guarda as preferências deste aparelho no escopo dela.
  const user = sink ? { uid: sink.uid } : conta;
  const [deviceId, setDeviceId] = useState('');
  // Câmera IP: o endereço da ponte fica só neste aparelho (nunca no banco).
  const [ponte, setPonte] = useState(() => readViewPreference(user?.uid, IP_PREF) || IP_BRIDGE_EXAMPLE);
  const [ponteErro, setPonteErro] = useState(null);
  const [assistente, setAssistente] = useState(false);
  const abrir = (escolha = deviceId) => {
    writeViewPreference(user?.uid, LAST_PREF, escolha || 'padrao');
    if (escolha !== IP_OPTION) { s.start(escolha || undefined); return; }
    const r = parseBridgeUrl(ponte);
    setPonteErro(r.ok ? null : r.error);
    if (!r.ok) return;
    writeViewPreference(user?.uid, IP_PREF, r.url);
    s.start(r);
  };
  const [mode, setMode] = useState(null); // 'corners' | 'adjust' | 'check' | 'inspect' | 'color' | null

  // Quem volta a esta posição já calibrada e com a câmera permitida não
  // repete nada: a mesma câmera reabre sozinha e falta só "Começar a analisar".
  const reabriu = useRef(false);
  useEffect(() => {
    if (reabriu.current || s.stream || s.calib.corners.length !== 4) return undefined;
    reabriu.current = true;
    const ultima = readViewPreference(user?.uid, LAST_PREF);
    if (!ultima) return undefined;
    let vivo = true;
    cameraPermitida().then((ok) => {
      if (!vivo || !ok) return;
      const escolha = ultima === 'padrao' ? '' : ultima;
      setDeviceId(escolha);
      abrir(escolha);
    });
    return () => { vivo = false; };
  }, [s.calib.corners.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Câmera aberta e nada marcado: já entra na marcação (um toque a menos).
  const abriuAgora = useRef(null);
  useEffect(() => {
    if (!s.stream || abriuAgora.current === s.stream) return;
    abriuAgora.current = s.stream;
    if (s.calib.corners.length === 0 && !mode) setMode('corners');
  }, [s.stream]); // eslint-disable-line react-hooks/exhaustive-deps
  // Resultado do "Grudar na linha" (quantos cantos andaram); mexer nos pontos de outro jeito o apaga.
  const [snapped, setSnapped] = useState(null);
  useEffect(() => { if (mode) setSnapped(null); }, [mode]);
  const [inspected, setInspected] = useState(null);
  const [replay, setReplay] = useState(null);
  useWakeLock(Boolean(s.stream));
  // O lance grande é o mais grave dos últimos segundos (a mesma regra da central e do telão).
  const last = pickHeadline(s.events);
  // Ao lado da quadra, só a falta grita: "revisar" não interrompe o ponto.
  const [falar, setFalar, som, setSom, aviso] = useAnnounce(s.events, callSpoken, 'linhas:voz:camera', { quietReview: true });

  const onTap = useCallback((pt) => {
    if (mode === 'color') { s.learnBallColor(pt); setMode(null); return; }
    if (mode === 'check') { s.setCheckTap(pt); setMode(null); return; }
    if (mode === 'inspect') { setInspected(pt); return; }
    s.addCorner(pt);
    if (s.calib.corners.length === 3) setMode('check');
  }, [mode, s]);

  const ids = s.targets.map((p) => p.id);
  const nextPoint = mode === 'corners' ? ids[Math.min(s.calib.corners.length, 3)] : null;
  const bloqueada = s.cameraChecks.some((c) => c.level === CAMERA_LEVEL.BLOCK);
  // A dica pela FONTE da câmera (OBS, NDI, celular sem fio, captura), pelo nome que o sistema dá a ela.
  const nomeCamera = s.stream?.getVideoTracks?.()[0]?.label || s.cameras.find((c) => c.id === deviceId)?.label || '';
  const fonteDica = CAMERA_SOURCE_TIP[cameraSource(nomeCamera)];
  const calibrada = Boolean(s.H);
  const baixaBateria = Number.isFinite(s.battery.level) && s.battery.level <= 20 && s.battery.charging === false;
  const lento = s.running && s.fps > 0 && s.fps < 24;
  const mexeu = s.running && s.health?.moved;
  // A câmera saiu do lugar: avisa em voz (se a voz está ligada) e vibra, uma vez.
  useEffect(() => {
    if (!mexeu) return;
    if (falar) speak(t('A câmera saiu do lugar'));
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ }
  }, [mexeu, falar]);

  // Pausar ao mexer na calibração: análise com pontos mudando mede errado.
  useEffect(() => { if (mode && mode !== 'inspect' && mode !== 'color') s.setRunning(false); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // O diagnóstico deste aparelho e a UMA coisa a fazer agora (`domain/stationCheck.js`).
  const diag = stationCheck({
    hasStream: Boolean(s.stream), cameraChecks: s.cameraChecks, calibrated: calibrada, checkLevel: s.check?.level || null,
    cmPerPixel: s.cmPerPixel, running: s.running, fps: s.fps, frameMs: s.frameMs, moved: mexeu, dark: s.health?.dark,
    battery: s.battery, shareError: s.shareError, usesPose: s.position.usesPose, poseState: s.poseState,
  });
  const fazerProximo = () => {
    if (diag.next === STATION_NEXT.OPEN) abrir();
    else if (diag.next === STATION_NEXT.MARK || diag.next === STATION_NEXT.REMARK) { s.setRunning(false); s.resetCorners(); setMode('corners'); }
    else if (diag.next === STATION_NEXT.CHECK) setMode('check');
    else if (diag.next === STATION_NEXT.START) { setMode(null); s.setRunning(true); }
  };
  const proximo = diag.next ? NEXT_TEXT[diag.next] : null;

  let hint = null;
  if (mode === 'corners' && nextPoint) hint = t('Ponto {n} de 4: toque em {p}. Aproxime com dois dedos ou com o +; com zoom o ponto continua preso na quadra.', { n: s.calib.corners.length + 1, p: t(POINT_LABEL[nextPoint]) });
  else if (mode === 'adjust') hint = t('Arraste um ponto amarelo para o lugar exato, olhando a lupa. Toque em "Pronto" ao terminar.');
  else if (mode === 'check') hint = t('Agora toque em {p}. É a prova de que a calibração está certa.', { p: t(CHECK_LABEL[s.checkPoint.id]) });
  else if (mode === 'inspect') hint = t('Ponha a bola parada sobre uma linha e toque nela: a tela diz onde a calibração acha que ela está.');
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

  return (
    <div className="space-y-4">
      <CallFlash latest={s.running ? aviso : null} />
      <V2Surface
        collapsible
        collapseId="linhas-posicionar"
        title={t('Como posicionar esta câmera')}
        description={t(s.position.label)}
        className="p-4"
        data-dica="linhas-posicionar"
      >
        <div className="space-y-4">
          <PlacementGuide position={s.position.id} layoutPositions={layoutPositions} />
          <DeviceTips />
        </div>
      </V2Surface>

      <V2Surface className="space-y-3 p-4" aria-live="polite" data-dica="linhas-proximo-passo">
        {proximo ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Próximo passo')}</p>
              <p className="text-base font-semibold text-ink">{t(proximo.title)}</p>
              <p className="text-sm text-gray-600">{t(proximo.text)}</p>
            </div>
            {proximo.action && !(diag.next === STATION_NEXT.START && bloqueada) && !(diag.next === STATION_NEXT.MARK && mode === 'corners') && (
              <V2Button type="button" onClick={fazerProximo}>{t(proximo.action)}</V2Button>
            )}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-base font-semibold text-ink">
            <Check className="h-5 w-5 text-green-600" aria-hidden="true" />
            {diag.ready ? t('Câmera pronta e analisando') : t('Câmera analisando')}
          </p>
        )}
        {s.stream && (
          <ul className="flex flex-wrap gap-2" aria-label={t('Diagnóstico deste aparelho')}>
            {diag.items.map((i) => (
              <li key={i.code}><V2Badge tone={LEVEL_TONE[i.level]}>{t(ITEM_TEXT[i.code])}: {t(LEVEL_TEXT[i.level])}</V2Badge></li>
            ))}
            {s.running && Number.isFinite(s.frameMs) && (
              <li><V2Badge tone={s.frameMs > 33 ? 'amber' : 'neutral'}>{t('{n} ms por quadro', { n: s.frameMs })}</V2Badge></li>
            )}
          </ul>
        )}
      </V2Surface>

      <V2Surface className="space-y-4 p-4">
        <ol className="space-y-4">
          <Step n={1} done={Boolean(s.stream)} active={!s.stream} title={t('Abra a câmera')} dica="linhas-abrir-camera">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-xs font-semibold text-gray-500">
                {t('Câmera')}
                <V2Select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="mt-1">
                  <option value="">{t('Câmera traseira / padrão')}</option>
                  {s.cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  <option value={IP_OPTION}>{t('Câmera IP (ponte local)')}</option>
                </V2Select>
              </label>
              <V2Button type="button" onClick={() => abrir()}>
                <Camera className="mr-1.5 h-4 w-4" /> {s.stream ? t('Trocar câmera') : t('Abrir câmera')}
              </V2Button>
            </div>
            {deviceId === IP_OPTION && (
              <div className="space-y-2 rounded-2xl bg-paper p-3" data-dica="linhas-camera-ip">
                <label className="block text-xs font-semibold text-gray-500">
                  {t('Endereço da ponte (go2rtc ou MediaMTX)')}
                  <V2Input
                    value={ponte}
                    onChange={(e) => { setPonte(e.target.value); setPonteErro(null); }}
                    placeholder={IP_BRIDGE_EXAMPLE}
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    className="mt-1"
                  />
                </label>
                {ponteErro && (
                  <p className="text-sm text-red-700" role="alert">{t(IP_ERROR[ponteErro], { ex: IP_BRIDGE_EXAMPLE })}</p>
                )}
                <p className="text-sm text-gray-500">
                  {t('A ponte roda num computador da arena e transforma o vídeo da câmera para o navegador. Use o Chrome nesse computador; o endereço fica guardado só aqui. Passo a passo na ajuda do controle de linhas.')}
                </p>
                <V2Button type="button" size="sm" variant="secondary" aria-expanded={assistente} onClick={() => setAssistente(!assistente)}>
                  {assistente ? t('Fechar o assistente') : t('Ainda não tenho a ponte: gerar o arquivo dela')}
                </V2Button>
                {assistente && (
                  <IpBridgeWizard
                    suggestedName={`quadra ${s.position.id}`}
                    onUse={(url) => { setPonte(url); setPonteErro(null); }}
                  />
                )}
              </div>
            )}
            {fonteDica && (
              <p className="rounded-2xl bg-paper p-3 text-sm text-ink" aria-live="polite">{t(fonteDica)}</p>
            )}
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
                {Number.isFinite(s.battery.level) && (
                  <V2Badge tone={baixaBateria ? 'red' : 'neutral'}>
                    {s.battery.charging ? t('Bateria {n}% · carregando', { n: s.battery.level }) : t('Bateria {n}%', { n: s.battery.level })}
                  </V2Badge>
                )}
              </div>
            )}
            {bloqueada && (
              <p className="text-sm text-red-600">{t('Esta câmera está abaixo do mínimo. As marcações ficariam imprecisas demais; use outra câmera.')}</p>
            )}
            {baixaBateria && (
              <p className="flex items-center gap-1.5 text-sm text-red-600">
                <BatteryLow className="h-4 w-4" aria-hidden="true" /> {t('Bateria baixa: ligue o carregador. Analisar vídeo gasta muita bateria.')}
              </p>
            )}
          </Step>

          <Step n={2} done={calibrada && s.check?.level !== CHECK_LEVEL.REDO && Boolean(s.check)} active={Boolean(s.stream) && (!calibrada || !s.check)} title={t('Marque os pontos da quadra e confira')} dica="linhas-calibrar">
            {s.stream && (
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
                      {t(z.label)}
                    </V2Button>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  {zona.id === 'full'
                    ? t('A câmera marca os lances da quadra toda.')
                    : t('Você marca os quatro cantos só desta parte, e a câmera só marca lances que caem nela. O resto fica com as outras câmeras. Trocar a parte apaga os pontos marcados.')}
                </p>
              </fieldset>
            )}
            <div className={cn(!s.stream && 'hidden')}>
              {/* O vídeo fica montado desde o início: o elemento recebe a câmera assim que ela abre. */}
              <CalibrationView
                s={s}
                mode={mode}
                onTap={onTap}
                zone={zona}
                hint={s.stream ? hint : null}
                status={status}
                toolbar={s.stream ? toolbar : null}
                diagram={{ points: ids, current: nextPoint, done: ids.slice(0, s.calib.corners.length), label: t('Os pontos da calibração no desenho da quadra') }}
              />
            </div>
            {s.stream && (
              <div className="flex items-start gap-3">
                <CourtDiagram
                  positions={[s.position.id]}
                  active={s.position.id}
                  points={ids}
                  current={nextPoint}
                  done={ids.slice(0, s.calib.corners.length)}
                  zone={zona}
                  className="w-20 shrink-0 text-ink sm:hidden"
                  label={t('Os pontos da calibração no desenho da quadra')}
                />
                <p className="text-xs text-gray-500">{t('Os botões e os avisos ficam sobre a imagem. Use a tela cheia para marcar com mais precisão.')}</p>
              </div>
            )}
          </Step>

          <Step n={3} done={Boolean(s.calib.hueSet)} active={calibrada && !s.calib.hueSet} title={t('Ensine a cor da bola (opcional)')}>
            {calibrada && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">{mode === 'color' ? t('Toque na bola, parada no chão.') : t('Já vem pronta para bola amarela/verde-limão. Com outra cor, toque na bola parada.')}</p>
                <V2Button size="sm" variant="ghost" onClick={() => setMode('color')}>
                  <Palette className="mr-1.5 h-4 w-4" /> {t('Ensinar a cor da bola')}
                </V2Button>
              </div>
            )}
          </Step>

          <Step n={4} done={false} active={calibrada} title={t('Analise o jogo')} dica="linhas-analisar">
            {calibrada && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <V2Button disabled={bloqueada} onClick={() => { setMode(null); s.setRunning(!s.running); }}>
                    {s.running
                      ? <><Pause className="mr-1.5 h-4 w-4" /> {t('Pausar')}</>
                      : <><Play className="mr-1.5 h-4 w-4" /> {t('Começar a analisar')}</>}
                  </V2Button>
                  <V2Button variant="ghost" onClick={() => setSom(!som)} aria-pressed={som}>
                    {som ? <Bell className="mr-1.5 h-4 w-4" /> : <BellOff className="mr-1.5 h-4 w-4" />}
                    {som ? t('Som do lance ligado') : t('Som do lance desligado')}
                  </V2Button>
                  {canSpeak() && (
                    <V2Button variant="ghost" onClick={() => setFalar(!falar)} aria-pressed={falar}>
                      {falar ? <Volume2 className="mr-1.5 h-4 w-4" /> : <VolumeX className="mr-1.5 h-4 w-4" />}
                      {falar ? t('Falando o lance') : t('Falar o lance')}
                    </V2Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.running && <V2Badge tone={lento ? 'amber' : 'neutral'}>{t('Analisando {n} quadros/s', { n: s.fps })}</V2Badge>}
                  {s.running && s.health?.known && !s.health.moved && <V2Badge tone="green">{t('Câmera no lugar')}</V2Badge>}
                  {s.running && s.poseState === 'loading' && <V2Badge tone="neutral">{t('Carregando o detector de pés…')}</V2Badge>}
                  {s.poseState === 'failed' && <V2Badge tone="red">{t('Detector de pés indisponível: só dentro/fora')}</V2Badge>}
                  {s.poseState === 'off' && <V2Badge tone="neutral">{t('Câmera de cima: só dentro/fora')}</V2Badge>}
                  {s.stream && !s.shareError && <V2Badge tone="green"><Radio className="mr-1 inline h-3 w-3" aria-hidden="true" />{t('Ligada à central')}</V2Badge>}
                  {s.shareError && <V2Badge tone="amber"><AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" />{t('Sem conexão com a central: as marcações ficam só aqui')}</V2Badge>}
                </div>
                {mexeu && (
                  <div role="alert" className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="flex items-start gap-1.5 text-sm font-medium text-red-700">
                      <Move className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {t('A câmera saiu do lugar (cerca de {n} px). Até marcar os pontos de novo, todo lance vai para "Revisar".', { n: s.health.px })}
                    </p>
                    <V2Button size="sm" onClick={() => { s.setRunning(false); s.resetCorners(); setMode('corners'); }}>
                      <Crosshair className="mr-1.5 h-4 w-4" /> {t('Marcar os pontos de novo')}
                    </V2Button>
                  </div>
                )}
                {s.running && s.health?.dark && (
                  <p className="text-sm text-amber-700">{t('Pouca luz: a bola vira um borrão e some. Acenda as luzes da quadra ou mude o aparelho de lugar, longe da contraluz.')}</p>
                )}
                {lento && (
                  <p className="text-sm text-amber-700">{t('Poucos quadros por segundo: feche outros aplicativos, tire o modo de economia de bateria ou use outro aparelho. Com menos de 24 por segundo a bola pula muito entre um quadro e outro.')}</p>
                )}
                {!s.check && <p className="text-xs text-gray-500">{t('Dica: confira com o 5º ponto antes de começar. Sem a conferência, a câmera funciona, mas ninguém sabe o erro dela.')}</p>}
              </div>
            )}
          </Step>
        </ol>
      </V2Surface>

      {s.cameraError && <V2ErrorState inline title={t('Câmera')} description={cameraErrorText(s.cameraError)} />}


      {last && (
        <V2Surface className="flex flex-wrap items-center justify-between gap-3 p-4" aria-live="polite">
          <div>
            <p className={cn('text-3xl font-black', CALL_TEXT[last.call])}>{callLabel(last)}</p>
            <p className="text-sm text-gray-600">{callDetail(last)}</p>
          </div>
          <V2Button variant="secondary" onClick={() => setReplay(last)}>
            {hasReplay(last)
              ? <><Film className="mr-1.5 h-4 w-4" /> {t('Ver replay')}</>
              : <><Camera className="mr-1.5 h-4 w-4" /> {t('Ver foto')}</>}
          </V2Button>
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
            {s.events.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => setReplay(e)} className="flex w-full gap-3 rounded-xl p-1 text-left transition-colors hover:bg-gray-50">
                  <span className="relative block w-32 shrink-0 overflow-hidden rounded-lg">
                    <img src={e.image} alt="" className="block w-full" />
                    {e.imagePoint && (
                      <span
                        className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                        style={{ left: `${(e.imagePoint.x * 100) / e.vw}%`, top: `${(e.imagePoint.y * 100) / e.vh}%`, borderColor: CALL_COLOR[e.call] }}
                      />
                    )}
                    {hasReplay(e) && <Film className="absolute bottom-1 right-1 h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0">
                    <V2Badge tone={CALL_TONE[e.call]}>{callLabel(e)}</V2Badge>
                    <span className="mt-1 block text-xs text-gray-500">{callDetail(e)}</span>
                    <span className="mt-1 block text-xs font-semibold text-ink">{hasReplay(e) ? t('Ver replay') : t('Ver foto')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </V2Surface>
      )}

      <LanceReplay event={replay ? (s.events.find((e) => e.id === replay.id) || replay) : null} Hinv={s.Hinv} onClose={() => setReplay(null)} />
    </div>
  );
}
