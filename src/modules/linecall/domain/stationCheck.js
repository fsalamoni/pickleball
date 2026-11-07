/**
 * "O que falta neste aparelho?" — o diagnóstico de UMA câmera, no aparelho
 * que filma, e o PRÓXIMO PASSO. Puro.
 *
 * A estação já mostrava tudo isso em selos soltos (quadros, resolução, erro da
 * conferência, bateria, luz, central…). Quem chega na quadra pela primeira vez
 * não sabe qual deles importa nem o que fazer: aqui cada um vira um item com
 * nível e a lista diz a UMA coisa a fazer agora (`next`), na ordem em que se
 * faz na quadra. A tela transforma `next` num botão.
 *
 * Níveis: `ok` (pronto), `todo` (falta fazer), `warn` (funciona, pior),
 * `block` (não julga nada até resolver).
 */

import { CAMERA_LEVEL } from './cameraCheck.js';
import { CHECK_LEVEL } from './calibrationCheck.js';

export const STATION_LIMITS = Object.freeze({ minFps: 24, lowBattery: 20, maxCmPerPixel: 3, slowFrameMs: 33 });

/** Os próximos passos possíveis, na ordem da quadra. Os ids viram botões na tela. */
export const STATION_NEXT = Object.freeze({
  OPEN: 'open_camera',
  CAMERA: 'change_camera',
  MARK: 'mark_points',
  REMARK: 'redo_points',
  CHECK: 'check_point',
  START: 'start',
});

/**
 * @param {{
 *   hasStream?: boolean, cameraChecks?: Array<{ key: string, level: string }>,
 *   calibrated?: boolean, checkLevel?: string|null, cmPerPixel?: number|null,
 *   running?: boolean, fps?: number, frameMs?: number|null, moved?: boolean, dark?: boolean,
 *   battery?: { level?: number|null, charging?: boolean|null },
 *   shareError?: boolean, sharing?: boolean, poseState?: string, usesPose?: boolean,
 * }} st
 * @returns {{ next: string|null, ready: boolean, items: Array<{ code: string, level: string }> }}
 */
export function stationCheck(st = {}) {
  const L = STATION_LIMITS;
  const items = [];
  const add = (code, level) => items.push({ code, level });
  let next = null;
  const want = (step) => { if (!next) next = step; };

  // 1. A câmera
  if (!st.hasStream) {
    add('camera', 'todo');
    want(STATION_NEXT.OPEN);
  } else {
    const checks = st.cameraChecks || [];
    const blocked = checks.some((c) => c.level === CAMERA_LEVEL.BLOCK);
    const weak = checks.some((c) => c.level === CAMERA_LEVEL.WARN);
    add('camera', blocked ? 'block' : weak ? 'warn' : 'ok');
    if (blocked) want(STATION_NEXT.CAMERA);
  }

  // 2. A calibração (só faz sentido com imagem)
  if (st.hasStream) {
    if (st.moved) {
      add('moved', 'block');
      want(STATION_NEXT.REMARK);
    }
    if (!st.calibrated) {
      add('calibration', 'todo');
      want(STATION_NEXT.MARK);
    } else if (!st.checkLevel) {
      add('calibration', 'warn');
      want(STATION_NEXT.CHECK);
    } else if (st.checkLevel === CHECK_LEVEL.REDO) {
      add('calibration', 'block');
      want(STATION_NEXT.REMARK);
    } else {
      add('calibration', st.checkLevel === CHECK_LEVEL.GREAT ? 'ok' : 'warn');
    }
    if (st.calibrated && Number.isFinite(st.cmPerPixel) && st.cmPerPixel > L.maxCmPerPixel) add('far', 'warn');
  }

  // 3. A análise
  if (st.hasStream && st.calibrated) {
    if (!st.running) {
      add('analysis', 'todo');
      want(STATION_NEXT.START);
    } else {
      const slow = (st.fps > 0 && st.fps < L.minFps) || (Number.isFinite(st.frameMs) && st.frameMs > L.slowFrameMs);
      add('analysis', slow ? 'warn' : 'ok');
    }
    if (st.usesPose && st.poseState === 'failed') add('pose', 'warn');
  }

  // 4. O ambiente
  if (st.hasStream && st.dark) add('light', 'warn');
  const bat = st.battery || {};
  if (Number.isFinite(bat.level) && bat.level <= L.lowBattery && bat.charging === false) add('battery', 'warn');
  if (st.hasStream && st.sharing !== false) add('central', st.shareError ? 'warn' : 'ok');

  const ready = !next && !items.some((i) => i.level === 'block' || i.level === 'todo');
  return { next, ready, items };
}
