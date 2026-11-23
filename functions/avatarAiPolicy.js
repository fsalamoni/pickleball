/**
 * AVATAR POR IA — a régua (pura): a receita conferida, o PEDIDO da imagem e
 * os limites de uso (docs/58).
 *
 * ⭐ O pedido que vai ao provedor é escrito AQUI, só com os trechos fixos
 * abaixo. O navegador manda ids; texto que não é um id do catálogo é
 * descartado por `normalizeRecipe` antes de qualquer coisa. Nenhum dado da
 * pessoa entra no pedido.
 *
 * Os ids são os de `src/modules/avatar/domain/catalog.js` (paridade em
 * `avatarAi.parity.test.js`): opção nova entra nos DOIS lados.
 */

const GEAR = {
  lime: 'lime green', green: 'green', teal: 'teal', sky: 'sky blue', blue: 'royal blue', navy: 'navy blue',
  purple: 'purple', pink: 'pink', coral: 'coral', red: 'red', orange: 'orange', yellow: 'yellow',
  white: 'white', gray: 'light gray', black: 'black',
};

/** Campo da receita → { id: trecho em inglês do pedido }. */
const FRAG = {
  body: { f: 'woman', m: 'man', n: 'person with an androgynous look' },
  age: { young: 'about 22 years old', adult: 'about 35 years old', mature: 'about 52 years old', senior: 'about 68 years old' },
  build: { slim: 'slim build', average: 'average build', athletic: 'athletic build', broad: 'broad strong build' },
  skin: {
    s1: 'very fair porcelain', s2: 'fair', s3: 'light rosy', s4: 'light golden tan', s5: 'light brown',
    s6: 'bronze tan', s7: 'medium brown', s8: 'warm brown', s9: 'dark brown', s10: 'deep dark',
  },
  face: { oval: 'oval', round: 'round', square: 'square-jawed', heart: 'heart-shaped' },
  eyeColor: { brown: 'brown', dark: 'dark brown', hazel: 'hazel', green: 'green', blue: 'blue', gray: 'gray', amber: 'amber', teal: 'teal' },
  hair: {
    buzz: 'a buzz cut', short: 'short neat hair', quiff: 'short hair with a voluminous quiff', side: 'short side-parted hair',
    curly: 'short curly hair', afro: 'a round afro', ponytail: 'long hair tied in a high ponytail', bun: 'hair tied up in a bun',
    braids: 'long braids', bob: 'a chin-length bob', long: 'long straight hair', wavy: 'shoulder-length wavy hair',
    locs: 'shoulder-length dreadlocks', bald: 'a bald head', longcurly: 'long curly hair',
  },
  hairColor: {
    black: 'black', darkbrown: 'dark brown', brown: 'brown', lightbrown: 'light brown', blonde: 'blonde', platinum: 'platinum blonde',
    red: 'red', gray: 'gray', white: 'white', pink: 'pink', blue: 'blue', lime: 'lime green',
  },
  beard: {
    none: '', stubble: 'light stubble', mustache: 'a mustache', goatee: 'a goatee', short: 'a short trimmed beard', full: 'a full beard',
  },
  glasses: { none: '', sport: 'sporty wraparound sunglasses', round: 'round eyeglasses', square: 'square eyeglasses' },
  headwear: {
    none: '', visor: 'a {c} sun visor', cap: 'a {c} baseball cap', cap_back: 'a {c} baseball cap worn backwards',
    headband: 'a {c} sports headband', bucket: 'a {c} bucket hat',
  },
  headwearColor: GEAR,
  top: {
    tee: 'a {c} athletic t-shirt', polo: 'a {c} polo shirt', tank: 'a {c} sleeveless athletic top',
    longsleeve: 'a {c} long-sleeve athletic shirt', dress: 'a {c} sleeveless tennis dress',
  },
  topColor: GEAR,
  bottom: { shorts: '{c} athletic shorts', skort: 'a {c} sports skort', leggings: '{c} athletic leggings', pants: '{c} track pants' },
  bottomColor: GEAR,
  paddleColor: GEAR,
  expression: {
    smile: 'a warm friendly smile', grin: 'a big open grin', focus: 'a focused, determined look', wink: 'a playful wink',
    wow: 'a delighted surprised look', laugh: 'a joyful laugh', cool: 'a confident smirk', shout: 'an excited cheer',
  },
  pose: {
    ready: 'in an athletic ready stance, holding the paddle in front with both hands',
    serve: 'about to serve, the paddle drawn back in one hand and a yellow perforated pickleball in the other',
    shoulder: 'relaxed, resting the paddle on one shoulder',
    celebrate: 'celebrating a point, raising the paddle high in the air',
    wave: 'waving hello with one hand and holding the paddle in the other',
    thumbsup: 'giving a thumbs up with one hand and holding the paddle in the other',
  },
  background: {
    acid: 'from pale lime to lime green', sky: 'from pale blue to sky blue', sunset: 'from soft orange to coral pink',
    court: 'from medium blue to deep court blue', mint: 'from pale mint to green', grape: 'from lavender to violet',
    night: 'from slate blue to near black', paper: 'from white to very light gray',
  },
  frame: {
    bust: 'Waist-up portrait, centered, the head in the upper half of the frame.',
    full: 'Full body from head to feet, standing, centered, wearing white court sneakers.',
  },
};

