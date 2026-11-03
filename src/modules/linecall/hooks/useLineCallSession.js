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
import { solveHomography, invertHomography } from '../domain/homography.js';
import { createLineCallEngine } from '../domain/lineCallEngine.js';
import { CAMERA_POSITIONS, calibrationPoints } from '../domain/cameraLayouts.js';
import { findBallCandidates, pickBall, rgbToHsv, BALL_DEFAULTS } from '../domain/ballDetection.js';
import { assessCamera, worstCmPerPixel } from '../domain/cameraCheck.js';
import { checkPointFor, calibrationCheck } from '../domain/calibrationCheck.js';
import { createFrameRing, clipWindow, REPLAY } from '../domain/replay.js';
import { toGray, cutPatch, matchPatch, driftFrom, brightness } from '../domain/cameraHealth.js';
import { snapToOuterCorner, centroid } from '../domain/snapCorner.js';
import { listCameras, openCamera, closeCamera } from '../services/cameraService.js';
import { createPoseDetector } from '../services/poseService.js';
import { upsertLineCam, removeLineCam, postLineCall, HEARTBEAT_MS } from '../services/lineCallSync.js';

/** Largura da imagem reduzida em que a bola é procurada (px). */
const SCAN_W = 480;
/** Largura dos quadros do replay (px): o bastante para ver a linha, leve na memória. */
const REPLAY_W = 480;
const MAX_EVENTS = 30;
/** De quanto em quanto tempo conferir se a câmera mexeu e se tem luz (ms). */
const HEALTH_EVERY_MS = 1000;
/** Os cantos da quadra (os únicos que o "Ajustar à linha" mexe). */
const COURT_CORNER_IDS = ['A1', 'A2', 'B1', 'B2'];

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
 * @param {{ layout?: string, share?: boolean }} [opts] `share`: mandar para a central
 */
