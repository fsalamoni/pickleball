/**
 * Simulador de quadra para os TESTES do motor de linhas: uma câmera de
 * verdade (posição, foco, imagem), a bola numa trajetória com gravidade e
 * jogadores com pés e punhos — tudo projetado na imagem, quadro a quadro,
 * com o que a rede esconde e um pouco de ruído. Só os testes usam.
 */

import { solveHomography } from '../homography.js';
import { COURT, COURT_POINTS, BALL_RADIUS } from '../court.js';

const G_ACC = 9.81;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crossV = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const n = Math.hypot(...a); return a.map((v) => v / n); };
const dotV = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Gerador pseudoaleatório com semente (o mesmo ruído a cada execução). */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Uma câmera em `C` olhando para `L`, foco `f` em pixels.
 * `corners`: os pontos da calibração (ids de `COURT_POINTS`), na ordem.
 */
export function makeCamera({ C, L, f, w = 1920, h = 1080, corners = ['A1', 'A2', 'B2', 'B1'], tapErrPx = 0, seed = 7 }) {
  const fwd = norm(sub(L, C));
  const right = norm(crossV(fwd, [0, 0, 1]));
  const down = crossV(fwd, right);
  const project = ([X, Y, Z]) => {
    const d = sub([X, Y, Z], C);
    const zc = dotV(d, fwd);
    if (zc <= 0.1) return null;
    return { x: (f * dotV(d, right)) / zc + w / 2, y: (f * dotV(d, down)) / zc + h / 2 };
  };
  const r = rng(seed);
  const img = corners.map((id) => {
    const p = project([COURT_POINTS[id].x, COURT_POINTS[id].y, 0]);
    return { x: p.x + (r() - 0.5) * 2 * tapErrPx, y: p.y + (r() - 0.5) * 2 * tapErrPx };
  });
  const H = solveHomography(img, corners.map((id) => COURT_POINTS[id]));
  return { C, H, project, size: { w, h }, inImage: (p) => p && p.x >= 0 && p.y >= 0 && p.x <= w && p.y <= h };
}

/** A rede esconde o ponto (3D) desta câmera? */
export function netBlocks(C, P) {
  const N = COURT.NET_Y;
  const dy = P[1] - C[1];
  if (Math.abs(dy) < 1e-9) return false;
  const s = (N - C[1]) / dy;
  if (!(s > 0 && s < 1)) return false;
  const x = C[0] + s * (P[0] - C[0]);
  const z = C[2] + s * (P[2] - C[2]);
  return x >= -0.3 && x <= COURT.WIDTH + 0.3 && z >= 0 && z < 0.89;
}

/**
 * A bola: passa por cada ponto `{ t, p: [x, y, z] }` no instante dado; entre
 * eles, uma parábola com gravidade. Quique é um ponto com z = raio da bola.
 */
export function ballPath(points) {
  return (t) => {
    if (t < points[0].t || t > points[points.length - 1].t) return null;
    let i = 0;
    while (i < points.length - 2 && t > points[i + 1].t) i += 1;
    const a = points[i];
    const b = points[i + 1];
    const dt = b.t - a.t;
    const s = t - a.t;
    const vz = (b.p[2] - a.p[2] + 0.5 * G_ACC * dt * dt) / dt;
    return [
      a.p[0] + ((b.p[0] - a.p[0]) * s) / dt,
      a.p[1] + ((b.p[1] - a.p[1]) * s) / dt,
      a.p[2] + vz * s - 0.5 * G_ACC * s * s,
    ];
  };
}

/** Ponto de quique (o centro da bola encostada no chão). */
export const bounce = (t, x, y) => ({ t, p: [x, y, BALL_RADIUS] });
/** Ponto de batida (na raquete). */
export const hit = (t, x, y, z = 0.9) => ({ t, p: [x, y, z] });

/**
 * Um jogador parado (ou andando por `moves`), virado para a rede.
 * Os pés: calcanhar esquerdo, calcanhar direito, ponta esquerda, ponta direita
 * (a ordem do detector). `lift`: [{ from, to, foot: 0|1, z }] pé no ar.
 * `wrist(t)`: onde está o punho (padrão: ao lado, na altura da cintura).
 */