const DEFAULT_RECIPE = Object.freeze({
  v: 2, body: 'n', age: 'adult', build: 'average', skin: 's4', face: 'oval', eyeColor: 'brown', freckles: false,
  hair: 'short', hairColor: 'darkbrown', beard: 'none', glasses: 'none', headwear: 'visor', headwearColor: 'white',
  top: 'polo', topColor: 'blue', bottom: 'shorts', bottomColor: 'black', paddleColor: 'lime', paddleBrand: null,
  expression: 'smile', pose: 'shoulder', background: 'acid', frame: 'bust',
});

/** O que é da PESSOA: "manter o rosto" nunca troca estes campos. */
const IDENTITY_FIELDS = Object.freeze(['body', 'age', 'build', 'skin', 'face', 'eyeColor', 'hair', 'hairColor', 'beard', 'freckles']);

/** A receita limpa: só ids conhecidos (chave PRÓPRIA do mapa, nunca do protótipo). */
function normalizeRecipe(raw, { brandIds } = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = { ...DEFAULT_RECIPE };
  for (const field of Object.keys(FRAG)) {
    if (typeof src[field] === 'string' && Object.hasOwn(FRAG[field], src[field])) out[field] = src[field];
  }
  if (typeof src.freckles === 'boolean') out.freckles = src.freckles;
  const brands = brandIds ? new Set(brandIds) : null;
  out.paddleBrand = typeof src.paddleBrand === 'string' && brands && brands.has(src.paddleBrand) ? src.paddleBrand : null;
  return out;
}

/** "Manter o rosto": a pessoa vem da receita-base; o visual, da nova. */
function mergeKeepingIdentity(base, next) {
  const out = { ...next };
  for (const f of IDENTITY_FIELDS) out[f] = base[f];
  return out;
}

/* ------------------------------------------------------ raquete de marca */

const HEX = /^#[0-9a-f]{6}$/i;
const NAMED = [
  ['lime green', 0xd4f82e], ['green', 0x22c55e], ['teal', 0x14b8a6], ['sky blue', 0x38bdf8], ['royal blue', 0x2563eb],
  ['navy blue', 0x1e3a8a], ['purple', 0x7c3aed], ['pink', 0xec4899], ['red', 0xef4444], ['orange', 0xf97316],
  ['yellow', 0xfacc15], ['white', 0xffffff], ['gray', 0x9ca3af], ['black', 0x0b0f19], ['brown', 0x7c2d12],
];
const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];

/** `#rrggbb` → "nome (#rrggbb)": o nome guia o modelo, o hex afina. */
function colorPhrase(hex) {
  if (!HEX.test(hex || '')) return 'black';
  const [r, g, b] = rgb(parseInt(hex.slice(1), 16));
  let best = NAMED[0];
  let dist = Infinity;
  for (const item of NAMED) {
    const [x, y, z] = rgb(item[1]);
    const d = (r - x) ** 2 + (g - y) ** 2 + (b - z) ** 2;
    if (d < dist) { dist = d; best = item; }
  }
  return `${best[0]} (${hex.toLowerCase()})`;
}

