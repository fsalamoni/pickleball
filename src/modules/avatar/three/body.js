/**
 * O CORPO do avatar 3D, com as juntas que as poses movem, mais a raquete e a
 * bola. Espaço: chão em y = 0, o avatar olha para +z; "direito" é o lado
 * direito DO AVATAR (x negativo), que é a mão da raquete.
 */
import * as THREE from 'three';
import { luminance, shade } from '../domain/color.js';
import { BALL_COLORS, SKIN_TONES, optionOf } from '../domain/catalog.js';
import { DEG, fabricMaterial, mesh, plasticMaterial, skinMaterial } from './geom.js';
import { ballTexture, paddleTexture, topTexture } from './tex.js';

export const HIP_Y = 0.62;
const L1 = 0.265; // coxa
const L2 = 0.27; // canela
const HIP_DROP = 0.02;
const ARM1 = 0.215;
const ARM2 = 0.2;
const SHOULDER_Y = 0.445;
const SHOULDER_X = 0.208;
export const NECK_Y = 0.5;
export const HEAD_UP = 0.445;

function lathe(profile, zScale, n = 30) {
  const curve = new THREE.SplineCurve(profile.map(([y, r]) => new THREE.Vector2(r, y)));
  // Amostra por ALTURA igual: o `v` da textura acompanha o y de verdade.
  const pts = curve.getSpacedPoints(n);
  const g = new THREE.LatheGeometry(pts, 56, Math.PI, Math.PI * 2);
  g.scale(1, 1, zScale);
  g.computeVertexNormals();
  return g;
}

function capsule(r, len, y = -len / 2) {
  const g = new THREE.CapsuleGeometry(r, len, 8, 20);
  g.translate(0, y, 0);
  return g;
}

function tube(rTop, rBot, len, y) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, 28, 1, true);
  g.translate(0, y, 0);
  return g;
}

function buildArm(side, recipe, mats) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * SHOULDER_X, SHOULDER_Y, 0);
  shoulder.rotation.order = 'ZXY';
  const elbow = new THREE.Group();
  elbow.position.y = -ARM1;
  const hand = new THREE.Group();
  hand.position.y = -ARM2;
  shoulder.add(elbow);
  elbow.add(hand);

  const long = recipe.top === 'longsleeve';
  shoulder.add(mesh(capsule(0.049, ARM1), long ? mats.sleeve : mats.skin));
  elbow.add(mesh(capsule(0.044, ARM2 - 0.02, -(ARM2 - 0.02) / 2), long ? mats.sleeve : mats.skin));
  const sleeveLen = { tee: 0.125, polo: 0.115, dress: 0.07, longsleeve: 0, tank: 0 }[recipe.top] ?? 0.12;
  if (recipe.top !== 'tank') {
    const cap = mesh(new THREE.SphereGeometry(0.063, 24, 16), mats.sleeve);
    cap.scale.set(1, 0.92, 1);
    shoulder.add(cap);
  }
  if (sleeveLen) {
    const sl = mesh(tube(0.062, 0.058, sleeveLen, -sleeveLen / 2 - 0.01), mats.sleeve);
    shoulder.add(sl);
    const hem = mesh(new THREE.TorusGeometry(0.058, 0.006, 8, 28), recipe.top === 'polo' ? mats.trim : mats.sleeve);
    hem.rotation.x = Math.PI / 2;
    hem.position.y = -sleeveLen - 0.01;
    shoulder.add(hem);
  }
  if (long) {
    const cuff = mesh(new THREE.TorusGeometry(0.045, 0.009, 8, 24), mats.trim);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -ARM2 + 0.035;
    elbow.add(cuff);
  }
  if (recipe.wristband && side < 0) {
    elbow.add(mesh(tube(0.05, 0.05, 0.042, -ARM2 + 0.05), mats.band));
  }
  const palm = mesh(new THREE.SphereGeometry(0.056, 24, 18), mats.skin);
  palm.scale.set(0.82, 1, 0.95);
  palm.position.y = -0.012;
  hand.add(palm);
  const thumb = mesh(new THREE.SphereGeometry(0.024, 14, 10), mats.skin);
  thumb.position.set(-side * 0.03, 0.0, 0.04);
  hand.add(thumb);
  return { shoulder, elbow, hand };
}

