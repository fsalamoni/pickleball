/**
 * MERCADO — a busca do lado do servidor, para o aviso das buscas salvas.
 *
 * CÓPIA de `src/modules/marketplace/domain/search.js` + `discovery.js` (o
 * pacote de Functions é publicado isolado e não importa `src/`). O teste
 * `marketSearch.parity.test.js` roda as duas sobre os mesmos anúncios e
 * buscas: mexer num lado só quebra o teste — o aviso diria "3 novos" e a
 * tela mostraria outro número.
 */

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na',
  'nos', 'nas', 'um', 'uma', 'com', 'para', 'por', 'pra', 'sem', 'que', 'ou',
]);
const LISTING_NEW = 'product_new';
const LISTING_USED = 'product_used';
const SELLER_IDS = new Set(['athlete', 'coach', 'arena', 'store', 'federation', 'club']);
const SHIP_IDS = new Set(['pickup', 'meetup', 'shipping']);

function normalizeSearchText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(text) {
  const out = [];
  for (const w of normalizeSearchText(text).split(' ')) {
    if (w.length < 2 || STOPWORDS.has(w) || out.includes(w)) continue;
    out.push(w);
  }
  return out;
}

function ms(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

function publishedMs(l) {
  return ms(l && l.published_at) || ms(l && l.created_at) || ms(l && l.created_at_ms);
}

function textMatchScore(listing, query) {
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
    else return 0;
  }
  return total / (words.length * 3);
}

function filtersFromParams(params) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params || '');
  const cents = (k) => {
    const v = p.get(k);
    if (v == null || v === '') return null;
    const n = Math.round(Number(v) * 100);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const attrs = {};
  for (const [k, v] of p.entries()) if (k.startsWith('a_') && v) attrs[k.slice(2)] = v;
  return {
    q: (p.get('q') || '').slice(0, 80),
    cat: p.get('cat') || '',
    cond: ['new', 'used'].includes(p.get('estado')) ? p.get('estado') : '',
    min: cents('min'),
    max: cents('max'),
    sellers: (p.get('vende') || '').split(',').filter((s) => SELLER_IDS.has(s)),
    ship: SHIP_IDS.has(p.get('entrega')) ? p.get('entrega') : '',
    offers: p.get('oferta') === '1',
    freeShipping: p.get('frete') === 'gratis',
    uf: /^[A-Za-z]{2}$/.test(p.get('uf') || '') ? p.get('uf').toUpperCase() : '',
    city: (p.get('cidade') || '').slice(0, 60),
    attrs,
  };
}

function filterListings(listings, f) {
  const attrs = Object.entries(f.attrs || {}).filter(([, v]) => v !== '' && v != null);
  return (listings || []).filter((l) => {
    if (!l || !['active', 'sold_out'].includes(l.status)) return false;
    if (f.cat && !(l.category_path || [l.category_slug]).includes(f.cat)) return false;
    if (f.cond === 'new' && l.type !== LISTING_NEW) return false;
    if (f.cond === 'used' && l.type !== LISTING_USED) return false;
    if (f.min != null && l.price_cents < f.min) return false;
    if (f.max != null && l.price_cents > f.max) return false;
    if (f.sellers && f.sellers.length && !f.sellers.includes(l.seller_type)) return false;
    if (f.ship && !(l.fulfillment || []).includes(f.ship)) return false;
    if (f.offers && !l.accepts_offers) return false;
    if (f.freeShipping && !((l.fulfillment || []).includes('shipping') && Number(l.shipping_cents) === 0 && !l.shipping_to_agree)) return false;
    if (f.uf && String(l.state || '').toUpperCase() !== f.uf.toUpperCase()) return false;
    if (f.city && normalizeSearchText(l.city) !== normalizeSearchText(f.city)) return false;
    for (const [k, v] of attrs) {
      if (String((l.attributes || {})[k] == null ? '' : l.attributes[k]) !== String(v)) return false;
    }
    if (f.q && textMatchScore(l, f.q) === 0) return false;
    return true;
  });
}

function savedSearchSince(search) {
  const c = search && search.created_at;
  const criada = Number((c && typeof c.toMillis === 'function' ? c.toMillis() : 0) || (search && search.created_at_ms) || 0);
  return Math.max(Number(search && search.last_seen_ms) || 0, criada);
}

function savedSearchMatches(listings, params, { since = 0, uid = '' } = {}) {
  return filterListings(listings, filtersFromParams(params))
    .filter((l) => l.status === 'active' && (Number(l.quantity) || 0) > 0)
    .filter((l) => publishedMs(l) > since && (!uid || l.created_by !== uid))
    .sort((a, b) => publishedMs(b) - publishedMs(a));
}

module.exports = {
  normalizeSearchText, tokenize, textMatchScore, filtersFromParams, filterListings,
  publishedMs, savedSearchSince, savedSearchMatches,
};
