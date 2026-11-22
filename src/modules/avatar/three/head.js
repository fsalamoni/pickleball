/**
 * A CABEÇA do avatar 3D: crânio, orelhas, olhos com pálpebra (piscam), sobrancelhas,
 * nariz, boca por expressão, barba, cabelo, boné/viseira e óculos.
 *
 * Espaço da cabeça: centro na origem, +y para cima, o rosto olha para +z.
 * "Direito" é o lado direito DO AVATAR (x negativo, à esquerda de quem olha).
 */
import * as THREE from 'three';
import { mix, shade } from '../domain/color.js';
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES, optionOf } from '../domain/catalog.js';
import {
  DEG, clamp, dirOf, hairMaterial, fabricMaterial, mesh, plasticMaterial, radialGeometry, roundedRect,
  shapeOf, sheetGeometry, skinMaterial, smooth, taper, taperTube,
} from './geom.js';
import { blushTexture, eyeTexture, specksTexture } from './tex.js';

export const HEAD_R = 0.36;
const R = HEAD_R;
const HIDE = -0.014; // "por baixo da pele": é como uma camada some fora da sua área

const FACES = {
  oval: { sx: 0.97, sy: 1.03, chin: 0.15, jaw: 0.035, cheek: 0.04 },
  round: { sx: 1.04, sy: 0.97, chin: 0.03, jaw: 0.06, cheek: 0.09 },
  square: { sx: 0.98, sy: 1.02, chin: 0.0, jaw: 0.16, cheek: 0.0 },
  heart: { sx: 1.0, sy: 1.04, chin: 0.36, jaw: -0.035, cheek: 0.07 },
};

/** O formato do rosto: `pt(dir, out, lift)` é o ponto da pele naquela direção. */
function headPoint(face) {
  const f = FACES[face] || FACES.oval;
  return (d, out, lift = 0) => {
    const { x, y, z } = d;
    const t = Math.max(0, -y);
    const w = 1 - f.chin * t ** 1.7 + f.jaw * Math.sin(Math.PI * Math.min(1, t))
      + f.cheek * Math.exp(-(((y + 0.28) / 0.3) ** 2));
    const dz = 1 - f.chin * 0.45 * t ** 1.7;
    return out.set(
      x * (f.sx * w * R + lift),
      y * (f.sy * R + lift),
      z * (0.97 * dz * (z < 0 ? 1.04 : 1) * R + lift),
    );
  };
}

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();

/** Camada colada na cabeça: `liftFn(dir, yaw, pitch)` diz a espessura (HIDE = não existe ali). */
function shell(pt, liftFn, w = 64, h = 48, pole = null) {
  return radialGeometry((d, out) => {
    const lift = liftFn(d, Math.atan2(d.x, d.z), Math.asin(clamp(d.y, -1, 1)));
    return pt(d, out, lift);
  }, w, h, pole);
}

const bumpAt = (d, cx, cy, cz, w) => {
  const n = Math.hypot(cx, cy, cz);
  const ang = Math.acos(clamp((d.x * cx + d.y * cy + d.z * cz) / n, -1, 1));
  return Math.exp(-((ang / w) ** 2));
};
const lumps = (d, f) => Math.sin(d.x * f + 1.3) * Math.sin(d.y * f + 2.1) * Math.sin(d.z * f + 0.7);
const top = (d) => Math.max(0, d.y);

// ------------------------------------------------------------------ expressões

const EXPR = {
  smile: { mouth: { w: 0.105, smile: 0.042 }, low: 0.18 },
  grin: { mouth: { w: 0.12, open: 0.05, smile: 0.05, teeth: 'full' }, low: 0.3 },
  focus: { mouth: { w: 0.062, smile: -0.006 }, brow: { inner: -0.07, raise: -0.025 }, lid: 0.28 },
  wink: { mouth: { w: 0.11, smile: 0.046, skew: 0.012 }, close: { l: 'wink' }, low: 0.25, brow: { raiseR: 0.03 } },
  wow: { mouth: { o: true, w: 0.046, h: 0.058 }, brow: { raise: 0.07 }, lid: -0.3 },
  laugh: { mouth: { w: 0.125, open: 0.105, smile: 0.052, teeth: 'top', tongue: true }, close: { l: 'happy', r: 'happy' }, brow: { raise: 0.03 } },
  cool: { mouth: { w: 0.095, smile: 0.03, skew: 0.028 }, brow: { raiseL: 0.06, inner: -0.02 }, lid: 0.3 },
  shout: { mouth: { w: 0.1, open: 0.115, top: 0.022, smile: -0.012, teeth: 'top', tongue: true }, brow: { inner: -0.085, raise: 0.01 }, lid: 0.1 },
};

// ------------------------------------------------------------------ olhos