function buildLeg(side, recipe, mats) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.086, -HIP_DROP, 0);
  const knee = new THREE.Group();
  knee.position.y = -L1;
  const foot = new THREE.Group();
  foot.position.y = -L2;
  hip.add(knee);
  knee.add(foot);

  const b = recipe.top === 'dress' ? 'none' : recipe.bottom;
  const covered = b === 'leggings' || b === 'pants';
  hip.add(mesh(capsule(0.07, L1), covered ? mats.bottom : mats.skin));
  knee.add(mesh(capsule(0.054, L2 - 0.03, -(L2 - 0.03) / 2), covered ? mats.bottom : mats.skin));
  if (b === 'shorts') {
    hip.add(mesh(tube(0.083, 0.09, 0.165, -0.085), mats.bottom));
    const hem = mesh(new THREE.TorusGeometry(0.09, 0.006, 8, 32), mats.bottom);
    hem.rotation.x = Math.PI / 2;
    hem.position.y = -0.168;
    hip.add(hem);
  }
  if (b === 'pants') {
    hip.add(mesh(tube(0.084, 0.078, L1 + 0.02, -L1 / 2), mats.bottom));
    knee.add(mesh(tube(0.076, 0.07, L2 - 0.04, -(L2 - 0.04) / 2), mats.bottom));
  }
  const sockH = recipe.socks === 'crew' ? 0.115 : 0.04;
  if (b !== 'pants') knee.add(mesh(tube(0.058, 0.06, sockH, -L2 + sockH / 2 + 0.015), mats.sock));

  const part = (mat, sx, sy, sz, x, y, z) => {
    const m = mesh(new THREE.SphereGeometry(1, 28, 20), mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    foot.add(m);
    return m;
  };
  part(mats.shoe, 0.064, 0.06, 0.076, 0, -0.012, 0.004); // calcanhar
  part(mats.shoe, 0.066, 0.044, 0.088, 0, -0.026, 0.078); // bico
  part(mats.sole, 0.072, 0.024, 0.134, 0, -0.046, 0.046);
  part(mats.trim, 0.034, 0.02, 0.05, 0, 0.012, 0.062).rotation.x = 0.5; // língua
  const collar = mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 24), mats.shoe);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.012, 0.004);
  foot.add(collar);
  return { hip, knee, foot };
}

