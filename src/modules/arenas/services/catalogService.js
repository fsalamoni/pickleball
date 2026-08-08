/**
 * Serviço do CATÁLOGO PADRÃO de produtos (flag arena_product_catalog).
 *
 * Coleção `catalog_products`: listagem geral, compartilhada por toda a
 * plataforma. Arenas leem para "puxar" produtos ao seu mercado e podem
 * CONTRIBUIR novos itens — sempre passando pela verificação de duplicidade.
 *
 * Regras de segurança (firestore.rules): leitura por qualquer autenticado;
 * criação por gestor de arena (source 'arena') ou platform_admin; atualização/
 * remoção por platform_admin (moderação). Ver match /catalog_products.
 */

import {
  addDoc, collection, doc, getDocs, getDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { ARENA_COLLECTIONS } from '../domain/constants.js';
import { createInventoryProduct, addInventoryEntry } from './arenaService.js';
import {
  normalizeCatalogProduct, findDuplicates, buildDedupKey,
  CATALOG_PRODUCT_SOURCE, CATALOG_PRODUCT_STATUS,
} from '../domain/productCatalog.js';
import { buildCatalogSeed } from '../domain/catalogSeed.js';

const COL = ARENA_COLLECTIONS.catalog_products;

/**
 * Lista o catálogo (todos os produtos ativos). Sem orderBy no Firestore para
 * evitar índice composto; ordena em memória por categoria e nome.
 * @param {{ includeInactive?: boolean }} [opts]
 * @returns {Promise<object[]>}
 */
export async function listCatalogProducts({ includeInactive = false } = {}) {
  if (!db) return [];
  const snap = await getDocs(collection(db, COL));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!includeInactive) list = list.filter((p) => p.status !== CATALOG_PRODUCT_STATUS.MERGED);
  return list.sort((a, b) =>
    String(a.category || '').localeCompare(String(b.category || ''))
    || String(a.subcategory || '').localeCompare(String(b.subcategory || ''))
    || String(a.name || '').localeCompare(String(b.name || '')));
}

/**
 * Verifica se um produto candidato já existe (dedup). Faz a checagem contra a
 * lista fornecida (normalmente já carregada no cliente) e, quando possível,
 * confirma no servidor por `dedup_key`.
 * @param {object} candidate  entrada crua ou normalizada
 * @param {object[]} [existing]  catálogo carregado (para similaridade)
 * @returns {Promise<{ matches: Array, exact: object|null }>}
 */
