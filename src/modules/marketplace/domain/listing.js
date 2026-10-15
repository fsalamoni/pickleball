/**
 * MERCADO — o anúncio: validar o que o vendedor digitou, montar os termos de
 * busca e responder "dá para comprar?" (lógica pura).
 */
import {
  LISTING_TYPE, LISTING_STATUS, CONDITION, FULFILLMENT, MEDIA_LIMITS, TEXT_LIMITS,
  PUBLIC_LISTING_STATUSES,
} from './constants.js';
import { findCategory, validateAttributes, categoryPath } from './taxonomy.js';
import { t } from '@/core/i18n';
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

export const VARIANT_LIMITS = Object.freeze({ max: 20, label: 40 });

/** As variações do anúncio (tamanho, cor…), ou `[]`. */
export function variantsOf(listing) {
  return Array.isArray(listing?.variants) ? listing.variants.filter((v) => v && v.id) : [];
}

/** Quantas unidades de UMA variação (ou do anúncio, sem variações). */
export function variantQuantity(listing, variantId) {
  const vs = variantsOf(listing);
  if (!vs.length) return availableQuantity(listing);
  const v = vs.find((x) => x.id === variantId);
  return v ? Math.max(0, Math.floor(Number(v.quantity) || 0)) : 0;
}

/**
 * Variações normalizadas: até 20, rótulo 1–40 letras sem repetir, quantidade
 * 0–9999. O id é mantido (o pedido e o carrinho apontam para ele); o novo ganha um.
 */
export function normalizeVariants(raw) {
  if (!Array.isArray(raw)) return { variants: [], error: null };
  const out = [];
  const vistos = new Set();
  let error = null;
  raw.forEach((v, i) => {
    const label = String(v?.label || '').trim().replace(/\s+/g, ' ').slice(0, VARIANT_LIMITS.label);
    if (!label) return;
    const chave = normalizeSearchText(label);
    if (vistos.has(chave)) { error = t('Duas variações com o mesmo nome.'); return; }
    vistos.add(chave);
    const quantity = Math.floor(Number(v.quantity));
    out.push({ id: typeof v.id === 'string' && v.id ? v.id.slice(0, 40) : `v${i}_${Math.random().toString(36).slice(2, 8)}`, label, quantity: quantity >= 0 && quantity <= 9999 ? quantity : 0 });
    if (!(quantity >= 0 && quantity <= 9999)) error = t('Quantidade entre 0 e 9999.');
  });
  if (out.length > VARIANT_LIMITS.max) error = t('Até {n} variações.', { n: VARIANT_LIMITS.max });
  return { variants: out.slice(0, VARIANT_LIMITS.max), error };
}

/**
 * O anúncio como ele VALE agora: a promoção com prazo vencido devolve o preço
 * ao "de". A rotina do servidor grava isso depois; a leitura não espera por ela.
 * ⚠️ Cópia em `functions/marketplace.js` (paridade).
 */
export function effectiveListing(listing, now = Date.now()) {
  if (!listing) return listing;
  const ate = Number(listing.sale_until_ms) || 0;
  const de = Number(listing.compare_at_cents) || 0;
  if (ate && now > ate && de > (Number(listing.price_cents) || 0)) {
    return { ...listing, price_cents: de, compare_at_cents: null, sale_until_ms: null };
  }
  return listing;
}

/**
 * Dá para comprar agora? Devolve o motivo quando não dá — a tela mostra o
 * motivo em vez de um botão desabilitado mudo.
 */