const EYE_SHAPE = {
  round: { sx: 1, sy: 1.06, open: -0.92 },
  almond: { sx: 1.13, sy: 0.88, open: -0.78 },
  wide: { sx: 1.1, sy: 1.16, open: -1.02 },
  hooded: { sx: 1.05, sy: 0.98, open: -0.58 },
  lashes: { sx: 1.03, sy: 1.08, open: -0.9, lash: true },
};
const LID_CLOSED = Math.PI / 2;

function buildEye(side, recipe, expr, pt, skin, mats) {
  const S = EYE_SHAPE[recipe.eyes] || EYE_SHAPE.round;
  const re = 0.079;
  const turn = side * 0.2;
  const g = new THREE.Group();
  pt(dirOf(side * 0.335, 0.035, _d), _v);
  g.position.copy(_v).addScaledVector(dirOf(turn, 0, _d), -(re * 0.62 - 0.013));
  g.rotation.y = turn;
  g.scale.set(S.sx, S.sy, 0.62);

  const ball = mesh(new THREE.SphereGeometry(re, 36, 24), mats.eye, { cast: false });
  ball.rotation.y = -Math.PI / 2;
  g.add(ball);

  const rl = re * 1.06;
  const lidMat = mats.lid;
  const closed = expr.close?.[side < 0 ? 'r' : 'l'];
  const open = clamp(S.open + (expr.lid || 0), -1.15, 0.2);
  const upper = mesh(new THREE.SphereGeometry(rl, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), lidMat, { cast: false });
  upper.rotation.x = closed ? LID_CLOSED : open;
  const lash = mesh(new THREE.TorusGeometry(rl, S.lash ? 0.0085 : 0.0055, 8, 56), mats.lash, { cast: false });
  lash.rotation.x = Math.PI / 2;
  upper.add(lash);
  if (S.lash) {
    [0.55, 0.85, 1.12].forEach((a, i) => {
      const cone = mesh(new THREE.ConeGeometry(0.0075, 0.04 - i * 0.004, 6), mats.lash, { cast: false });
      const radial = new THREE.Vector3(side * Math.sin(a), 0, Math.cos(a));
      cone.position.copy(radial).multiplyScalar(rl + 0.012).add(new THREE.Vector3(0, 0.006, 0));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial.add(new THREE.Vector3(0, 0.55, 0)).normalize());
      upper.add(cone);
    });
  }
  g.add(upper);

  const lower = mesh(new THREE.SphereGeometry(rl, 36, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lidMat, { cast: false });
  lower.rotation.x = closed ? 1.5 : 1.12 - (expr.low || 0);
  g.add(lower);

  if (closed) {
    // Olho fechado: um risco curvo (feliz = arco para cima; piscadela = para baixo).
    const up = closed === 'happy' ? 1 : -1;
    const pts = [];
    for (let i = 0; i <= 8; i += 1) {
      const x = (i / 8 - 0.5) * 1.5 * re;
      const y = up * re * 0.3 * (1 - (x / (0.75 * re)) ** 2) - up * re * 0.1;
      const r2 = (rl + 0.004) ** 2 - x * x - y * y;
      pts.push(new THREE.Vector3(x, y, Math.sqrt(Math.max(1e-6, r2))));
    }
    g.add(mesh(taperTube(pts, taper(0.0095, 0.4), { segments: 24, radial: 8 }), mats.lash, { cast: false }));
  }
  return { group: g, upper: closed ? null : upper, open };
}

function buildBrow(side, recipe, expr, pt, mat) {
  const B = {
    natural: { r: 0.017, arch: 0.03 }, thick: { r: 0.024, arch: 0.03 }, arched: { r: 0.016, arch: 0.065 },
    straight: { r: 0.017, arch: 0.004 }, thin: { r: 0.011, arch: 0.035 },
  }[recipe.brows] || { r: 0.017, arch: 0.03 };
  const e = expr.brow || {};
  const raise = (e.raise || 0) + (side > 0 ? e.raiseL || 0 : e.raiseR || 0);
  const pts = [];
  for (let i = 0; i <= 6; i += 1) {
    const s = i / 6;
    const yaw = side * (0.13 + s * 0.41);
    const pitch = 0.365 + raise + B.arch * Math.sin(Math.PI * s ** 0.75) - 0.035 * s * s + (e.inner || 0) * (1 - s) ** 1.5;
    pts.push(pt(dirOf(yaw, pitch, _d), new THREE.Vector3(), 0.003));
  }
  return mesh(taperTube(pts, taper(B.r, 0.42), { segments: 24, radial: 8 }), mat, { cast: false });
}

// ------------------------------------------------------------------ boca

