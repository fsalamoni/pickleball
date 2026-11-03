/**
 * O som de cada lance — um toque curto que sai ANTES da voz (a fala leva
 * 200–500 ms para começar; o toque, alguns milissegundos). Puro: notas em Hz e
 * duração em ms; quem toca é `services/alertSound.js`.
 *
 * Cada lance tem um desenho diferente, para quem está em quadra reconhecer de
 * ouvido sem olhar a tela: fora = dois agudos; falta de pé = zumbido grave;
 * revisar = um médio; dentro = um clique curto (só se a pessoa quiser).
 */

/** @typedef {{ hz: number, ms: number, gapMs?: number, type?: OscillatorType }} Note */

/** @type {Readonly<Record<string, Note[]>>} */
export const CALL_TONES = Object.freeze({
  out: [{ hz: 1320, ms: 110, gapMs: 60 }, { hz: 1320, ms: 160 }],
  fault: [{ hz: 220, ms: 380, type: 'sawtooth' }],
  review: [{ hz: 660, ms: 180 }],
  in: [{ hz: 880, ms: 45 }],
});

/**
 * As notas de um lance, ou `[]` quando ele não toca.
 * @param {string} call  `in` | `out` | `fault` | `review`
 * @param {{ playIn?: boolean }} [opts]  tocar também o "dentro"
 */
export function tonesFor(call, { playIn = false } = {}) {
  if (call === 'in' && !playIn) return [];
  return CALL_TONES[call] || [];
}

/** Duração total (ms) de uma sequência. */
export const tonesDuration = (notes) => notes.reduce((s, n) => s + n.ms + (n.gapMs || 0), 0);
