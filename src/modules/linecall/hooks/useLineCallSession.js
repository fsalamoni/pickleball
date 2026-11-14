/**
 * useLineCallSession — UMA câmera do controle de linhas, no aparelho que
 * filma: abre a câmera, guarda a calibração da posição, roda a análise quadro
 * a quadro, guarda o REPLAY de cada lance e manda as marcações para a central.
 *
 * O vídeo não é gravado nem enviado. A calibração (os quatro pontos, a cor da
 * bola e a conferência do 5º ponto) fica no navegador, por pessoa, jogo e
 * POSIÇÃO — a câmera fica no mesmo lugar o jogo inteiro. O replay também fica
 * só aqui: uma fita circular dos últimos segundos, recortada em volta de cada
 * lance (`domain/replay.js`). O que sai do aparelho é só o "estou no ar"
 * (`line_cams`, com bateria e conferência) e cada marcação, sem imagem
 * (`line_calls`), para a central juntar as câmeras.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { logger } from '@/core/lib/logger';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { createLineCallEngine } from '../domain/lineCallEngine.js';
import { CAMERA_POSITIONS } from '../domain/cameraLayouts.js';
import { findBallCandidates, pickBall, predictNext, BALL_DEFAULTS } from '../domain/ballDetection.js';
import { assessCamera, CAMERA_LEVEL } from '../domain/cameraCheck.js';
import { eventInZone } from '../domain/zones.js';
import { createFrameRing, clipWindow, REPLAY } from '../domain/replay.js';
import { headlineFirst } from '../domain/fusion.js';
import { toGray, cutPatch, matchPatch, driftFrom, brightness } from '../domain/cameraHealth.js';
import { cameraKey, fixedPrefId, fixedSnapshot, fixedPatches, restoreDecision, restoredCalib } from '../domain/fixedCalib.js';
import { cameraTodo, remoteCalibFor, curForDb, savedCalibFor, seenFromSaved } from '../domain/remoteCalib.js';

/** Os campos com a calibração completa (`cur`); incompleta não vai, para não apagar a guardada. */
const withCur = (fields, c) => {
  const cur = curForDb(c);
  return cur ? { ...fields, cur } : fields;
};
import { listCameras, openCamera, closeCamera } from '../services/cameraService.js';
import { createPoseDetector } from '../services/poseService.js';
import { upsertLineCam, removeLineCam, postLineCall, HEARTBEAT_MS } from '../services/lineCallSync.js';
import { cameraCalibSync, grabSnap } from '../services/lineCalibService.js';
import { useCalibration } from './useCalibration.js';

/** Largura da imagem reduzida em que a bola é procurada (px). */
const SCAN_W = 480;
/** Largura dos quadros do replay (px): o bastante para ver a linha, leve na memória. */
const REPLAY_W = 480;
const MAX_EVENTS = 30;
/** De quanto em quanto tempo conferir se a câmera mexeu e se tem luz (ms). */
const HEALTH_EVERY_MS = 1000;
/**
 * De quanto em quanto tempo a bola desenhada na tela é atualizada (ms). A
 * análise segue QUADRO A QUADRO; só o desenho é mais espaçado: atualizar o
 * estado a cada quadro redesenhava a tela inteira 30–60 vezes por segundo e
 * roubava da análise o tempo do celular.
 */
const BALL_UI_MS = 80;

/** A imagem atual em cinza, na escala da análise. */
function grabGray(video) {
  const w = video?.videoWidth;
  const h = video?.videoHeight;
  if (!w || !h) return null;
  const k = SCAN_W / w;
  const cv = document.createElement('canvas');
  cv.width = SCAN_W;
  cv.height = Math.round(h * k);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, cv.width, cv.height);
  return { gray: toGray(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height), w: cv.width, h: cv.height, k };
}

/** Os pedaços de imagem em volta dos pontos marcados (a "foto" de onde a quadra está). */
function cutRefs(snap, corners) {
  if (!snap) return null;
  const refs = corners.map((c) => cutPatch(snap.gray, snap.w, snap.h, c.x * snap.k, c.y * snap.k));
  return refs.filter(Boolean).length >= 2 ? refs : null;
}