export function useLineCallSession(gameDayId, position, { layout = null, share = true } = {}) {
  const { user, userProfile } = useAuth();
  const uid = user?.uid || null;
  const pos = CAMERA_POSITIONS[position] || CAMERA_POSITIONS.fundo_a;
  const targets = useMemo(() => calibrationPoints(pos.id), [pos.id]);
  const checkPoint = useMemo(() => checkPointFor(pos.id), [pos.id]);
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
  const [ball, setBall] = useState(null);
  const [shareError, setShareError] = useState(false);
  const battery = useBattery(Boolean(stream));
  // A câmera mexeu? Tem luz? (`domain/cameraHealth.js`)
  const [health, setHealth] = useState({ moved: false, px: null, known: false, dark: false });
  const refPatches = useRef(null);

  // Trocar de posição troca a calibração.
  useEffect(() => { setCalib(readCalib(uid, gameDayId, pos.id)); setRunning(false); }, [uid, gameDayId, pos.id]);
  useEffect(() => { writeViewPreference(uid, prefId(gameDayId, pos.id), JSON.stringify(calib)); }, [uid, gameDayId, pos.id, calib]);

  const H = useMemo(
    () => (calib.corners.length === 4 ? solveHomography(calib.corners, targets) : null),
    [calib.corners, targets],
  );
  const Hinv = useMemo(() => (H ? invertHomography(H) : null), [H]);
  const cameraChecks = useMemo(() => (settings ? assessCamera(settings) : []), [settings]);
  const cmPerPixel = useMemo(() => (H ? worstCmPerPixel(H, calib.corners) : null), [H, calib.corners]);
  // A conferência do 5º ponto vale para ESTA calibração: marcar de novo apaga.
  const check = useMemo(
    () => (H && calib.checkTap ? calibrationCheck(H, calib.checkTap, checkPoint) : null),
    [H, calib.checkTap, checkPoint],
  );

  // A referência de "onde a quadra está" é tirada quando a calibração fica
  // pronta (e no 1º quadro da análise, se o vídeo ainda não tinha imagem).
  useEffect(() => {
    try { refPatches.current = H ? cutRefs(grabGray(videoRef.current), calib.corners) : null; } catch { refPatches.current = null; }
    setHealth((st) => ({ ...st, moved: false, px: null, known: false }));
  }, [H, calib.corners]);

  const refreshCameras = useCallback(() => listCameras().then(setCameras).catch(() => setCameras([])), []);
  useEffect(() => { refreshCameras(); }, [refreshCameras]);

  const start = useCallback(async (deviceId) => {
    setCameraError(null);
    try {
      closeCamera(stream);
      const opened = await openCamera(deviceId);
      setStream(opened.stream);
      setSettings(opened.settings);
      refreshCameras(); // depois da permissão os nomes aparecem
    } catch (e) {
      setCameraError(e?.name || e?.message || 'error');
    }
  }, [stream, refreshCameras]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);
  useEffect(() => () => closeCamera(stream), [stream]);

  // "Estou no ar": sinal de vida enquanto a câmera está aberta.
  const live = useRef({});
  live.current = {
    calibrated: Boolean(H), analyzing: running, fps,
    battery: battery.level, charging: battery.charging, checkCm: check?.cm ?? null,
  };
  const name = userProfile?.full_name || userProfile?.display_name || user?.displayName || '';
  useEffect(() => {
    if (!share || !uid || !stream || !gameDayId) return undefined;
    const beat = () => upsertLineCam(gameDayId, { uid, name, position: pos.id, layout, ...live.current })
      .then(() => setShareError(false))
      .catch((e) => { logger.warn('linhas: sinal da câmera falhou', e); setShareError(true); });
    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    return () => {
      clearInterval(id);
      removeLineCam(gameDayId, uid, pos.id).catch(() => {});
    };
  }, [share, uid, stream, gameDayId, pos.id, layout, name]);
  // Mudou o estado (calibrou, conferiu, começou, pausou): avisa já, sem esperar o próximo sinal.
  useEffect(() => {
    if (!share || !uid || !stream || !gameDayId) return;
    upsertLineCam(gameDayId, { uid, name, position: pos.id, layout, ...live.current }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(H), running, check?.cm]);

  /** Toque na imagem (coordenadas do VÍDEO): marca o próximo ponto. */
  const addCorner = useCallback((pt) => {
    setCalib((c) => ({ ...c, checkTap: null, corners: c.corners.length >= 4 ? [pt] : [...c.corners, pt] }));
  }, []);
  /** Arrasta um ponto já marcado (ajuste fino com a lupa). */
  const moveCorner = useCallback((i, pt) => {
    setCalib((c) => ({ ...c, checkTap: null, corners: c.corners.map((p, j) => (j === i ? pt : p)) }));
  }, []);
  /**
   * "Ajustar à linha": leva os cantos da QUADRA para a borda externa do L
   * branco (`domain/snapCorner.js`). As pontas da cozinha ficam como estão.
   * Devolve quantos pontos andaram; o anterior fica guardado para desfazer.
   */
  const snapBackup = useRef(null);
  const snapCorners = useCallback(() => {
    const v = videoRef.current;
    if (!v?.videoWidth || calib.corners.length !== 4) return 0;
    const cv = document.createElement('canvas');
    cv.width = v.videoWidth; cv.height = v.videoHeight;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, 0, 0);
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
    const mid = centroid(calib.corners);
    let moved = 0;
    const next = calib.corners.map((p, i) => {
      if (!COURT_CORNER_IDS.includes(targets[i]?.id)) return p;
      const q = snapToOuterCorner(img, cv.width, cv.height, p, mid);
      if (!q) return p;
      moved += 1;
      return q;
    });
    if (!moved) return 0;
    snapBackup.current = calib.corners;
    setCalib((c) => ({ ...c, checkTap: null, corners: next }));
    return moved;
  }, [calib.corners, targets]);
  const undoSnap = useCallback(() => {
    const prev = snapBackup.current;
    snapBackup.current = null;
    if (prev) setCalib((c) => ({ ...c, checkTap: null, corners: prev }));
  }, []);
  const resetCorners = useCallback(() => setCalib((c) => ({ ...c, corners: [], checkTap: null })), []);
  /** Toque no 5º ponto (o de conferência). */
  const setCheckTap = useCallback((pt) => setCalib((c) => ({ ...c, checkTap: pt })), []);

  /** Toque na bola parada: aprende a cor dela. */
  const learnBallColor = useCallback((pt) => {
    const v = videoRef.current;
    if (!v) return;
    const cv = document.createElement('canvas');
    cv.width = 5; cv.height = 5;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, pt.x - 2, pt.y - 2, 5, 5, 0, 0, 5, 5);
    const d = ctx.getImageData(2, 2, 1, 1).data;
    setCalib((c) => ({ ...c, hue: Math.round(rgbToHsv(d[0], d[1], d[2]).h), hueSet: true }));
  }, []);

  // Os replays guardados, para soltar a memória quando saem da lista.
  const eventsRef = useRef(events);
  eventsRef.current = events;
  useEffect(() => () => eventsRef.current.forEach(releaseClip), []);
  const clearEvents = useCallback(() => {
    eventsRef.current.forEach(releaseClip);
    setEvents([]);
  }, []);

  // A análise, quadro a quadro.
  useEffect(() => {
    const video = videoRef.current;
    if (!running || !video || !H) return undefined;
    let cancelled = false;
    let pose = null;
    const engine = createLineCallEngine({ H, options: { mode: pos.mode } });
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
    let frames = 0;
    let since = performance.now();
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
    // pode seguir girando enquanto as imagens são feitas).
    const finalize = async (p, w, h) => {
      const { from, to } = clipWindow(p.t);
      const picked = ring.between(from, to);
      const urls = await Promise.all(picked.map((f) => toBlobUrl(f.cv)));
      const clip = {
        eventT: p.t, scale: REPLAY_W / w, vw: w, vh: h,
        frames: picked.map((f, i) => ({ t: f.t, url: urls[i], ball: f.ball })),
      };
      if (cancelled) { releaseClip({ clip }); return; }
      setEvents((list) => list.map((e) => (e.id === p.id ? { ...e, clip } : e)));
    };

    const onFrame = (now, meta) => {
      if (cancelled) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w && h) {
        const k = SCAN_W / w;
        scan.width = SCAN_W;
        scan.height = Math.round(h * k);
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
          setHealth({ moved: drift.moved, px: drift.px, known: drift.known, dark: brightness(gray).dark });
        }
        const got = pickBall(cands, last ? { x: last.x * k, y: last.y * k } : null);
        last = got ? { x: got.x / k, y: got.y / k } : null;
        setBall(last);
        let players = [];
        try { players = pose ? pose.detect(video, now) : []; } catch { players = []; }
        const t = meta?.mediaTime ?? now / 1000;
        record(t, w, h, last);
        // Com a câmera fora do lugar a medida não vale: o lance vai para revisão.
        const found = engine.push({ t, ball: last, players })
          .map((e) => (moved ? { ...e, call: 'review', moved: true } : e));
        if (found.length) {
          snap.width = 320;
          snap.height = Math.round(h * (320 / w));
          snap.getContext('2d').drawImage(video, 0, 0, snap.width, snap.height);
          const image = snap.toDataURL('image/jpeg', 0.7);
          const at = Date.now();
          if (share && uid) {
            found.forEach((event) => {
              // A hora do LANCE (não a de agora) no relógio deste aparelho.
              const tMs = at - Math.max(0, t - event.t) * 1000;
              postLineCall(gameDayId, { uid, position: pos.id, event, tMs })
                .catch((e) => { logger.warn('linhas: marcação não foi enviada', e); setShareError(true); });
            });
          }
          const fresh = found.map((e) => {
            seq += 1;
            const id = `${at}-${seq}`;
            pending.push({ id, t: e.t, until: e.t + REPLAY.AFTER_S });
            return { ...e, id, image, at, vw: w, vh: h };
          });
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
        while (pending.length && pending[0].until <= t) finalize(pending.shift(), w, h);
        frames += 1;
        if (now - since >= 1000) { setFps(Math.round((frames * 1000) / (now - since))); frames = 0; since = now; }
      }
      handle = schedule(onFrame);
    };
    handle = schedule(onFrame);
    return () => {
      cancelled = true;
      if (handle != null && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(handle);
      pose?.close();
      ring.clear();
      setBall(null);
      setFps(0);
    };
  }, [running, H, calib.hue, calib.corners, pos.mode, pos.usesPose, pos.id, share, uid, gameDayId]);

  return {
    position: pos, targets, checkPoint,
    videoRef, cameras, start, stream, settings, cameraError, cameraChecks,
    calib, addCorner, moveCorner, resetCorners, snapCorners, undoSnap, setCheckTap, check, learnBallColor, H, Hinv, cmPerPixel,
    running, setRunning, poseState, events, clearEvents, fps, ball, shareError, battery, health,
  };
}
