/**
 * MERCADO — a ajuda na busca (lógica pura): as buscas recentes da pessoa
 * (guardadas no aparelho, zero banco) e as sugestões pelo prefixo digitado —
 * categorias da taxonomia e marcas presentes nos anúncios de agora.
 */
import { MARKET_CATEGORIES } from './taxonomy.js';
import { normalizeSearchText } from './listing.js';

/** A preferência de tela (por conta, no aparelho) com as buscas recentes. */
export const RECENT_SEARCH_PREF = 'mercado:buscas-recentes';
export const RECENT_SEARCH_LIMIT = 8;

/** Lê a lista guardada (texto JSON); qualquer lixo vira lista vazia. */
export function parseRecentSearches(text) {
  try {
    const v = JSON.parse(text || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, RECENT_SEARCH_LIMIT) : [];
  } catch {
    return [];
  }
}

/** Põe a busca na frente (sem repetir, ignorando maiúsculas, com teto). */
export function pushRecentSearch(list, q) {
  const texto = String(q || '').trim().slice(0, 80);
  if (!texto) return (list || []).slice(0, RECENT_SEARCH_LIMIT);
  const chave = normalizeSearchText(texto);
  return [texto, ...(list || []).filter((x) => normalizeSearchText(x) !== chave)].slice(0, RECENT_SEARCH_LIMIT);
}

/**
 * Sugestões para o que a pessoa digitou: categorias e subcategorias cujo nome
 * começa com o prefixo (qualquer palavra) e marcas dos anúncios dados.
 * Rótulos de categoria vêm como CHAVE (`tk`): a tela traduz, e `parent` é o
 * departamento da subcategoria.
 * @returns {{ kind: 'cat'|'brand', label: string, parent?: string, slug?: string, q?: string }[]}
 */
export function searchSuggestions(prefix, { listings = [], disabled = [], limit = 6 } = {}) {
  const p = normalizeSearchText(prefix);
  if (!p) return [];
  const bate = (texto) => normalizeSearchText(texto).split(' ').some((w) => w.startsWith(p));
  const off = new Set(disabled);
  const cats = [];
  for (const root of MARKET_CATEGORIES) {
    if (off.has(root.slug)) continue;
    if (bate(root.label)) cats.push({ kind: 'cat', label: root.label, slug: root.slug });
    for (const c of root.children || []) {
      if (bate(c.label)) cats.push({ kind: 'cat', label: c.label, parent: root.label, slug: c.slug });
    }
  }
  const marcas = new Map();
  for (const l of listings) {
    const b = String(l?.brand || '').trim();
    if (b && bate(b) && !marcas.has(normalizeSearchText(b))) marcas.set(normalizeSearchText(b), { kind: 'brand', label: b, q: b });
  }
  return [...cats, ...marcas.values()].slice(0, limit);
}
