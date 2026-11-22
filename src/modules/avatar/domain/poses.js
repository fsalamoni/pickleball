/**
 * POSES e MOVIMENTOS do avatar (puro).
 *
 * O corpo 3D tem poucas juntas. Ângulos em graus; `bob` e `tossY` em unidades
 * da cena (o avatar tem ~1,9 de altura). "r" é o braço DIREITO do avatar (o da
 * raquete, à esquerda de quem olha), "l" o esquerdo.
 *
 *   rA / lA  abrir o braço para o lado          rF / lF  levar o braço à frente
 *   rT / lT  girar o braço (para dentro = +)    rE / lE  dobrar o cotovelo
 *   pP pY pR raquete na mão: inclinar, virar, rolar
 *   lean twist bend   tronco: para a frente, girar, para o lado
 *   headNod headTurn headTilt   cabeça
 *   stance crouch     abrir as pernas, dobrar os joelhos
 *   bob               sair do chão (pulo)        tossY  a bola acima da mão
 *
 * Um movimento é uma lista de quadros-chave `{ at: 0–1, ...juntas }` sobre
 * uma pose de partida; `poseAt` interpola com suavização.
 */

/** @typedef {Record<string, number> & { ball: boolean }} AvatarPose */

const BASE = Object.freeze({
  rA: 10, rF: 4, rT: 10, rE: 14, pP: 48, pY: 0, pR: 0,
  lA: 10, lF: 4, lT: 10, lE: 14,
  lean: 0, twist: 0, bend: 0, hipTwist: 0,
  headNod: 0, headTurn: 0, headTilt: 0,
  stance: 5, crouch: 0, bob: 0, tossY: 0, ball: false,
});

export const POSE_JOINTS = Object.freeze({
  // Posição de espera: joelhos soltos, raquete à frente do peito.
  ready: {
    ...BASE, rA: 14, rF: 34, rT: 38, rE: 92, pP: 22, pY: -12, pR: 0,
    lA: 12, lF: 30, lT: 46, lE: 84, lean: 7, stance: 11, crouch: 13, headNod: -4,
  },
  // Pronto para sacar: a bola na mão esquerda, a raquete atrás.
  serve: {
    ...BASE, rA: 22, rF: -24, rT: 0, rE: 26, pP: 62, pY: 0, pR: 20,
    lA: 6, lF: 52, lT: 8, lE: 38, ball: true, lean: 6, twist: -22, hipTwist: -8,
    headTurn: 14, stance: 9, crouch: 9,
  },
  // Raquete no ombro, mão na cintura.
  shoulder: {
    ...BASE, rA: 80, rF: 16, rT: -78, rE: 96, pP: 80, pY: 0, pR: 80,
    lA: 44, lF: -12, lT: 74, lE: 100, bend: -3, headTilt: 5, stance: 7,
  },
  // Comemoração: braços para o alto.
  celebrate: {
    ...BASE, rA: 146, rF: 10, rT: -20, rE: 18, pP: 72, pY: 0, pR: 0,
    lA: 140, lF: 8, lT: -30, lE: 26, lean: -4, headNod: -8, stance: 10, bob: 0.02,
  },
  // Aceno com a mão livre.
  wave: {
    ...BASE, rA: 20, rF: 10, rT: 14, rE: 24, pP: 82,
    lA: 120, lF: 6, lT: -90, lE: 60, bend: 3, headTilt: -6, stance: 6,
  },
});

export function poseJoints(poseId) {
  return POSE_JOINTS[poseId] || POSE_JOINTS.ready;
}

