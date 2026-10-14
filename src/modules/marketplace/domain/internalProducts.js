/**
 * MERCADO ↔ mercados internos: o rascunho de anúncio que nasce de um produto
 * da LOJA DO PROFESSOR (`coach_products`) ou do MERCADO DA ARENA
 * (`arena_inventory_products`). Só preenche o formulário — quem vende revisa,
 * põe fotos e publica (lógica pura).
 *
 * O produto da arena ainda leva a LIGAÇÃO de estoque (`source`), que só o
 * servidor grava (ver `functions/marketplace.js`, `linkListingSource`).
 */

import { LISTING_TYPE, TEXT_LIMITS } from './constants.js';

const COACH_CATEGORY = Object.freeze({
  vestuario: 'vestuario', acessorios: 'acessorios', material: 'treino', outros: 'outros',
});

const ARENA_CATEGORY = Object.freeze({
  Raquete: 'raquetes', Bola: 'bolas', 'Vestuário': 'vestuario', 'Acessórios': 'acessorios',
});

const reais = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2).replace('.', ',') : '';
};

/** Rascunho a partir de um produto da loja do professor. */
export function draftFromCoachProduct(p = {}) {
  return {
    title: String(p.name || '').trim().slice(0, TEXT_LIMITS.title),
    description: String(p.description || '').trim(),
    price: reais(p.price),
    category_slug: COACH_CATEGORY[p.category] || '',
    type: LISTING_TYPE.NEW,
    quantity: '1',
  };
}

/**
 * Rascunho a partir de um produto do mercado da arena. A quantidade vem da
 * cópia de estoque (`stock_qty`); sem controle de estoque, 1.
 */
export function draftFromArenaProduct(p = {}) {
  const stock = Number(p.stock_qty);
  const desc = [p.brand && `Marca: ${p.brand}.`, p.size && `Tamanho: ${p.size}.`, String(p.description || '').trim()]
    .filter(Boolean).join(' ');
  return {
    title: [p.name, p.brand && !String(p.name || '').includes(p.brand) ? p.brand : ''].filter(Boolean).join(' ').trim().slice(0, TEXT_LIMITS.title),
    description: desc,
    price: reais(p.sale_price),
    category_slug: ARENA_CATEGORY[p.category] || 'outros',
    type: LISTING_TYPE.NEW,
    quantity: String(Number.isFinite(stock) && p.stock_qty != null ? Math.max(0, Math.floor(stock)) : 1),
    fulfillment: ['pickup'],
    pickup_note: 'Retirar na recepção da arena.',
  };
}
