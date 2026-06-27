/**
 * Lógica pura de afiliados/parcerias (sem I/O).
 *
 * Normaliza/valida o link cadastrado pelo admin e ordena/filtra os ativos para
 * exibição. A persistência fica no `affiliateService`.
 */

export const AFFILIATE_CATEGORY = Object.freeze({
  EQUIPMENT: 'equipment',
  STORE: 'store',
  SPONSOR: 'sponsor',
  ACADEMY: 'academy',
  OTHER: 'other',
});

export const AFFILIATE_CATEGORY_LABELS = Object.freeze({
  [AFFILIATE_CATEGORY.EQUIPMENT]: 'Equipamentos',
  [AFFILIATE_CATEGORY.STORE]: 'Loja',
  [AFFILIATE_CATEGORY.SPONSOR]: 'Patrocinador',
  [AFFILIATE_CATEGORY.ACADEMY]: 'Academia/Clínica',
  [AFFILIATE_CATEGORY.OTHER]: 'Outros',
});

function trimmed(value) {
  return String(value ?? '').trim();
}

/** Valida que a URL é http(s) absoluta. */
export function isValidUrl(url) {
  const u = trimmed(url);
  return /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(u);
}

/**
 * Normaliza e valida o input de um link de afiliado.
 * @param {object} input
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object }}
 */
export function normalizeAffiliateInput(input = {}) {
  const value = {
    title: trimmed(input.title).slice(0, 100),
    description: trimmed(input.description).slice(0, 300),
    url: trimmed(input.url),
    image_url: trimmed(input.image_url),
    category: Object.values(AFFILIATE_CATEGORY).includes(input.category)
      ? input.category
      : AFFILIATE_CATEGORY.OTHER,
    active: input.active !== false,
    sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 0,
  };

  const errors = {};
  if (!value.title) errors.title = 'Informe o título.';
  if (!isValidUrl(value.url)) errors.url = 'Informe uma URL válida (https://…).';

  return { valid: Object.keys(errors).length === 0, errors, value };
}

/** Filtra ativos e ordena por `sort_order` e depois título. */
export function sortActiveLinks(links) {
  return (links || [])
    .filter((l) => l.active !== false)
    .sort(
      (a, b) =>
        (a.sort_order || 0) - (b.sort_order || 0)
        || String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR'),
    );
}