export async function checkCatalogDuplicates(candidate, existing = []) {
  const { value } = normalizeCatalogProduct(candidate);
  const key = value.dedup_key || buildDedupKey(candidate);
  const matches = findDuplicates(value, existing);
  let exact = matches.find((m) => m.exact)?.product || null;
  // Confirmação server-side por dedup_key (cobre catálogo maior que o carregado).
  if (!exact && db && key) {
    try {
      const snap = await getDocs(query(collection(db, COL), where('dedup_key', '==', key)));
      if (!snap.empty) exact = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (err) {
      logger.warn('[catalog] dedup lookup falhou', err);
    }
  }
  return { matches, exact };
}

/**
 * Cria (contribui) um novo produto no catálogo geral. Bloqueia duplicata exata
 * a menos que `force` seja true (usado quando o usuário confirma que é distinto).
 * @param {object} input
 * @param {object} actor  usuário autenticado
 * @param {{ arenaId?: string, existing?: object[], force?: boolean }} [opts]
 * @returns {Promise<{ id: string }>}
 */
export async function proposeCatalogProduct(input, actor, { arenaId = null, existing = [], force = false } = {}) {
  if (!db) throw new Error('Sem conexão.');
  const isArena = !!arenaId;
  const { valid, error, value } = normalizeCatalogProduct({
    ...input,
    source: isArena ? CATALOG_PRODUCT_SOURCE.ARENA : CATALOG_PRODUCT_SOURCE.PLATFORM,
    status: CATALOG_PRODUCT_STATUS.ACTIVE,
  });
  if (!valid) throw new Error(error);

  const { exact } = await checkCatalogDuplicates(value, existing);
  if (exact && !force) {
    const err = new Error('Este produto já existe no catálogo.');
    err.code = 'duplicate';
    err.existing = exact;
    throw err;
  }

  const ref = await addDoc(collection(db, COL), {
    ...value,
    contributed_by_arena_id: arenaId || null,
    contributed_by_uid: actor?.uid || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'catalog_product_created', actor,
    details: { name: value.name, category: value.category, source: value.source, arena_id: arenaId || null },
  }).catch(() => {});
  return { id: ref.id };
}

/**
 * "Puxa" um produto do catálogo padrão para o mercado da arena: cria um produto
 * de estoque (arena_inventory_products) pré-preenchido com os dados do catálogo
 * e as variáveis da arena (preço de venda, estoque mínimo, validade). Se
 * `initial_quantity > 0`, também registra a entrada inicial (compra) para já
 * refletir no estoque.
 *
 * @param {string} arenaId
 * @param {object} catalogProduct  produto do catálogo (com id)
 * @param {object} arenaFields  { sale_price, purchase_price, initial_quantity, min_stock, expiry_date, supplier }
 * @param {object} actor
 * @returns {Promise<{ productId: string }>}
 */
export async function adoptCatalogToArena(arenaId, catalogProduct, arenaFields = {}, actor) {
  if (!arenaId || !catalogProduct) throw new Error('Dados inválidos.');
  const productId = await createInventoryProduct(arenaId, {
    name: catalogProduct.name,
    brand: catalogProduct.brand,
    category: catalogProduct.category,
    subcategory: catalogProduct.subcategory,
    packaging: catalogProduct.packaging,
    size: catalogProduct.size,
    flavor: catalogProduct.flavor,
    unit: catalogProduct.unit || 'un',
    description: catalogProduct.description,
    catalog_id: catalogProduct.id,
    sale_price: arenaFields.sale_price,
    min_stock: arenaFields.min_stock,
    expiry_date: arenaFields.expiry_date,
    active: true,
  }, actor);

  const qty = Number(arenaFields.initial_quantity);
  if (Number.isFinite(qty) && qty > 0) {
    await addInventoryEntry(arenaId, {
      product_id: productId,
      date: new Date().toISOString().slice(0, 10),
      quantity: qty,
      unit_cost: Number(arenaFields.purchase_price) || 0,
      supplier: arenaFields.supplier || '',
      buyer_name: actor?.displayName || '',
      notes: 'Entrada inicial (produto puxado do catálogo)',
    }, actor).catch((err) => logger.warn('[catalog] entrada inicial falhou', err));
  }
  return { productId };
}

/** Atualiza um produto do catálogo (moderação — platform_admin). */
export async function updateCatalogProduct(productId, updates, actor) {
  if (!db || !productId) throw new Error('Produto inválido.');
  const clean = { ...updates };
  // Recomputa chaves quando atributos mudam.
  if (['name', 'category', 'subcategory', 'brand', 'packaging', 'size', 'flavor'].some((k) => k in clean)) {
    const snap = await getDoc(doc(db, COL, productId));
    const merged = { ...(snap.exists() ? snap.data() : {}), ...clean };
    const { value } = normalizeCatalogProduct(merged);
    clean.dedup_key = value.dedup_key;
    clean.search_tokens = value.search_tokens;
  }
  await updateDoc(doc(db, COL, productId), { ...clean, updated_at: serverTimestamp(), updated_by: actor?.uid || null });
  await createAuditLog({ action: 'catalog_product_updated', actor, details: { product_id: productId } }).catch(() => {});
}

/** Remove um produto do catálogo (moderação — platform_admin). */
export async function deleteCatalogProduct(productId, actor) {
  if (!db || !productId) throw new Error('Produto inválido.');
  await deleteDoc(doc(db, COL, productId));
  await createAuditLog({ action: 'catalog_product_deleted', actor, details: { product_id: productId } }).catch(() => {});
}

/**
 * Popula o catálogo com a semente padrão. Idempotente: não recria itens cuja
 * `dedup_key` já exista. Apenas platform_admin (garantido pelas regras).
 * @param {object} actor
 * @returns {Promise<{ created: number, skipped: number, total: number }>}
 */
export async function seedCatalog(actor) {
  if (!db) throw new Error('Sem conexão.');
  const existing = await listCatalogProducts({ includeInactive: true });
  const existingKeys = new Set(existing.map((p) => p.dedup_key).filter(Boolean));
  const seed = buildCatalogSeed();

  let created = 0;
  let skipped = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const raw of seed) {
    const { valid, value } = normalizeCatalogProduct(raw);
    if (!valid) { skipped += 1; continue; }
    if (existingKeys.has(value.dedup_key)) { skipped += 1; continue; }
    existingKeys.add(value.dedup_key);
    const ref = doc(collection(db, COL));
    batch.set(ref, {
      ...value,
      source: CATALOG_PRODUCT_SOURCE.PLATFORM,
      status: CATALOG_PRODUCT_STATUS.ACTIVE,
      contributed_by_arena_id: null,
      contributed_by_uid: actor?.uid || null,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    });
    created += 1;
    batchCount += 1;
    // Firestore: máximo 500 escritas por batch. Damos folga em 400.
    if (batchCount >= 400) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }
  if (batchCount > 0) await batch.commit();

  await createAuditLog({ action: 'catalog_seeded', actor, details: { created, skipped } }).catch(() => {});
  return { created, skipped, total: seed.length };
}