function buildMouth(expr, pt, skin) {
  const M = expr.mouth;
  const g = new THREE.Group();
  const p0 = -0.5;
  const at = (x, y, lift) => pt(dirOf(x / (R * 0.84), p0 + y / R, _d), new THREE.Vector3(), lift);
  const lipDark = new THREE.MeshStandardMaterial({ color: mix(skin, '#5e1f1c', 0.68), roughness: 0.5 });
  const N = 16;
  if (!M.open && !M.o) {
    const pts = [];
    for (let i = 0; i <= 10; i += 1) {
      const k = (i / 10) * 2 - 1;
      pts.push(at(k * M.w, M.smile * k * k - M.smile * 0.55 + (M.skew || 0) * k, 0.002));
    }
    g.add(mesh(taperTube(pts, taper(0.0088, 0.3), { segments: 32, radial: 8 }), lipDark, { cast: false }));
    return g;
  }
  let topY;
  let botY;
  let w = M.w;
  if (M.o) {
    topY = (x) => M.h * Math.sqrt(Math.max(0, 1 - (x / w) ** 2));
    botY = (x) => -topY(x);
  } else {
    const off = -M.smile * 0.5 + M.open * 0.35;
    topY = (x) => (M.top || 0) * (1 - (x / w) ** 2) + M.smile * (x / w) ** 2 + off;
    botY = (x) => -M.open * (1 - (x / w) ** 2) ** 0.75 + M.smile * (x / w) ** 2 + off;
  }
  const xs = Array.from({ length: N + 1 }, (_, i) => ((i / N) * 2 - 1) * w);
  const outline = [...xs.map((x) => [x, topY(x)]), ...xs.slice(1, -1).reverse().map((x) => [x, botY(x)])];
  const decal = (pts2, lift, material) => {
    const geo = new THREE.ShapeGeometry(shapeOf(pts2));
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const p = at(pos.getX(i), pos.getY(i), lift);
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    geo.computeVertexNormals();
    return mesh(geo, material, { cast: false, receive: false });
  };
  g.add(decal(outline, 0.0015, new THREE.MeshStandardMaterial({ color: '#4a121f', roughness: 0.7 })));
  if (M.teeth) {
    const th = M.teeth === 'full' ? M.open * 0.92 : Math.min(0.032, M.open * 0.36);
    const pts2 = [...xs.map((x) => [x, topY(x)]), ...xs.slice().reverse().map((x) => [x, Math.max(topY(x) - th, botY(x))])];
    g.add(decal(pts2, 0.003, new THREE.MeshStandardMaterial({ color: '#fbfaf5', roughness: 0.25 })));
  }
  if (M.tongue) {
    const tw = w * 0.72;
    const txs = xs.filter((x) => Math.abs(x) <= tw);
    const th = M.open * 0.42;
    const pts2 = [...txs.map((x) => [x, botY(x)]), ...txs.slice().reverse().map((x) => [x, botY(x) + th * (1 - (x / tw) ** 2) ** 0.6])];
    g.add(decal(pts2, 0.003, new THREE.MeshStandardMaterial({ color: '#ec6f7d', roughness: 0.45 })));
  }
  const lip = new THREE.MeshStandardMaterial({ color: mix(skin, '#b8473f', 0.5), roughness: 0.42 });
  const ring = outline.map(([x, y]) => at(x, y, 0.003));
  g.add(mesh(taperTube(ring, 0.0078, { segments: 48, radial: 8, closed: true }), lip, { cast: false }));
  return g;
}

// ------------------------------------------------------------------ barba

