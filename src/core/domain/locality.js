/**
 * LOCALIDADE — como a plataforma compara cidade e estado (lógica pura).
 *
 * Fonte única da comparação de nomes de lugar. Mora no núcleo porque quem
 * compara é a plataforma inteira: o filtro "Minha região" (torneios, dias de
 * jogo, arenas, professores, clubes, promoções), os banners da tela inicial e
 * a proximidade da tela inicial. Arquivo leve de propósito.
 *
 * "São Paulo " e "sao paulo" são a mesma cidade: a comparação ignora acento,
 * caixa e espaços repetidos.
 */

/** "São Paulo " → "sao paulo". */
export function normalizeLocality(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** " rs" → "RS" (2 letras; o resto é descartado). */
export function ufOf(valor) {
  return String(valor || '').trim().toUpperCase().slice(0, 2);
}

/** A chave de uma cidade: "RS|porto alegre". */
export function cityKey(city, state) {
  return `${ufOf(state)}|${normalizeLocality(city)}`;
}

/**
 * Lê um lugar escrito à mão — "Porto Alegre/RS", "Canoas - RS",
 * "Gramado, RS", "Porto Alegre" — em `{ city, state }`.
 *
 * Só reconhece a UF no FIM e com 2 letras, para não partir nomes como
 * "Embu-Guaçu" ou "Xangri-lá" no hífen.
 *
 * @returns {{ city: string, state: string }}
 */
export function parsePlaceText(texto) {
  const bruto = String(texto || '').trim();
  const m = bruto.match(/^(.*?)\s*(?:\/|,|\s-\s|\s–\s|\()\s*([A-Za-z]{2})\)?\s*$/);
  if (m && m[1].trim()) return { city: m[1].trim(), state: m[2].toUpperCase() };
  return { city: bruto, state: '' };
}
