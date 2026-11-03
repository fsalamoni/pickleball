/**
 * O REPLAY de um lance — os quadros de pouco antes a pouco depois do quique
 * ou do voleio, guardados SÓ no aparelho que filmou (nada vai ao banco).
 *
 * A câmera mantém uma fita circular dos últimos segundos (`createFrameRing`).
 * Quando o motor marca um lance, o aparelho espera `AFTER_S` para ter o
 * "depois" e recorta a janela `[t − BEFORE_S, t + AFTER_S]` (`clipWindow`).
 * Puro: o que é cada quadro (um canvas, uma imagem) é problema de quem chama.
 */

export const REPLAY = Object.freeze({
  /** quanto guardar antes do lance (s) */
  BEFORE_S: 1.2,
  /** quanto guardar depois do lance (s) */
  AFTER_S: 0.6,
  /** a fita guarda um pouco mais que o recorte (s) */
  RING_S: 2.4,
  /** teto de quadros na fita (memória do celular) */
  RING_MAX: 150,
  /** quantos replays ficam guardados no aparelho */
  KEEP: 12,
});

/**
 * Fita circular por TEMPO: guarda os quadros dos últimos `seconds`. Devolve o
 * que saiu, para quem chama reaproveitar (canvas) ou soltar (URL).
 */
export function createFrameRing({ seconds = REPLAY.RING_S, max = REPLAY.RING_MAX } = {}) {
  const items = [];
  return {
    /** @returns {Array<object>} os quadros que saíram da fita */
    push(frame) {
      items.push(frame);
      const out = [];
      while (items.length > max || (items.length > 1 && frame.t - items[0].t > seconds)) out.push(items.shift());
      return out;
    },
    between(t0, t1) {
      return items.filter((f) => f.t >= t0 && f.t <= t1);
    },
    get size() { return items.length; },
    clear() { return items.splice(0); },
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
