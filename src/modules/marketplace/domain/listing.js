/**
 * MERCADO — o anúncio: validar o que o vendedor digitou, montar os termos de
 * busca e responder "dá para comprar?" (lógica pura).
 */
import {
  LISTING_TYPE, LISTING_STATUS, CONDITION, FULFILLMENT, MEDIA_LIMITS, TEXT_LIMITS,
  PUBLIC_LISTING_STATUSES,
} from './constants.js';
import { findCategory, validateAttributes, categoryPath } from './taxonomy.js';
import { normalizeAspect, normalizeFrame } from './mediaFrame.js';

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na',
  'nos', 'nas', 'um', 'uma', 'com', 'para', 'por', 'pra', 'sem', 'que', 'ou',
]);

/** "Raquete JOOLA Pérola!" → "raquete joola perola" */
export function normalizeSearchText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Palavras úteis de um texto (sem acento, sem palavra vazia, sem repetir). */
export function tokenize(text) {
  const out = [];
  for (const w of normalizeSearchText(text).split(' ')) {
    if (w.length < 2 || STOPWORDS.has(w) || out.includes(w)) continue;
    out.push(w);
  }
  return out;
}

/** Termos denormalizados no anúncio (≤ 60), para `array-contains` e para a busca. */
export function buildSearchTerms({ title, brand, categorySlug, attributes, city, condition } = {}) {
  const cat = findCategory(categorySlug);
  const parent = cat?.parent ? findCategory(cat.parent) : null;
  const parts = [
    title, brand, cat?.label, parent?.label, city,
    ...Object.values(attributes || {}).filter((v) => typeof v === 'string' || typeof v === 'number'),
    condition && condition !== CONDITION.NEW ? 'usado' : 'novo',
  ];
  return tokenize(parts.join(' ')).slice(0, 60);
}

/** Primeira foto (a capa) ou `null`. */
export function coverOf(listing) {
  const media = Array.isArray(listing?.media) ? listing.media : [];
  return media.find((m) => m?.kind !== 'video' && m?.is_cover)
    || media.find((m) => m?.kind !== 'video')
    || null;
}

/** Quantas unidades ainda há. */
export function availableQuantity(listing) {
  const q = Math.max(0, Math.floor(Number(listing?.quantity) || 0));
  return q;
}

/**
 * Dá para comprar agora? Devolve o motivo quando não dá — a tela mostra o
 * motivo em vez de um botão desabilitado mudo.
 */
export function buyability(listing, { viewerUid, sellerManagers = [] } = {}) {
  if (!listing) return { ok: false, reason: 'Anúncio não encontrado.' };
  if (listing.status !== LISTING_STATUS.ACTIVE) {
    return { ok: false, reason: listing.status === LISTING_STATUS.SOLD_OUT ? 'Esgotado.' : 'Este anúncio não está à venda agora.' };
  }
  if (availableQuantity(listing) < 1) return { ok: false, reason: 'Esgotado.' };
  if (viewerUid && (listing.seller_uid === viewerUid || sellerManagers.includes(viewerUid))) {
    return { ok: false, reason: 'Este anúncio é seu.', own: true };
  }
  return { ok: true, reason: '' };
}

export function isPublicListing(listing) {
  return PUBLIC_LISTING_STATUSES.includes(listing?.status);
}

