/**
 * FOTOS do avatar 3D: as miniaturas do estúdio e a imagem que é salva.
 *
 * Um palco só, fora da tela, tira todas (o navegador mantém poucos contextos
 * WebGL por página). Os pedidos entram numa FILA e saem um por vez, cedendo a
 * vez à tela entre um e outro: trocar a cor da pele redesenha uma dúzia de
 * miniaturas sem travar o toque. Pedido cancelado (a pessoa já mudou de novo)
 * não é desenhado.
 *
 * A three.js só entra aqui, por import dinâmico.
 */
import { resolvePaddle } from '../domain/brandItems.js';
import { webglAvailable } from '../three/support.js';

const CACHE_MAX = 120;
const cache = new Map();
let queue = [];
let running = false;
let stageModule = null;

const loadStage = () => {
  stageModule = stageModule || import('../three/stage.js');
  return stageModule;
};

/** A chave de uma foto: tudo o que muda o desenho (inclusive a raquete de marca resolvida). */
export function snapKey(recipe, { view = 'bust', width = 160, height = 160, brandItems = [] } = {}) {
  const paddle = recipe?.paddleBrand ? JSON.stringify(resolvePaddle(recipe, brandItems)) : '';
  return `${view}|${width}x${height}|${JSON.stringify(recipe)}|${paddle}`;
}

function remember(key, canvas) {
  cache.delete(key);
  cache.set(key, canvas);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

async function draw(job) {
  const hit = job.cache && cache.get(job.key);
  if (hit) return hit;
  const { snapAvatar } = await loadStage();
  const src = snapAvatar(job.recipe, job.opts);
  const copy = document.createElement('canvas');
  copy.width = src.width;
  copy.height = src.height;
  copy.getContext('2d').drawImage(src, 0, 0);
  if (job.cache) remember(job.key, copy);
  return copy;
}

function pump() {
  if (running) return;
  running = true;
  const step = async () => {
    const job = queue.shift();
    if (!job) {
      running = false;
      return;
    }
    if (!job.cancelled) {
      try {
        job.resolve(await draw(job));
      } catch (err) {
        job.reject(err);
      }
    }
    setTimeout(step, 0);
  };
  step();
}

/**
 * Pede uma foto. Devolve `{ key, promise, cancel }`; a promessa entrega um
 * canvas pronto (não o altere: ele fica guardado para o próximo pedido igual).
 * @param {object} recipe receita normalizada
 * @param {{ view?:'bust'|'face'|'paddle'|'full', width?:number, height?:number, brandItems?:Array, urgent?:boolean, cache?:boolean }} [opts]
 */
export function requestSnap(recipe, { view = 'bust', width = 160, height = 160, brandItems = [], urgent = false, cache: keep = true } = {}) {
  const opts = { view, width, height, brandItems };
  const key = snapKey(recipe, opts);
  const hit = keep && cache.get(key);
  if (hit) return { key, promise: Promise.resolve(hit), cancel() {} };
  if (!webglAvailable()) return { key, promise: Promise.reject(new Error('webgl')), cancel() {} };
  const job = { key, recipe, opts, cache: keep, cancelled: false };
  job.promise = new Promise((resolve, reject) => {
    job.resolve = resolve;
    job.reject = reject;
  });
  if (urgent) queue.unshift(job);
  else queue.push(job);
  pump();
  return { key, promise: job.promise, cancel() { job.cancelled = true; } };
}

/** A foto já guardada, se houver (para desenhar na hora, sem piscar). */
export function cachedSnap(key) {
  return cache.get(key) || null;
}

/** Solta o palco das fotos e o que estava guardado (ao sair do estúdio). */
export async function releaseSnapshots() {
  queue.forEach((job) => { job.cancelled = true; });
  queue = [];
  cache.clear();
  if (!stageModule) return;
  const { disposeSnapper } = await stageModule;
  disposeSnapper();
}
