/**
 * Lógica pura de afiliados/parcerias (sem I/O).
 *
 * Normaliza/valida o link cadastrado pelo admin e ordena/filtra os ativos para
 * exibição. A persistência fica no `affiliateService`.
 */

import { safeHttpUrl, isSafeHttpUrl } from '@/core/domain/externalUrl';

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
  return isSafeHttpUrl(url, { requireHostWithDot: true });
}

export function safeAffiliateUrl(url) {
  return safeHttpUrl(url, { requireHostWithDot: true });
}

export function safeAffiliateImageUrl(url) {
  return safeHttpUrl(url, { requireHostWithDot: true });
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
    url: safeAffiliateUrl(input.url),
    image_url: safeAffiliateImageUrl(input.image_url),
    category: Object.values(AFFILIATE_CATEGORY).includes(input.category)
      ? input.category
      : AFFILIATE_CATEGORY.OTHER,
    active: input.active !== false,
    sort_order: Number.isFinite(Number(input.sort_order)) ? Number(input.sort_order) : 0,
  };

  const errors = {};
  if (!value.title) errors.title = 'Informe o título.';
  if (!isValidUrl(value.url)) errors.url = 'Informe uma URL válida (https://…).';
  if (trimmed(input.image_url) && !value.image_url) errors.image_url = 'A imagem precisa ser uma URL https:// válida.';

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

/** Links seguros para exibição pública: ativo + URL clicável validada. */
export function publicAffiliateLinks(links) {
  return sortActiveLinks(links)
    .map((link) => ({
      ...link,
      url: safeAffiliateUrl(link.url),
      image_url: safeAffiliateImageUrl(link.image_url),
    }))
    .filter((link) => link.url);
}
