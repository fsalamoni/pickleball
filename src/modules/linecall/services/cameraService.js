/**
 * A câmera, pelo navegador (`getUserMedia`). Serve qualquer câmera que o
 * sistema enxergue como câmera: a do próprio celular/tablet, webcam USB
 * (UVC), placa de captura HDMI (GoPro, filmadora) e câmera virtual (OBS, que
 * também recebe câmera IP por RTSP). Câmera IP com RTSP entra pela ponte local
 * (`openIpCamera`) — ver docs/53-CONTROLE-DE-LINHAS.md §3.1.
 */

import { t } from '@/core/i18n';
import { inboundVideoSettings } from '../domain/ipCamera.js';
import { framesFirst } from '../domain/webcamTuning.js';

/** As câmeras disponíveis (os nomes só aparecem depois da permissão). */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const all = await navigator.mediaDevices.enumerateDevices();
  return all.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, label: d.label || t('Câmera {n}', { n: i + 1 }) }));
}

/**
 * Abre a câmera pedindo o MÁXIMO de quadros (o motor precisa) e Full HD.
 * O que a câmera de fato entregou vem em `settings`.
 * @param {string|{ url: string, local: boolean }} [deviceId] a câmera do
 *   aparelho, ou a ponte de uma câmera IP (`parseBridgeUrl`)
 */
export async function openCamera(deviceId) {
  if (deviceId && typeof deviceId === 'object') return openIpCamera(deviceId);
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
  // Abriu em 1080p a 30 podendo 720p a 60? Troca: para a bola, quadro vale mais que pixel.
  let caps = null;
  try { caps = track?.getCapabilities?.() || null; } catch { /* navegador sem getCapabilities */ }
  const troca = framesFirst(track?.getSettings?.(), caps);
  if (troca) {
    try { await track.applyConstraints(troca); } catch { /* fica no modo que abriu */ }
  }
  return { stream, settings: track?.getSettings?.() || {} };
}

// A conexão de cada câmera IP aberta, para fechar junto com o vídeo.
const conexoes = new WeakMap();

const esperar = (ms) => new Promise((r) => { setTimeout(r, ms); });

/**
 * Abre a câmera IP pela ponte local (go2rtc `/api/webrtc?src=…` ou MediaMTX
 * `/…/whep`): oferta WebRTC de só receber, a ponte responde, o vídeo chega
 * como um fluxo comum — calibração, motor e central não percebem a diferença.
 * Erros: `ip-unreachable` (ponte fora do ar, permissão de rede local negada
 * ou navegador que bloqueia), `ip-refused` (a ponte não conhece a câmera),
 * `ip-no-video` (conectou e o vídeo não veio).
 * @param {{ url: string, local: boolean }} bridge o endereço já conferido (`parseBridgeUrl`)
 */
export async function openIpCamera(bridge, { Pc = globalThis.RTCPeerConnection, fetchImpl = globalThis.fetch, timeoutMs = 10000, statsDelayMs = 1500 } = {}) {
  if (!Pc || !fetchImpl) throw new Error('camera-unsupported');
  const pc = new Pc();
  try {
    pc.addTransceiver('video', { direction: 'recvonly' });
    const chegou = new Promise((resolve) => {
      pc.ontrack = (e) => resolve(e.streams?.[0] || new MediaStream([e.track]));
    });
    await pc.setLocalDescription(await pc.createOffer());
    // Sem "trickle": espera os candidatos (na rede local é imediato), com teto.
    if (pc.iceGatheringState !== 'complete') {
      await Promise.race([
        new Promise((r) => pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') r(); })),
        esperar(2000),
      ]);
    }
    let resp;
    try {
      resp = await fetchImpl(bridge.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription.sdp,
        // Chrome (Local Network Access): página segura falando com a rede da
        // arena OU com o próprio computador declara para onde vai e pede a permissão.
        targetAddressSpace: bridge.local ? 'local' : 'loopback',
      });
    } catch {
      throw new Error('ip-unreachable');
    }
    if (!resp.ok) throw new Error('ip-refused');
    await pc.setRemoteDescription({ type: 'answer', sdp: await resp.text() });
    const stream = await Promise.race([chegou, esperar(timeoutMs).then(() => null)]);
    if (!stream) throw new Error('ip-no-video');
    conexoes.set(stream, pc);
    // O que a câmera ENTREGA (quadros e tamanho que chegaram), não o anúncio dela.
    await esperar(statsDelayMs);
    let settings = {};
    try { settings = inboundVideoSettings((await pc.getStats()).values()); } catch { /* sem estatísticas */ }
    if (!settings.frameRate) settings = { ...stream.getVideoTracks()[0]?.getSettings?.(), ...settings };
    return { stream, settings };
  } catch (e) {
    pc.close();
    throw e;
  }
}

export function closeCamera(stream) {
  stream?.getTracks().forEach((t) => t.stop());
  if (stream && conexoes.has(stream)) {
    conexoes.get(stream).close();
    conexoes.delete(stream);
  }
}
