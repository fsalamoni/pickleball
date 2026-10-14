/**
 * MERCADO — busca, filtros, ordenação e facetas sobre a janela de anúncios
 * que a consulta trouxe (lógica pura). O Firestore não faz busca por texto:
 * a consulta traz os anúncios no ar e o refino acontece aqui. O contrato
 * (`searchListings`) não muda quando a origem virar um índice de busca.
 */
import { normalizeSearchText, tokenize, listingCompleteness } from './listing.js';
import { LISTING_TYPE, SELLER_TYPE, FULFILLMENT, LISTING_STATUS } from './constants.js';
import { filterableAttributes } from './taxonomy.js';
import { t, tk } from '@/core/i18n';

export const SORT_OPTIONS = Object.freeze([
  { id: 'relevance', label: tk('Mais relevantes') },
  { id: 'recent', label: tk('Mais recentes') },
  { id: 'price_asc', label: tk('Menor preço') },
  { id: 'price_desc', label: tk('Maior preço') },
  { id: 'rating', label: tk('Melhor avaliados') },
  { id: 'discount', label: tk('Maior desconto') },
]);

const SORT_IDS = new Set(SORT_OPTIONS.map((s) => s.id));

export const EMPTY_FILTERS = Object.freeze({
  q: '', cat: '', cond: '', min: null, max: null, sellers: [], ship: '',
  offers: false, uf: '', city: '', attrs: {}, sort: 'relevance',
});

