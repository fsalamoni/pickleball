/**
 * Domínio puro de Mercado/Estoque da arena (Sprint 5).
 *
 * Modelo:
 * - arena_inventory_products/{id}: produto mestre (nome, marca, categoria, ...)
 * - arena_inventory_entries/{id}: entrada de mercadoria (compra/reposição)
 * - arena_inventory_exits/{id}: saída de mercadoria (venda/consumo/perda)
 *
 * Estoque atual = soma(entries.quantity) - soma(exits.quantity)
 *
 * Categorias: Vestuário, Bebida, Comida, Raquete, Bola, Acessórios, Brindes, Outros
 */

export const INVENTORY_CATEGORIES = Object.freeze({
  VESTUARIO: 'Vestuário',
  BEBIDA: 'Bebida',
  COMIDA: 'Comida',
  RAQUETE: 'Raquete',
  BOLA: 'Bola',
  ACESSORIOS: 'Acessórios',
  BRINDES: 'Brindes',
  EQUIPAMENTO: 'Equipamento',
  OUTROS: 'Outros',
});

export const INVENTORY_CATEGORIES_LIST = Object.values(INVENTORY_CATEGORIES);

export const PRODUCT_NAME_MAX = 80;
export const PRODUCT_BRAND_MAX = 60;
export const PRODUCT_DESCRIPTION_MAX = 500;
export const ENTRY_NOTES_MAX = 500;
export const EXIT_REASON_MAX = 200;
export const INVENTORY_MAX_QUANTITY = 100000;

const str = (v) => String(v ?? '').trim();

function isValidDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidCategory(value) {
  return INVENTORY_CATEGORIES_LIST.includes(value);
}

/**
 * Normaliza e valida um produto.
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function normalizeInventoryProduct(input = {}) {
  const name = str(input.name);
  if (!name) return { valid: false, error: 'Nome do produto é obrigatório.', value: {} };
  if (name.length > PRODUCT_NAME_MAX) {
    return { valid: false, error: `Nome muito longo (max ${PRODUCT_NAME_MAX}).`, value: { name: name.slice(0, PRODUCT_NAME_MAX) } };
  }
  const category = str(input.category);
  if (!isValidCategory(category)) {
    return { valid: false, error: 'Categoria inválida.', value: { name } };
  }
  const value = {
    name,
    brand: str(input.brand).slice(0, PRODUCT_BRAND_MAX),
    description: str(input.description).slice(0, PRODUCT_DESCRIPTION_MAX),
    category,
    unit: str(input.unit).slice(0, 20) || 'un', // un, kg, L, etc
    active: input.active !== false,
  };

  // Campos ADITIVOS (opcionais) — detalhamento vindo do catálogo padrão e as
  // variáveis do mercado da arena. Só são gravados quando informados, mantendo
  // total retrocompatibilidade com produtos antigos.
  const subcategory = str(input.subcategory).slice(0, 50);
  if (subcategory) value.subcategory = subcategory;
  const packaging = str(input.packaging).slice(0, 40);
  if (packaging) value.packaging = packaging;
  const size = str(input.size).slice(0, 30);
  if (size) value.size = size;
  const flavor = str(input.flavor).slice(0, 40);
  if (flavor) value.flavor = flavor;
  const catalogId = str(input.catalog_id);
  if (catalogId) value.catalog_id = catalogId;

  // Preço de venda padrão do produto no mercado da arena (o preço de compra é
  // registrado por entrada). >= 0.
  const salePrice = Number(input.sale_price);
  if (Number.isFinite(salePrice) && salePrice >= 0) {
    value.sale_price = Math.round(salePrice * 100) / 100;
  }
  // Estoque mínimo para alertar reposição.
  const minStock = Number(input.min_stock);
  if (Number.isFinite(minStock) && minStock >= 0) {
    value.min_stock = Math.round(minStock);
  }
  // Validade (opcional) do lote atual — YYYY-MM-DD.
  const expiry = str(input.expiry_date);
  if (isValidDate(expiry)) value.expiry_date = expiry;

  return { valid: true, error: null, value };
}

/** Situação do estoque de um produto para alertas na UI. */
export function stockStatus(quantity, minStock = 0) {
  const q = Number(quantity) || 0;
  const min = Number(minStock) || 0;
  if (q <= 0) return 'out';        // esgotado
  if (min > 0 && q <= min) return 'low'; // abaixo do mínimo
  if (q < 5) return 'low';         // heurística padrão quando não há mínimo
  return 'ok';
}

/**
 * Dias até a validade (negativo = vencido). Retorna null quando não há data.
 * @param {string} expiryDate  YYYY-MM-DD
 * @param {string} [today]     YYYY-MM-DD (default: hoje)
 */