const an = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

const SHAPE = { standard: 'standard', elongated: 'elongated', wide: 'wide-body' };

/** O que a marca escreve na face: só letras, números e pouca pontuação. */
function cleanWordmark(v) {
  return String(v || '').replace(/[^A-Za-z0-9 .&-]/g, '').trim().slice(0, 14);
}

/**
 * A raquete de marca NO AR com este id, ou `null`. `list` é
 * `platform_settings/avatar_catalog.brand_paddles` como está gravada.
 */
function liveBrand(list, id, now) {
  if (!id) return null;
  const item = (Array.isArray(list) ? list : []).find((b) => b && b.id === id);
  if (!item || item.active === false) return null;
  if (Number(item.starts_ms) > 0 && now < Number(item.starts_ms)) return null;
  if (Number(item.ends_ms) > 0 && now > Number(item.ends_ms)) return null;
  return item;
}

function paddlePhrase(recipe, brand) {
  if (!brand) return { text: `a pickleball paddle with ${an(GEAR[recipe.paddleColor])} ${GEAR[recipe.paddleColor]} face`, wordmark: '' };
  const wordmark = cleanWordmark(brand.wordmark);
  const shape = Object.hasOwn(SHAPE, brand.shape) ? SHAPE[brand.shape] : SHAPE.standard;
  const mark = wordmark ? `, with the word "${wordmark}" printed clearly on the paddle face` : '';
  return {
    text: `${an(shape)} ${shape} pickleball paddle with a ${colorPhrase(brand.color)} face and ${colorPhrase(brand.color2)} accents${mark}`,
    wordmark,
  };
}

/* ----------------------------------------------------------- o pedido -- */

const STYLE = 'Stylized 3D character avatar in the polished look of modern smartphone personal avatars and animated feature films: '
  + 'smooth clean skin, large expressive eyes, sculpted glossy hair, soft rounded shapes, soft studio lighting. High quality 3D render, not a photograph.';

/** Põe a cor no trecho, com o artigo certo ("an orange…"). */
const tint = (frag, color) => frag.replace('a {c}', `${an(color)} ${color}`).replace('{c}', color);
const join = (parts) => parts.filter(Boolean).join(', ');

function personPhrase(r) {
  const hair = r.hair === 'bald' ? FRAG.hair.bald : `${FRAG.hairColor[r.hairColor]} ${FRAG.hair[r.hair].replace(/^an? /, '')}`;
  return join([
    `a ${FRAG.body[r.body]} ${FRAG.age[r.age]}`,
    FRAG.build[r.build],
    `${FRAG.skin[r.skin]} skin`,
    `${FRAG.face[r.face]} face`,
    `${FRAG.eyeColor[r.eyeColor]} eyes`,
    hair,
    FRAG.beard[r.beard],
    r.freckles ? 'freckles' : '',
  ]);
}

function lookPhrases(r, brand) {
  const top = tint(FRAG.top[r.top], GEAR[r.topColor]);
  const outfit = r.top === 'dress' ? top : `${top} and ${tint(FRAG.bottom[r.bottom], GEAR[r.bottomColor])}`;
  const acc = join([tint(FRAG.headwear[r.headwear], GEAR[r.headwearColor]), FRAG.glasses[r.glasses]]);
  const paddle = paddlePhrase(r, brand);
  return {
    outfit: `Wearing ${outfit}${acc ? `, with ${acc}` : ', with no hat and no glasses'}.`,
    action: `Holding ${paddle.text}, ${FRAG.pose[r.pose]}, with ${FRAG.expression[r.expression]}.`,
    frame: `${FRAG.frame[r.frame]} Simple soft gradient background ${FRAG.background[r.background]}.`,
    text: paddle.wordmark ? 'No other text, no watermark, no border.' : 'No text, no letters, no logos, no watermark, no border.',
  };
}

