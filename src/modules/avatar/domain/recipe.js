/**
 * A RECEITA do avatar (puro): o que fica gravado em `users.avatar.recipe` e no
 * espelho público. Só ids do catálogo e um sim/não — nenhum texto livre, nada
 * pessoal. É dela que o SERVIDOR escreve o pedido da imagem
 * (`functions/avatarAiPolicy.js`, mesma régua, com paridade). Tudo o que não
 * se reconhece cai no padrão daquela parte: uma receita antiga (a do boneco
 * 3D, v1) ou adulterada nunca quebra nada.
 */
import { RECIPE_OPTIONS } from './catalog.js';

export const RECIPE_VERSION = 2;

export const DEFAULT_RECIPE = Object.freeze({
  v: RECIPE_VERSION,
  body: 'n',
  age: 'adult',
  build: 'average',
  skin: 's4',
  face: 'oval',
  eyeColor: 'brown',
  freckles: false,
  hair: 'short',
  hairColor: 'darkbrown',
  beard: 'none',
  glasses: 'none',
  headwear: 'visor',
  headwearColor: 'white',
  top: 'polo',
  topColor: 'blue',
  bottom: 'shorts',
  bottomColor: 'black',
  paddleColor: 'lime',
  paddleBrand: null,
  expression: 'smile',
  pose: 'shoulder',
  background: 'acid',
  frame: 'bust',
});

const VALID = Object.fromEntries(Object.entries(RECIPE_OPTIONS).map(([k, list]) => [k, new Set(list.map((o) => o.id))]));

/**
 * A receita limpa: cada campo conferido contra o catálogo.
 * @param {object} raw
 * @param {{ brandIds?: Iterable<string> }} [opts] ids das raquetes de marca no ar
 */
export function normalizeRecipe(raw, { brandIds } = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...DEFAULT_RECIPE };
  for (const [field, valid] of Object.entries(VALID)) {
    if (valid.has(src[field])) out[field] = src[field];
  }
  if (typeof src.freckles === 'boolean') out.freckles = src.freckles;
  const brands = brandIds ? new Set(brandIds) : null;
  out.paddleBrand = typeof src.paddleBrand === 'string' && brands?.has(src.paddleBrand) ? src.paddleBrand : null;
  return out;
}

/** Duas receitas pedem o mesmo avatar? (a raquete de marca conta) */
export function sameRecipe(a, b) {
  const brandIds = [a?.paddleBrand, b?.paddleBrand].filter(Boolean);
  const x = normalizeRecipe(a, { brandIds });
  const y = normalizeRecipe(b, { brandIds });
  return Object.keys(x).every((k) => x[k] === y[k]);
}

/** Gerador determinístico (mulberry32) — o sorteio é testável. */
export function seededRandom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rnd, list) => list[Math.floor(rnd() * list.length) % list.length].id;

/** Campos do VISUAL: o que "Sortear o visual" troca sem mexer na pessoa. */
const LOOK_FIELDS = ['glasses', 'headwear', 'headwearColor', 'top', 'topColor', 'bottom', 'bottomColor', 'paddleColor', 'expression', 'pose', 'background'];

/**
 * "Surpreenda-me": sorteia o visual (roupa, acessórios, pose, fundo) sobre a
 * pessoa que já está escolhida. Não gasta criação: só preenche as escolhas.
 * @param {() => number} rnd
 * @param {object} [base]
 */
export function randomLook(rnd = Math.random, base) {
  const r = normalizeRecipe(base, { brandIds: base?.paddleBrand ? [base.paddleBrand] : [] });
  const look = Object.fromEntries(LOOK_FIELDS.map((f) => [f, pick(rnd, RECIPE_OPTIONS[f])]));
  if (rnd() < 0.7) look.glasses = 'none';
  return { ...r, ...look, paddleBrand: null };
}