/** @returns {{ group: THREE.Group, joints: object }} */
export function buildBody(recipe, shared) {
  const skin = optionOf(SKIN_TONES, recipe.skin)?.color || '#e9b48c';
  const ballColor = optionOf(BALL_COLORS, recipe.ball)?.color || '#f4dd2b';
  const top = recipe.topColor;
  const trimColor = recipe.topColor2;
  const shoe = recipe.shoesColor;
  const mats = {
    skin: skinMaterial(skin),
    sleeve: fabricMaterial(top, { bump: shared.fabricBump }),
    trim: fabricMaterial(trimColor, { bump: shared.fabricBump }),
    band: fabricMaterial(trimColor, { bump: shared.fabricBump }),
    bottom: fabricMaterial(recipe.top === 'dress' ? top : recipe.bottomColor, { bump: shared.fabricBump }),
    sock: fabricMaterial(recipe.socksColor, { bump: shared.fabricBump }),
    shoe: plasticMaterial(shoe, { roughness: 0.5, clearcoat: 0.25 }),
    sole: plasticMaterial(luminance(shoe) > 0.75 ? '#cbd2dc' : '#f4f6f8', { roughness: 0.6, clearcoat: 0 }),
  };

  const skirt = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
  const root = new THREE.Group();
  const pelvis = new THREE.Group();
  pelvis.position.y = HIP_Y;
  root.add(pelvis);
  const spine = new THREE.Group();
  pelvis.add(spine);

  // Tronco = a camisa (o mapa dá a volta: o centro da textura é o peito).
  const tank = recipe.top === 'tank';
  const profile = tank
    ? [[-0.035, 0.18], [0.05, 0.174], [0.18, 0.166], [0.32, 0.186], [0.41, 0.184], [0.47, 0.15], [0.5, 0.108], [0.52, 0.08]]
    : [[-0.035, 0.181], [0.05, 0.175], [0.18, 0.167], [0.32, 0.19], [0.415, 0.2], [0.468, 0.178], [0.5, 0.118], [0.52, 0.082]];
  const map = topTexture({
    color: top, color2: trimColor, pattern: recipe.topPattern, mark: recipe.chestMark, number: recipe.chestNumber,
    ballColor, polo: recipe.top === 'polo',
  });
  const shirt = fabricMaterial(top, { map, bump: shared.fabricBump });
  shirt.side = THREE.DoubleSide;
  spine.add(mesh(lathe(profile, 0.72), shirt));
  if (tank) {
    const yoke = mesh(new THREE.SphereGeometry(1, 28, 16), mats.skin);
    yoke.scale.set(0.215, 0.05, 0.085);
    yoke.position.y = 0.452;
    spine.add(yoke);
    [-1, 1].forEach((s) => {
      const ball = mesh(new THREE.SphereGeometry(0.061, 20, 14), mats.skin);
      ball.position.set(s * SHOULDER_X, SHOULDER_Y, 0);
      spine.add(ball);
    });
  }
  if (recipe.top === 'polo') {
    const collar = mesh(new THREE.TorusGeometry(0.088, 0.022, 10, 36), mats.trim);
    collar.rotation.x = Math.PI / 2 + 0.12;
    collar.scale.set(1, 0.85, 0.5);
    collar.position.set(0, 0.512, 0.004);
    spine.add(collar);
  }
  if (recipe.top === 'dress') {
    spine.add(mesh(lathe([[-0.19, 0.285], [-0.165, 0.283], [-0.05, 0.245], [0.08, 0.198], [0.17, 0.168]], 0.82, 18), skirt(mats.sleeve)));
  }
  const neck = mesh(new THREE.CylinderGeometry(0.064, 0.072, 0.16, 24), mats.skin);
  neck.position.y = 0.545;
  spine.add(neck);

  // Quadril (short, saia-short, legging, calça).
  const hips = mesh(new THREE.SphereGeometry(1, 32, 20), mats.bottom);
  hips.scale.set(0.174, 0.11, 0.122);
  hips.position.y = -0.035;
  pelvis.add(hips);
  if (recipe.bottom === 'skort' && recipe.top !== 'dress') {
    pelvis.add(mesh(lathe([[-0.172, 0.262], [-0.15, 0.26], [-0.1, 0.243], [0, 0.2], [0.07, 0.172]], 0.8, 16), skirt(mats.bottom)));
  }

  const head = new THREE.Group();
  head.position.y = NECK_Y;
  spine.add(head);

  const armR = buildArm(-1, recipe, mats);
  const armL = buildArm(1, recipe, mats);
  spine.add(armR.shoulder, armL.shoulder);
  const legR = buildLeg(-1, recipe, mats);
  const legL = buildLeg(1, recipe, mats);
  pelvis.add(legR.hip, legL.hip);

  return { group: root, joints: { root, pelvis, spine, head, armR, armL, legR, legL } };
}

// ------------------------------------------------------------------ raquete e bola

const PADDLE_DIM = {
  standard: { W: 0.25, H: 0.275 }, elongated: { W: 0.212, H: 0.325 }, wide: { W: 0.282, H: 0.248 },
};