/** Barba por fazer: pontinhos pintados na pele (a borda some aos poucos, sem degrau de malha). */
function stubbleTexture(mask, hex) {
  const W = 512;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let j = 0; j < H; j += 1) {
    const pitch = (0.5 - j / H) * Math.PI;
    for (let i = 0; i < W; i += 1) {
      const phi = (i / W) * 2 * Math.PI;
      const m = mask(Math.atan2(-Math.cos(phi), Math.sin(phi)), pitch);
      const k = (j * W + i) * 4;
      img.data[k] = rgb[0];
      img.data[k + 1] = rgb[1];
      img.data[k + 2] = rgb[2];
      img.data[k + 3] = 255 * m * (0.3 + 0.7 * rnd() ** 1.6);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBeard(recipe, pt, hairColor, skin, bump) {
  const style = recipe.beard;
  if (!style || style === 'none') return null;
  const mouthHole = (yaw, pitch) => smooth(0.75, 1.05, Math.hypot(yaw / 0.44, (pitch + 0.5) / 0.15));
  const jaw = (yaw, pitch) => {
    // Da costeleta até o queixo, passando acima da boca como bigode.
    const ay = Math.abs(yaw);
    const topLine = -0.4 + 0.36 * smooth(0.55, 1.5, ay);
    return smooth(0.02, -0.06, pitch - topLine) * smooth(1.72, 1.5, ay);
  };
  const defs = {
    stubble: { lift: 0.0025, mask: (y, p) => smooth(0.05, -0.12, p - (-0.36 + 0.36 * smooth(0.55, 1.5, Math.abs(y)))) * smooth(1.72, 1.4, Math.abs(y)) * mouthHole(y, p) },
    short: { lift: 0.014, mask: (y, p) => jaw(y, p) * mouthHole(y, p) },
    full: { lift: 0.034, mask: (y, p) => jaw(y, p) * mouthHole(y, p), chin: 0.07 },
    goatee: {
      lift: 0.016,
      mask: (y, p) => Math.max(
        smooth(1.05, 0.8, Math.hypot(y / 0.5, (p + 0.96) / 0.36)),
        smooth(1.05, 0.8, Math.hypot(y / 0.52, (p + 0.5) / 0.24)),
      ) * mouthHole(y, p),
    },
    mustache: { lift: 0.02, mask: (y, p) => smooth(1.05, 0.7, Math.hypot(y / 0.4, (p + 0.345 + 0.05 * (y / 0.4) ** 2) / 0.07)) },
  };
  const D = defs[style];
  if (!D) return null;
  if (style === 'stubble') {
    const mat = new THREE.MeshStandardMaterial({ map: stubbleTexture(D.mask, mix(hairColor, skin, 0.2)), roughness: 0.9, transparent: true, opacity: 0.62, depthWrite: false });
    return mesh(new THREE.SphereGeometry(1, 64, 48).copy(shell(pt, () => D.lift, 64, 48)), mat, { cast: false, receive: false });
  }
  const geo = shell(pt, (d, yaw, pitch) => {
    const m = D.mask(yaw, pitch);
    return HIDE + m * (D.lift - HIDE + (D.chin || 0) * bumpAt(d, 0, -1, 0.35, 0.55));
  }, 72, 56);
  const mat = hairMaterial(hairColor, bump, 0.7);
  return mesh(geo, mat, { cast: false });
}

// ------------------------------------------------------------------ chapéus

const plane = (d, n, c) => d.y * n[1] + d.z * n[2] - c;

/** A elevação em que a linha do chapéu passa, para cada giro. */
function linePitch(n, c, yaw) {
  let p = 0.3;
  for (let i = 0; i < 5; i += 1) p = Math.asin(clamp((c - n[2] * Math.cos(p) * Math.cos(yaw)) / n[1], -1, 1));
  return p;
}

function brim(pt, { n, c, center = 0, spread = 1.15, len = 0.2, drop = 0.16, lift = 0.03, around = false }) {
  return sheetGeometry((u, v, out) => {
    const a = (u - 0.5) * 2 * (around ? Math.PI : spread);
    const yaw = center + a;
    pt(dirOf(yaw, linePitch(n, c, yaw), _d), out, lift - 0.01);
    const f = around ? 1 : Math.cos((a / spread) * (Math.PI / 2)) ** 0.55;
    const fx = around ? Math.sin(yaw) : Math.sin(center) + Math.sin(yaw) * 0.42;
    const fz = around ? Math.cos(yaw) : Math.cos(center) + Math.cos(yaw) * 0.42;
    const k = len * f * v;
    out.x += fx * k;
    out.z += fz * k;
    out.y -= k * drop + (around ? 0.03 * v * v : 0.07 * Math.sin(a) ** 2 * v);
    return out;
  }, around ? 72 : 36, 8, 0.014);
}

function buildHeadwear(recipe, pt, fabricBump) {
  const kind = recipe.headwear;
  if (!kind || kind === 'none') return { group: null, clampHair: null };
  const color = recipe.headwearColor;
  const mat = fabricMaterial(color, { bump: fabricBump });
  const g = new THREE.Group();
  const dome = (n, c, lift, extra = () => 0) => shell(pt, (d) => HIDE + smooth(0, 0.03, plane(d, n, c)) * (lift - HIDE + extra(d)), 72, 72, n);
  const band = (n, c, lo, hi, lift) => shell(pt, (d) => {
    const h = plane(d, n, c);
    return HIDE + smooth(lo, lo + 0.02, h) * smooth(hi, hi - 0.02, h) * (lift - HIDE);
  }, 72, 110, n);
  let clampHair = null;
  if (kind === 'cap' || kind === 'cap_back') {
    const back = kind === 'cap_back';
    const n = back ? [0, 0.95, -0.33] : [0, 0.97, -0.24];
    const c = back ? 0.125 : 0.2;
    g.add(mesh(dome(n, c, 0.04, (d) => 0.03 * bumpAt(d, 0, 0.8, back ? -0.3 : 0.5, 0.7)), mat));
    g.add(mesh(brim(pt, { n, c: c + 0.01, center: back ? Math.PI : 0, lift: 0.04, len: 0.23, drop: back ? 0.5 : 0.1 }), mat));
    const button = mesh(new THREE.SphereGeometry(0.022, 16, 12), mat);
    pt(_d.set(0, 1, back ? 0.05 : -0.12).normalize(), button.position, 0.07);
    button.scale.y = 0.5;
    g.add(button);
    clampHair = (d, lift) => lift - Math.max(0, lift - 0.03) * smooth(-0.07, -0.02, plane(d, n, c));
  } else if (kind === 'visor') {
    const n = [0, 0.97, -0.24];
    const c = 0.27;
    g.add(mesh(band(n, c, -0.03, 0.085, 0.034), mat));
    g.add(mesh(brim(pt, { n, c: c - 0.012, lift: 0.036 }), mat));
    clampHair = (d, lift) => { const h = plane(d, n, c); return lift - Math.max(0, lift - 0.022) * smooth(-0.09, -0.04, h) * smooth(0.16, 0.1, h); };
  } else if (kind === 'headband') {
    const n = [0, 0.94, -0.34];
    const c = 0.3;
    g.add(mesh(band(n, c, -0.05, 0.05, 0.026), mat));
    clampHair = (d, lift) => { const h = plane(d, n, c); return lift - Math.max(0, lift - 0.016) * smooth(-0.12, -0.06, h) * smooth(0.12, 0.06, h); };
  } else if (kind === 'bucket') {
    const n = [0, 0.99, -0.12];
    const c = 0.37;
    g.add(mesh(dome(n, c, 0.05, (d) => -0.03 * top(d) ** 6), mat));
    g.add(mesh(brim(pt, { n, c: c + 0.01, around: true, len: 0.115, drop: 0.32, lift: 0.05 }), mat));
    clampHair = (d, lift) => lift - Math.max(0, lift - 0.035) * smooth(-0.07, -0.02, plane(d, n, c));
  }
  return { group: g, clampHair };
}

// ------------------------------------------------------------------ cabelo

/** Risca do cabelo no meio (um sulco raso no alto da cabeça). */
const part = (d) => 0.016 * Math.exp(-((d.x / 0.035) ** 2)) * smooth(-0.1, 0.4, d.y) * smooth(-0.5, 0.2, d.z);

const HAIR = {
  buzz: { c0: 0.3, back: 0.36, burn: 0.1, lift: () => 0.009 },
  short: { c0: 0.25, back: 0.42, burn: 0.18, lift: (d) => 0.03 + 0.03 * top(d) + 0.03 * bumpAt(d, 0, 0.72, 0.69, 0.5) },
  quiff: { c0: 0.27, back: 0.4, burn: 0.13, lift: (d) => 0.026 + 0.02 * top(d) + 0.16 * bumpAt(d, 0, 0.62, 0.78, 0.4) },
  side: {
    c0: 0.23, back: 0.42, burn: 0.16,
    line: (d) => 0.24 * bumpAt(d, 0.5, 0.6, 0.62, 0.42),
    lift: (d) => 0.034 + 0.02 * top(d) + 0.065 * bumpAt(d, 0.35, 0.8, 0.45, 0.6),
  },
  curly: { c0: 0.2, back: 0.46, burn: 0.1, seg: 2, lift: (d) => 0.07 + 0.02 * top(d) + 0.034 * Math.abs(lumps(d, 12)) },
  afro: { c0: 0.2, back: 0.52, burn: 0.02, seg: 2, lift: (d) => 0.115 + 0.07 * top(d) + 0.02 * lumps(d, 15) },
  ponytail: { c0: 0.26, back: 0.45, burn: 0.14, lift: (d) => 0.027 + 0.012 * top(d), extra: 'ponytail' },
  bun: { c0: 0.26, back: 0.45, burn: 0.14, lift: (d) => 0.027 + 0.012 * top(d), extra: 'bun' },
  braids: {
    c0: 0.25, back: 0.45, burn: 0.14, extra: 'braids',
    lift: (d) => 0.032 - 0.014 * Math.exp(-((d.x / 0.045) ** 2)) * smooth(-0.2, 0.3, d.y),
  },
  bob: {
    c0: 0.22, back: 0.3, burn: 0, seg: 2, grain: true, lift: (d) => 0.05 + 0.015 * top(d) - part(d),
    line: (d) => 0.17 * bumpAt(d, 0, 0.5, 0.86, 0.55),
    curtain: { front: 0.9, bottom: -0.27, rho: 1.13, curl: 0.045 },
  },
  long: { c0: 0.25, back: 0.3, burn: 0, seg: 2, grain: true, lift: (d) => 0.045 + 0.02 * top(d) - part(d), curtain: { front: 0.98, bottom: -0.5, rho: 1.11, drop: 0.1 } },
  wavy: {
    c0: 0.24, back: 0.3, burn: 0, seg: 2, grain: true, lift: (d) => 0.05 + 0.02 * top(d) + 0.012 * lumps(d, 9) - part(d),
    line: (d) => 0.14 * bumpAt(d, -0.45, 0.6, 0.66, 0.4),
    curtain: { front: 0.95, bottom: -0.5, rho: 1.13, wave: 0.022, drop: 0.06 },
  },
  locs: { c0: 0.23, back: 0.46, burn: 0.1, seg: 2, lift: (d) => 0.036 + 0.012 * Math.abs(lumps(d, 17)), extra: 'locs' },
};

function buildHair(recipe, pt, color, clampHair, bump) {
  const S = HAIR[recipe.hair];
  if (!S) return null;
  const g = new THREE.Group();
  const tilt = 25 * DEG;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const c = S.curtain;
  const hatOn = recipe.headwear === 'cap' || recipe.headwear === 'cap_back' || recipe.headwear === 'bucket';
  const fn = (d, out) => {
    const { x, y, z } = d;
    const yaw = Math.atan2(x, z);
    const ay = Math.abs(yaw);
    const pitch = Math.asin(clamp(y, -1, 1));
    const line = y * ct - z * st - S.c0 + S.back * Math.max(0, -z)
      + S.burn * Math.exp(-(((ay - 1.22) / 0.2) ** 2)) + (S.line ? S.line(d) : 0);
    const m = smooth(0, 0.06, line);
    let lift = S.lift(d);
    if (clampHair) lift = clampHair(d, lift);
    pt(d, out, HIDE + m * (lift - HIDE));
    return out;
  };
  const seg = S.seg || 1;
  const mat = recipe.hair === 'buzz'
    ? new THREE.MeshStandardMaterial({ color, roughness: 0.95, transparent: true, opacity: 0.82 })
    : hairMaterial(color, S.seg && !S.grain ? null : bump);
  g.add(mesh(radialGeometry(fn, 72 * seg, 72 * seg, [0, ct, -st]), mat));
  if (c) {
    // O cabelo que CAI (chanel, comprido, ondulado): uma folha grossa em volta da nuca, de uma têmpora à outra.
    const R1 = R * c.rho;
    const yTop = hatOn ? -0.035 : 0.22; // com boné, o cabelo começa abaixo da aba
    const sheet = sheetGeometry((u, v, out) => {
      const yaw = c.front + u * (2 * Math.PI - 2 * c.front);
      const back = Math.sin(Math.PI * u);
      const y = yTop + (c.bottom - (c.drop || 0) * back * back - yTop) * v;
      let rho = y >= 0 ? Math.sqrt(R1 * R1 - y * y) : R1 * (1 + 0.1 * -y);
      rho *= 1 + 0.011 * Math.sin(yaw * 26);
      if (c.wave) rho += c.wave * Math.sin(v * 17 + Math.sin(yaw * 3) * 2.2) * v;
      if (c.curl) rho -= c.curl * smooth(0.65, 1, v);
      rho -= 0.022 * (1 - smooth(0, 0.07, Math.min(u, 1 - u))) * v;
      return out.set(rho * Math.sin(yaw), y, rho * Math.cos(yaw));
    }, 110, 22, c.thick || 0.065);
    g.add(mesh(sheet, hairMaterial(color, bump)));
  }

  const plain = hairMaterial(color, null);
  const tie = plasticMaterial(recipe.topColor2 || '#d4f82e');
  const P = (yaw, pitch, lift = 0) => pt(dirOf(yaw, pitch, _d), new THREE.Vector3(), lift);
  const add = (p, dx, dy, dz) => p.clone().add(new THREE.Vector3(dx, dy, dz));
  if (S.extra === 'ponytail' && !hatOn) {
    const p = P(Math.PI, 0.62, 0.01);
    const pts = [p, add(p, 0, 0.05, -0.1), add(p, 0, -0.06, -0.2), add(p, 0, -0.26, -0.2), add(p, 0, -0.44, -0.13)];
    g.add(mesh(taperTube(pts, (t) => 0.03 + 0.05 * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.1)) ** 0.8 * (1 - t * 0.55), { segments: 40, radial: 14 }), plain));
    const ring = mesh(new THREE.TorusGeometry(0.04, 0.014, 10, 24), tie);
    ring.position.copy(add(p, 0, 0.035, -0.07));
    ring.rotation.x = -0.6;
    g.add(ring);
  }
  if (S.extra === 'ponytail' && hatOn) {
    // Com boné, o rabo sai por baixo, atrás.
    const p = P(Math.PI, -0.05, 0.02);
    const pts = [p, add(p, 0, -0.04, -0.1), add(p, 0, -0.2, -0.13), add(p, 0, -0.38, -0.08)];
    g.add(mesh(taperTube(pts, (t) => 0.03 + 0.04 * Math.sin(Math.PI * Math.min(1, t + 0.15)) * (1 - t * 0.5), { segments: 32, radial: 14 }), plain));
  }
  if (S.extra === 'bun' && !hatOn) {
    const p = P(Math.PI, 0.86, 0.09);
    const bun = mesh(radialGeometry((d, out) => out.copy(d).multiplyScalar(0.12 * (1 + 0.05 * Math.sin(Math.atan2(d.x, d.z) * 9 + d.y * 6))), 40, 28), plain);
    bun.position.copy(p);
    g.add(bun);
    const ring = mesh(new THREE.TorusGeometry(0.075, 0.016, 10, 28), tie);
    ring.position.copy(P(Math.PI, 0.86, 0.02));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ring.position.clone().normalize());
    g.add(ring);
  }
  if (S.extra === 'braids') {
    [-1, 1].forEach((s) => {
      const p = P(s * 1.75, -0.12, 0.012);
      const pts = [p, add(p, s * 0.03, -0.14, 0.03), add(p, s * 0.035, -0.32, 0.09), add(p, s * 0.02, -0.5, 0.12)];
      const curve = new THREE.CatmullRomCurve3(pts);
      g.add(mesh(taperTube(pts, (t) => (0.043 - 0.012 * t) * (1 + 0.2 * Math.sin(t * Math.PI * 11)), { segments: 56, radial: 14 }), plain));
      const ring = mesh(new THREE.TorusGeometry(0.03, 0.012, 10, 24), tie);
      ring.position.copy(curve.getPointAt(0.9));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    });
  }
  if (S.extra === 'locs') {
    let seed = 5;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 26; i += 1) {
      const yaw = 0.95 + (i / 25) * (2 * Math.PI - 1.9);
      const row = i % 2;
      const p = P(yaw, 0.28 - row * 0.2 + rnd() * 0.08, 0.02);
      const out = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const len = 0.36 + rnd() * 0.16 + row * 0.06;
      const pts = [
        p,
        p.clone().addScaledVector(out, 0.05).add(new THREE.Vector3(0, -len * 0.3, 0)),
        p.clone().addScaledVector(out, 0.06 + rnd() * 0.02).add(new THREE.Vector3(0, -len * 0.65, 0)),
        p.clone().addScaledVector(out, 0.05 + rnd() * 0.03).add(new THREE.Vector3(0, -len, 0)),
      ];
      g.add(mesh(taperTube(pts, (t) => 0.023 * (1 - 0.25 * t) * (1 + 0.1 * Math.sin(t * 40)), { segments: 18, radial: 8 }), plain));
    }
  }
  return g;
}

