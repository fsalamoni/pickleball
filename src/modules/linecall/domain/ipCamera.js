/**
 * Câmera IP pela PONTE local (go2rtc ou MediaMTX). O navegador não fala RTSP:
 * a ponte, num computador da arena, converte o vídeo da câmera para WebRTC,
 * e o PickleRush o recebe como se fosse uma câmera comum. Ver
 * docs/53-CONTROLE-DE-LINHAS.md §3.1.
 *
 * Aqui só a regra do ENDEREÇO da ponte, que a pessoa digita. Duas portas
 * fechadas de propósito: endereço de câmera (rtsp://) não é o da ponte, e
 * usuário/senha nunca entram no PickleRush — a credencial da câmera fica no
 * arquivo da ponte, no computador da arena.
 */

/** O endereço de exemplo da go2rtc no mesmo computador. */
export const IP_BRIDGE_EXAMPLE = 'http://localhost:1984/api/webrtc?src=quadra1';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Confere o endereço da ponte.
 * @param {string} text o que a pessoa digitou
 * @returns {{ ok: true, url: string, local: boolean } | { ok: false, error: 'ip-url-invalid'|'ip-rtsp'|'ip-credentials' }}
 *   `local` = rede da arena (não é o próprio computador): o Chrome pede a
 *   permissão de "rede local" para esse caso.
 */
export function parseBridgeUrl(text) {
  const raw = String(text || '').trim();
  if (/^rtsps?:\/\//i.test(raw)) return { ok: false, error: 'ip-rtsp' };
  let u;
  try { u = new URL(raw); } catch { return { ok: false, error: 'ip-url-invalid' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, error: 'ip-url-invalid' };
  if (u.username || u.password) return { ok: false, error: 'ip-credentials' };
  return { ok: true, url: u.href, local: !LOOPBACK.has(u.hostname) };
}

/**
 * O que a câmera ENTREGA, lido das estatísticas da conexão (quadros e
 * tamanho que de fato chegaram) — o anúncio da câmera não conta.
 * @param {Iterable<object>} reports os relatórios de `pc.getStats()`
 * @returns {{ width?: number, height?: number, frameRate?: number }}
 */
export function inboundVideoSettings(reports) {
  for (const r of reports) {
    if (r?.type === 'inbound-rtp' && (r.kind === 'video' || r.mediaType === 'video')) {
      return { width: r.frameWidth, height: r.frameHeight, frameRate: r.framesPerSecond };
    }
  }
  return {};
}
