/**
 * Calibrar uma câmera PELA CENTRAL (docs/53 §5d).
 *
 * Câmera presa no alto de um poste ou atrás do vidro não se calibra pela tela
 * dela. Então a câmera manda à central UMA foto da quadra e quem organiza
 * marca os pontos ali, com o mesmo zoom, lupa e 5º ponto; a central devolve a
 * calibração e a câmera a aplica. Tudo mora em `{quadra}/line_calib/{camId}`:
 *
 * · a câmera grava `snap` (a foto, JPEG em data URL), `vw`/`vh` (o tamanho
 *   real do vídeo), `snap_ms`, `cur` (a calibração que ela tem agora) e
 *   `applied_ms` (a última calibração da central que ela aplicou);
 * · quem organiza grava `calib`/`calib_ms` (a calibração, em pixels do VÍDEO),
 *   `snap_req_ms` (pedir foto nova) e `run`/`run_ms` (começar ou pausar a
 *   análise), e toda escrita dela APAGA a foto.
 *
 * Aqui só a conta: escala entre a foto e o vídeo, limpeza do que veio do
 * banco e o que a câmera tem de fazer com o documento.
 */

import { CAMERA_ZONES } from './zones.js';
import { BALL_DEFAULTS } from './ballDetection.js';

/** Maior lado da foto (px): o bastante para o "Grudar na linha", leve no banco. */
export const SNAP_MAX_W = 1600;
/** Teto do texto da foto (a regra recusa acima): o documento tem 1 MiB. */
export const SNAP_MAX_CHARS = 900000;
/** Foto mais velha que isto é pedida de novo ao abrir a calibração. */
export const SNAP_STALE_MS = 120000;

const finito = (v) => typeof v === 'number' && Number.isFinite(v);
const ponto = (p) => (p && finito(p.x) && finito(p.y) ? { x: p.x, y: p.y } : null);
const ZONE_IDS = new Set(CAMERA_ZONES.map((z) => z.id));

/** Os pontos (cantos e o 5º) multiplicados por `k` — foto ⇄ vídeo. */
export function scaleCalib(c, k) {
  if (!c) return c;
  const s = (p) => (p ? { x: p.x * k, y: p.y * k } : p);
  return { ...c, corners: (c.corners || []).map(s), checkTap: s(c.checkTap || null) };
}

/**
 * O que veio do banco, só com o que a câmera entende: até 4 pontos com
 * números, a área conhecida, a cor da bola num ângulo válido e o 5º ponto.
 */
export function sanitizeCalib(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const corners = (Array.isArray(raw.corners) ? raw.corners : []).map(ponto);
  if (corners.some((p) => !p) || corners.length > 4) return null;
  const out = {
    corners,
    hue: finito(raw.hue) && raw.hue >= 0 && raw.hue <= 360 ? raw.hue : BALL_DEFAULTS.hue,
    checkTap: corners.length === 4 ? ponto(raw.checkTap) : null,
  };
  if (raw.hueSet === true) out.hueSet = true;
  if (ZONE_IDS.has(raw.zone)) out.zone = raw.zone;
  return out;
}

/** A calibração no formato do banco (sem o que é só do aparelho). */
export function calibForDb(c) {
  const s = sanitizeCalib(c);
  if (!s) return null;
  const out = { corners: s.corners, hue: s.hue, checkTap: s.checkTap };
  if (s.hueSet) out.hueSet = true;
  if (s.zone) out.zone = s.zone;
  return out;
}

/**
 * A calibração mandada pela central, nos pixels do vídeo DESTA câmera agora
 * (a resolução pode ter mudado depois da foto). `null` se não há o que aplicar.
 */
export function remoteCalibFor(docData, videoW) {
  const c = sanitizeCalib(docData?.calib);
  if (!c || c.corners.length !== 4) return null;
  const k = finito(docData.vw) && docData.vw > 0 && finito(videoW) && videoW > 0 ? videoW / docData.vw : 1;
  return scaleCalib(c, k);
}