// ------------------------------------------------------------------ óculos

function buildGlasses(recipe, eyeY) {
  const kind = recipe.glasses;
  if (!kind || kind === 'none') return null;
  const color = recipe.glassesColor;
  const g = new THREE.Group();
  const frame = plasticMaterial(color);
  if (kind === 'sport') {
    const lens = new THREE.MeshPhysicalMaterial({
      color: mix(color, '#0b1220', 0.55), metalness: 0.75, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
    });
    const shield = mesh(sheetGeometry((u, v, out) => {
      const a = (u - 0.5) * 2.1;
      const k = (a / 1.05) ** 2;
      const topY = eyeY + 0.06 - 0.02 * k;
      const botY = eyeY - 0.05 + 0.034 * k + 0.036 * Math.exp(-((a / 0.15) ** 2));
      const r = 0.376 - 0.014 * k;
      return out.set(Math.sin(a) * r, topY + (botY - topY) * v, Math.cos(a) * r + 0.004);
    }, 48, 8, 0.01), lens, { cast: false });
    g.add(shield);
    const pts = [];
    for (let i = 0; i <= 16; i += 1) {
      const a = -1.6 + (i / 16) * 3.2;
      const rr = 0.374 - 0.03 * smooth(1.05, 1.6, Math.abs(a));
      pts.push(new THREE.Vector3(Math.sin(a) * rr, eyeY + 0.074 - 0.055 * smooth(1.05, 1.6, Math.abs(a)), Math.cos(a) * rr + 0.004));
    }
    g.add(mesh(taperTube(pts, 0.011, { segments: 48, radial: 8 }), frame, { cast: false }));
    return g;
  }
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#dbeafe', roughness: 0.05, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false,
  });
  const z = 0.335;
  [-1, 1].forEach((s) => {
    const lens = new THREE.Group();
    lens.position.set(s * 0.122, eyeY, z);
    lens.rotation.y = s * 0.18;
    if (kind === 'round') {
      lens.add(mesh(new THREE.TorusGeometry(0.088, 0.0095, 12, 48), frame, { cast: false }));
      lens.add(mesh(new THREE.CircleGeometry(0.086, 40), glass, { cast: false, receive: false }));
    } else {
      const outer = shapeOf(roundedRect(0.2, 0.158, 0.045));
      const inner = new THREE.Path(roundedRect(0.172, 0.13, 0.034).map(([x, y]) => new THREE.Vector2(x, y)).reverse());
      outer.holes.push(inner);
      const rim = new THREE.ExtrudeGeometry(outer, { depth: 0.012, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 8 });
      rim.translate(0, 0, -0.006);
      lens.add(mesh(rim, frame, { cast: false }));
      lens.add(mesh(new THREE.ShapeGeometry(shapeOf(roundedRect(0.174, 0.132, 0.034))), glass, { cast: false, receive: false }));
    }
    g.add(lens);
    // Haste até a orelha.
    const a = new THREE.Vector3(s * 0.215, eyeY + 0.01, z - 0.02);
    const b = new THREE.Vector3(s * 0.345, eyeY + 0.005, 0.02);
    g.add(mesh(taperTube([a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(s * 0.012, 0, 0)), b], 0.0075, { segments: 12, radial: 6 }), frame, { cast: false }));
  });
  g.add(mesh(taperTube([new THREE.Vector3(-0.036, eyeY + 0.012, z + 0.012), new THREE.Vector3(0, eyeY + 0.022, z + 0.018), new THREE.Vector3(0.036, eyeY + 0.012, z + 0.012)], 0.0085, { segments: 10, radial: 8 }), frame, { cast: false }));
  return g;
}

