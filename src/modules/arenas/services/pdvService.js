/**
 * Service: PDV (Arena V3 — sprint 3).
 *
 * Produtos, vendas, pagamentos. Sandbox: sem gateway real.
 * ADITIVO.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch, increment, limit,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  normalizeProductInput, normalizeSaleInput, calculateCartTotal,
  splitAmount, hasStock, decrementStock, SALE_STATUS, PAYMENT_METHOD,
} from '../domain/pdv.js';

const COL_PRODUCTS = 'arena_products';
const COL_SALES = 'arena_sales';
const COL_PAYMENTS = 'arena_payments';

function str(v) { return String(v ?? '').trim(); }
function displayName(u, p) {
  return p?.platform_name || p?.full_name || u?.displayName || u?.email || 'Atleta';
}

/* ----------------------- Products ---------------------- */

export async function listArenaProducts(arenaId, { onlyActive = true, lim = 200 } = {}) {
  if (!db || !arenaId) return [];
  const c = [where('arena_id', '==', arenaId)];
  if (onlyActive) c.push(where('active', '==', true));
  c.push(orderBy('name', 'asc'));
  c.push(limit(lim));
  const snap = await getDocs(query(collection(db, COL_PRODUCTS), ...c));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createArenaProduct(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeProductInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_PRODUCTS)).id;
  await setDoc(doc(db, COL_PRODUCTS, id), {
    id, arena_id: arenaId, ...value, sold_count: 0, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_product_created', actor, details: { arena_id: arenaId, name: value.name } });
  return id;
}

export async function updateArenaProduct(prodId, updates, actor) {
  if (!prodId) return;
  await updateDoc(doc(db, COL_PRODUCTS, prodId), { ...updates, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'arena_product_updated', actor, details: { prod_id: prodId } });
}

export async function deleteArenaProduct(prodId, actor) {
  if (!prodId) return;
  await deleteDoc(doc(db, COL_PRODUCTS, prodId));
  await createAuditLog({ action: 'arena_product_deleted', actor, details: { prod_id: prodId } });
}

/* ----------------------- Sales ---------------------- */

/** Atleta compra 1+ produtos. Registra sale + payments (split se houver). */
export async function createSale(arenaId, items, paymentMethod, splitWith, user, profile) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  if (!user?.uid) throw new Error('Faça login.');

  // Valida estoque
  for (const item of items) {
    const psnap = await getDoc(doc(db, COL_PRODUCTS, item.product_id));
    if (!psnap.exists()) throw new Error(`Produto ${item.product_id} não existe.`);
    const p = psnap.data();
    if (!hasStock(p, item.quantity || 1)) {
      throw new Error(`Estoque insuficiente para ${p.name}.`);
    }
  }

  const total = calculateCartTotal(items);
  const saleId = doc(collection(db, COL_SALES)).id;
  const splits = splitWith && splitWith.length > 0
    ? splitAmount(total, splitWith)
    : null;

  const sale = {
    id: saleId,
    arena_id: arenaId,
    buyer_id: user.uid,
    buyer_name: displayName(user, profile),
    items,
    total,
    payment_method: paymentMethod,
    status: SALE_STATUS.PENDING,
    split_with: splitWith || [],
    split_details: splits,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, COL_SALES, saleId), sale);

  // Decrementa estoque
  for (const item of items) {
    const ref = doc(db, COL_PRODUCTS, item.product_id);
    await updateDoc(ref, {
      stock: increment(-(item.quantity || 1)),
      sold_count: increment(item.quantity || 1),
      updated_at: serverTimestamp(),
    });
  }

  // Cria payments (1 para venda direta, N para split)
  if (splits) {
    const batch = writeBatch(db);
    splits.forEach((s) => {
      const payId = `${saleId}_${s.user_id}`;
      batch.set(doc(db, COL_PAYMENTS, payId), {
        id: payId,
        sale_id: saleId,
        arena_id: arenaId,
        payer_id: s.user_id,
        amount: s.amount,
        payment_method: paymentMethod,
        status: SALE_STATUS.PENDING,
        created_at: serverTimestamp(),
      });
    });
    await batch.commit();
  } else {
    const payId = `${saleId}_${user.uid}`;
    await setDoc(doc(db, COL_PAYMENTS, payId), {
      id: payId,
      sale_id: saleId,
      arena_id: arenaId,
      payer_id: user.uid,
      amount: total,
      payment_method: paymentMethod,
      status: SALE_STATUS.PENDING,
      created_at: serverTimestamp(),
    });
  }

  await createAuditLog({
    action: 'arena_sale_created',
    actor: user,
    details: { arena_id: arenaId, sale_id: saleId, total },
  });
  return saleId;
}

/** Lista vendas da arena. */
export async function listArenaSales(arenaId, { limit: lim = 200 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_SALES), where('arena_id', '==', arenaId), orderBy('created_at', 'desc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Lista vendas do user. */
export async function listUserSales(userId, { limit: lim = 100 } = {}) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL_SALES), where('buyer_id', '==', userId), orderBy('created_at', 'desc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ----------------------- Payments ---------------------- */

export async function listArenaPayments(arenaId, { limit: lim = 200 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_PAYMENTS), where('arena_id', '==', arenaId), orderBy('created_at', 'desc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function confirmPayment(paymentId, actor) {
  if (!paymentId) return;
  await updateDoc(doc(db, COL_PAYMENTS, paymentId), {
    status: SALE_STATUS.PAID,
    paid_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  // Atualiza sale se for único
  const psnap = await getDoc(doc(db, COL_PAYMENTS, paymentId));
  if (psnap.exists()) {
    const saleId = psnap.data().sale_id;
    const saleRef = doc(db, COL_SALES, saleId);
    const allPays = await getDocs(query(collection(db, COL_PAYMENTS), where('sale_id', '==', saleId)));
    const allPaid = allPays.docs.every((d) => d.id === paymentId || d.data().status === SALE_STATUS.PAID);
    if (allPaid) {
      await updateDoc(saleRef, { status: SALE_STATUS.PAID, paid_at: serverTimestamp(), updated_at: serverTimestamp() });
    }
  }
  await createAuditLog({ action: 'arena_payment_confirmed', actor, details: { payment_id: paymentId } });
}
