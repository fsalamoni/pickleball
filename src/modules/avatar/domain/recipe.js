/**
 * A RECEITA do avatar (puro): o que fica gravado em `users.avatar.recipe` e no
 * espelho público. Só ids do catálogo, cores `#rrggbb` e poucos números —
 * nada pessoal. Tudo o que não se reconhece cai no padrão daquela parte, então
 * uma receita antiga (ou adulterada) nunca quebra o desenho.
 */
import { RECIPE_OPTIONS, RECIPE_COLOR_FIELDS, GEAR_COLORS } from './catalog.js';
import { isHexColor } from './color.js';

export const RECIPE_VERSION = 1;

export const DEFAULT_RECIPE = Object.freeze({
  v: RECIPE_VERSION,
  skin: 's4',
  face: 'oval',
  eyes: 'round',
  eyeColor: 'brown',
  brows: 'natural',
  nose: 'soft',
  cheeks: true,
  freckles: false,
  hair: 'short',
  hairColor: 'darkbrown',
  beard: 'none',
  glasses: 'none',
  glassesColor: '#0b0f19',
  headwear: 'visor',
  headwearColor: '#ffffff',
  top: 'tee',
  topColor: '#2563eb',
  topColor2: '#d4f82e',
  topPattern: 'side',
  chestMark: 'ball',
  chestNumber: '7',
  bottom: 'shorts',
  bottomColor: '#0b0f19',
  shoesColor: '#ffffff',
  socks: 'crew',
  socksColor: '#ffffff',
  wristband: true,
  paddleShape: 'standard',
  paddleColor: '#d4f82e',
  paddleColor2: '#0b0f19',
  paddleEdge: '#0b0f19',
  paddleGrip: '#1f2937',
  paddleArt: 'fade',
  paddleBrand: null,
  ball: 'yellow',
  expression: 'smile',
  pose: 'ready',
  background: 'acid',
});

const ids = (list) => new Set(list.map((o) => o.id));
const VALID = Object.fromEntries(Object.entries(RECIPE_OPTIONS).map(([k, list]) => [k, ids(list)]));

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
  for (const field of RECIPE_COLOR_FIELDS) {
    if (isHexColor(src[field])) out[field] = src[field].toLowerCase();
  }
  for (const field of ['cheeks', 'freckles', 'wristband']) {
    if (typeof src[field] === 'boolean') out[field] = src[field];
  }
  const num = String(src.chestNumber ?? '').replace(/\D/g, '').slice(0, 2);
  out.chestNumber = num || DEFAULT_RECIPE.chestNumber;
  const brands = brandIds ? new Set(brandIds) : null;
  out.paddleBrand = typeof src.paddleBrand === 'string' && brands?.has(src.paddleBrand) ? src.paddleBrand : null;
  // Vestido já é a parte de baixo.
  return out;
}

/** Duas receitas desenham o mesmo avatar? */
export function sameRecipe(a, b) {
  const x = normalizeRecipe(a);
  const y = normalizeRecipe(b);
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

const pick = (rnd, list) => list[Math.floor(rnd() * list.length) % list.length];

/** Combinações de cor que ficam bem juntas (roupa, segunda cor). */
const OUTFITS = [
  ['#2563eb', '#d4f82e'], ['#0b0f19', '#d4f82e'], ['#ffffff', '#2563eb'], ['#ef4444', '#ffffff'],
  ['#0f766e', '#facc15'], ['#7c3aed', '#38bdf8'], ['#ec4899', '#ffffff'], ['#f97316', '#0b0f19'],
  ['#22c55e', '#0b0f19'], ['#1e3a8a', '#f97316'], ['#facc15', '#1f2937'], ['#38bdf8', '#ffffff'],
];

/**
 * "Surpreenda-me": um avatar inteiro sorteado. `keep` mantém partes que a
 * pessoa já escolheu (ex.: o rosto, ao sortear só a roupa).
 * @param {() => number} rnd
 * @param {{ base?: object, only?: 'look'|'all' }} [opts]
 */
export function randomRecipe(rnd = Math.random, { base, only = 'all' } = {}) {
  const r = normalizeRecipe(base);
  const o = RECIPE_OPTIONS;
  const [c1, c2] = pick(rnd, OUTFITS);
  const look = {
    headwear: pick(rnd, o.headwear).id,
    headwearColor: pick(rnd, GEAR_COLORS),
    glasses: rnd() < 0.7 ? 'none' : pick(rnd, o.glasses).id,
    top: pick(rnd, o.top).id,
    topColor: c1,
    topColor2: c2,
    topPattern: pick(rnd, o.topPattern).id,
    chestMark: pick(rnd, o.chestMark).id,
    chestNumber: String(1 + Math.floor(rnd() * 99)),
    bottom: pick(rnd, o.bottom).id,
    bottomColor: pick(rnd, ['#0b0f19', '#1f2937', '#ffffff', '#1e3a8a', c1, c2]),
    shoesColor: pick(rnd, ['#ffffff', '#0b0f19', c1, c2]),
    socks: pick(rnd, o.socks).id,
    socksColor: pick(rnd, ['#ffffff', c2]),
    wristband: rnd() < 0.5,
    paddleShape: pick(rnd, o.paddleShape).id,
    paddleArt: pick(rnd, o.paddleArt).id,
    paddleColor: pick(rnd, GEAR_COLORS),
    paddleColor2: pick(rnd, ['#0b0f19', '#ffffff', c1, c2]),
    paddleEdge: pick(rnd, ['#0b0f19', '#ffffff', c2]),
    expression: pick(rnd, o.expression).id,
    pose: pick(rnd, o.pose).id,
    background: pick(rnd, o.background).id,
  };
  if (only === 'look') return normalizeRecipe({ ...r, ...look });
  const face = {
    skin: pick(rnd, o.skin).id,
    face: pick(rnd, o.face).id,
    eyes: pick(rnd, o.eyes).id,
    eyeColor: pick(rnd, o.eyeColor).id,
    brows: pick(rnd, o.brows).id,
    nose: pick(rnd, o.nose).id,
    cheeks: rnd() < 0.6,
    freckles: rnd() < 0.2,
    hair: pick(rnd, o.hair).id,
    hairColor: pick(rnd, o.hairColor.slice(0, 9)).id,
    beard: rnd() < 0.65 ? 'none' : pick(rnd, o.beard).id,
  };
  return normalizeRecipe({ ...r, ...face, ...look });
}
