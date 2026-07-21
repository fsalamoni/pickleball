/**
 * Domínio: PDV (Arena V3 — sprint 3).
 */

export const PRODUCT_CATEGORIES = Object.freeze({
  BEBIDAS: 'bebidas',
  EQUIPAMENTOS: 'equipamentos',
  VESTUARIO: 'vestuario',
  ACESSORIOS: 'acessorios',
  ALIMENTOS: 'alimentos',
  OUTROS: 'outros',
});

export const SALE_STATUS = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
});

export const PAYMENT_METHOD = Object.freeze({
  PIX: 'pix',
  CREDIT_CARD: 'credit_card',
  DEBIT_CARD: 'debit_card',
  CASH: 'cash',
  WALLET: 'wallet',
  BANK_TRANSFER: 'bank_transfer',
});

/** Normaliza input de produto. */
export function normalizeProductInput(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  if (!name) errors.name = 'Nome obrigatório.';
  if (name.length > 80) errors.name = 'Máx. 80 chars.';

  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) errors.price = 'Preço inválido.';

  const stock = Number(input.stock);
  const stockOk = !Number.isFinite(stock) || stock >= 0;

  return {
    valid: Object.keys(errors).length === 0 && stockOk,
    errors,
    value: {
      name,
      description: String(input.description || '').trim().slice(0, 500),
      price: Number.isFinite(price) ? price : 0,
      category: Object.values(PRODUCT_CATEGORIES).includes(input.category) ? input.category : PRODUCT_CATEGORIES.OUTROS,
      stock: Number.isFinite(stock) ? Math.max(0, Math.floor(stock)) : null,
      image_url: String(input.image_url || '').trim(),
      active: input.active !== false,
    },
  };
}

/** Verifica se produto tem estoque. */
export function hasStock(product, qty = 1) {
  if (product?.stock == null) return true;  // sem controle
  return product.stock >= qty;
}

/** Decrementa estoque. */
export function decrementStock(product, qty) {
  if (product?.stock == null) return product;
  return { ...product, stock: Math.max(0, product.stock - qty) };
}

/** Calcula total do carrinho. */
export function calculateCartTotal(items = []) {
  return items.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);
}

/** Divide valor entre N participantes. */
export function splitAmount(total, participants) {
  if (!Number.isFinite(total) || total < 0) return [];
  if (!Array.isArray(participants) || participants.length === 0) return [];
  const n = participants.length;
  const cents = Math.round(total * 100);
  const perPerson = Math.floor(cents / n);
  const remainder = cents - perPerson * n;
  return participants.map((uid, idx) => ({
    user_id: uid,
    amount: (perPerson + (idx < remainder ? 1 : 0)) / 100,
  }));
}

/** Normaliza input de sale. */
export function normalizeSaleInput(input = {}) {
  return {
    items: Array.isArray(input.items) ? input.items : [],
    total: Number(input.total) || 0,
    payment_method: Object.values(PAYMENT_METHOD).includes(input.payment_method)
      ? input.payment_method : PAYMENT_METHOD.PIX,
    split_with: Array.isArray(input.split_with) ? input.split_with : [],
  };
}