// ------------------------------------------------------------------ a cabeça

/**
 * @returns {{ group: THREE.Group, setBlink: (k:number) => void }}
 */
export function buildHead(recipe, shared) {
  const skin = optionOf(SKIN_TONES, recipe.skin)?.color || '#e9b48c';
  const hairColor = optionOf(HAIR_COLORS, recipe.hairColor)?.color || '#3b2418';
  const iris = optionOf(EYE_COLORS, recipe.eyeColor)?.color || '#6b3e1f';
  const expr = EXPR[recipe.expression] || EXPR.smile;
  const pt = headPoint(recipe.face);
  const g = new THREE.Group();
  const skinMat = skinMaterial(skin);

  g.add(mesh(radialGeometry((d, out) => pt(d, out), 80, 64), skinMat));

  [-1, 1].forEach((s) => {
    const ear = mesh(new THREE.SphereGeometry(0.078, 24, 18), skinMat);
    pt(dirOf(s * 1.53, -0.06, _d), ear.position, -0.012);
    ear.scale.set(0.42, 1, 0.72);
    ear.rotation.y = s * 0.35;
    g.add(ear);
    const inner = mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshStandardMaterial({ color: shade(skin, -0.16), roughness: 0.7 }), { cast: false });
    inner.position.copy(ear.position).add(new THREE.Vector3(s * 0.02, 0, 0.012));
    inner.scale.set(0.4, 0.95, 0.6);
    inner.rotation.y = s * 0.35;
    g.add(inner);
  });

  const mats = {
    eye: new THREE.MeshPhysicalMaterial({ map: eyeTexture(iris), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }),
    lid: skinMaterial(shade(skin, -0.05)),
    lash: new THREE.MeshStandardMaterial({ color: '#1a1210', roughness: 0.6 }),
  };
  const eyes = [buildEye(-1, recipe, expr, pt, skin, mats), buildEye(1, recipe, expr, pt, skin, mats)];
  eyes.forEach((e) => g.add(e.group));
  const eyeY = eyes[0].group.position.y;

  const browColor = recipe.hair === 'bald' && recipe.beard === 'none' ? shade(skin, -0.5) : shade(hairColor, -0.12);
  const browMat = new THREE.MeshStandardMaterial({ color: browColor, roughness: 0.75 });
  g.add(buildBrow(-1, recipe, expr, pt, browMat), buildBrow(1, recipe, expr, pt, browMat));

  const N = {
    button: [1, 1, 1, 0], soft: [1.22, 0.92, 0.86, 0], wide: [1.5, 0.92, 0.9, 0], long: [0.98, 1.5, 1.08, 0.03],
  }[recipe.nose] || [1, 1, 1, 0];
  const nose = mesh(new THREE.SphereGeometry(0.041, 24, 18), skinMaterial(mix(skin, '#e2705c', 0.12)), { cast: false });
  pt(dirOf(0, -0.18 + N[3], _d), nose.position, -0.008);
  nose.scale.set(N[0], N[1], N[2]);
  g.add(nose);

  g.add(buildMouth(expr, pt, skin));

  if (recipe.cheeks) {
    const tex = blushTexture();
    [-1, 1].forEach((s) => {
      const geo = new THREE.CircleGeometry(0.075, 28);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        pt(dirOf(s * 0.66 + pos.getX(i) / R, -0.27 + pos.getY(i) / R, _d), _v, 0.003);
        pos.setXYZ(i, _v.x, _v.y, _v.z);
      }
      geo.computeVertexNormals();
      g.add(mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.6, opacity: 0.6 }), { cast: false, receive: false }));
    });
  }
  if (recipe.freckles) {
    const geo = new THREE.PlaneGeometry(0.4, 0.13, 20, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      pt(dirOf(pos.getX(i) / (R * 0.9), -0.14 + pos.getY(i) / R, _d), _v, 0.0035);
      pos.setXYZ(i, _v.x, _v.y, _v.z);
    }
    geo.computeVertexNormals();
    const tex = specksTexture({ color: shade(skin, -0.38), count: 90, size: 2.3, fade: true });
    g.add(mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.7 }), { cast: false, receive: false }));
  }

  const beard = buildBeard(recipe, pt, hairColor, skin, shared.hairBump);
  if (beard) g.add(beard);
  const hw = buildHeadwear(recipe, pt, shared.fabricBump);
  const hair = buildHair(recipe, pt, hairColor, hw.clampHair, shared.hairBump);
  if (hair) g.add(hair);
  if (hw.group) g.add(hw.group);
  const glasses = buildGlasses(recipe, eyeY);
  if (glasses) g.add(glasses);

  return {
    group: g,
    setBlink(k) {
      eyes.forEach((e) => { if (e.upper) e.upper.rotation.x = e.open + (LID_CLOSED - e.open) * k; });
    },
  };
}