function ms(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

/** Quando o anúncio foi publicado (ms), com fallback para criação. */
export function publishedMs(l) {
  return ms(l?.published_at) || ms(l?.created_at) || ms(l?.created_at_ms);
}

/** O texto bate com o anúncio? 0 = não; >0 = quanto (título vale mais). */
export function textMatchScore(listing, query) {
  const words = tokenize(query);
  if (!words.length) return 1;
  const title = normalizeSearchText(listing.title);
  const terms = new Set(listing.search_terms || []);
  const desc = normalizeSearchText(listing.description);
  let total = 0;
  for (const w of words) {
    const prefix = (s) => s.split(' ').some((t) => t.startsWith(w));
    if (prefix(title)) total += 3;
    else if ([...terms].some((t) => t.startsWith(w))) total += 2;
    else if (desc.includes(w)) total += 1;
    else return 0; // todas as palavras precisam aparecer
  }
  return total / (words.length * 3);
}

/** Aplica os filtros (sem ordenar). */
export function filterListings(listings, f = EMPTY_FILTERS) {
  const attrs = Object.entries(f.attrs || {}).filter(([, v]) => v !== '' && v != null);
  return (listings || []).filter((l) => {
    if (!l || ![LISTING_STATUS.ACTIVE, LISTING_STATUS.SOLD_OUT].includes(l.status)) return false;
    if (f.cat && !(l.category_path || [l.category_slug]).includes(f.cat)) return false;
    if (f.cond === 'new' && l.type !== LISTING_TYPE.NEW) return false;
    if (f.cond === 'used' && l.type !== LISTING_TYPE.USED) return false;
    if (f.min != null && l.price_cents < f.min) return false;
    if (f.max != null && l.price_cents > f.max) return false;
    if (f.sellers?.length && !f.sellers.includes(l.seller_type)) return false;
    if (f.ship && !(l.fulfillment || []).includes(f.ship)) return false;
    if (f.offers && !l.accepts_offers) return false;
    if (f.uf && String(l.state || '').toUpperCase() !== f.uf.toUpperCase()) return false;
    if (f.city && normalizeSearchText(l.city) !== normalizeSearchText(f.city)) return false;
    for (const [k, v] of attrs) {
      if (String(l.attributes?.[k] ?? '') !== String(v)) return false;
    }
    if (f.q && textMatchScore(l, f.q) === 0) return false;
    return true;
  });
}

const HALF_LIFE_MS = 7 * 24 * 3600 * 1000;

/**
 * Relevância (0–1) e o porquê. Pesos: texto 45%, novidade 20%, confiança no
 * vendedor 20%, anúncio completo 15%. Esgotado vai para o fim.
 */
export function relevance(listing, { q = '', now = Date.now(), viewer = {} } = {}) {
  const text = q ? textMatchScore(listing, q) : 0.5;
  const age = Math.max(0, now - publishedMs(listing));
  const fresh = Math.pow(0.5, age / HALF_LIFE_MS);
  const count = Number(listing.seller_rating_count) || 0;
  const avg = Number(listing.seller_rating_avg) || 0;
  const trust = count >= 3 ? (avg / 5) * Math.min(1, Math.log10(count + 1) / 2) : 0.3;
  const complete = listingCompleteness(listing);
  let score = 0.45 * text + 0.2 * fresh + 0.2 * trust + 0.15 * complete;
  const why = [];
  if (q && text > 0.6) why.push(t('o título combina com a busca'));
  if (fresh > 0.7) why.push(t('anunciado há pouco'));
  if (count >= 3 && avg >= 4.5) why.push(t('vendedor bem avaliado'));
  if (viewer.city && normalizeSearchText(viewer.city) === normalizeSearchText(listing.city)) {
    score += 0.05;
    why.push(t('na sua cidade'));
  }
  if (listing.status === LISTING_STATUS.SOLD_OUT) score -= 1;
  return { score, why };
}

/** Filtra + ordena. Devolve `{ items, total }`. */
export function searchListings(listings, filters = EMPTY_FILTERS, ctx = {}) {
  const f = { ...EMPTY_FILTERS, ...filters };
  const items = filterListings(listings, f);
  const sort = SORT_IDS.has(f.sort) ? f.sort : 'relevance';
  const soldLast = (a, b) => (a.status === LISTING_STATUS.SOLD_OUT) - (b.status === LISTING_STATUS.SOLD_OUT);
  const byRecent = (a, b) => publishedMs(b) - publishedMs(a);
  let sorted;
  if (sort === 'recent') sorted = items.sort((a, b) => soldLast(a, b) || byRecent(a, b));
  else if (sort === 'price_asc') sorted = items.sort((a, b) => soldLast(a, b) || a.price_cents - b.price_cents || byRecent(a, b));
  else if (sort === 'price_desc') sorted = items.sort((a, b) => soldLast(a, b) || b.price_cents - a.price_cents || byRecent(a, b));
  else if (sort === 'rating') {
    const r = (l) => ((Number(l.seller_rating_count) || 0) >= 3 ? Number(l.seller_rating_avg) || 0 : 0);
    sorted = items.sort((a, b) => soldLast(a, b) || r(b) - r(a) || byRecent(a, b));
  } else if (sort === 'discount') {
    const d = (l) => (l.compare_at_cents > l.price_cents ? (l.compare_at_cents - l.price_cents) / l.compare_at_cents : 0);
    sorted = items.sort((a, b) => soldLast(a, b) || d(b) - d(a) || byRecent(a, b));
  } else {
    const scored = items.map((l) => ({ l, s: relevance(l, { q: f.q, now: ctx.now, viewer: ctx.viewer }).score }));
    sorted = scored.sort((a, b) => b.s - a.s || byRecent(a.l, b.l)).map((x) => x.l);
  }
  return { items: sorted, total: sorted.length };
}

/**
 * Contagens para os filtros (quantos há em cada opção), calculadas sobre o
 * resultado SEM o próprio filtro — senão escolher "Raquetes" zeraria Bolas.
 */
export function facetCounts(listings, filters = EMPTY_FILTERS) {
  const f = { ...EMPTY_FILTERS, ...filters };
  const count = (list, key) => list.reduce((acc, l) => {
    const vals = Array.isArray(key(l)) ? key(l) : [key(l)];
    vals.filter(Boolean).forEach((v) => { acc[v] = (acc[v] || 0) + 1; });
    return acc;
  }, {});
  const without = (k, empty) => filterListings(listings, { ...f, [k]: empty });
  return {
    cat: count(without('cat', ''), (l) => l.category_path || [l.category_slug]),
    cond: count(without('cond', ''), (l) => (l.type === LISTING_TYPE.USED ? 'used' : 'new')),
    sellers: count(without('sellers', []), (l) => l.seller_type),
    ship: count(without('ship', ''), (l) => l.fulfillment || []),
    uf: count(without('uf', ''), (l) => String(l.state || '').toUpperCase()),
    attrs: f.cat ? Object.fromEntries(filterableAttributes(f.cat).map((a) => [
      a.key,
      count(filterListings(listings, { ...f, attrs: { ...f.attrs, [a.key]: '' } }), (l) => (l.attributes?.[a.key] ?? null)),
    ])) : {},
  };
}

/** Filtros ativos como chips removíveis: `[{ key, label, clear }]`. */
export function activeFilterChips(f, labels = {}) {
  const chips = [];
  if (f.q) chips.push({ key: 'q', label: `“${f.q}”` });
  if (f.cat) chips.push({ key: 'cat', label: labels.cat?.[f.cat] || f.cat });
  if (f.cond) chips.push({ key: 'cond', label: f.cond === 'used' ? t('Usados') : t('Novos') });
  if (f.min != null || f.max != null) chips.push({ key: 'price', label: priceRangeLabel(f.min, f.max) });
  (f.sellers || []).forEach((s) => chips.push({ key: `seller:${s}`, label: labels.sellers?.[s] || s }));
  if (f.ship) chips.push({ key: 'ship', label: labels.ship?.[f.ship] || f.ship });
  if (f.offers) chips.push({ key: 'offers', label: t('Aceita oferta') });
  if (f.uf) chips.push({ key: 'uf', label: f.uf });
  if (f.city) chips.push({ key: 'city', label: f.city });
  Object.entries(f.attrs || {}).forEach(([k, v]) => { if (v !== '' && v != null) chips.push({ key: `attr:${k}`, label: t(String(v)) }); });
  return chips;
}

/** Remove o filtro de um chip. */
export function clearChip(f, key) {
  const next = { ...f, attrs: { ...(f.attrs || {}) }, sellers: [...(f.sellers || [])] };
  if (key === 'price') { next.min = null; next.max = null; } else if (key.startsWith('seller:')) {
    next.sellers = next.sellers.filter((s) => s !== key.slice(7));
  } else if (key.startsWith('attr:')) delete next.attrs[key.slice(5)];
  else if (key === 'offers') next.offers = false;
  else next[key] = '';
  return next;
}

function priceRangeLabel(min, max) {
  const r = (c) => `R$ ${Math.round(c / 100)}`;
  if (min != null && max != null) return t('{min} a {max}', { min: r(min), max: r(max) });
  if (min != null) return t('A partir de {valor}', { valor: r(min) });
  return t('Até {valor}', { valor: r(max) });
}

const SELLER_IDS = new Set(Object.values(SELLER_TYPE));
const SHIP_IDS = new Set(Object.values(FULFILLMENT));

/** URLSearchParams → filtros (o que não for válido é ignorado). */
export function filtersFromParams(params) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params || '');
  const cents = (k) => {
    const v = p.get(k);
    if (v == null || v === '') return null;
    const n = Math.round(Number(v) * 100);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const attrs = {};
  for (const [k, v] of p.entries()) if (k.startsWith('a_') && v) attrs[k.slice(2)] = v;
  const sort = p.get('ordem');
  return {
    ...EMPTY_FILTERS,
    q: (p.get('q') || '').slice(0, 80),
    cat: p.get('cat') || '',
    cond: ['new', 'used'].includes(p.get('estado')) ? p.get('estado') : '',
    min: cents('min'),
    max: cents('max'),
    sellers: (p.get('vende') || '').split(',').filter((s) => SELLER_IDS.has(s)),
    ship: SHIP_IDS.has(p.get('entrega')) ? p.get('entrega') : '',
    offers: p.get('oferta') === '1',
    uf: /^[A-Za-z]{2}$/.test(p.get('uf') || '') ? p.get('uf').toUpperCase() : '',
    city: (p.get('cidade') || '').slice(0, 60),
    attrs,
    sort: SORT_IDS.has(sort) ? sort : 'relevance',
  };
}

/** Filtros → URLSearchParams (só o que não é padrão, para o link ficar curto). */
export function filtersToParams(f) {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.cat) p.set('cat', f.cat);
  if (f.cond) p.set('estado', f.cond);
  if (f.min != null) p.set('min', String(f.min / 100));
  if (f.max != null) p.set('max', String(f.max / 100));
  if (f.sellers?.length) p.set('vende', f.sellers.join(','));
  if (f.ship) p.set('entrega', f.ship);
  if (f.offers) p.set('oferta', '1');
  if (f.uf) p.set('uf', f.uf);
  if (f.city) p.set('cidade', f.city);
  Object.entries(f.attrs || {}).forEach(([k, v]) => { if (v !== '' && v != null) p.set(`a_${k}`, String(v)); });
  if (f.sort && f.sort !== 'relevance') p.set('ordem', f.sort);
  return p;
}
