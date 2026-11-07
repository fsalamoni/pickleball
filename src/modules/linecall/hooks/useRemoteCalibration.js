/**
 * useRemoteCalibration — a CENTRAL calibrando uma câmera, sobre a foto que
 * ela mandou (docs/53 §5d). A mesma conta da câmera (`useCalibration`), com
 * os pontos em pixels da FOTO; ao mandar, eles vão em pixels do VÍDEO da
 * câmera (a foto é o vídeo encolhido, `snapScale`).
 *
 * Ao abrir, pede uma foto nova se a do banco não existe ou é velha. A tela
 * começa pelo que a câmera TEM (`cur`) até alguém mexer nos pontos.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '@/core/lib/logger';
import { CAMERA_POSITIONS } from '../domain/cameraLayouts.js';
import { BALL_DEFAULTS } from '../domain/ballDetection.js';
import {
  sanitizeCalib, scaleCalib, snapScale, snapIsStale, remoteState,
} from '../domain/remoteCalib.js';
import { camDocId } from '../services/lineCallSync.js';
import {
  watchCameraCalib, requestCameraSnap, sendCameraCalib, setCameraRun,
} from '../services/lineCalibService.js';
import { useCalibration } from './useCalibration.js';

const EMPTY = () => ({ corners: [], hue: BALL_DEFAULTS.hue });

/**
 * @param {string} host  o caminho da quadra
 * @param {{ uid: string, position: string }|null} cam  a câmera no ar (`line_cams`)
 * @param {string} uid   quem organiza
 */
export function useRemoteCalibration(host, cam, uid) {
  const camId = cam ? camDocId(cam.uid, cam.position) : null;
  const pos = CAMERA_POSITIONS[cam?.position] || CAMERA_POSITIONS.fundo_a;
  const imgRef = useRef(null);
  const [data, setData] = useState(undefined); // undefined = carregando; null = a câmera ainda não mandou nada
  const [error, setError] = useState(null);
  const [calib, setCalibRaw] = useState(EMPTY);
  const dirty = useRef(false);
  const setCalib = useCallback((fn) => { dirty.current = true; setCalibRaw(fn); }, []);
  const [sentMs, setSentMs] = useState(null);
  const [busy, setBusy] = useState(false);
  const pediu = useRef(false);

  useEffect(() => {
    setData(undefined); setError(null); setSentMs(null); pediu.current = false; dirty.current = false; setCalibRaw(EMPTY());
    if (!camId) return undefined;
    return watchCameraCalib(host, camId, setData, (e) => { logger.warn('linhas: calibração remota', e); setError(e); });
  }, [host, camId]);

  const k = snapScale(data?.vw, data?.vh);
  // Foto nova, ninguém mexendo: começa pelo que a câmera tem.
  useEffect(() => {
    if (!data?.snap || dirty.current) return;
    setCalibRaw(scaleCalib(sanitizeCalib(data.cur) || EMPTY(), k));
  }, [data?.snap_ms]); // eslint-disable-line react-hooks/exhaustive-deps

  const pedirFoto = useCallback(() => {
    if (!camId) return Promise.resolve();
    return requestCameraSnap(host, camId, uid).catch((e) => { logger.warn('linhas: pedir foto', e); setError(e); });
  }, [host, camId, uid]);
  // Ao abrir: foto ausente ou velha ⇒ pede uma nova (uma vez).
  useEffect(() => {
    if (!data || pediu.current) return;
    pediu.current = true;
    if (snapIsStale(data, Date.now())) pedirFoto();
  }, [data, pedirFoto]);

  const cal = useCalibration(pos.id, calib, setCalib, imgRef);

  /** Manda a calibração (e, com `run`, já começa a analisar). */
  const send = useCallback(async (run = null) => {
    if (!camId || calib.corners.length !== 4) return;
    setBusy(true);
    try {
      const ms = await sendCameraCalib(host, camId, uid, scaleCalib(calib, 1 / k), run);
      dirty.current = false;
      setSentMs(ms);
    } catch (e) {
      logger.warn('linhas: mandar calibração', e);
      setError(e);
    } finally { setBusy(false); }
  }, [host, camId, uid, calib, k]);

  const setRun = useCallback((run) => (camId ? setCameraRun(host, camId, uid, run) : Promise.resolve()), [host, camId, uid]);

  const state = remoteState(data, sentMs);
  return useMemo(() => ({
    ...cal,
    position: pos,
    videoRef: imgRef,
    still: data?.snap || null,
    snapMs: data?.snap_ms || null,
    ball: null,
    events: [],
    loading: data === undefined && !error,
    missing: data === null,
    error,
    busy,
    sentMs,
    state,
    send,
    setRun,
    pedirFoto,
  }), [cal, pos, data, error, busy, sentMs, state, send, setRun, pedirFoto]);
}
