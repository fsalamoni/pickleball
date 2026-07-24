/**
 * Domínio puro de metadados de página (SEO) — flag public_seo.
 *
 * Monta título, descrição e tags Open Graph a partir de um input, com fallbacks
 * e truncamento seguros. Sem I/O — a aplicação real das tags no <head> é feita
 * pelo hook useDocumentMeta.
 */

export const BRAND = 'PickleRush';

function clamp(str, max) {
  const s = String(str ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Normaliza os metadados de uma página.
 * @param {{ title?, description?, image?, url? }} input
 * @returns {{ title, description, ogTitle, ogDescription, image, url }}
 */
export function buildMeta(input = {}) {
  const rawTitle = clamp(input.title, 60);
  const title = rawTitle ? `${rawTitle} · ${BRAND}` : BRAND;
  const description = clamp(
    input.description || 'Torneios, arenas, ranking e comunidade de pickleball.',
    160,
  );
  return {
    title,
    description,
    ogTitle: rawTitle || BRAND,
    ogDescription: description,
    image: input.image || '',
    url: input.url || '',
  };
}
