/**
 * Domínio puro da loja do professor (produtos que o professor vende).
 *
 * `coach_products/{id}`: item avulso (equipamento, material, camiseta…) com
 * preço, categoria e visibilidade pública opcional (o professor decide se
 * aparece no seu perfil público). Sem I/O — testável isoladamente.
 */

import { formatPrice } from '../../arenas/domain/pricing.js';
import { t, tk } from '@/core/i18n';

const str = (v) => String(v ?? '').trim();

export const COACH_PRODUCT_NAME_MAX = 80;
export const COACH_PRODUCT_DESC_MAX = 400;

export const COACH_PRODUCT_CATEGORY = Object.freeze({
  EQUIPMENT: 'equipamentos',
  APPAREL: 'vestuario',
  ACCESSORY: 'acessorios',
  MATERIAL: 'material',
  OTHER: 'outros',
});

export const COACH_PRODUCT_CATEGORY_LABELS = Object.freeze({
  [COACH_PRODUCT_CATEGORY.EQUIPMENT]: tk('Equipamentos'),
  [COACH_PRODUCT_CATEGORY.APPAREL]: tk('Vestuário'),
  [COACH_PRODUCT_CATEGORY.ACCESSORY]: tk('Acessórios'),
  [COACH_PRODUCT_CATEGORY.MATERIAL]: tk('Material'),
  [COACH_PRODUCT_CATEGORY.OTHER]: tk('Outros'),
});

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normCategory(value) {
  const v = str(value).toLowerCase();
  return Object.values(COACH_PRODUCT_CATEGORY).includes(v) ? v : COACH_PRODUCT_CATEGORY.OTHER;
}

/** Normaliza/valida um produto da loja do professor. */
export function normalizeCoachProduct(input = {}) {
  const coach_id = str(input.coach_id);
  if (!coach_id) return { valid: false, error: t('coach_id é obrigatório.'), value: {} };
  const name = str(input.name).slice(0, COACH_PRODUCT_NAME_MAX);
  if (!name) return { valid: false, error: t('Informe o nome do produto.'), value: { coach_id } };
  const price = num(input.price, null);
  if (price == null) return { valid: false, error: t('Informe um preço válido.'), value: { coach_id, name } };
  return {
    valid: true,
    error: null,
    value: {
      coach_id,
      name,
      description: str(input.description).slice(0, COACH_PRODUCT_DESC_MAX),
      price: Math.round(price * 100) / 100,
      category: normCategory(input.category),
      visible_public: input.visible_public === true,
      active: input.active !== false,
    },
  };
}

/** Produtos visíveis publicamente (ativos e marcados como públicos). */
export function publicCoachProducts(list = []) {
  return (Array.isArray(list) ? list : []).filter((p) => p.active !== false && p.visible_public === true);
}

export function coachProductCategoryLabel(category) {
  return t(COACH_PRODUCT_CATEGORY_LABELS[normCategory(category)] || category);
}

/** Formata o preço (BRL) — conveniência. */
export function formatCoachProductPrice(value) {
  return formatPrice(value);
}
