/**
 * Peças de modelagem do avatar 3D: superfícies feitas por FUNÇÃO (a cabeça, o
 * cabelo e o que veste a cabeça são "uma esfera com raio que muda"), tubos que
 * afinam nas pontas e folhas com espessura. Tudo devolve BufferGeometry.
 */
import * as THREE from 'three';
import { mix, shade } from '../domain/color.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const DEG = Math.PI / 180;

/** Direção a partir de giro (em volta do eixo vertical) e elevação. */
export function dirOf(yaw, pitch, out = new THREE.Vector3()) {
  const c = Math.cos(pitch);
  return out.set(Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

/**
 * Superfície radial: `fn(dir, out)` devolve o ponto da superfície naquela
 * direção. As normais saem por diferença finita (sem costura na emenda da esfera).
 */
/** `pole`: para onde aponta o polo da malha (os anéis ficam paralelos à borda de quem usa um plano inclinado). */
export function radialGeometry(fn, wSeg = 64, hSeg = 48, pole = null) {
  const g = new THREE.SphereGeometry(1, wSeg, hSeg);
  const q = pole ? new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...pole).normalize()) : null;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const eps = 0.012;
  for (let i = 0; i < pos.count; i += 1) {
    _d.fromBufferAttribute(pos, i).normalize();
    if (q) _d.applyQuaternion(q);
    _a.crossVectors(Math.abs(_d.y) > 0.98 ? RIGHT : UP, _d).normalize();
    _b.crossVectors(_d, _a);
    fn(_d, _p0);
    fn(_q.copy(_d).addScaledVector(_a, eps).normalize(), _p1);
    fn(_q.copy(_d).addScaledVector(_b, eps).normalize(), _p2);
    _p1.sub(_p0);
    _p2.sub(_p0);
    _p1.cross(_p2).normalize();
    pos.setXYZ(i, _p0.x, _p0.y, _p0.z);
    nor.setXYZ(i, _p1.x, _p1.y, _p1.z);
  }
  g.computeBoundingSphere();
  return g;
}

/**
 * Tubo ao longo de pontos, com raio que varia: `radius(t)` com t de 0 a 1.
 * `flat` achata o tubo na direção `flatAxis` (sobrancelha, lábio).
 */
export function taperTube(points, radius, { segments = 32, radial = 10, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const g = new THREE.TubeGeometry(curve, segments, 1, radial, closed);
  const pos = g.attributes.position;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    curve.getPointAt(closed && i === segments ? 0 : t, c);
    const r = typeof radius === 'function' ? radius(t) : radius;
    for (let j = 0; j <= radial; j += 1) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Raio que some nas duas pontas (0 → r → 0). */
export const taper = (r, sharp = 0.5) => (t) => r * Math.max(0.04, Math.sin(Math.PI * t) ** sharp);

/**
 * Folha com espessura: `fn(u, v, out)` é a superfície de cima (u, v de 0 a 1);
 * a de baixo desce `thick` pela normal. Fecha as quatro bordas.
 */
export function sheetGeometry(fn, nu, nv, thick) {
  const cols = nu + 1;
  const rows = nv + 1;
  const n = cols * rows;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const e = 1e-3;
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const u = i / nu;
      const v = j / nv;
      fn(u, v, _p0);
      fn(Math.min(1, u + e), v, _p1);
      fn(u, Math.min(1, v + e), _p2);
      if (u + e > 1) { fn(u - e, v, _a); _p1.copy(_p0).multiplyScalar(2).sub(_a); }
      if (v + e > 1) { fn(u, v - e, _a); _p2.copy(_p0).multiplyScalar(2).sub(_a); }
      _p1.sub(_p0);
      _p2.sub(_p0);
      _a.crossVectors(_p2, _p1).normalize();
      const k = j * cols + i;
      pos.set([_p0.x, _p0.y, _p0.z], k * 3);
      pos.set([_p0.x - _a.x * thick, _p0.y - _a.y * thick, _p0.z - _a.z * thick], (n + k) * 3);
      uv.set([u, v], k * 2);
      uv.set([u, v], (n + k) * 2);
    }
  }
  const idx = [];
  const quad = (a, b, c, d) => idx.push(a, b, d, b, c, d);
  for (let j = 0; j < nv; j += 1) {
    for (let i = 0; i < nu; i += 1) {
      const a = j * cols + i;
      quad(a, a + cols, a + cols + 1, a + 1);
      quad(n + a, n + a + 1, n + a + cols + 1, n + a + cols);
    }
  }
  for (let i = 0; i < nu; i += 1) {
    quad(i, i + 1, n + i + 1, n + i);
    const a = nv * cols + i;
    quad(a + 1, a, n + a, n + a + 1);
  }
  for (let j = 0; j < nv; j += 1) {
    const a = j * cols;
    quad(a + cols, a, n + a, n + a + cols);
    const b = a + nu;
    quad(b, b + cols, n + b + cols, n + b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Forma 2D (lista de [x, y]) → Shape. */
export function shapeOf(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** Retângulo de cantos redondos, como lista de pontos (anti-horário). */
export function roundedRect(w, h, r, n = 8) {
  const pts = [];
  const hw = w / 2;
  const hh = h / 2;
  [[hw - r, hh - r, 0], [-hw + r, hh - r, 90], [-hw + r, -hh + r, 180], [hw - r, -hh + r, 270]].forEach(([cx, cy, a0]) => {
    for (let i = 0; i <= n; i += 1) {
      const a = (a0 + (i / n) * 90) * DEG;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  });
  return pts;
}

// ---------------------------------------------------------------- materiais

export function skinMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.52, sheen: 0.6, sheenRoughness: 0.45, sheenColor: mix(color, '#ffb199', 0.5),
    clearcoat: 0.08, clearcoatRoughness: 0.6,
  });
}

export function hairMaterial(color, bump, strength = 0.9) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.46, bumpMap: bump || null, bumpScale: strength,
    sheen: 0.5, sheenRoughness: 0.4, sheenColor: shade(color, 0.45),
  });
}

export function fabricMaterial(color, { map = null, bump = null } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: map ? '#ffffff' : color, map, roughness: 0.82, bumpMap: bump, bumpScale: 0.35,
    sheen: 0.35, sheenRoughness: 0.6, sheenColor: '#ffffff',
  });
}

export function plasticMaterial(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, ...opts });
}

export function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Solta a memória de vídeo de um pedaço da cena (as texturas compartilhadas ficam). */
export function disposeTree(root, keep = new Set()) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m) return;
      ['map', 'bumpMap', 'alphaMap'].forEach((k) => { if (m[k] && !keep.has(m[k])) m[k].dispose(); });
      m.dispose();
    });
  });
}
