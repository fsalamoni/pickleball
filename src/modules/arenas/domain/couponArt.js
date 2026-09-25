/**
 * A ARTE do cupom (Onda CD) — o "vale" que a pessoa vê, com o código para
 * copiar.
 *
 * ## O pedido
 *
 * *"A mesma coisa para cupons, deve ter padrões e modelos, mas permitir que a
 * arena também faça upload ou crie o seu próprio. E deve ser possível copiar o
 * código."*
 *
 * ## O desenho
 *
 * Um cupom é um TÍQUETE: a parte principal diz o que ele dá, e o canhoto, do
 * outro lado do picote, traz o CÓDIGO — que é sempre o código de verdade do
 * cupom, montado pela tela e tocável para copiar. Por isso o código nunca vai
 * dentro da imagem enviada: imagem não se copia, e o código escrito nela
 * ficaria errado no dia em que a arena trocasse o código.
 *
 * Como no banner (Onda CC), a arte criada na plataforma NÃO é uma imagem: é um
 * desenho (`style`, cores e três textos). Texto em branco usa o do próprio
 * cupom ("10% de desconto", a descrição) — a arte escolhida nunca desmente o
 * cupom, porque o título padrão É o benefício.
 *
 * Modelos: CINCO da plataforma (código) e os da ARENA, em
 * `arena_settings.coupon_templates` (só a arena lê e escreve), com as mesmas
 * regras dos modelos de banner — editar um da plataforma e salvar cria um
 * modelo da arena, e o original fica como estava.
 *
 * PURO. Sem React, sem Firebase.
 */
import { luminance, normalizeHex, readableInk } from './whiteLabel.js';
import {
  ARENA_TEMPLATES_MAX, arenaTemplatesFrom, contrastRatio, isAllowedImageUrl, isArenaTemplateId,
  MIN_TEXT_CONTRAST, removeArenaTemplate, saveArenaTemplate,
} from './bannerArt.js';

/* ------------------------------------------------------------------ */
/*  Os estilos e os modelos                                           */
/* ------------------------------------------------------------------ */

export const COUPON_ART_STYLE = Object.freeze({
  CLASSICO: 'classico',
  NEON: 'neon',
  QUADRA: 'quadra',
  FESTA: 'festa',
  SOL: 'sol',
});

/** Até quantos caracteres cada texto vai — além disso o tíquete quebra feio. */
export const COUPON_TEXT_LIMITS = Object.freeze({
  kicker: 28,
  title: 40,
  subtitle: 90,
});

/**
 * Os cinco modelos da plataforma. O título e o texto vêm EM BRANCO de
 * propósito: em branco, valem o benefício e a descrição do próprio cupom.
 */
export const COUPON_ART_TEMPLATES = Object.freeze([
  Object.freeze({
    id: 'classico',
    name: 'Clássico',
    description: 'Papel e tinta, como um vale de verdade. Serve para tudo.',
    design: Object.freeze({
      style: COUPON_ART_STYLE.CLASSICO, kicker: 'Cupom', title: '', subtitle: '',
      bg: '#f4f1ea', fg: '#0b0b0c', accent: '#0f766e',
    }),
  }),
  Object.freeze({
    id: 'neon',
    name: 'Neon',
    description: 'Escuro com o verde-limão. Chama atenção em qualquer lista.',
    design: Object.freeze({
      style: COUPON_ART_STYLE.NEON, kicker: 'Só pelo app', title: '', subtitle: '',
      bg: '#0b0b0c', fg: '#ffffff', accent: '#d4f631',
    }),
  }),
  Object.freeze({
    id: 'quadra',
    name: 'Quadra',
    description: 'O verde da quadra com as linhas. Para reserva e hora grátis.',
    design: Object.freeze({
      style: COUPON_ART_STYLE.QUADRA, kicker: 'Para jogar mais', title: '', subtitle: '',
      bg: '#0f766e', fg: '#ffffff', accent: '#fde047',
    }),
  }),
  Object.freeze({
    id: 'festa',
    name: 'Festa',
    description: 'Para data especial, aniversário e evento.',
    design: Object.freeze({
      style: COUPON_ART_STYLE.FESTA, kicker: 'Presente da casa', title: '', subtitle: '',
      bg: '#5b21b6', fg: '#ffffff', accent: '#f0abfc',
    }),
  }),
  Object.freeze({
    id: 'sol',
    name: 'Sol',
    description: 'Quente: happy hour, bebida e comida.',
    design: Object.freeze({
      style: COUPON_ART_STYLE.SOL, kicker: 'Happy hour', title: '', subtitle: '',
      bg: '#f97316', fg: '#0b0b0c', accent: '#fff7ed',
    }),
  }),
]);

/** O modelo da plataforma pelo id (ou `null`). */
export function couponTemplate(id) {
  return COUPON_ART_TEMPLATES.find((t) => t.id === id) || null;
}