const prefId = (gameDayId, position) => `linhas:calibracao:${gameDayId}:${position}`;
const EMPTY = () => ({ corners: [], hue: BALL_DEFAULTS.hue });

function readCalib(uid, gameDayId, position) {
  try { return JSON.parse(readViewPreference(uid, prefId(gameDayId, position)) || 'null') || EMPTY(); } catch { return EMPTY(); }
}

const toBlobUrl = (cv) => new Promise((resolve) => {
  cv.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), 'image/jpeg', 0.72);
});

/** Solta as imagens do replay de um lance. */
function releaseClip(event) {
  event?.clip?.frames?.forEach((f) => f.url && URL.revokeObjectURL(f.url));
}

/** Bateria do aparelho, quando o navegador conta (Chrome/Android). */
function useBattery(enabled) {
  const [state, setState] = useState({ level: null, charging: null });
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.getBattery) return undefined;
    let bat = null;
    const read = () => bat && setState({ level: Math.round(bat.level * 100), charging: bat.charging });
    navigator.getBattery().then((b) => {
      bat = b;
      read();
      b.addEventListener('levelchange', read);
      b.addEventListener('chargingchange', read);
    }).catch(() => {});
    return () => {
      bat?.removeEventListener('levelchange', read);
      bat?.removeEventListener('chargingchange', read);
    };
  }, [enabled]);
  return state;
}

/**
 * @param {string} gameDayId
 * @param {string} position  id em `CAMERA_POSITIONS`
 * @param {{ layout?: string, share?: boolean, sink?: object }} [opts] `share`: mandar para a central;
 *   `sink`: a câmera CONVIDADA, sem conta (`guestSink`), que manda tudo pelo servidor
 */
