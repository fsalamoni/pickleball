/**
 * A câmera, pelo navegador (`getUserMedia`). Serve qualquer câmera que o
 * sistema enxergue como câmera: a do próprio celular/tablet, webcam USB
 * (UVC), placa de captura HDMI (GoPro, filmadora) e câmera virtual (OBS, que
 * também recebe câmera IP por RTSP). Câmera Wi-Fi/IP direto no navegador não
 * existe — ver docs/53-CONTROLE-DE-LINHAS.md §3.
 */

import { t } from '@/core/i18n';

/** As câmeras disponíveis (os nomes só aparecem depois da permissão). */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || t('Câmera {n}', { n: i + 1 }) }));
}

/**
 * Abre a câmera pedindo o MÁXIMO de quadros (o motor precisa) e Full HD.
 * O que a câmera de fato entregou vem em `settings`.
 */
export async function openCamera(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera-unsupported');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }),
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 120, min: 24 },
    },
  });
  const track = stream.getVideoTracks()[0];
  return { stream, settings: track?.getSettings?.() || {} };
}

export function closeCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}
