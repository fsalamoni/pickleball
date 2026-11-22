/**
 * O PALCO do avatar 3D: câmera, luz de estúdio, sombra, o laço de animação
 * (respirar, piscar, movimento ao toque) e o giro com o dedo.
 *
 * Este arquivo (e a three.js) só entra por import dinâmico: nada disso pesa
 * no pacote inicial.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BACKGROUNDS, optionOf } from '../domain/catalog.js';
import { resolvePaddle } from '../domain/brandItems.js';
import { MOTIONS, POSE_MOTION, poseAt, poseJoints } from '../domain/poses.js';
import { Character } from './character.js';
import { backgroundTexture, contactShadowTexture } from './tex.js';

export const VIEWS = {
  full: { fov: 26, pos: [0, 1.25, 5.05], target: [0, 1.05, 0], aspect: 340 / 520 },
  bust: { fov: 24, pos: [0, 1.62, 3.3], target: [0, 1.5, 0], aspect: 1 },
  // Só para as miniaturas do estúdio: o rosto de perto e a raquete erguida.
  face: { fov: 24, pos: [0, 1.6, 2.5], target: [0, 1.54, 0], aspect: 1 },
  paddle: { fov: 24, pos: [-0.34, 1.74, 2.3], target: [-0.34, 1.7, 0], aspect: 1 },
};
export const DEFAULT_YAW = -0.2;

export class AvatarStage {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ view?: 'full'|'bust', background?: boolean }} [opts]
   */
  constructor(canvas, { view = 'full', background = true } = {}) {
    this.canvas = canvas;
    this.withBackground = background;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !background, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.62;

    const key = new THREE.DirectionalLight('#fff4e6', 2.3);
    key.position.set(1.5, 5.2, 3.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 5;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 2.6, bottom: -0.4, near: 1, far: 12 });
    const fill = new THREE.DirectionalLight('#dbeafe', 0.75);
    fill.position.set(-3.5, 1.8, 2.5);
    const rim = new THREE.DirectionalLight('#ffffff', 1.5);
    rim.position.set(-2.2, 3.2, -4);
    this.scene.add(key, fill, rim, new THREE.HemisphereLight('#ffffff', '#b9c2d0', 0.42));

    this.contact = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    );
    this.contact.rotation.x = -Math.PI / 2;
    this.contact.position.y = 0.003;
    this.scene.add(this.contact);

    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
    this.character = new Character();
    this.scene.add(this.character.root);
    this.yaw = DEFAULT_YAW;
    this.pose = 'ready';
    this.motion = null;
    this.reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.nextBlink = 1.5;
    this.frame = this.frame.bind(this);
    this.setView(view);
  }

  setView(view) {
    this.view = VIEWS[view] ? view : 'full';
    const v = VIEWS[this.view];
    this.camera.fov = v.fov;
    this.camera.position.set(...v.pos);
    this.camera.lookAt(...v.target);
    this.aspect = null;
    this.applyBackground();
  }

  applyBackground() {
    if (!this.withBackground || !this.bg) return;
    const key = `${this.bg.id}|${this.view}`;
    if (key === this.bgKey) return;
    this.scene.background?.dispose?.();
    this.scene.background = backgroundTexture(this.bg, VIEWS[this.view].aspect);
    this.bgKey = key;
  }

  /** @param {object} recipe receita normalizada */
  setRecipe(recipe, brandItems = []) {
    this.character.update(recipe, resolvePaddle(recipe, brandItems));
    this.bg = optionOf(BACKGROUNDS, recipe.background) || BACKGROUNDS[0];
    this.applyBackground();
    this.pose = recipe.pose;
    this.dirty = true;
  }

  setYaw(yaw) {
    this.yaw = yaw;
    this.dirty = true;
  }

  resetYaw() {
    this.setYaw(DEFAULT_YAW);
  }

  /** Toca o movimento da pose (ou o pedido). Devolve a duração em ms. */
  play(motionId) {
    const id = motionId || POSE_MOTION[this.pose] || 'swing';
    if (!MOTIONS[id] || this.reduced) return 0;
    this.motion = { id, start: performance.now() };
    return MOTIONS[id].duration;
  }

  /** Acerta o tamanho do desenho (em pixels de CSS). */
  resize(width, height, pixelRatio = Math.min(window.devicePixelRatio || 1, 2)) {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Em tela mais estreita que o enquadramento, afasta para o corpo caber.
    const v = VIEWS[this.view];
    const k = Math.max(1, v.aspect / this.camera.aspect);
    this.camera.position.set(v.pos[0], v.pos[1], v.target[2] + (v.pos[2] - v.target[2]) * k);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Desenha um quadro no instante `now` (ms). `still` = sem respiração (foto). */
  render(now = 0, still = false) {
    const t = now / 1000;
    let J = poseJoints(this.pose);
    if (this.motion) {
      const m = MOTIONS[this.motion.id];
      const p = (now - this.motion.start) / m.duration;
      if (p >= 1) this.motion = null;
      else J = poseAt(this.motion.id, p, this.pose);
    }
    if (!still && !this.reduced) {
      const b = Math.sin(t * 1.9);
      J = {
        ...J, lean: J.lean + b * 0.5, headTilt: J.headTilt + Math.sin(t * 0.83) * 1.4, headTurn: J.headTurn + Math.sin(t * 0.61) * 2.2,
        rA: J.rA + b * 0.9, lA: J.lA + b * 0.9, rE: J.rE + b * 1.2, lE: J.lE - b * 1.2, bob: J.bob + b * 0.004,
      };
      if (t > this.nextBlink + 0.16) this.nextBlink = t + 2.2 + Math.random() * 3;
      const k = (t - this.nextBlink) / 0.16;
      this.character.setBlink(k > 0 && k < 1 ? Math.sin(Math.PI * k) : 0);
    } else {
      this.character.setBlink(0);
    }
    this.character.root.rotation.y = this.yaw;
    this.character.setPose(J);
    const air = Math.max(0, J.bob);
    this.contact.scale.set(0.95 - air * 1.6, 0.6 - air, 1);
    this.contact.material.opacity = 0.85 - air * 2.2;
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
  }

  frame(now) {
    this.raf = requestAnimationFrame(this.frame);
    // Parado (sem movimento e com "menos movimento" ligado): só redesenha quando algo muda.
    if (this.reduced && !this.motion && !this.dirty) return;
    // Respirar não precisa de 60 quadros: 30 poupam bateria. Movimento e giro vão a toda.
    if (!this.motion && !this.dirty && now - (this.last || 0) < 32) return;
    this.last = now;
    this.render(now);
  }

  start() {
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    this.stop();
    this.character.dispose();
    this.scene.background?.dispose?.();
    this.env.dispose();
    this.contact.material.map.dispose();
    this.contact.geometry.dispose();
    this.renderer.dispose();
    // Devolve o contexto na hora: o navegador só mantém alguns por página.
    this.renderer.forceContextLoss();
  }
}

// ---------------------------------------------------------------- fotos

let shared = null;

/**
 * Tira uma FOTO do avatar (miniaturas do estúdio e a imagem salva). Um palco
 * só, fora da tela, serve todas: o navegador limita os contextos WebGL.
 * O canvas devolvido é reaproveitado — copie na hora (drawImage / toBlob).
 * @returns {HTMLCanvasElement}
 */
export function snapAvatar(recipe, { view = 'full', width = 256, height = 256, brandItems = [], yaw = DEFAULT_YAW } = {}) {
  if (!shared) shared = new AvatarStage(document.createElement('canvas'), { view });
  if (shared.view !== view) shared.setView(view);
  shared.setRecipe(recipe, brandItems);
  shared.setYaw(yaw);
  shared.resize(width, height, 1);
  shared.render(0, true);
  return shared.canvas;
}

export function disposeSnapper() {
  shared?.dispose();
  shared = null;
}