/** Os movimentos que o avatar sabe fazer ao toque. */
export const MOTIONS = Object.freeze({
  // Saque por baixo (a regra do pickleball): solta a bola, leva a raquete atrás e bate de baixo para cima.
  serve: {
    duration: 1700,
    from: 'serve',
    frames: [
      { at: 0 },
      { at: 0.22, rF: -46, rE: 16, twist: -32, tossY: 0.05, lF: 60, crouch: 14 },
      { at: 0.4, rF: -52, rE: 12, twist: -34, tossY: 0.02, lF: 56, lE: 30 },
      { at: 0.56, rF: 28, rE: 24, pP: 30, twist: 6, lean: 2, tossY: -0.2, lF: 30, lE: 20, crouch: 6 },
      { at: 0.6, rF: 44, rE: 26, pP: 26, twist: 10, lean: 2, tossY: -0.24, lF: 28, lE: 20, crouch: 5, ball: false },
      { at: 0.76, rF: 96, rA: 12, rE: 46, pP: 6, twist: 26, hipTwist: 10, lean: -3, lF: 8, lE: 24, crouch: 2, ball: false },
      { at: 0.9, rF: 104, rE: 60, twist: 28, ball: false },
      { at: 1, ball: true },
    ],
  },
  // Comemoração: dois pulos com os braços para o alto.
  celebrate: {
    duration: 1400,
    from: 'celebrate',
    frames: [
      { at: 0 },
      { at: 0.12, bob: 0, crouch: 16, rA: 128, lA: 124 },
      { at: 0.3, bob: 0.2, crouch: 0, rA: 158, lA: 154 },
      { at: 0.48, bob: 0, crouch: 15, rA: 130, lA: 126 },
      { at: 0.66, bob: 0.22, crouch: 0, rA: 160, lA: 156 },
      { at: 0.86, bob: 0, crouch: 12 },
      { at: 1 },
    ],
  },
  // Aceno: o antebraço vai e volta.
  wave: {
    duration: 1500,
    from: 'wave',
    frames: [
      { at: 0 },
      { at: 0.18, lE: 86 },
      { at: 0.38, lE: 34 },
      { at: 0.58, lE: 86 },
      { at: 0.78, lE: 34 },
      { at: 1 },
    ],
  },
  // Drive de forehand a partir da posição de espera.
  swing: {
    duration: 1200,
    from: 'ready',
    frames: [
      { at: 0 },
      { at: 0.3, rA: 46, rF: -8, rT: 0, rE: 44, pP: 30, twist: -36, hipTwist: -12, lF: 44, lE: 50, crouch: 17 },
      { at: 0.52, rA: 30, rF: 60, rT: 30, rE: 34, pP: 14, twist: 12, lean: 4, crouch: 10 },
      { at: 0.72, rA: 12, rF: 96, rT: 74, rE: 84, pP: 0, twist: 34, hipTwist: 12, lF: 14, lE: 60, crouch: 6 },
      { at: 1 },
    ],
  },
});

/** O movimento que combina com cada pose (o que o toque faz). */
export const POSE_MOTION = Object.freeze({
  ready: 'swing', serve: 'serve', shoulder: 'swing', celebrate: 'celebrate', wave: 'wave',
});

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2);
const NUM = Object.keys(BASE).filter((k) => typeof BASE[k] === 'number');

function lerpPose(a, b, k) {
  const out = { ...a };
  for (const key of NUM) out[key] = a[key] + (b[key] - a[key]) * k;
  out.ball = k < 0.5 ? a.ball : b.ball;
  return out;
}

/**
 * A pose do movimento no instante `p` (0–1). Quadros sem uma junta herdam a
 * pose de partida.
 * @returns {AvatarPose}
 */
export function poseAt(motionId, p, basePoseId) {
  const motion = MOTIONS[motionId];
  const start = poseJoints(basePoseId || motion?.from);
  if (!motion) return start;
  const t = Math.max(0, Math.min(1, p));
  const frames = motion.frames.map((f) => ({ at: f.at, pose: { ...start, ...f } }));
  let i = 0;
  while (i < frames.length - 2 && t > frames[i + 1].at) i += 1;
  const a = frames[i];
  const b = frames[i + 1] || a;
  const span = b.at - a.at || 1;
  return lerpPose(a.pose, b.pose, ease((t - a.at) / span));
}