/** O modelo que vale quando o cupom não tem arte (todo cupom anterior). */
export const DEFAULT_COUPON_TEMPLATE_ID = 'classico';

/* ------------------------------------------------------------------ */
/*  Conferir o desenho                                                */
/* ------------------------------------------------------------------ */

function texto(v, max) {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * O desenho do cupom, conferido: estilo conhecido, cores válidas, textos
 * cortados no limite. A cor do texto, quando falta, é escolhida por contraste.
 * Sempre VÁLIDO (título em branco usa o benefício do cupom); os avisos dizem o
 * que vai ficar ruim de ler.
 *
 * @returns {{ valid: true, value: object, warnings: string[] }}
 */
export function normalizeCouponArtDesign(input = {}) {
  const base = couponTemplate(DEFAULT_COUPON_TEMPLATE_ID).design;
  const style = Object.values(COUPON_ART_STYLE).includes(input.style) ? input.style : base.style;
  const bg = normalizeHex(input.bg) || base.bg;
  const fg = normalizeHex(input.fg) || normalizeHex(readableInk(bg)) || '#0b0b0c';
  const accent = normalizeHex(input.accent) || base.accent;
  const value = {
    style,
    kicker: texto(input.kicker, COUPON_TEXT_LIMITS.kicker),
    title: texto(input.title, COUPON_TEXT_LIMITS.title),
    subtitle: texto(input.subtitle, COUPON_TEXT_LIMITS.subtitle),
    bg,
    fg,
    accent,
  };
  const warnings = [];
  if (contrastRatio(fg, bg) < MIN_TEXT_CONTRAST) {
    warnings.push('O texto está pouco visível sobre este fundo. Troque a cor do texto ou do fundo.');
  }
  return { valid: true, value, warnings };
}

/** A cor do texto do CANHOTO (onde fica o código), escolhida por contraste. */
export function stubInk(accent) {
  const cor = normalizeHex(accent) || '#0f766e';
  return luminance(cor) > 0.45 ? '#0b0b0c' : '#ffffff';
}

/** Um desenho a partir de um modelo (da plataforma ou da arena). */
export function couponDesignFromTemplate(template, overrides = {}) {
  const base = template?.design || couponTemplate(DEFAULT_COUPON_TEMPLATE_ID).design;
  return normalizeCouponArtDesign({ ...base, ...overrides }).value;
}

/** A cor da arena aplicada ao desenho (fundo = marca; texto por contraste). */
export function withArenaCouponColors(design, brandColor) {
  const cor = normalizeHex(brandColor);
  if (!cor) return normalizeCouponArtDesign(design).value;
  return normalizeCouponArtDesign({ ...design, bg: cor, fg: readableInk(cor) }).value;
}

/**
 * Troca o modelo MANTENDO o que a pessoa escreveu (texto igual ao exemplo do
 * modelo anterior é exemplo; diferente, foi escrito por ela).
 */
export function switchCouponTemplate(atual = {}, de = null, para = COUPON_ART_TEMPLATES[0].design) {
  const saida = { ...para };
  ['kicker', 'title', 'subtitle'].forEach((campo) => {
    const escrito = String(atual?.[campo] || '').trim();
    const exemplo = String(de?.[campo] || '').trim();
    if (escrito && escrito !== exemplo) saida[campo] = escrito;
  });
  return normalizeCouponArtDesign(saida).value;
}

/* ------------------------------------------------------------------ */
/*  A arte inteira (desenho OU imagem enviada)                        */
/* ------------------------------------------------------------------ */

export const COUPON_ART_SOURCE = Object.freeze({
  DESIGN: 'design',
  UPLOAD: 'upload',
});

export const COUPON_ALT_MAX = 200;

/**
 * A arte que vai para `arena_coupons.art` — ou `null` (sem arte: vale o
 * modelo Clássico na tela).
 *
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object|null }}
 */
export function normalizeCouponArt(input) {
  if (input == null) return { valid: true, errors: {}, value: null };
  const errors = {};
  if (input.source === COUPON_ART_SOURCE.UPLOAD) {
    const url = String(input.image_url || '').trim();
    const alt = texto(input.alt, COUPON_ALT_MAX);
    if (!url) errors.image_url = 'Envie a imagem do cupom.';
    else if (!isAllowedImageUrl(url)) errors.image_url = 'A imagem precisa ser enviada pela plataforma.';
    if (!alt) errors.alt = 'Descreva a imagem (é o que o leitor de tela lê).';
    const w = Number(input.width);
    const h = Number(input.height);
    return {
      valid: Object.keys(errors).length === 0,
      errors,
      value: {
        source: COUPON_ART_SOURCE.UPLOAD,
        image_url: url,
        image_path: String(input.image_path || '').slice(0, 300),
        width: Number.isFinite(w) && w > 0 ? Math.round(w) : null,
        height: Number.isFinite(h) && h > 0 ? Math.round(h) : null,
        alt,
      },
    };
  }
  if (input.source === COUPON_ART_SOURCE.DESIGN || input.design) {
    const id = String(input.template_id || '').slice(0, 60);
    return {
      valid: true,
      errors: {},
      value: {
        source: COUPON_ART_SOURCE.DESIGN,
        template_id: couponTemplate(id) || isArenaTemplateId(id) ? id : null,
        design: normalizeCouponArtDesign(input.design || {}).value,
      },
    };
  }
  return { valid: false, errors: { art: 'Arte do cupom inválida.' }, value: null };
}

/**
 * O que a tela desenha para um cupom: a arte dele, ou o Clássico.
 *
 * @param {object} coupon
 * @param {object} [override] a arte do formulário (pré-visualização)
 * @returns {{ source: 'design'|'upload', design?: object, image_url?: string, alt?: string }}
 */
export function couponArtOf(coupon, override) {
  const art = override !== undefined ? override : coupon?.art;
  const n = normalizeCouponArt(art || null);
  if (n.value && (n.value.source === COUPON_ART_SOURCE.DESIGN || n.value.image_url)) return n.value;
  return {
    source: COUPON_ART_SOURCE.DESIGN,
    template_id: DEFAULT_COUPON_TEMPLATE_ID,
    design: couponDesignFromTemplate(couponTemplate(DEFAULT_COUPON_TEMPLATE_ID)),
  };
}

/**
 * Os textos do tíquete. Em branco, valem os do CUPOM: o benefício ("10% de
 * desconto", "1 água de coco") e a descrição. Assim a arte não desmente o
 * cupom — nem quando a arena muda o desconto depois.
 *
 * @param {object} design
 * @param {{ benefit?: string, description?: string, kicker?: string }} doCupom
 */
export function couponArtTexts(design = {}, doCupom = {}) {
  return {
    kicker: design.kicker || doCupom.kicker || '',
    title: design.title || doCupom.benefit || 'Cupom',
    subtitle: design.subtitle || doCupom.description || '',
  };
}

/* ------------------------------------------------------------------ */
/*  A imagem enviada                                                  */
/* ------------------------------------------------------------------ */

export const COUPON_UPLOAD_SPEC = Object.freeze({
  noun: 'a arte do cupom',
  ratio: 2,
  ratioLabel: '2:1',
  recommended: Object.freeze({ width: 1200, height: 600 }),
  minimum: Object.freeze({ width: 800, height: 400 }),
  formats: Object.freeze(['JPG', 'PNG', 'WebP']),
  mimeTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  idealBytes: 1 * 1024 * 1024,
  maxBytes: 5 * 1024 * 1024,
  /** Os cantos são arredondados e o picote morde as bordas. */
  safeArea: Object.freeze({ width: 0.9, height: 0.8 }),
  ratioTolerance: 0.08,
});

/** A especificação da imagem do cupom, em linhas para a tela. */
export function couponUploadGuide(spec = COUPON_UPLOAD_SPEC) {
  const mb = (b) => `${Math.round(b / (1024 * 1024))} MB`;
  return [
    { label: 'Tamanho ideal', value: `${spec.recommended.width} × ${spec.recommended.height} px` },
    { label: 'Proporção', value: `${spec.ratioLabel} (a largura é o dobro da altura)` },
    { label: 'Mínimo', value: `${spec.minimum.width} × ${spec.minimum.height} px — menor que isso fica borrado` },
    { label: 'Formatos', value: spec.formats.join(', ') },
    { label: 'Peso', value: `até ${mb(spec.idealBytes)} (máximo ${mb(spec.maxBytes)})` },
    { label: 'Código', value: 'NÃO escreva o código na imagem: a plataforma mostra o código ao lado, e quem vê toca para copiar. Assim ele nunca fica errado.' },
    {
      label: 'Margem',
      value: `texto e logo dentro dos ${Math.round(spec.safeArea.width * 100)}% centrais — os cantos são arredondados`,
    },
    { label: 'Texto', value: 'pouco e grande; o que estiver escrito na imagem precisa ir também na descrição' },
  ];
}

/* ------------------------------------------------------------------ */
/*  Os modelos da ARENA                                               */
/* ------------------------------------------------------------------ */

export const COUPON_TEMPLATES_FIELD = 'coupon_templates';
export { ARENA_TEMPLATES_MAX };

/** Salva (ou atualiza) um modelo de cupom da arena. */
export function saveArenaCouponTemplate(lista, modelo, ctx = {}) {
  return saveArenaTemplate(lista, modelo, { ...ctx, normalize: normalizeCouponArtDesign });
}

/** Apaga um modelo de cupom da arena (os da plataforma não se apagam). */
export function removeArenaCouponTemplate(lista, id) {
  return removeArenaTemplate(lista, id);
}

/** Os modelos de cupom da arena, lidos das configurações. */
export function arenaCouponTemplatesFrom(settings) {
  return arenaTemplatesFrom(settings, { field: COUPON_TEMPLATES_FIELD, normalize: normalizeCouponArtDesign });
}
