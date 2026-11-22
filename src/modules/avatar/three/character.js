/**
 * O PERSONAGEM: junta cabeça, corpo, raquete e bola, e refaz só a parte que a
 * receita mudou (trocar a cor da camisa não remodela o rosto).
 */
import * as THREE from 'three';
import { applyPose, buildBall, buildBody, buildPaddle, HEAD_UP } from './body.js';
import { buildHead } from './head.js';
import { disposeTree } from './geom.js';
import { fabricBumpTexture, hairBumpTexture } from './tex.js';

const HEAD_KEYS = [
  'skin', 'face', 'eyes', 'eyeColor', 'brows', 'nose', 'cheeks', 'freckles', 'hair', 'hairColor', 'beard',
  'glasses', 'glassesColor', 'headwear', 'headwearColor', 'expression', 'topColor2',
];
const BODY_KEYS = [
  'skin', 'top', 'topColor', 'topColor2', 'topPattern', 'chestMark', 'chestNumber', 'ball', 'bottom', 'bottomColor',
  'shoesColor', 'socks', 'socksColor', 'wristband',
];
const PADDLE_KEYS = ['shape', 'art', 'color', 'color2', 'edge', 'grip', 'wordmark', 'ink'];
const keyOf = (obj, keys) => keys.map((k) => String(obj[k])).join('|');

export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.shared = { hairBump: hairBumpTexture(), fabricBump: fabricBumpTexture() };
    this.keep = new Set(Object.values(this.shared));
    this.keys = {};
    this.paddleHold = new THREE.Group();
    this.headMount = new THREE.Group();
    this.headMount.position.set(0, HEAD_UP, 0.012);
  }

  /** @param {object} recipe receita já normalizada  @param {object} paddle `resolvePaddle(...)` */
  update(recipe, paddle) {
    const k = {
      head: keyOf(recipe, HEAD_KEYS), body: keyOf(recipe, BODY_KEYS), paddle: keyOf(paddle, PADDLE_KEYS), ball: recipe.ball,
    };
    if (k.body !== this.keys.body) {
      this.drop(this.body?.group);
      this.body = buildBody(recipe, this.shared);
      this.root.add(this.body.group);
      this.body.joints.head.add(this.headMount);
      this.body.joints.armR.hand.add(this.paddleHold);
    }
    if (k.head !== this.keys.head) {
      this.drop(this.head?.group);
      this.head = buildHead(recipe, this.shared);
      this.headMount.add(this.head.group);
    }
    if (k.paddle !== this.keys.paddle) {
      this.drop(this.paddle);
      this.paddle = buildPaddle(paddle);
      this.paddleHold.add(this.paddle);
    }
    if (k.ball !== this.keys.ball) {
      this.drop(this.ball);
      this.ball = buildBall(recipe);
    }
    // A bola mora na raiz do corpo (segue o pulo, não a mão).
    this.body.joints.root.add(this.ball);
    this.keys = k;
  }

  drop(obj) {
    if (!obj) return;
    obj.removeFromParent();
    // A cabeça e a raquete moram dentro do corpo, mas têm vida própria.
    if (obj === this.body?.group) {
      this.headMount.removeFromParent();
      this.paddleHold.removeFromParent();
      this.ball?.removeFromParent();
    }
    disposeTree(obj, this.keep);
  }

  /** @param {object} joints pose em graus (domain/poses.js) */
  setPose(joints) {
    if (!this.body) return;
    applyPose({ joints: this.body.joints, paddleHold: this.paddleHold, paddle: this.paddle, ball: this.ball }, joints);
  }

  setBlink(k) {
    this.head?.setBlink(k);
  }

  dispose() {
    this.drop(this.ball);
    this.drop(this.body?.group);
    this.drop(this.head?.group);
    this.drop(this.paddle);
    Object.values(this.shared).forEach((t) => t.dispose());
  }
}
