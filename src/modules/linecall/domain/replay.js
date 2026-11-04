/**
 * O REPLAY de um lance — os quadros de pouco antes a pouco depois do quique
 * ou do voleio, guardados SÓ no aparelho que filmou (nada vai ao banco).
 *
 * A câmera mantém uma fita circular dos últimos segundos (`createFrameRing`).
 * Quando o motor marca um lance, o aparelho espera `AFTER_S` para ter o
 * "depois" e recorta a janela `[t − BEFORE_S, t + AFTER_S]` (`clipWindow`).
 * Puro: o que é cada quadro (um canvas, uma imagem) é problema de quem chama.
 *
 * O motor não solta todo lance na hora: o voleio só sai quando o impulso acaba
 * — até `momentumMaxS` depois da batida (11.A.2) — e a quina em dúvida espera
 * o lance seguinte até `resolveS`. A fita cobre esse atraso mais o "antes" do
 * replay; para caber na memória do celular, os últimos `FULL_S` guardam até 60
 * quadros por segundo e os mais velhos, até 30.
 */

import { ENGINE_DEFAULTS } from './lineCallEngine.js';

/** O maior atraso com que o motor solta um lance depois do instante dele (s). */
const LATE_S = Math.max(ENGINE_DEFAULTS.momentumMaxS, ENGINE_DEFAULTS.resolveS);
const BEFORE_S = 1.2;
const FULL_S = 2.4;
const RING_S = LATE_S + BEFORE_S + 0.3;
/** Intervalo mínimo entre dois quadros guardados: 60/s nos recentes, 30/s nos velhos (10% de folga para o relógio do vídeo). */
const FULL_GAP_S = 0.9 / 60;
const OLD_GAP_S = 0.9 / 30;

export const REPLAY = Object.freeze({
  /** quanto guardar antes do lance (s) */
  BEFORE_S,
  /** quanto guardar depois do lance (s) */
  AFTER_S: 0.6,
  /** a fita: o lance mais atrasado do motor, mais o "antes" do replay e uma folga (s) */
  RING_S,
  /** os últimos segundos da fita com todos os quadros (o replay do lance que sai na hora) */
  FULL_S,
  FULL_GAP_S,
  OLD_GAP_S,
  /** teto de quadros na fita (memória do celular): o que as duas taxas guardam, com folga */
  RING_MAX: Math.ceil(FULL_S / FULL_GAP_S + (RING_S - FULL_S) / OLD_GAP_S) + 2,
  /** quantos replays ficam guardados no aparelho */
  KEEP: 12,
});

/**
 * Fita circular por TEMPO: guarda os quadros dos últimos `seconds` — os de até
 * `full` segundos atrás a no máximo um a cada `fullGap`, os mais velhos a um a
 * cada `oldGap`. Devolve o que saiu (ou nem entrou), para quem chama
 * reaproveitar (canvas) ou soltar (URL).
 */
export function createFrameRing({
  seconds = REPLAY.RING_S, full = REPLAY.FULL_S, max = REPLAY.RING_MAX,
  fullGap = REPLAY.FULL_GAP_S, oldGap = REPLAY.OLD_GAP_S,
} = {}) {
  const items = [];
  let old = 0; // quantos do começo da fita já passaram pelo desbaste dos velhos
  return {
    /** @returns {Array<object>} os quadros que saíram da fita (ou nem entraram) */
    push(frame) {
      const out = [];
      const last = items[items.length - 1];
      if (last && frame.t < last.t) {
        // O relógio do vídeo voltou (outra câmera, outro vídeo): a fita recomeça.
        out.push(...items.splice(0));
        old = 0;
      } else if (last && frame.t - last.t < fullGap) {
        return [frame];
      }
      items.push(frame);
      while (old < items.length && frame.t - items[old].t > full) {
        if (old > 0 && items[old].t - items[old - 1].t < oldGap) out.push(...items.splice(old, 1));
        else old += 1;
      }
      while (items.length > max || (items.length > 1 && frame.t - items[0].t > seconds)) {
        out.push(items.shift());
        if (old > 0) old -= 1;
      }
      return out;
    },
    between(t0, t1) {
      return items.filter((f) => f.t >= t0 && f.t <= t1);
    },
    get size() { return items.length; },
    clear() { old = 0; return items.splice(0); },
  };
}

/** A janela de tempo do replay de um lance em `t` (segundos do vídeo). */
export function clipWindow(t, { before = REPLAY.BEFORE_S, after = REPLAY.AFTER_S } = {}) {
  return { from: t - before, to: t + after };
}

/** O índice do quadro mais perto do instante `t` (o quique, no replay). */
export function frameIndexAt(frames, t) {
  let best = 0;
  frames.forEach((f, i) => { if (Math.abs(f.t - t) < Math.abs(frames[best].t - t)) best = i; });
  return best;
}

/** O lance tem replay de verdade: algum quadro guardado. Sem quadro nenhum não há o que ver. */
export const hasReplay = (e) => Boolean(e?.clip?.frames?.length);