export function daysToExpiry(expiryDate, today) {
  if (!isValidDate(expiryDate)) return null;
  const ref = isValidDate(today) ? today : new Date().toISOString().slice(0, 10);
  const a = Date.parse(`${expiryDate}T00:00:00Z`);
  const b = Date.parse(`${ref}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

/** Classifica a validade: 'expired' | 'soon' (<= soonDays) | 'ok' | null. */
export function expiryStatus(expiryDate, { soonDays = 15, today } = {}) {
  const d = daysToExpiry(expiryDate, today);
  if (d === null) return null;
  if (d < 0) return 'expired';
  if (d <= soonDays) return 'soon';
  return 'ok';
}

/**
 * Normaliza e valida uma entrada de mercadoria (compra/reposição).
 */
export function normalizeInventoryEntry(input = {}) {
  const product_id = str(input.product_id);
  if (!product_id) return { valid: false, error: 'Produto é obrigatório.', value: {} };
  const date = str(input.date);
  if (!isValidDate(date)) return { valid: false, error: 'Data inválida (YYYY-MM-DD).', value: { product_id } };
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > INVENTORY_MAX_QUANTITY) {
    return { valid: false, error: `Quantidade deve ser entre 1 e ${INVENTORY_MAX_QUANTITY}.`, value: { product_id, date } };
  }
  const unit_cost = Number(input.unit_cost);
  if (!Number.isFinite(unit_cost) || unit_cost < 0) {
    return { valid: false, error: 'Custo unitário inválido (>= 0).', value: { product_id, date, quantity } };
  }
  return {
    valid: true,
    error: null,
    value: {
      product_id,
      date,
      quantity: Math.round(quantity),
      unit_cost: Math.round(unit_cost * 100) / 100,
      total_cost: Math.round(quantity * unit_cost * 100) / 100,
      supplier: str(input.supplier).slice(0, 120),
      buyer_id: str(input.buyer_id),
      buyer_name: str(input.buyer_name).slice(0, 80),
      notes: str(input.notes).slice(0, ENTRY_NOTES_MAX),
    },
  };
}

/**
 * Normaliza e valida uma saída de mercadoria (venda/consumo/perda).
 */
export function normalizeInventoryExit(input = {}) {
  const product_id = str(input.product_id);
  if (!product_id) return { valid: false, error: 'Produto é obrigatório.', value: {} };
  const date = str(input.date);
  if (!isValidDate(date)) return { valid: false, error: 'Data inválida (YYYY-MM-DD).', value: { product_id } };
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > INVENTORY_MAX_QUANTITY) {
    return { valid: false, error: `Quantidade deve ser entre 1 e ${INVENTORY_MAX_QUANTITY}.`, value: { product_id, date } };
  }
  const exit_type = str(input.exit_type) || 'sale';
  if (!['sale', 'consumption', 'loss', 'gift', 'return'].includes(exit_type)) {
    return { valid: false, error: 'Tipo de saída inválido (sale, consumption, loss, gift, return).', value: { product_id, date, quantity } };
  }
  const unit_price = Number(input.unit_price);
  if (!Number.isFinite(unit_price) || unit_price < 0) {
    return { valid: false, error: 'Preço unitário inválido (>= 0).', value: { product_id, date, quantity, exit_type } };
  }
  return {
    valid: true,
    error: null,
    value: {
      product_id,
      date,
      quantity: Math.round(quantity),
      exit_type,
      unit_price: Math.round(unit_price * 100) / 100,
      total_price: Math.round(quantity * unit_price * 100) / 100,
      buyer_id: str(input.buyer_id),
      buyer_name: str(input.buyer_name).slice(0, 80),
      reason: str(input.reason).slice(0, EXIT_REASON_MAX),
    },
  };
}

/**
 * Calcula estoque agregado de um produto.
 * @param {string} productId
 * @param {Array} entries
 * @param {Array} exits
 * @returns {{ quantity: number, total_invested: number, total_revenue: number }}
 */
export function calculateStock(productId, entries = [], exits = []) {
  const e = entries.filter((x) => x.product_id === productId);
  const x = exits.filter((x) => x.product_id === productId);
  const inQty = e.reduce((s, x) => s + Number(x.quantity || 0), 0);
  const outQty = x.reduce((s, x) => s + Number(x.quantity || 0), 0);
  return {
    quantity: inQty - outQty,
    total_invested: Math.round(e.reduce((s, x) => s + Number(x.total_cost || 0), 0) * 100) / 100,
    total_revenue: Math.round(x.reduce((s, x) => s + Number(x.total_price || 0), 0) * 100) / 100,
  };
}

/** Calcula margem de lucro (% de lucro sobre o custo). */
export function calculateMargin(stock) {
  if (!stock.total_invested || stock.total_invested === 0) return 0;
  return Math.round(((stock.total_revenue - stock.total_invested) / stock.total_invested) * 10000) / 100;
}

/** Filtra produtos por categoria. */
export function filterProductsByCategory(products = [], category) {
  if (!category || category === 'all') return products;
  return products.filter((p) => p.category === category);
}

/** Busca produtos por nome/brand. */
export function searchProducts(products = [], query = '') {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return products;
  return products.filter((p) =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.brand || '').toLowerCase().includes(q)
  );
}