export function useLineCallSession(gameDayId, position, { layout = null, share = true, sink = null } = {}) {
  const { user, userProfile } = useAuth();
  const uid = sink?.uid || user?.uid || null;
  // Para onde vão o sinal e as marcações: o banco direto (conta) ou o servidor (convidado).
  const sinkRef = useRef(sink);
  sinkRef.current = sink;
  const upsert = useCallback((c) => (sinkRef.current ? sinkRef.current.upsert(c) : upsertLineCam(gameDayId, c)), [gameDayId]);
  const remove = useCallback((p) => (sinkRef.current ? sinkRef.current.remove() : removeLineCam(gameDayId, uid, p)), [gameDayId, uid]);
  const post = useCallback((c) => (sinkRef.current ? sinkRef.current.post(c) : postLineCall(gameDayId, c)), [gameDayId]);
  const pos = CAMERA_POSITIONS[position] || CAMERA_POSITIONS.fundo_a;
  const videoRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [stream, setStream] = useState(null);
  const [settings, setSettings] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [calib, setCalib] = useState(() => readCalib(uid, gameDayId, pos.id));
  const [running, setRunning] = useState(false);
  const [poseState, setPoseState] = useState('idle'); // idle | loading | ready | failed | off
  const [events, setEvents] = useState([]);
  const [fps, setFps] = useState(0);
  // Quanto a análise de UM quadro leva neste aparelho (ms, média do último segundo).
  const [frameMs, setFrameMs] = useState(null);
  const [ball, setBall] = useState(null);
  const [shareError, setShareError] = useState(false);
  const battery = useBattery(Boolean(stream));
  // A câmera mexeu? Tem luz? (`domain/cameraHealth.js`)
  const [health, setHealth] = useState({ moved: false, px: null, known: false, dark: false, glare: false });
  const refPatches = useRef(null);

  // Trocar de posição troca a calibração.
  useEffect(() => { setCalib(readCalib(uid, gameDayId, pos.id)); setRunning(false); }, [uid, gameDayId, pos.id]);
  useEffect(() => { writeViewPreference(uid, prefId(gameDayId, pos.id), JSON.stringify(calib)); }, [uid, gameDayId, pos.id, calib]);

  const cal = useCalibration(pos.id, calib, setCalib, videoRef);
  const { zone, H, check } = cal;
  const cameraChecks = useMemo(() => (settings ? assessCamera(settings) : []), [settings]);
  const checkCm = check?.cm ?? null;

  // A referência de "onde a quadra está" é tirada quando a calibração fica
  // pronta (e no 1º quadro da análise, se o vídeo ainda não tinha imagem).
  useEffect(() => {
    try { refPatches.current = H ? cutRefs(grabGray(videoRef.current), calib.corners) : null; } catch { refPatches.current = null; }
    setHealth((st) => ({ ...st, moved: false, px: null, known: false }));
  }, [H, calib.corners]);

  // ---- Câmera FIXA: a calibração volta no dia seguinte (`domain/fixedCalib.js`) ----
  const camKey = useRef('padrao');
  const [restored, setRestored] = useState(null); // { decision, savedMs } | null
  const restoredRef = useRef(null);
  // Guarda a calibração pronta, com a "foto" dos pontos, para esta posição e esta câmera.
  useEffect(() => {
    const v = videoRef.current;
    if (!H || !uid || !v?.videoWidth) return;
    // Voltou sem certeza e o 5º ponto ainda não confirmou: não regrava por cima.
    if (restoredRef.current === 'unsure' && !calib.checkTap) return;
    const snap = fixedSnapshot(calib, { vw: v.videoWidth, vh: v.videoHeight, patches: refPatches.current });
    if (snap) writeViewPreference(uid, fixedPrefId(pos.id, camKey.current), JSON.stringify(snap));
  }, [H, calib, uid, pos.id]);
  // Câmera aberta e nada marcado hoje: procura a calibração de antes na imagem de agora.
  useEffect(() => {
    const v = videoRef.current;
    if (!stream || !v || !uid) return undefined;
    let vivo = true;
    const tentar = () => {
      if (!vivo || !v.videoWidth || calibNowRef.current.corners.length) return;
      let saved = null;
      try { saved = JSON.parse(readViewPreference(uid, fixedPrefId(pos.id, camKey.current)) || 'null'); } catch { saved = null; }
      if (!saved) return;
      let drift = { known: false };
      try {
        const snap = grabGray(v);
        if (snap) drift = driftFrom(fixedPatches(saved).map((p) => matchPatch(snap.gray, snap.w, snap.h, p)));
      } catch { /* sem imagem: sem certeza */ }
      const decision = restoreDecision(saved, { vw: v.videoWidth, vh: v.videoHeight, drift });
      if (decision === 'none') return;
      restoredRef.current = decision;
      setRestored({ decision, savedMs: saved.savedMs || null });
      const c = restoredCalib(saved, decision);
      if (c) setCalib(c);
    };
    // Espera o primeiro quadro de verdade (a imagem preta da abertura não serve).
    const id = setTimeout(tentar, 800);
    return () => { vivo = false; clearTimeout(id); };
  }, [stream, uid, pos.id]);
  const calibNowRef = useRef(calib);
  calibNowRef.current = calib;
  const dismissRestored = useCallback(() => setRestored(null), []);

  const refreshCameras = useCallback(() => listCameras().then(setCameras).catch(() => setCameras([])), []);
  useEffect(() => { refreshCameras(); }, [refreshCameras]);

  // Os replays guardados, para soltar a memória quando saem da lista.
  const eventsRef = useRef(events);
  eventsRef.current = events;
  useEffect(() => () => eventsRef.current.forEach(releaseClip), []);
  const clearEvents = useCallback(() => {
    eventsRef.current.forEach(releaseClip);
    setEvents([]);
  }, []);

  const start = useCallback(async (deviceId) => {
    setCameraError(null);
    try {
      // Outra câmera = outro relógio de vídeo (o `t` recomeça do zero) e outra
      // imagem: os lances da anterior saem, senão um velho seguiria de manchete
      // e o círculo dele seria pintado sobre a imagem nova.
      if (stream) clearEvents();
      closeCamera(stream);
      camKey.current = cameraKey(deviceId);
      restoredRef.current = null;
      setRestored(null);
      const opened = await openCamera(deviceId);
      setStream(opened.stream);
      setSettings(opened.settings);
      refreshCameras(); // depois da permissão os nomes aparecem
    } catch (e) {
      // Erro do navegador tem nome próprio (NotAllowedError…); o nosso vem na mensagem.
      setCameraError((e?.name && e.name !== 'Error' ? e.name : e?.message) || 'error');
    }
  }, [stream, refreshCameras, clearEvents]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  useEffect(() => () => closeCamera(stream), [stream]);

  // "Estou no ar": sinal de vida enquanto a câmera está aberta.
  const live = useRef({});
  live.current = {
    calibrated: Boolean(H), analyzing: running, fps,
    battery: battery.level, charging: battery.charging, checkCm: check?.cm ?? null,
    alert: !running ? null : health.moved ? 'moved' : health.dark ? 'dark' : health.glare ? 'glare' : null,
  };
  const name = sink?.name || userProfile?.full_name || userProfile?.display_name || user?.displayName || '';
  useEffect(() => {
    if (!share || !uid || !stream || !gameDayId) return undefined;
    const beat = () => upsert({ uid, name, position: pos.id, layout, ...live.current })
      .then(() => setShareError(false))
      .catch((e) => { logger.warn('linhas: sinal da câmera falhou', e); setShareError(true); });
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => {
      clearInterval(id);
      remove(pos.id).catch(() => {});
    };
  }, [share, uid, stream, gameDayId, pos.id, layout, name, upsert, remove]);
  // Mudou o estado (calibrou, conferiu, começou, pausou): avisa já, sem esperar o próximo sinal.
  useEffect(() => {
    if (!share || !uid || !stream || !gameDayId) return;
    upsert({ uid, name, position: pos.id, layout, ...live.current }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(H), running, check?.cm, live.current.alert]);

  // ---- Calibração PELA CENTRAL (docs/53 §5d) ----------------------------
  // Câmera em lugar alto não se calibra pela tela dela: ela manda uma foto da
  // quadra a `line_calib`, quem organiza marca os pontos na central e devolve;
  // a central também começa e pausa a análise. Sem conta, pelo servidor.
  const remoteOn = share && Boolean(uid) && Boolean(gameDayId);
  const calibSync = useMemo(
    () => (remoteOn ? (sink?.calib || cameraCalibSync(gameDayId, uid, pos.id)) : null),
    [remoteOn, sink, gameDayId, uid, pos.id],
  );
  const [remote, setRemote] = useState(null);
  const [remoteApplied, setRemoteApplied] = useState(null);
  // A calibração voltou do que ficou guardado na quadra (para a tela avisar e pedir a conferência).
  const [restoredFromCourt, setRestoredFromCourt] = useState(false);
  const [pendingRun, setPendingRun] = useState(null);
  const calibNow = useRef(calib);
  calibNow.current = calib;
  const seen = useRef({ calibMs: 0, runMs: 0, snapMs: 0 });
  useEffect(() => { seen.current = { calibMs: calibNow.current.remoteMs || 0, runMs: 0, snapMs: 0 }; setRemote(null); }, [calibSync]);

  // Câmera aberta: diz o tamanho do vídeo e o que tem; sem calibração, já manda a foto.
  useEffect(() => {
    if (!calibSync || !stream) return undefined;
    let vivo = true;
    let unsub = null;
    let timer = null;
    const first = async () => {
      if (!vivo) return;
      const v = videoRef.current;
      if (!v?.videoWidth) { timer = setTimeout(first, 400); return; }
      // A calibração GUARDADA NA QUADRA (de outra vez, de outro aparelho):
      // volta quando este aparelho abre sem nada marcado. O começar antigo não.
      if (calibSync.saved) {
        try {
          const { own, all } = await calibSync.saved();
          if (!vivo) return;
          seen.current = { ...seenFromSaved(own), calibMs: Math.max(seenFromSaved(own).calibMs, seen.current.calibMs) };
          const back = calibNow.current.corners.length === 4 ? null : savedCalibFor(all, v.videoWidth);
          if (back) {
            calibNow.current = { ...calibNow.current, ...back };
            setCalib((old) => (old.corners.length === 4 ? old : { ...old, ...back }));
            setRestoredFromCourt(true);
          }
        } catch (e) {
          logger.warn('linhas: calibração guardada na quadra', e);
        }
      }
      const fields = withCur({ vw: v.videoWidth, vh: v.videoHeight }, calibNow.current);
      if (calibNow.current.corners.length !== 4) {
        const sn = grabSnap(v);
        if (sn) { fields.snap = sn.snap; fields.snap_ms = Date.now(); seen.current.snapMs = fields.snap_ms; }
      }
      calibSync.write(fields)
        .then(() => { if (vivo) unsub = calibSync.watch(setRemote, (e) => logger.warn('linhas: calibração pela central', e)); })
        .catch((e) => logger.warn('linhas: calibração pela central indisponível', e));
    };
    first();
    return () => { vivo = false; clearTimeout(timer); unsub?.(); };
  }, [calibSync, stream]);
  // Saiu da tela: a FOTO sai do banco e a calibração fica guardada na quadra
  // (o convidado sai pelo servidor, que apaga tudo).
  useEffect(() => () => {
    const out = calibSync?.release || calibSync?.remove;
    out?.()?.catch?.(() => {});
  }, [calibSync]);
  // Toda calibração completa vai para a quadra (com uma pausa, para não gravar a cada arrasto).
  useEffect(() => {
    if (!calibSync || !stream || calib.corners.length !== 4) return undefined;
    const id = setTimeout(() => { calibSync.write(withCur({}, calib)).catch(() => {}); }, 1500);
    return () => clearTimeout(id);
  }, [calibSync, stream, calib]);

  // O que a central pediu: aplicar a calibração, mandar foto nova, começar/pausar.
  useEffect(() => {
    if (!remote || !calibSync) return;
    const todo = cameraTodo(remote, seen.current);
    const v = videoRef.current;
    if (todo.applyCalib) {
      seen.current.calibMs = remote.calib_ms;
      const c = remoteCalibFor(remote, v?.videoWidth);
      if (c) {
        setRunning(false);
        setCalib((old) => ({ ...old, ...c, remoteMs: remote.calib_ms }));
        setRemoteApplied(remote.calib_ms);
        calibSync.write(withCur({ applied_ms: remote.calib_ms }, c)).catch(() => {});
      }
    }
    if (todo.sendSnap && v?.videoWidth) {
      seen.current.snapMs = remote.snap_req_ms;
      const sn = grabSnap(v);
      if (sn) calibSync.write(withCur({ ...sn, snap_ms: Date.now() }, calibNow.current)).catch((e) => logger.warn('linhas: foto para a central', e));
    }
    if (todo.run !== null) { seen.current.runMs = remote.run_ms; setPendingRun(todo.run); }
  }, [remote, calibSync]);
  // Começar só com a calibração pronta e a câmera acima do mínimo (a mesma trava do botão).
  useEffect(() => {
    if (pendingRun === null) return;
    setPendingRun(null);
    if (!pendingRun) { setRunning(false); return; }
    if (H && !cameraChecks.some((c) => c.level === CAMERA_LEVEL.BLOCK)) setRunning(true);
  }, [pendingRun, H, cameraChecks]);

  // A análise, quadro a quadro.
  useEffect(() => {
    const video = videoRef.current;
    if (!running || !video || !H) return undefined;
    let cancelled = false;
    let pose = null;
    // Com o tamanho da imagem o motor tira da calibração onde a câmera está e
    // corrige a altura da bola e do pé; o erro medido no 5º ponto entra na
    // incerteza de cada medida (nunca abaixo do erro típico de quem toca).
    // Criado no 1º quadro: logo depois de trocar de câmera o vídeo novo ainda
    // não diz o tamanho.
    let engine = null;
    const makeEngine = () => {
      const imageSize = video.videoWidth && video.videoHeight ? { w: video.videoWidth, h: video.videoHeight } : null;
      const options = { mode: pos.mode, imageSize };
      if (Number.isFinite(checkCm)) options.calibrationM = Math.max(0.015, checkCm / 100);
      return createLineCallEngine({ H, options });
    };
    const scan = document.createElement('canvas');
    const sctx = scan.getContext('2d', { willReadFrequently: true });
    const snap = document.createElement('canvas');
    // A fita do replay: canvases reaproveitados (nada de alocar a cada quadro).
    const ring = createFrameRing();
    const pool = [];
    const pending = []; // lances esperando o "depois" para recortar o replay
    let seq = 0;
    let prev = null;
    let last = null;
    let before = null;
    let frames = 0;
    let busy = 0;
    let since = performance.now();
    let ballAt = 0;
    let shownBall = false;
    let handle = null;
    let healthAt = 0;
    let moved = false;

    if (pos.usesPose) {
      setPoseState('loading');
      createPoseDetector()
        .then((p) => { if (cancelled) p.close(); else { pose = p; setPoseState('ready'); } })
        .catch(() => { if (!cancelled) setPoseState('failed'); });
    } else {
      setPoseState('off');
    }

    const schedule = (fn) => (video.requestVideoFrameCallback
      ? video.requestVideoFrameCallback(fn)
      : requestAnimationFrame(() => fn(performance.now(), { mediaTime: performance.now() / 1000 })));

    const record = (t, w, h, ballPt) => {
      const cv = pool.pop() || document.createElement('canvas');
      cv.width = REPLAY_W;
      cv.height = Math.round(h * (REPLAY_W / w));
      cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height);
      ring.push({ t, cv, ball: ballPt }).forEach((f) => pool.push(f.cv));
    };

    // Recorta o replay do lance (o canvas é copiado no `toBlob`, então a fita
    // pode seguir girando enquanto as imagens são feitas). Sem nenhum quadro na
    // janela, o lance fica SEM replay (`clip: false`) — não um replay vazio.
    const finalize = async (p, w, h) => {
      const { from, to } = clipWindow(p.t);
      const picked = ring.between(from, to);
      const urls = await Promise.all(picked.map((f) => toBlobUrl(f.cv)));
      let clip = picked.length > 0 && {
        eventT: p.t, scale: REPLAY_W / w, vw: w, vh: h,
        frames: picked.map((f, i) => ({ t: f.t, url: urls[i], ball: f.ball })),
      };
      if (cancelled) { releaseClip({ clip }); clip = false; }
      setEvents((list) => {
        if (!clip || list.some((e) => e.id === p.id)) return list.map((e) => (e.id === p.id ? { ...e, clip } : e));
        // O lance já saiu da lista ("Limpar", ou empurrado além de MAX_EVENTS)
        // enquanto as imagens eram feitas: o replay dele é solto aqui.
        releaseClip({ clip });
        return list;
      });
    };

    const onFrame = (now, meta) => {
      if (cancelled) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        const t0 = performance.now();
        const k = SCAN_W / w;
        // Mudar o tamanho de um canvas apaga e realoca a memória dele: só quando muda.
        const sh = Math.round(h * k);
        if (scan.width !== SCAN_W || scan.height !== sh) { scan.width = SCAN_W; scan.height = sh; }
        sctx.drawImage(video, 0, 0, scan.width, scan.height);
        const img = sctx.getImageData(0, 0, scan.width, scan.height).data;
        const cands = findBallCandidates(img, prev, scan.width, scan.height, { hue: calib.hue });
        prev = img;
        if (now - healthAt >= HEALTH_EVERY_MS) {
          healthAt = now;
          const gray = toGray(img, scan.width, scan.height);
          if (!refPatches.current) refPatches.current = cutRefs({ gray, w: scan.width, h: scan.height, k }, calib.corners);
          const drift = driftFrom((refPatches.current || []).map((p) => matchPatch(gray, scan.width, scan.height, p)));
          moved = drift.moved;
          const luz = brightness(gray);
          setHealth({ moved: drift.moved, px: drift.px, known: drift.known, dark: luz.dark, glare: luz.glare });
        }
        // Procura onde a bola deve estar pelo rumo dos dois últimos quadros.
        const sc = (p) => (p ? { x: p.x * k, y: p.y * k } : null);
        const got = pickBall(cands, sc(predictNext(last, before)), { anchor: sc(last) });
        before = got ? last : null;
        last = got ? { x: got.x / k, y: got.y / k } : null;
        if ((last || shownBall) && now - ballAt >= BALL_UI_MS) { ballAt = now; shownBall = Boolean(last); setBall(last); }
        let players = [];
        try { players = pose ? pose.detect(video, now) : []; } catch { players = []; }
        const t = meta?.mediaTime ?? now / 1000;
        record(t, w, h, last);
        // Com a câmera fora do lugar a medida não vale: o lance vai para revisão.
        engine ??= makeEngine();
        const found = engine.push({ t, ball: last, players })
          // Fora da área escolhida esta câmera não marca: ali cuida outra.
          .filter((e) => eventInZone(e, zone))
          .map((e) => (moved ? { ...e, call: 'review', moved: true } : e));
        if (found.length) {
          snap.width = 320;
          snap.height = Math.round(h * (320 / w));
          snap.getContext('2d').drawImage(video, 0, 0, snap.width, snap.height);
          const image = snap.toDataURL('image/jpeg', 0.7);
          // A hora em que o QUADRO foi capturado (`captureTime`, quando o
          // navegador conta), não a de agora: o processamento atrasa cada
          // aparelho de um jeito, e a central compara as horas entre câmeras.
          const agora = Date.now();
          const cap = Number.isFinite(meta?.captureTime) ? performance.timeOrigin + meta.captureTime : NaN;
          const at = Math.abs(agora - cap) < 2000 ? cap : agora;
          if (share && uid) {
            found.forEach((event) => {
              // A hora do LANCE (não a de agora) no relógio deste aparelho.
              const tMs = at - Math.max(0, t - event.t) * 1000;
              post({ uid, position: pos.id, event, tMs })
                .catch((e) => { logger.warn('linhas: marcação não foi enviada', e); setShareError(true); });
            });
          }
          // O lote na ordem da tela: o mais grave primeiro (o motor solta o pé
          // de quem saca, limpo, antes do quique do saque, fora).
          const fresh = headlineFirst(found.map((e) => {
            seq += 1;
            const id = `${at}-${seq}`;
            pending.push({ id, t: e.t, until: e.t + REPLAY.AFTER_S });
            return { ...e, id, image, at, vw: w, vh: h };
          }));
          setEvents((list) => {
            const next = [...fresh, ...list];
            next.slice(MAX_EVENTS).forEach(releaseClip);
            // O replay ocupa memória: só os mais recentes ficam com ele.
            return next.slice(0, MAX_EVENTS).map((e, i) => {
              if (i < REPLAY.KEEP || !e.clip) return e;
              releaseClip(e);
              return { ...e, clip: null };
            });
          });
        }
        // Todo lance com o "depois" já filmado, em qualquer ordem: o voleio que o
        // motor soltou atrasado (impulso, 11.A.2) não espera o quique mais novo.
        for (let i = pending.length - 1; i >= 0; i -= 1) {
          if (pending[i].until <= t) finalize(pending.splice(i, 1)[0], w, h);
        }
        frames += 1;
        busy += performance.now() - t0;
        if (now - since >= 1000) {
          setFps(Math.round((frames * 1000) / (now - since)));
          setFrameMs(Math.round(busy / frames));
          frames = 0; busy = 0; since = now;
        }
      }
      handle = schedule(onFrame);
    };
    handle = schedule(onFrame);
    return () => {
      cancelled = true;
      // O lance que ainda esperava o "depois" fica sem replay — não "sendo recortado" para sempre.
      const semReplay = new Set(pending.splice(0).map((p) => p.id));
      if (semReplay.size) setEvents((list) => list.map((e) => (semReplay.has(e.id) ? { ...e, clip: false } : e)));
      if (handle != null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(handle);
      pose?.close();
      ring.clear();
      setBall(null);
      setFps(0);
      setFrameMs(null);
    };
  // `stream`: trocar de câmera recomeça o relógio do vídeo, então o motor, o
  // replay e o lance pendente nascem de novo com ele.
  }, [running, H, calib.hue, calib.corners, pos.mode, pos.usesPose, pos.id, share, uid, gameDayId, checkCm, stream, zone, post]);

  return {
    ...cal, position: pos,
    videoRef, cameras, start, stream, settings, cameraError, cameraChecks, remote: remoteOn, remoteApplied, restoredFromCourt,
    running, setRunning, poseState, events, clearEvents, fps, frameMs, ball, shareError, battery, health,
    restored, dismissRestored,
  };
}