export function buyability(listing, { viewerUid, sellerManagers = [] } = {}) {
  if (!listing) return { ok: false, reason: t('Anúncio não encontrado.') };
  if (listing.status !== LISTING_STATUS.ACTIVE) {
    return { ok: false, reason: listing.status === LISTING_STATUS.SOLD_OUT ? t('Esgotado.') : t('Este anúncio não está à venda agora.') };
  }
  if (availableQuantity(listing) < 1) return { ok: false, reason: t('Esgotado.') };
  if (viewerUid && (listing.seller_uid === viewerUid || sellerManagers.includes(viewerUid))) {
    return { ok: false, reason: t('Este anúncio é seu.'), own: true };
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
  if (!title) errors.title = t('Dê um título ao anúncio.');
  else if (title.length < 6) errors.title = t('O título precisa de pelo menos 6 letras.');
  else if (title.length > TEXT_LIMITS.title) errors.title = t('Até {n} caracteres.', { n: TEXT_LIMITS.title });

  const description = String(input.description || '').trim().slice(0, TEXT_LIMITS.description);

  const category = findCategory(input.category_slug);
  if (!category) errors.category_slug = t('Escolha a categoria.');

  // 'used' é o apelido curto (rascunhos antigos do editor gravavam assim).
  const type = [LISTING_TYPE.USED, 'used'].includes(input.type) ? LISTING_TYPE.USED : LISTING_TYPE.NEW;
  const condition = type === LISTING_TYPE.NEW
    ? CONDITION.NEW
    : (Object.values(CONDITION).includes(input.condition) && input.condition !== CONDITION.NEW ? input.condition : null);
  if (type === LISTING_TYPE.USED && !condition) errors.condition = t('Diga o estado do produto usado.');

  const price = Math.round(Number(input.price_cents));
  if (!(price > 0)) errors.price_cents = t('Informe o preço.');
  else if (price > 10_000_000) errors.price_cents = t('Preço acima do limite (R$ 100.000).');

  let compareAt = input.compare_at_cents == null || input.compare_at_cents === '' ? null : Math.round(Number(input.compare_at_cents));
  if (compareAt != null && !(compareAt > price)) {
    if (compareAt) errors.compare_at_cents = t('O preço "de" precisa ser maior que o preço atual.');
    compareAt = null;
  }

  const { variants, error: variantsError } = normalizeVariants(input.variants);
  if (variantsError) errors.variants = variantsError;
  // Com variações, a quantidade do anúncio é a SOMA delas (o campo solto não vale).
  const quantity = variants.length ? variants.reduce((n, v) => n + v.quantity, 0) : Math.floor(Number(input.quantity ?? 1));
  if (!(quantity >= 0) || quantity > 9999) errors.quantity = t('Quantidade entre 0 e 9999.');

  // Promoção com prazo: só faz sentido com o preço "de"; vencida, o preço volta ao "de".
  let saleUntil = compareAt && input.sale_until_ms ? Math.round(Number(input.sale_until_ms)) : null;
  if (saleUntil != null && !(saleUntil > 0)) saleUntil = null;

  // Resposta automática a ofertas: aceita a partir de X e recusa abaixo de Y (Y < X < preço).
  const centsOrNull = (v) => (v == null || v === '' ? null : Math.round(Number(v)));
  let autoAccept = input.accepts_offers ? centsOrNull(input.offer_auto_accept_cents) : null;
  let autoDecline = input.accepts_offers ? centsOrNull(input.offer_auto_decline_cents) : null;
  if (autoAccept != null && !(autoAccept > 0 && autoAccept < price)) { errors.offer_auto_accept_cents = t('O valor de aceite automático precisa ser menor que o preço.'); autoAccept = null; }
  if (autoDecline != null && !(autoDecline > 0 && autoDecline < price && (autoAccept == null || autoDecline < autoAccept))) {
    errors.offer_auto_decline_cents = t('O valor de recusa automática precisa ser menor que o de aceite.');
    autoDecline = null;
  }

  const fulfillment = Array.isArray(input.fulfillment)
    ? [...new Set(input.fulfillment.filter((f) => Object.values(FULFILLMENT).includes(f)))]
    : [];
  if (!fulfillment.length) errors.fulfillment = t('Escolha ao menos uma forma de entrega.');

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
  if (photos.length > MEDIA_LIMITS.maxPhotos) errors.media = t('Até {n} fotos.', { n: MEDIA_LIMITS.maxPhotos });
  if (videos.length > 1) errors.media = t('Um vídeo por anúncio.');
  if (photos[0]) photos[0].is_cover = true;
  const orderedMedia = [...photos, ...videos.slice(0, 1)].map((m, i) => ({ ...m, order: i }));

  const videoLink = input.video_link ? parseVideoLink(input.video_link) : null;
  if (input.video_link && !videoLink) errors.video_link = t('Use um link do YouTube ou do Vimeo.');

  const { value: attributes, errors: attrErrors } = validateAttributes(input.category_slug, input.attributes);
  Object.entries(attrErrors).forEach(([k, msg]) => { errors[`attr_${k}`] = msg; });

  const city = String(input.city || '').trim().slice(0, 60);
  const state = String(input.state || '').trim().toUpperCase().slice(0, 2);

  if (publish) {
    if (!photos.length) errors.media = t('Coloque ao menos uma foto.');
    if (!city || state.length !== 2) errors.city = t('Diga a cidade e o estado.');
    if (fulfillment.includes(FULFILLMENT.SHIPPING) && shippingCents == null && !input.shipping_to_agree) {
      errors.shipping_cents = t('Diga o valor do envio ou marque "a combinar".');
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
    variants,
    sale_until_ms: saleUntil,
    accepts_offers: Boolean(input.accepts_offers),
    offer_auto_accept_cents: autoAccept,
    offer_auto_decline_cents: autoDecline,
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

/**
 * O formulário de uma CÓPIA do anúncio (vira rascunho): o mesmo conteúdo com
 * " (cópia)" no título, sem o vínculo com o estoque da arena nem as contagens.
 */
export function duplicateListingInput(listing) {
  const sufixo = t(' (cópia)');
  const base = String(listing?.title || '').trim();
  const title = `${base.slice(0, TEXT_LIMITS.title - sufixo.length)}${sufixo}`.trim();
  const copia = {};
  ['description', 'category_slug', 'type', 'condition', 'brand', 'attributes', 'price_cents', 'compare_at_cents', 'quantity',
    'accepts_offers', 'fulfillment', 'shipping_cents', 'shipping_to_agree', 'pickup_note', 'media', 'video_link', 'city', 'state',
    'variants', 'offer_auto_accept_cents', 'offer_auto_decline_cents']
    .forEach((k) => { if (listing?.[k] !== undefined) copia[k] = listing[k]; });
  return { ...copia, title };
}

/** O que falta para publicar: as mensagens de erro, sem repetir. */
export function publishBlockers(input) {
  const { errors } = validateListingInput(input, { publish: true });
  return [...new Set(Object.values(errors))];
}

/**
 * "Modo férias": tudo o que está no ar pausado de uma vez. Devolve quem pausar,
 * quem retomar e se TODOS os anúncios publicáveis estão pausados.
 */
export function vacationState(listings = []) {
  const vivos = listings.filter((l) => l && !['removed', 'draft', 'closed'].includes(l.status));
  const noAr = vivos.filter((l) => PUBLIC_LISTING_STATUSES.includes(l.status));
  const pausados = vivos.filter((l) => l.status === 'paused' && !l.admin_paused);
  return { noAr, pausados, todosPausados: vivos.length > 0 && noAr.length === 0 && pausados.length > 0 };
}
