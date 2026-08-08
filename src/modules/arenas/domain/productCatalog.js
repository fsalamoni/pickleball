/**
 * Domínio puro do CATÁLOGO PADRÃO de produtos da plataforma (flag
 * arena_product_catalog).
 *
 * Objetivo: uma listagem geral, rica e padronizada de produtos (bebidas,
 * comidas, lanches, doces, salgadinhos, etc.) que as arenas podem "puxar" para
 * o seu mercado e complementar com os dados do próprio negócio (preço de
 * compra/venda, quantidade, validade). As arenas também podem CONTRIBUIR novos
 * produtos ao catálogo — e, antes de inserir, a plataforma verifica se aquele
 * produto já não existe com outro nome/formato/descrição (deduplicação).
 *
 * Modelo (coleção `catalog_products`):
 *  - name          nome canônico (ex.: "Coca-Cola 350ml")
 *  - category      categoria macro (reaproveita INVENTORY_CATEGORIES)
 *  - subcategory   subcategoria (ex.: "Refrigerante", "Salgadinho", "Pizza")
 *  - brand         marca (ex.: "Coca-Cola")
 *  - packaging     embalagem (ex.: "Lata", "Garrafa PET", "Pacote")
 *  - size          tamanho/volume/peso textual (ex.: "350ml", "100g")
 *  - flavor        sabor/variante (opcional)
 *  - unit          unidade de medida (un, kg, L)
 *  - description   descrição livre (opcional)
 *  - dedup_key     chave normalizada p/ detectar duplicatas exatas
 *  - search_tokens tokens normalizados p/ busca/similaridade
 *  - source        'platform' | 'arena'
 *  - status        'active' | 'pending' | 'merged'
 *
 * Este arquivo NÃO importa React nem Firebase — apenas lógica pura, testada.
 */

import { INVENTORY_CATEGORIES } from './inventory.js';

/** Categorias que participam do catálogo (subconjunto de INVENTORY_CATEGORIES). */
export const CATALOG_CATEGORIES = Object.freeze({
  BEBIDA: INVENTORY_CATEGORIES.BEBIDA,
  COMIDA: INVENTORY_CATEGORIES.COMIDA,
  ACESSORIOS: INVENTORY_CATEGORIES.ACESSORIOS,
  RAQUETE: INVENTORY_CATEGORIES.RAQUETE,
  BOLA: INVENTORY_CATEGORIES.BOLA,
  VESTUARIO: INVENTORY_CATEGORIES.VESTUARIO,
  EQUIPAMENTO: INVENTORY_CATEGORIES.EQUIPAMENTO,
  BRINDES: INVENTORY_CATEGORIES.BRINDES,
  OUTROS: INVENTORY_CATEGORIES.OUTROS,
});

export const CATALOG_CATEGORIES_LIST = Object.values(CATALOG_CATEGORIES);

/**
 * Subcategorias sugeridas por categoria. É apenas uma lista de apoio para a UI
 * (datalist) e para a organização do seed — a subcategoria em si é texto livre
 * validado por tamanho, não por enum, para não travar a contribuição das arenas.
 */
export const CATALOG_SUBCATEGORIES = Object.freeze({
  [CATALOG_CATEGORIES.BEBIDA]: [
    'Refrigerante', 'Suco', 'Água', 'Água com gás', 'Água saborizada',
    'Energético', 'Isotônico', 'Chá gelado', 'Cerveja', 'Cerveja sem álcool',
    'Café', 'Achocolatado', 'Leite', 'Coco',
  ],
  [CATALOG_CATEGORIES.COMIDA]: [
    'Salgadinho', 'Salgado', 'Lanche', 'Sanduíche', 'Pizza', 'Porção',
    'Chocolate', 'Doce', 'Bala/Goma', 'Biscoito', 'Barra de cereal',
    'Sorvete', 'Açaí', 'Fruta', 'Amendoim/Castanha',
  ],
  [CATALOG_CATEGORIES.ACESSORIOS]: ['Grip', 'Overgrip', 'Toalha', 'Munhequeira', 'Boné', 'Meia', 'Elástico'],
  [CATALOG_CATEGORIES.RAQUETE]: ['Raquete', 'Case', 'Kit'],
  [CATALOG_CATEGORIES.BOLA]: ['Bola indoor', 'Bola outdoor', 'Pack de bolas'],
  [CATALOG_CATEGORIES.VESTUARIO]: ['Camiseta', 'Short', 'Regata', 'Viseira', 'Agasalho'],
  [CATALOG_CATEGORIES.EQUIPAMENTO]: ['Rede', 'Marcador de placar', 'Cone', 'Fita de quadra'],
  [CATALOG_CATEGORIES.BRINDES]: ['Chaveiro', 'Adesivo', 'Squeeze'],
  [CATALOG_CATEGORIES.OUTROS]: ['Diversos'],
});