/**
 * O pedido da imagem. `keep`: edição sobre a imagem-base (a pessoa fica; o
 * visual muda).
 * @param {object} recipe receita JÁ normalizada
 * @param {{ keep?: boolean, brand?: object|null }} [opts]
 */
function buildPrompt(recipe, { keep = false, brand = null } = {}) {
  const look = lookPhrases(recipe, brand);
  if (keep) {
    return [
      'Use the character in the reference image. Keep exactly the same person and the same art style: same face, facial features, skin tone, eye color, hair style and hair color.',
      'Change only the outfit, accessories, pose, expression, framing and background as follows.',
      look.outfit, look.action, look.frame, STYLE, look.text,
    ].join(' ');
  }
  return [`${STYLE} The character is a pickleball player: ${personPhrase(recipe)}.`, look.outfit, look.action, look.frame, look.text].join(' ');
}

/* ------------------------------------------------- configuração e uso -- */

const QUALITIES = ['low', 'medium', 'high'];
const DEFAULT_CONFIG = Object.freeze({ enabled: false, model: 'gpt-image-2.5-sunburst', quality: 'high', per_day: 3, per_month: 15, platform_month: 2000 });

const inteiro = (v, min, max, padrao) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== null && v !== '' && v !== undefined ? Math.min(max, Math.max(min, n)) : padrao;
};

/** A configuração do admin, limpa (o que não se reconhece cai no padrão). */
function normalizeConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const model = typeof src.model === 'string' && /^[a-z0-9][a-z0-9.-]{2,60}$/.test(src.model) ? src.model : DEFAULT_CONFIG.model;
  const perDay = inteiro(src.per_day, 1, 50, DEFAULT_CONFIG.per_day);
  return {
    enabled: src.enabled === true,
    model,
    quality: QUALITIES.includes(src.quality) ? src.quality : DEFAULT_CONFIG.quality,
    per_day: perDay,
    per_month: Math.max(perDay, inteiro(src.per_month, 1, 1000, DEFAULT_CONFIG.per_month)),
    platform_month: inteiro(src.platform_month, 0, 1000000, DEFAULT_CONFIG.platform_month),
  };
}

/** Dia e mês de Brasília (UTC−3, sem horário de verão). */
function periodKeys(now) {
  const iso = new Date(now - 3 * 3600 * 1000).toISOString();
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
}

const count = (doc, key, field, period) => (doc && doc[key] === period ? Number(doc[field]) || 0 : 0);

/**
 * Quanto a pessoa ainda pode criar agora.
 * @returns {{ ok:boolean, reason:null|'day'|'month'|'platform', day_left:number, month_left:number }}
 */
function limitState(usage, platform, config, now) {
  const { day, month } = periodKeys(now);
  const dayLeft = Math.max(0, config.per_day - count(usage, 'day', 'day_count', day));
  const monthLeft = Math.max(0, config.per_month - count(usage, 'month', 'month_count', month));
  const platformLeft = Math.max(0, config.platform_month - count(platform, 'month', 'month_count', month));
  const reason = platformLeft <= 0 ? 'platform' : monthLeft <= 0 ? 'month' : dayLeft <= 0 ? 'day' : null;
  return { ok: !reason, reason, day_left: Math.min(dayLeft, monthLeft), month_left: monthLeft };
}

/** O contador depois de `delta` criações (+1 ao reservar, −1 ao devolver). */
function bumpUsage(doc, now, delta) {
  const { day, month } = periodKeys(now);
  return {
    day,
    day_count: Math.max(0, count(doc, 'day', 'day_count', day) + delta),
    month,
    month_count: Math.max(0, count(doc, 'month', 'month_count', month) + delta),
  };
}

module.exports = {
  FRAG, GEAR, DEFAULT_RECIPE, IDENTITY_FIELDS, DEFAULT_CONFIG, QUALITIES,
  normalizeRecipe, mergeKeepingIdentity, liveBrand, cleanWordmark, colorPhrase, buildPrompt,
  normalizeConfig, periodKeys, limitState, bumpUsage,
};