/** Link de vídeo aceito (YouTube ou Vimeo) → `{ provider, id, embed }` ou `null`. */
export function parseVideoLink(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  let m = s.match(/^https:\/\/(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)([\w-]{6,})/)
    || s.match(/^https:\/\/youtu\.be\/([\w-]{6,})/);
  if (m) return { provider: 'youtube', id: m[1], url: s, embed: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  m = s.match(/^https:\/\/(?:www\.)?vimeo\.com\/(\d{5,})/) || s.match(/^https:\/\/player\.vimeo\.com\/video\/(\d{5,})/);
  if (m) return { provider: 'vimeo', id: m[1], url: s, embed: `https://player.vimeo.com/video/${m[1]}` };
  return null;
}

/**
 * Valida e normaliza o formulário do anúncio. `publish` exige o mínimo para ir
 * ao ar (foto, preço, entrega); o rascunho aceita incompleto.
 * @returns {{ value: object, errors: Record<string,string>, ok: boolean }}
 */
export function validateListingInput(input = {}, { publish = false } = {}) {
  const errors = {};
  const title = String(input.title || '').trim().replace(/\s+/g, ' ');
  if (!title) errors.title = 'Dê um título ao anúncio.';
  else if (title.length < 6) errors.title = 'O título precisa de pelo menos 6 letras.';
  else if (title.length > TEXT_LIMITS.title) errors.title = `Até ${TEXT_LIMITS.title} caracteres.`;

  const description = String(input.description || '').trim().slice(0, TEXT_LIMITS.description);

  const category = findCategory(input.category_slug);
  if (!category) errors.category_slug = 'Escolha a categoria.';

  // 'used' é o apelido curto (rascunhos antigos do editor gravavam assim).
  const type = [LISTING_TYPE.USED, 'used'].includes(input.type) ? LISTING_TYPE.USED : LISTING_TYPE.NEW;
  const condition = type === LISTING_TYPE.NEW
    ? CONDITION.NEW
    : (Object.values(CONDITION).includes(input.condition) && input.condition !== CONDITION.NEW ? input.condition : null);
  if (type === LISTING_TYPE.USED && !condition) errors.condition = 'Diga o estado do produto usado.';

  const price = Math.round(Number(input.price_cents));
  if (!(price > 0)) errors.price_cents = 'Informe o preço.';
  else if (price > 10_000_000) errors.price_cents = 'Preço acima do limite (R$ 100.000).';

  let compareAt = input.compare_at_cents == null || input.compare_at_cents === '' ? null : Math.round(Number(input.compare_at_cents));
  if (compareAt != null && !(compareAt > price)) {
    if (compareAt) errors.compare_at_cents = 'O preço "de" precisa ser maior que o preço atual.';
    compareAt = null;
  }

  const quantity = Math.floor(Number(input.quantity ?? 1));
  if (!(quantity >= 0) || quantity > 9999) errors.quantity = 'Quantidade entre 0 e 9999.';

  const fulfillment = Array.isArray(input.fulfillment)
    ? [...new Set(input.fulfillment.filter((f) => Object.values(FULFILLMENT).includes(f)))]
    : [];
  if (!fulfillment.length) errors.fulfillment = 'Escolha ao menos uma forma de entrega.';

  const shippingCents = fulfillment.includes(FULFILLMENT.SHIPPING)
    ? (input.shipping_cents === '' || input.shipping_cents == null ? null : Math.max(0, Math.round(Number(input.shipping_cents) || 0)))
    : null;

  const media = (Array.isArray(input.media) ? input.media : [])
    .filter((m) => m && typeof m.url === 'string' && m.url.startsWith('https://'))
    .slice(0, MEDIA_LIMITS.maxPhotos + 1)
    .map((m, i) => ({
      url: m.url,
      path: m.path || '',
      thumb_url: m.thumb_url || m.url,
      kind: m.kind === 'video' ? 'video' : 'image',
      alt: String(m.alt || '').slice(0, 140),
      ...(m.kind === 'video' ? {} : { frame: normalizeFrame(m.frame), aspect: normalizeAspect(m.aspect) }),
      ai_generated: m.ai_generated === true,
      is_cover: false,
      order: i,
    }));
  const photos = media.filter((m) => m.kind === 'image');
  const videos = media.filter((m) => m.kind === 'video');
  if (photos.length > MEDIA_LIMITS.maxPhotos) errors.media = `Até ${MEDIA_LIMITS.maxPhotos} fotos.`;
  if (videos.length > 1) errors.media = 'Um vídeo por anúncio.';
  if (photos[0]) photos[0].is_cover = true;
  const orderedMedia = [...photos, ...videos.slice(0, 1)].map((m, i) => ({ ...m, order: i }));

  const videoLink = input.video_link ? parseVideoLink(input.video_link) : null;
  if (input.video_link && !videoLink) errors.video_link = 'Use um link do YouTube ou do Vimeo.';

  const { value: attributes, errors: attrErrors } = validateAttributes(input.category_slug, input.attributes);
  Object.entries(attrErrors).forEach(([k, msg]) => { errors[`attr_${k}`] = msg; });

  const city = String(input.city || '').trim().slice(0, 60);
  const state = String(input.state || '').trim().toUpperCase().slice(0, 2);

  if (publish) {
    if (!photos.length) errors.media = 'Coloque ao menos uma foto.';
    if (!city || state.length !== 2) errors.city = 'Diga a cidade e o estado.';
    if (fulfillment.includes(FULFILLMENT.SHIPPING) && shippingCents == null && !input.shipping_to_agree) {
      errors.shipping_cents = 'Diga o valor do envio ou marque "a combinar".';
    }
  }

  const brand = String(attributes.marca || input.brand || '').trim().slice(0, 40);
  const value = {
    title,
    description,
    category_slug: category ? category.slug : '',
    category_path: category ? categoryPath(category.slug) : [],
    type,
    condition,
    brand,
    attributes,
    price_cents: price > 0 ? price : 0,
    compare_at_cents: compareAt,
    quantity: quantity >= 0 ? quantity : 0,
    accepts_offers: Boolean(input.accepts_offers),
    fulfillment,
    shipping_cents: shippingCents,
    shipping_to_agree: fulfillment.includes(FULFILLMENT.SHIPPING) && Boolean(input.shipping_to_agree),
    pickup_note: String(input.pickup_note || '').trim().slice(0, 140),
    media: orderedMedia,
    video_link: videoLink ? videoLink.url : '',
    city,
    state,
    search_terms: buildSearchTerms({
      title, brand, categorySlug: input.category_slug, attributes, city, condition,
    }),
  };
  return { value, errors, ok: Object.keys(errors).length === 0 };
}

/** Quão completo está o anúncio (0–1): fotos, descrição, atributos, vídeo. */
export function listingCompleteness(listing) {
  if (!listing) return 0;
  const photos = (listing.media || []).filter((m) => m.kind !== 'video').length;
  let score = 0;
  score += Math.min(photos, 4) / 4 * 0.4;
  score += Math.min(String(listing.description || '').length, 300) / 300 * 0.3;
  score += Math.min(Object.keys(listing.attributes || {}).length, 3) / 3 * 0.2;
  score += (listing.video_link || (listing.media || []).some((m) => m.kind === 'video')) ? 0.1 : 0;
  return Math.round(score * 100) / 100;
}
