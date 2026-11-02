/**
 * useLineCallSession — a sessão de controle de linhas de UM jogo, no aparelho
 * que tem a câmera: abre a câmera, guarda a calibração, roda a análise quadro
 * a quadro e junta as marcações.
 *
 * Nada sai do aparelho: o vídeo não é gravado nem enviado, e a calibração
 * (os quatro cantos e a cor da bola) fica no navegador, por pessoa e por jogo
 * — a câmera fica no mesmo lugar o jogo inteiro, e trocar de aparelho pede
 * calibrar de novo de qualquer jeito. Zero banco.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { solveHomography, invertHomography } from '../domain/homography.js';
import { CALIBRATION_CORNERS } from '../domain/court.js';
import { createLineCallEngine } from '../domain/lineCallEngine.js';
import { findBallCandidates, pickBall, rgbToHsv, BALL_DEFAULTS } from '../domain/ballDetection.js';
import { assessCamera, worstCmPerPixel } from '../domain/cameraCheck.js';
import { listCameras, openCamera, closeCamera } from '../services/cameraService.js';
import { createPoseDetector } from '../services/poseService.js';

/** Largura da imagem reduzida em que a bola é procurada (px). */
const SCAN_W = 480;
const MAX_EVENTS = 30;

const prefId = (gameDayId) => `linhas:calibracao:${gameDayId}`;

export function useLineCallSession(gameDayId) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const videoRef = useRef(null);
  const [cameras, setCameras] = useState([]);
  const [stream, setStream] = useState(null);
  const [settings, setSettings] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [calib, setCalib] = useState(() => {
    try { return JSON.parse(readViewPreference(uid, prefId(gameDayId)) || 'null') || { corners: [], hue: BALL_DEFAULTS.hue }; } catch { return { corners: [], hue: BALL_DEFAULTS.hue }; }
  });
  const [running, setRunning] = useState(false);
  const [poseState, setPoseState] = useState('idle'); // idle | loading | ready | failed
  const [events, setEvents] = useState([]);
  const [fps, setFps] = useState(0);
  const [ball, setBall] = useState(null);

  useEffect(() => { writeViewPreference(uid, prefId(gameDayId), JSON.stringify(calib)); }, [uid, gameDayId, calib]);

  const H = useMemo(
    () => (calib.corners.length === 4 ? solveHomography(calib.corners, CALIBRATION_CORNERS) : null),
    [calib.corners],
  );
  const Hinv = useMemo(() => (H ? invertHomography(H) : null), [H]);
  const cameraChecks = useMemo(() => (settings ? assessCamera(settings) : []), [settings]);
  const cmPerPixel = useMemo(() => (H ? worstCmPerPixel(H, calib.corners) : null), [H, calib.corners]);

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

  /** Toque na imagem (coordenadas do VÍDEO): marca o próximo canto. */
  const addCorner = useCallback((pt) => {
    setCalib((c) => ({ ...c, corners: c.corners.length >= 4 ? [pt] : [...c.corners, pt] }));
  }, []);
  const resetCorners = useCallback(() => setCalib((c) => ({ ...c, corners: [] })), []);

  /** Toque na bola parada: aprende a cor dela. */
  const learnBallColor = useCallback((pt) => {
    const v = videoRef.current;
    if (!v) return;
    const cv = document.createElement('canvas');
    cv.width = 5; cv.height = 5;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(v, pt.x - 2, pt.y - 2, 5, 5, 0, 0, 5, 5);
    const d = ctx.getImageData(2, 2, 1, 1).data;
    setCalib((c) => ({ ...c, hue: Math.round(rgbToHsv(d[0], d[1], d[2]).h) }));
  }, []);

  // A análise, quadro a quadro.
  useEffect(() => {
    const video = videoRef.current;
    if (!running || !video || !H) return undefined;
    let cancelled = false;
    let pose = null;
    const engine = createLineCallEngine({ H });
    const scan = document.createElement('canvas');
    const sctx = scan.getContext('2d', { willReadFrequently: true });
    const snap = document.createElement('canvas');
    let prev = null;
    let last = null;
    let frames = 0;
    let since = performance.now();
    let handle = null;

    setPoseState('loading');
    createPoseDetector()
      .then((p) => { if (cancelled) p.close(); else { pose = p; setPoseState('ready'); } })
      .catch(() => { if (!cancelled) setPoseState('failed'); });

    const schedule = (fn) => (video.requestVideoFrameCallback
      ? video.requestVideoFrameCallback(fn)
      : requestAnimationFrame(() => fn(performance.now(), { mediaTime: performance.now() / 1000 })));

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
        const got = pickBall(cands, last ? { x: last.x * k, y: last.y * k } : null);
        last = got ? { x: got.x / k, y: got.y / k } : null;
        setBall(last);
        let players = [];
        try { players = pose ? pose.detect(video, now) : []; } catch { players = []; }
        const t = meta?.mediaTime ?? now / 1000;
        const found = engine.push({ t, ball: last, players });
        if (found.length) {
          snap.width = 320;
          snap.height = Math.round(h * (320 / w));
          snap.getContext('2d').drawImage(video, 0, 0, snap.width, snap.height);
          const image = snap.toDataURL('image/jpeg', 0.7);
          const at = Date.now();
          setEvents((list) => [...found.map((e) => ({ ...e, image, at, vw: w, vh: h })), ...list].slice(0, MAX_EVENTS));
        }
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
      setBall(null);
      setFps(0);
    };
  }, [running, H, calib.hue]);

  return {
    videoRef, cameras, start, stream, settings, cameraError, cameraChecks,
    calib, addCorner, resetCorners, learnBallColor, H, Hinv, cmPerPixel,
    running, setRunning, poseState, events, clearEvents: () => setEvents([]), fps, ball,
  };
}