export function player({ x, y, moves = [], lift = [], wrist = null, stance = 0.32 }) {
  const facing = y < COURT.NET_Y ? 1 : -1;
  const at = (t) => {
    let px = x;
    let py = y;
    moves.forEach((m) => {
      if (t <= m.from) return;
      const k = Math.min(1, (t - m.from) / Math.max(m.to - m.from, 1e-6));
      px += (m.dx || 0) * k;
      py += (m.dy || 0) * k;
    });
    return [px, py];
  };
  return {
    facing,
    at,
    feet(t) {
      const [cx, cy] = at(t);
      // no ar, o pé sobe e desce num arco (pulo), até a altura `z`
      const z = (foot) => {
        const l = lift.find((q) => q.foot === foot && t >= q.from && t <= q.to);
        return l ? 0.03 + l.z * Math.sin((Math.PI * (t - l.from)) / (l.to - l.from)) : 0.03;
      };
      const xs = [cx - stance / 2, cx + stance / 2];
      return [
        [xs[0], cy - facing * 0.12, z(0)],
        [xs[1], cy - facing * 0.12, z(1)],
        [xs[0], cy + facing * 0.14, z(0)],
        [xs[1], cy + facing * 0.14, z(1)],
      ];
    },
    wrist(t) {
      if (wrist) return wrist(t);
      const [cx, cy] = at(t);
      return [cx + 0.35, cy + facing * 0.15, 0.95];
    },
  };
}

/**
 * Os quadros que a câmera vê, de `from` a `to`. A bola some quando a rede a
 * esconde ou sai da imagem; o pé escondido pela rede sai com visibilidade baixa.
 */
export function frames({ cam, ball, players = [], fps = 60, from, to, ballNoisePx = 0.6, poseNoisePx = 1.5, seed = 3 }) {
  const r = rng(seed);
  const n = (s) => (r() - 0.5) * 2 * s;
  const out = [];
  for (let i = 0; ; i += 1) {
    const t = from + i / fps;
    if (t > to + 1e-9) break;
    const bp = ball(t);
    let b = null;
    if (bp && !netBlocks(cam.C, bp)) {
      const q = cam.project(bp);
      if (cam.inImage(q)) b = { x: q.x + n(ballNoisePx), y: q.y + n(ballNoisePx) };
    }
    const ps = players.map((pl) => {
      const feet = pl.feet(t).map((P) => {
        const q = cam.project(P);
        if (!q) return { x: 0, y: 0, v: 0 };
        return { x: q.x + n(poseNoisePx), y: q.y + n(poseNoisePx), v: netBlocks(cam.C, P) || !cam.inImage(q) ? 0.1 : 0.95 };
      });
      const wq = cam.project(pl.wrist(t));
      return { feet, wrists: wq ? [{ x: wq.x + n(poseNoisePx), y: wq.y + n(poseNoisePx) }] : [] };
    });
    out.push({ t, ball: b, players: ps });
  }
  return out;
}

/** Empurra os quadros num motor e devolve todas as marcações. */
export function run(engine, fr) {
  return fr.flatMap((f) => engine.push(f));
}

/** Câmeras de sempre nos testes. */
export const CAMS = {
  fundoA: () => makeCamera({ C: [3.048, -5, 4], L: [3.048, 8, 0], f: 1000 }),
  fundoB: () => makeCamera({ C: [3.048, COURT.LENGTH + 5, 4], L: [3.048, COURT.LENGTH - 8, 0], f: 1000 }),
  rede1: () => makeCamera({ C: [-3, COURT.NET_Y, 1.6], L: [3.048, COURT.NET_Y, 0], f: 1000, corners: ['KA1', 'KA2', 'KB2', 'KB1'] }),
  // de cima, a 7 m, no centro da quadra (um quase nada inclinada, para a imagem ter um "para cima")
  topo: () => makeCamera({ C: [COURT.WIDTH / 2, COURT.NET_Y, 7], L: [COURT.WIDTH / 2, COURT.NET_Y + 0.01, 0], f: 380 }),
};