/** Embalagens comuns (apoio à UI; texto livre também é aceito). */
export const CATALOG_PACKAGINGS = Object.freeze([
  'Lata', 'Latão', 'Long neck', 'Garrafa PET', 'Garrafa de vidro', 'Garrafa',
  'Caixinha (Tetra Pak)', 'Copo', 'Pacote', 'Saco', 'Caixa', 'Pote', 'Sachê',
  'Bandeja', 'Fatia', 'Barra', 'Unidade', 'Fardo', 'Dupla', 'Kit',
]);

/** Unidades de medida padrão. */
export const CATALOG_UNITS = Object.freeze(['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'fatia', 'porção']);

export const CATALOG_PRODUCT_SOURCE = Object.freeze({ PLATFORM: 'platform', ARENA: 'arena' });
export const CATALOG_PRODUCT_STATUS = Object.freeze({ ACTIVE: 'active', PENDING: 'pending', MERGED: 'merged' });

export const CATALOG_NAME_MAX = 100;
export const CATALOG_BRAND_MAX = 60;
export const CATALOG_SUBCATEGORY_MAX = 50;
export const CATALOG_PACKAGING_MAX = 40;
export const CATALOG_SIZE_MAX = 30;
export const CATALOG_FLAVOR_MAX = 40;
export const CATALOG_DESCRIPTION_MAX = 500;

const str = (v) => String(v ?? '').trim();

/**
 * Normaliza texto para comparação: minúsculas, sem acentos, sem pontuação,
 * espaços colapsados. Base da deduplicação e da busca.
 * @param {string} value
 * @returns {string}
 */
export function normalizeText(value) {
  return str(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normaliza um "tamanho" para comparação, unificando unidades comuns
 * (ex.: "2 l" e "2l" e "2000ml" → mesma grandeza quando possível).
 * @param {string} value
 * @returns {string}
 */
export function normalizeSize(value) {
  const t = normalizeText(value).replace(/\s+/g, '');
  const m = t.match(/^(\d+(?:[.,]\d+)?)(ml|l|g|kg|un|cm|mm)?$/);
  if (!m) return t;
  let qty = parseFloat(m[1].replace(',', '.'));
  const unit = m[2] || '';
  if (unit === 'l') { qty *= 1000; return `${qty}ml`; }
  if (unit === 'kg') { qty *= 1000; return `${qty}g`; }
  return `${qty}${unit}`;
}

/**
 * Chave de deduplicação: identifica um produto de forma estável a partir dos
 * atributos que o tornam único (categoria, subcategoria, marca, embalagem,
 * tamanho e nome). Dois produtos com a mesma chave são a MESMA coisa.
 * @param {object} p
 * @returns {string}
 */
export function buildDedupKey(p = {}) {
  return [
    normalizeText(p.category),
    normalizeText(p.subcategory),
    normalizeText(p.brand),
    normalizeSize(p.size),
    normalizeText(p.packaging),
    normalizeText(p.flavor),
    normalizeText(p.name),
  ].join('|');
}

/** Conjunto de tokens (palavras) que descrevem o produto, p/ busca/similaridade. */
export function buildSearchTokens(p = {}) {
  const raw = [p.name, p.brand, p.subcategory, p.packaging, p.size, p.flavor, p.category]
    .map(normalizeText)
    .join(' ');
  const set = new Set(raw.split(' ').filter((t) => t.length > 1));
  // Remove tokens de "tamanho" puros muito genéricos? Mantemos: ajudam a distinguir.
  return Array.from(set);
}

/**
 * Similaridade de Jaccard entre dois conjuntos de tokens (0..1).
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number}
 */
export function jaccard(a = [], b = []) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Normaliza e valida um produto do catálogo. Preenche dedup_key e search_tokens.
 * @param {object} input
 * @returns {{ valid: boolean, error: string|null, value: object }}
 */
export function normalizeCatalogProduct(input = {}) {
  const name = str(input.name);
  if (!name) return { valid: false, error: 'Nome do produto é obrigatório.', value: {} };
  if (name.length > CATALOG_NAME_MAX) {
    return { valid: false, error: `Nome muito longo (máx ${CATALOG_NAME_MAX}).`, value: {} };
  }
  const category = str(input.category);
  if (!CATALOG_CATEGORIES_LIST.includes(category)) {
    return { valid: false, error: 'Categoria inválida.', value: { name } };
  }
  const subcategory = str(input.subcategory).slice(0, CATALOG_SUBCATEGORY_MAX);
  if (!subcategory) {
    return { valid: false, error: 'Subcategoria é obrigatória.', value: { name, category } };
  }
  const value = {
    name,
    category,
    subcategory,
    brand: str(input.brand).slice(0, CATALOG_BRAND_MAX),
    packaging: str(input.packaging).slice(0, CATALOG_PACKAGING_MAX),
    size: str(input.size).slice(0, CATALOG_SIZE_MAX),
    flavor: str(input.flavor).slice(0, CATALOG_FLAVOR_MAX),
    unit: str(input.unit).slice(0, 12) || 'un',
    description: str(input.description).slice(0, CATALOG_DESCRIPTION_MAX),
    source: input.source === CATALOG_PRODUCT_SOURCE.ARENA ? CATALOG_PRODUCT_SOURCE.ARENA : CATALOG_PRODUCT_SOURCE.PLATFORM,
    status: Object.values(CATALOG_PRODUCT_STATUS).includes(input.status) ? input.status : CATALOG_PRODUCT_STATUS.ACTIVE,
  };
  value.dedup_key = buildDedupKey(value);
  value.search_tokens = buildSearchTokens(value);
  return { valid: true, error: null, value };
}

/**
 * Procura possíveis duplicatas de um candidato dentro de uma lista existente.
 * Retorna correspondências ordenadas por confiança (desc). Uma correspondência
 * `exact: true` significa mesma dedup_key (é o mesmo produto).
 *
 * @param {object} candidate  produto candidato (já normalizado ou cru)
 * @param {object[]} existing lista de produtos do catálogo
 * @param {{ threshold?: number, limit?: number }} [opts]
 * @returns {Array<{ product: object, score: number, exact: boolean }>}
 */
export function findDuplicates(candidate, existing = [], opts = {}) {
  const threshold = typeof opts.threshold === 'number' ? opts.threshold : 0.62;
  const limit = opts.limit || 8;
  const candKey = candidate.dedup_key || buildDedupKey(candidate);
  const candTokens = candidate.search_tokens?.length ? candidate.search_tokens : buildSearchTokens(candidate);
  const candBrand = normalizeText(candidate.brand);
  const candSub = normalizeText(candidate.subcategory);

  const matches = [];
  for (const p of existing) {
    if (!p) continue;
    const pKey = p.dedup_key || buildDedupKey(p);
    const exact = !!candKey && pKey === candKey;
    const pTokens = p.search_tokens?.length ? p.search_tokens : buildSearchTokens(p);
    let score = jaccard(candTokens, pTokens);
    // Reforça a confiança quando marca e subcategoria batem (mesmo produto com
    // nome escrito de outra forma). Penaliza quando a marca diverge.
    const sameBrand = candBrand && normalizeText(p.brand) === candBrand;
    const sameSub = candSub && normalizeText(p.subcategory) === candSub;
    if (sameBrand && sameSub) score = Math.min(1, score + 0.15);
    if (candBrand && normalizeText(p.brand) && !sameBrand) score = Math.max(0, score - 0.2);
    if (exact) score = 1;
    if (exact || score >= threshold) matches.push({ product: p, score: Math.round(score * 100) / 100, exact });
  }
  matches.sort((a, b) => (b.exact - a.exact) || (b.score - a.score));
  return matches.slice(0, limit);
}

/** Filtra o catálogo por categoria/subcategoria/busca (tudo client-side). */
export function filterCatalog(products = [], { category = 'all', subcategory = 'all', query = '' } = {}) {
  const q = normalizeText(query);
  const qTokens = q ? q.split(' ').filter(Boolean) : [];
  return products.filter((p) => {
    if (category !== 'all' && p.category !== category) return false;
    if (subcategory !== 'all' && p.subcategory !== subcategory) return false;
    if (qTokens.length === 0) return true;
    const hay = (p.search_tokens?.length ? p.search_tokens.join(' ') : buildSearchTokens(p).join(' '));
    return qTokens.every((t) => hay.includes(t));
  });
}

/** Rótulo amigável de um produto do catálogo (nome + marca + embalagem/tamanho). */
export function catalogProductLabel(p = {}) {
  const bits = [p.name];
  if (p.brand && !normalizeText(p.name).includes(normalizeText(p.brand))) bits.unshift(p.brand);
  const pack = [p.packaging, p.size].filter(Boolean).join(' ');
  return `${bits.filter(Boolean).join(' ')}${pack ? ` · ${pack}` : ''}`.trim();
}
