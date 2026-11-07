/**
 * A PONTE COMANDADA PELA PÁGINA (docs/53 §5b). A go2rtc já sabe achar câmeras
 * ONVIF na rede e guardar câmera nova no próprio arquivo; aqui só a leitura
 * das respostas dela e a montagem dos pedidos. Puro: os pedidos de verdade
 * ficam em `services/bridgeService.js`.
 *
 * Formatos lidos do código da go2rtc (1.9.x):
 * - `GET /api/onvif` → `{ sources: [{ name: host, info, url: 'onvif://user:pass@host…' }] }`
 *   (usuário e senha de enfeite; 404 "no sources" = ninguém achado);
 * - `GET /api/onvif?src=onvif://…` → os perfis: `{ name: '… stream0', url: '…?subtype=…' }`
 *   e, quando há, um `'… snapshot'` (`&snapshot`) que não é vídeo;
 * - `GET /api/streams` → `{ nome: { producers: [...] } }`;
 * - `GET /api/streams?src=nome` → `producers[].medias: ['video, recvonly, H264']`;
 * - `PUT /api/streams?name=&src=` cria a câmera E grava no `go2rtc.yaml`.
 */

import { streamName } from './ipCamera.js';

/** Onde a go2rtc escuta por padrão, no próprio computador. */
export const BRIDGE_DEFAULT_BASE = 'http://localhost:1984';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * A raiz da ponte (`http://host:porta`) a partir do que a pessoa digitou ou de
 * um endereço `…/api/webrtc?src=` já salvo. null se não for http(s) ou trouxer senha.
 * @returns {{ base: string, local: boolean } | null}
 */
export function bridgeBase(text) {
  let u;
  try { u = new URL(String(text || '').trim() || BRIDGE_DEFAULT_BASE); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  return { base: `${u.protocol}//${u.host}`, local: !LOOPBACK.has(u.hostname) };
}

/** O espaço de endereço que o Chrome exige declarar (Local Network Access). */
export const addressSpace = (bridge) => (bridge?.local ? 'local' : 'loopback');

/** O endereço que o PickleRush abre para receber o vídeo de uma câmera da ponte. */
export const webrtcUrl = (base, name) => `${base}/api/webrtc?src=${encodeURIComponent(name)}`;

/** Os nomes das câmeras que a ponte já tem (`GET /api/streams`). */
export function streamNames(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return [];
  return Object.keys(json).sort((a, b) => a.localeCompare(b));
}

/**
 * As câmeras ONVIF que a ponte achou na rede.
 * @returns {Array<{ host: string, info: string, url: string }>}
 */
export function onvifDevices(json) {
  const list = Array.isArray(json?.sources) ? json.sources : [];
  const seen = new Set();
  return list.flatMap((s) => {
    let u;
    try { u = new URL(s.url); } catch { return []; }
    if (u.protocol !== 'onvif:' || seen.has(u.host)) return [];
    seen.add(u.host);
    return [{ host: u.hostname, info: String(s.info || '').trim(), url: s.url }];
  });
}

/**
 * O endereço ONVIF com o usuário e a senha DA CÂMERA (os de enfeite saem).
 * Usuário e senha vão escapados: `@`, `:` e `/` não quebram o endereço.
 * null se o endereço não for ONVIF.
 */
export function withOnvifCredentials(url, user, pass) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'onvif:') return null;
  u.username = user ? encodeURIComponent(user) : '';
  u.password = user && pass ? encodeURIComponent(pass) : '';
  return u.href;
}

/**
 * Os perfis de vídeo da câmera (sem a foto). O primeiro é o principal na
 * quase totalidade das câmeras (`stream0`, maior resolução) — é o que vale
 * para medir linha.
 * @returns {Array<{ label: string, url: string, main: boolean }>}
 */
export function onvifProfiles(json) {
  const list = Array.isArray(json?.sources) ? json.sources : [];
  return list
    .filter((s) => typeof s?.url === 'string' && !/[?&]snapshot\b/.test(s.url))
    .map((s, i) => ({ label: String(s.name || '').trim(), url: s.url, main: i === 0 }));
}

/**
 * Um nome de câmera que ainda não existe na ponte.
 * @param {string} wanted   o nome desejado (ex.: o da posição)
 * @param {string[]} taken  os que a ponte já tem
 */
export function freeStreamName(wanted, taken = []) {
  const base = streamName(wanted) || 'camera';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; i < 100; i += 1) if (!used.has(`${base}_${i}`)) return `${base}_${i}`;
  return `${base}_${Date.now()}`;
}

/**
 * O formato do vídeo que a câmera manda, da resposta de `GET /api/streams?src=`.
 * `medias` vem como texto: "video, recvonly, H264".
 * @returns {string|null} 'H264', 'H265', 'MJPEG'… ou null se ainda não se sabe
 */
export function streamVideoCodec(json) {
  const producers = Array.isArray(json?.producers) ? json.producers : [];
  for (const p of producers) {
    for (const m of Array.isArray(p?.medias) ? p.medias : []) {
      const parts = String(m).split(',').map((x) => x.trim());
      if (parts[0] === 'video' && parts[2]) return parts[2].split(/[\s/]/)[0].toUpperCase();
    }
  }
  return null;
}

/** O navegador recebe este vídeo por WebRTC? H.265/HEVC não, de forma confiável. */
export const codecPlaysInBrowser = (codec) => !codec || !/^(H265|HEVC)$/i.test(codec);