/**
 * A calibração GUARDADA NA QUADRA (o `cur` que ficou no banco de uma vez
 * anterior), para uma câmera que abriu sem nada marcado neste aparelho: a
 * mais recente entre os documentos desta posição, com os quatro pontos,
 * levada aos pixels do vídeo de agora. `null` se não há nenhuma.
 * @param {object[]} docs documentos `line_calib` (o da própria câmera primeiro)
 * @param {number} videoW a largura do vídeo agora
 */
export function savedCalibFor(docs, videoW) {
  const quando = (d) => (finito(d?.cur?.ms) ? d.cur.ms : Math.max(finito(d?.applied_ms) ? d.applied_ms : 0, finito(d?.calib_ms) ? d.calib_ms : 0));
  let best = null;
  (docs || []).forEach((d) => {
    const c = sanitizeCalib(d?.cur);
    if (!c || c.corners.length !== 4) return;
    if (!best || quando(d) > quando(best.d)) best = { d, c };
  });
  if (!best) return null;
  const vw = best.d.vw;
  const k = finito(vw) && vw > 0 && finito(videoW) && videoW > 0 ? videoW / vw : 1;
  return scaleCalib(best.c, k);
}

/**
 * O que a câmera já "viu" de um documento que ficou de uma vez anterior: o
 * começar/pausar antigo NÃO vale de novo (a análise não começa sozinha ao
 * abrir), e a calibração da central já aplicada não volta por cima da que a
 * câmera marcou depois.
 */
export function seenFromSaved(d) {
  if (!d) return { calibMs: 0, runMs: 0, snapMs: 0 };
  const calibMs = finito(d.calib_ms) ? d.calib_ms : 0;
  const applied = finito(d.applied_ms) && d.applied_ms >= calibMs;
  return { calibMs: applied ? calibMs : 0, runMs: finito(d.run_ms) ? d.run_ms : 0, snapMs: finito(d.snap_ms) ? d.snap_ms : 0 };
}

/** A calibração no formato do banco, com a hora em que foi guardada (`cur.ms`). */
export function curForDb(c, now = Date.now()) {
  const out = calibForDb(c);
  return out && out.corners.length === 4 ? { ...out, ms: now } : null;
}

/**
 * O que a câmera faz com o documento que acabou de ler.
 * @param {object|null} d o documento `line_calib`
 * @param {{ calibMs?: number, runMs?: number, snapMs?: number }} seen o que ela já fez
 * @returns {{ applyCalib: boolean, run: boolean|null, sendSnap: boolean }}
 */
export function cameraTodo(d, seen = {}) {
  if (!d) return { applyCalib: false, run: null, sendSnap: false };
  const calibMs = finito(d.calib_ms) ? d.calib_ms : 0;
  const runMs = finito(d.run_ms) ? d.run_ms : 0;
  const reqMs = finito(d.snap_req_ms) ? d.snap_req_ms : 0;
  return {
    applyCalib: calibMs > (seen.calibMs || 0) && Boolean(d.calib),
    run: runMs > (seen.runMs || 0) && typeof d.run === 'boolean' ? d.run : null,
    // A foto que a central pediu e que ainda não saiu (nem a que está no banco é nova).
    sendSnap: reqMs > Math.max(seen.snapMs || 0, finito(d.snap_ms) ? d.snap_ms : 0),
  };
}

/** Quanto a foto encolhe o vídeo (foto = vídeo × k): a mesma conta de quem tira a foto. */
export function snapScale(vw, vh) {
  const m = Math.max(vw || 0, vh || 0);
  return m > 0 ? Math.min(1, SNAP_MAX_W / m) : 1;
}

/** A foto da central precisa ser pedida de novo? (não existe, ou é velha) */
export function snapIsStale(d, now) {
  if (!d?.snap || !finito(d.snap_ms)) return true;
  return now - d.snap_ms > SNAP_STALE_MS;
}

/**
 * Onde está a calibração mandada pela central, para a tela dela:
 * `sending` (nada ainda), `waiting` (a câmera ainda não aplicou) ou `applied`.
 */
export function remoteState(d, sentMs) {
  if (!finito(sentMs)) return 'idle';
  if (finito(d?.applied_ms) && d.applied_ms >= sentMs) return 'applied';
  return 'waiting';
}
