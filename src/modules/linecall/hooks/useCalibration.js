/**
 * useCalibration — a marcação dos pontos de UMA câmera sobre uma imagem: o
 * vídeo ao vivo (no aparelho que filma) ou a FOTO que a câmera mandou (na
 * central, docs/53 §5d). A mesma conta nos dois lugares: os pontos tocados, a
 * área vigiada, o "Grudar na linha", o 5º ponto e a cor da bola.
 *
 * O estado fica com quem chama (`calib`/`setCalib`): o aparelho que filma o
 * guarda no navegador; a central, só enquanto a tela está aberta.
 */

import { useCallback, useMemo, useRef } from 'react';
import { solveHomography, invertHomography } from '../domain/homography.js';
import { calibrationPoints } from '../domain/cameraLayouts.js';
import { rgbToHsv } from '../domain/ballDetection.js';
import { worstCmPerPixel } from '../domain/cameraCheck.js';
import { checkPointFor, calibrationCheck } from '../domain/calibrationCheck.js';
import { zoneById, zoneCalibrationPoints, zoneCheckPoint } from '../domain/zones.js';
import { snapToOuterCorner, centroid } from '../domain/snapCorner.js';

/** Os cantos da quadra (os únicos que o "Grudar na linha" mexe). */
const COURT_CORNER_IDS = ['A1', 'A2', 'B1', 'B2'];

/** O tamanho da imagem do elemento: vídeo (`videoWidth`) ou foto (`naturalWidth`). */
export function mediaSize(el) {
  const w = el?.videoWidth || el?.naturalWidth || 0;
  const h = el?.videoHeight || el?.naturalHeight || 0;
  return { w, h };
}

/**
 * @param {string} positionId  id em `CAMERA_POSITIONS`
 * @param {object} calib       `{ corners, hue, hueSet?, zone?, checkTap? }` (pontos em pixels da imagem)
 * @param {Function} setCalib
 * @param {{ current: HTMLVideoElement|HTMLImageElement|null }} mediaRef
 */
export function useCalibration(positionId, calib, setCalib, mediaRef) {
  // A área vigiada (quadra inteira ou uma parte) decide os pontos tocados e o que a câmera marca.
  const zone = zoneById(calib.zone).id;
  const targets = useMemo(() => zoneCalibrationPoints(zone) || calibrationPoints(positionId), [zone, positionId]);
  const checkPoint = useMemo(() => zoneCheckPoint(zone) || checkPointFor(positionId), [zone, positionId]);
  const H = useMemo(
    () => (calib.corners.length === 4 ? solveHomography(calib.corners, targets) : null),
    [calib.corners, targets],
  );
  const Hinv = useMemo(() => (H ? invertHomography(H) : null), [H]);
  const cmPerPixel = useMemo(() => (H ? worstCmPerPixel(H, calib.corners) : null), [H, calib.corners]);
  // A conferência do 5º ponto vale para ESTA calibração: marcar de novo apaga.
  const check = useMemo(
    () => (H && calib.checkTap ? calibrationCheck(H, calib.checkTap, checkPoint) : null),
    [H, calib.checkTap, checkPoint],
  );

  /** Toque na imagem (coordenadas da IMAGEM): marca o próximo ponto. */
  const addCorner = useCallback((pt) => {
    setCalib((c) => ({ ...c, checkTap: null, corners: c.corners.length >= 4 ? [pt] : [...c.corners, pt] }));
  }, [setCalib]);
  /** Arrasta um ponto já marcado (ajuste fino com a lupa). */
  const moveCorner = useCallback((i, pt) => {
    setCalib((c) => ({ ...c, checkTap: null, corners: c.corners.map((p, j) => (j === i ? pt : p)) }));
  }, [setCalib]);
  /**
   * "Grudar na linha": leva os cantos da QUADRA para a borda externa do L
   * branco (`domain/snapCorner.js`). As pontas da cozinha ficam como estão.
   * Devolve quantos pontos andaram; o anterior fica guardado para desfazer.
   */
  const snapBackup = useRef(null);
  const snapCorners = useCallback(() => {
    const el = mediaRef.current;
    const { w, h } = mediaSize(el);
    if (!w || calib.corners.length !== 4) return 0;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(el, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h).data;
    const mid = centroid(calib.corners);
    let moved = 0;
    const next = calib.corners.map((p, i) => {
      if (!COURT_CORNER_IDS.includes(targets[i]?.id)) return p;
      const q = snapToOuterCorner(img, w, h, p, mid);
      if (!q) return p;
      moved += 1;
      return q;
    });
    if (!moved) return 0;
    snapBackup.current = calib.corners;
    setCalib((c) => ({ ...c, checkTap: null, corners: next }));
    return moved;
  }, [calib.corners, targets, mediaRef, setCalib]);
  const undoSnap = useCallback(() => {
    const prev = snapBackup.current;
    snapBackup.current = null;
    if (prev) setCalib((c) => ({ ...c, checkTap: null, corners: prev }));
  }, [setCalib]);
  /** Troca a área vigiada: os pontos são outros, então a marcação recomeça. */
  const setZone = useCallback((id) => setCalib((c) => (zoneById(c.zone).id === id ? c : { ...c, zone: id, corners: [], checkTap: null })), [setCalib]);
  const resetCorners = useCallback(() => setCalib((c) => ({ ...c, corners: [], checkTap: null })), [setCalib]);
  /** Toque no 5º ponto (o de conferência). */
  const setCheckTap = useCallback((pt) => setCalib((c) => ({ ...c, checkTap: pt })), [setCalib]);
  /** Toque na bola parada: aprende a cor dela. */
  const learnBallColor = useCallback((pt) => {
    const el = mediaRef.current;
    if (!el) return;
    const cv = document.createElement('canvas');
    cv.width = 5; cv.height = 5;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(el, pt.x - 2, pt.y - 2, 5, 5, 0, 0, 5, 5);
    const d = ctx.getImageData(2, 2, 1, 1).data;
    setCalib((c) => ({ ...c, hue: Math.round(rgbToHsv(d[0], d[1], d[2]).h), hueSet: true }));
  }, [mediaRef, setCalib]);

  return {
    calib, zone, targets, checkPoint, H, Hinv, cmPerPixel, check,
    setZone, addCorner, moveCorner, resetCorners, snapCorners, undoSnap, setCheckTap, learnBallColor,
  };
}