/** A raquete: origem no meio do cabo, +y para a cabeça da raquete. */
export function buildPaddle(spec) {
  const { W, H } = PADDLE_DIM[spec.shape] || PADDLE_DIM.standard;
  const hl = 0.135;
  const hw = 0.021;
  const rb = 0.085;
  const rt = 0.062;
  const y0 = hl;
  const s = new THREE.Shape();
  s.moveTo(-hw, 0);
  s.lineTo(-hw, y0 - 0.012);
  s.bezierCurveTo(-hw, y0 + 0.03, -W / 2, y0 - 0.005, -W / 2, y0 + rb);
  s.lineTo(-W / 2, y0 + H - rt);
  s.quadraticCurveTo(-W / 2, y0 + H, -W / 2 + rt, y0 + H);
  s.lineTo(W / 2 - rt, y0 + H);
  s.quadraticCurveTo(W / 2, y0 + H, W / 2, y0 + H - rt);
  s.lineTo(W / 2, y0 + rb);
  s.bezierCurveTo(W / 2, y0 - 0.005, hw, y0 + 0.03, hw, y0 - 0.012);
  s.lineTo(hw, 0);
  s.closePath();

  const g = new THREE.Group();
  const depth = 0.013;
  const body = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.005, bevelSegments: 3, curveSegments: 20 });
  body.translate(0, 0, -depth / 2);
  g.add(mesh(body, plasticMaterial(spec.edge, { roughness: 0.45 })));

  const map = paddleTexture(spec);
  const faceMat = new THREE.MeshPhysicalMaterial({ map, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const cy = y0 + H / 2;
  [1, -1].forEach((dir) => {
    const face = new THREE.ShapeGeometry(s, 20);
    const pos = face.attributes.position;
    const uv = face.attributes.uv;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      uv.setXY(i, x / W + 0.5, (y - y0) / H);
      pos.setXYZ(i, x * 0.955, cy + (y - cy) * 0.975, 0);
    }
    const m = mesh(face, faceMat, { cast: false });
    m.position.z = dir * (depth / 2 + 0.0056);
    if (dir < 0) m.rotation.y = Math.PI;
    g.add(m);
  });

  const grip = mesh(new THREE.CylinderGeometry(0.0225, 0.0245, hl, 20), fabricMaterial(spec.grip));
  grip.scale.set(1.12, 1, 0.86);
  grip.position.y = hl / 2;
  g.add(grip);
  const wrap = new THREE.MeshStandardMaterial({ color: shade(spec.grip, 0.2), roughness: 0.8 });
  for (let i = 0; i < 6; i += 1) {
    const ring = mesh(new THREE.TorusGeometry(0.0235, 0.0022, 6, 20), wrap, { cast: false });
    ring.rotation.set(Math.PI / 2 + 0.3, 0, 0);
    ring.scale.set(1.12, 0.86, 1);
    ring.position.y = 0.018 + i * 0.02;
    g.add(ring);
  }
  const butt = mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.014, 20), plasticMaterial(spec.edge));
  butt.scale.set(1.12, 1, 0.86);
  butt.position.y = 0.004;
  g.add(butt);

  g.children.forEach((c) => { c.position.y -= hl * 0.5; });
  g.scale.setScalar(1.1);
  return g;
}

export function buildBall(recipe) {
  const color = optionOf(BALL_COLORS, recipe.ball)?.color || '#f4dd2b';
  const map = ballTexture(color);
  const mat = new THREE.MeshPhysicalMaterial({ map, bumpMap: map, bumpScale: 1.4, roughness: 0.42, clearcoat: 0.3 });
  return mesh(new THREE.SphereGeometry(0.047, 32, 24), mat);
}

// ------------------------------------------------------------------ pose

const _w = new THREE.Vector3();

/**
 * Põe o corpo na pose (ângulos em graus; ver `domain/poses.js`).
 * `ctx`: { joints, paddleHold, paddle, ball, head }.
 */
export function applyPose(ctx, J) {
  const { pelvis, spine, head, armR, armL, legR, legL, root } = ctx.joints;
  const c = J.crouch * DEG;
  const st = J.stance * DEG;
  const reach = (L1 + L2) * Math.cos(c) * Math.cos(st);
  pelvis.position.y = HIP_Y - (L1 + L2 - reach) + J.bob;
  pelvis.rotation.y = (J.hipTwist || 0) * DEG;
  [[legR, -1], [legL, 1]].forEach(([leg, side]) => {
    leg.hip.rotation.set(-c, 0, side * st);
    leg.knee.rotation.x = 2 * c;
    leg.foot.rotation.set(-c, side * 0.16, -side * st);
  });
  spine.rotation.set(J.lean * DEG, J.twist * DEG, J.bend * DEG);
  head.rotation.set(J.headNod * DEG, J.headTurn * DEG, J.headTilt * DEG);
  armR.shoulder.rotation.set(-J.rF * DEG, J.rT * DEG, -J.rA * DEG);
  armR.elbow.rotation.x = -J.rE * DEG;
  armL.shoulder.rotation.set(-J.lF * DEG, -J.lT * DEG, J.lA * DEG);
  armL.elbow.rotation.x = -J.lE * DEG;
  if (ctx.paddleHold) {
    ctx.paddleHold.rotation.set(Math.PI / 2 + J.pP * DEG, 0, J.pY * DEG);
    ctx.paddle.rotation.y = J.pR * DEG;
  }
  if (ctx.ball) {
    ctx.ball.visible = !!J.ball;
    if (J.ball) {
      root.updateWorldMatrix(true, true);
      armL.hand.localToWorld(_w.set(0, -0.085, 0.03));
      root.worldToLocal(_w);
      ctx.ball.position.set(_w.x, _w.y + J.tossY, _w.z);
    }
  }
}
