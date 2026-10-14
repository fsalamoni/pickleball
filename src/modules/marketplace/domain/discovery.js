/**
 * MERCADO — o que traz a pessoa de volta (lógica pura): buscas salvas com
 * "o que chegou desde a última vez" e os anúncios vistos há pouco.
 *
 * A conta de "novidades" é a MESMA no servidor (`functions/marketSearch.js`,
 * com teste de paridade): o aviso diz "3 novos" e a tela mostra os mesmos 3.
 */
import { filtersFromParams, filtersToParams, filterListings, publishedMs } from './search.js';
import { findCategory } from './taxonomy.js';
import { formatBRL } from './money.js';

/** Quantas buscas salvas por pessoa (o resto pede para apagar alguma). */
export const SAVED_SEARCH_LIMIT = 20;

/** Quantos "vistos recentemente" ficam guardados no aparelho. */
export const RECENT_LIMIT = 12;

/** A preferência de tela (por conta, no aparelho) que guarda os vistos. */
export const RECENT_PREF = 'mercado:vistos';

/** Lê a lista de vistos guardada (texto JSON); qualquer lixo vira lista vazia. */
export function parseRecent(text) {
  try {
    const v = JSON.parse(text || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

/** A busca em forma canônica (mesma busca → mesmo texto, para não duplicar). */
export function savedSearchKey(params) {
  const p = filtersToParams(filtersFromParams(params));
  p.delete('ordem'); // a ordem não muda o que entra
  return [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
}

/** Um nome legível para a busca: "raquete · Raquetes · usados · até R$ 800". */
export function savedSearchLabel(filters) {
  const partes = [];
  if (filters.q) partes.push(`“${filters.q}”`);
  if (filters.cat) partes.push(findCategory(filters.cat)?.label || filters.cat);
  if (filters.cond) partes.push(filters.cond === 'used' ? 'usados' : 'novos');
  if (filters.max != null) partes.push(`até ${formatBRL(filters.max)}`);
  else if (filters.min != null) partes.push(`a partir de ${formatBRL(filters.min)}`);
  if (filters.city) partes.push(filters.city);
  else if (filters.uf) partes.push(filters.uf);
  return (partes.join(' · ') || 'Todos os anúncios').slice(0, 60);
}

/** Desde quando contar novidade numa busca salva (ms). */
export function savedSearchSince(search) {
  const criada = Number(search?.created_at?.toMillis?.() || search?.created_at_ms || 0);
  return Math.max(Number(search?.last_seen_ms) || 0, criada);
}

/**
 * Os anúncios no ar que batem com a busca e chegaram DEPOIS de `since` —
 * sem os da própria pessoa (ninguém quer aviso do próprio anúncio).
 */
export function savedSearchMatches(listings, params, { since = 0, uid = '' } = {}) {
  const f = filtersFromParams(params);
  return filterListings(listings, f)
    .filter((l) => l.status === 'active' && (Number(l.quantity) || 0) > 0)
    .filter((l) => publishedMs(l) > since && (!uid || l.created_by !== uid))
    .sort((a, b) => publishedMs(b) - publishedMs(a));
}

/** Põe o anúncio na frente da lista de vistos (sem repetir, com teto). */
export function pushRecent(ids, id, limit = RECENT_LIMIT) {
  if (!id) return Array.isArray(ids) ? ids.slice(0, limit) : [];
  return [id, ...(Array.isArray(ids) ? ids : []).filter((x) => x !== id && typeof x === 'string')].slice(0, limit);
}

/**
 * Os vistos que ainda estão à venda, na ordem em que foram vistos (o mais
 * recente primeiro), sem o anúncio aberto agora.
 */
export function recentListings(ids, listings, { except = '' } = {}) {
  const porId = new Map((listings || []).map((l) => [l.id, l]));
  return (ids || [])
    .filter((id) => id !== except)
    .map((id) => porId.get(id))
    .filter((l) => l && l.status === 'active');
}
