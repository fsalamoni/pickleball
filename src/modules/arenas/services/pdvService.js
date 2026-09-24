/**
 * Service: a loja da arena — produtos, vendas e pagamentos.
 *
 * ## 🐞 Três defeitos que impediam a loja de existir
 *
 * **1. O atleta não conseguia comprar.** `createSale` dava baixa no estoque
 * escrevendo em `arena_products`, e a regra só deixa o GESTOR da arena
 * escrever ali. A venda era gravada (essa o comprador pode gravar) e a
 * escrita seguinte era recusada: sobrava uma venda fantasma e um erro na
 * tela. Agora a baixa acontece na **confirmação pela arena** — a mesma
 * decisão das horas de pacote (Onda AI): reservar estoque de um pedido que a
 * arena ainda não entregou é contar uma venda que pode não acontecer.
 *
 * **2. Dividir a conta não funcionava.** O comprador criava um documento de
 * pagamento para CADA participante, com `payer_id` de outra pessoa — e a
 * regra exige `payer_id == request.auth.uid`. Como era um `writeBatch`
 * (atômico), a recusa de um derrubava todos, **inclusive o do próprio
 * comprador**. Agora o comprador grava só o pagamento DELE; a divisão fica no
 * documento da venda, e cada participante grava o próprio quando paga
 * (`payMyShare`). A arena, que pode tudo, registra por quem preferir pagar no
 * balcão.
 *
 * **3. A lista de vendas não ordenava.** Ela ordenava por `created_at_ms`, um
 * campo que `createSale` nunca gravou: a subtração dava sempre zero e o caixa
 * saía em ordem arbitrária. Agora o campo é gravado, e a ordenação tem
 * fallback para `created_at`, para as vendas antigas não irem todas para o
 * fim.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, writeBatch, increment, limit,
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

/**
 * Quando isto aconteceu, em ms.
 *
 * `created_at_ms` passou a ser gravado nesta onda; para os documentos antigos
 * o fallback é o `created_at` do servidor. Sem o fallback, tudo o que existia
 * antes iria para o fim da lista de uma vez — que é o oposto do que a arena
 * quer ver no caixa.
 */
function quando(doc) {
  const ms = Number(doc?.created_at_ms);
  if (Number.isFinite(ms) && ms > 0) return ms;
  const ts = doc?.created_at;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  return 0;
}
function displayName(u, p) {
  return p?.platform_name || p?.full_name || u?.displayName || u?.email || 'Atleta';
}

/* ----------------------- Products ---------------------- */

export async function listArenaProducts(arenaId, { onlyActive = true, lim = 200 } = {}) {
  if (!db || !arenaId) return [];
  // Query simples por arena_id (sem orderBy → sem índice composto); filtra e
  // ordena em memória para não falhar sem o índice.
  const snap = await getDocs(query(collection(db, COL_PRODUCTS), where('arena_id', '==', arenaId), limit(lim)));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (onlyActive) list = list.filter((p) => p.active !== false);
  return list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
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

/**
 * Edita um produto.
 *
 * Passa pela MESMA normalização da criação: gravava o objeto cru, então um
 * preço negativo ou uma categoria inventada entravam em silêncio e só
 * apareciam como estrago no caixa.
 */
export async function updateArenaProduct(prodId, updates, actor) {
  if (!prodId) return;
  const snap = await getDoc(doc(db, COL_PRODUCTS, prodId));
  if (!snap.exists()) throw new Error('Produto não encontrado.');
  const { valid, errors, value } = normalizeProductInput({ ...snap.data(), ...updates });
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  await updateDoc(doc(db, COL_PRODUCTS, prodId), { ...value, updated_at: serverTimestamp() });
  await createAuditLog({ action: 'arena_product_updated', actor, details: { prod_id: prodId } });
}

export async function deleteArenaProduct(prodId, actor) {
  if (!prodId) return;
  await deleteDoc(doc(db, COL_PRODUCTS, prodId));
  await createAuditLog({ action: 'arena_product_deleted', actor, details: { prod_id: prodId } });
}

/* ----------------------- Sales ---------------------- */

/**
 * O atleta (ou a arena) registra uma compra.
 *
 * A venda nasce **pendente** e NÃO baixa estoque: quem baixa é a confirmação
 * da arena. A conferência de estoque aqui é um aviso — a tela estima, o
 * serviço confere de novo na hora de entregar.
 *
 * @param {string} arenaId
 * @param {Array<{product_id, quantity, price, name}>} items
 * @param {string} paymentMethod
 * @param {Array<string>} splitWith uids que dividem a conta (inclusive o comprador)
 */
export async function createSale(arenaId, items, paymentMethod, splitWith, user, profile) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  if (!user?.uid) throw new Error('Faça login.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Carrinho vazio.');

  // Aviso, não reserva: entre este instante e a confirmação outra pessoa pode
  // levar a última unidade, e é a confirmação que decide.
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    const psnap = await getDoc(doc(db, COL_PRODUCTS, item.product_id));
    if (!psnap.exists()) throw new Error(`Produto ${item.product_id} não existe.`);
    const p = psnap.data();
    if (!hasStock(p, item.quantity || 1)) throw new Error(`Estoque insuficiente para ${p.name}.`);
  }

  const total = calculateCartTotal(items);
  const saleId = doc(collection(db, COL_SALES)).id;
  const participantes = Array.isArray(splitWith) ? splitWith.filter(Boolean) : [];
  const splits = participantes.length > 1 ? splitAmount(total, participantes) : null;
  const minhaParte = splits
    ? (splits.find((x) => x.user_id === user.uid)?.amount ?? 0)
    : total;

  await setDoc(doc(db, COL_SALES, saleId), {
    id: saleId,
    arena_id: arenaId,
    buyer_id: user.uid,
    buyer_name: displayName(user, profile),
    items,
    total,
    payment_method: paymentMethod,
    status: SALE_STATUS.PENDING,
    split_with: participantes,
    split_details: splits,
    stock_applied: false,
    created_at: serverTimestamp(),
    // 🐞 Sem isto a ordenação da lista de vendas era sempre zero.
    created_at_ms: Date.now(),
    updated_at: serverTimestamp(),
  });

  // Só o pagamento do PRÓPRIO comprador: a regra recusa `payer_id` de outra
  // pessoa, e num lote atômico essa recusa derrubava até o dele.
  if (minhaParte > 0) {
    await setDoc(doc(db, COL_PAYMENTS, `${saleId}_${user.uid}`), {
      id: `${saleId}_${user.uid}`,
      sale_id: saleId,
      arena_id: arenaId,
      payer_id: user.uid,
      amount: minhaParte,
      payment_method: paymentMethod,
      status: SALE_STATUS.PENDING,
      created_at: serverTimestamp(),
      created_at_ms: Date.now(),
    });
  }

  // Os outros são AVISADOS para pagar a parte deles. Sem o aviso, "dividir a
  // conta" seria o comprador cobrando os amigos por fora — que é justamente o
  // que a funcionalidade promete resolver.
  const outros = participantes.filter((uid) => uid !== user.uid);
  if (outros.length > 0) {
    try {
      await notifyUsers(outros, {
        title: 'Sua parte da conta',
        message: `${displayName(user, profile)} dividiu uma compra com você. Toque para pagar sua parte.`,
        type: NOTIFICATION_TYPE.GENERIC,
        link: `/arenas/${arenaId}/loja`,
        actor: user,
      });
    } catch (err) {
      logger.info('Falha ao avisar quem divide a conta', { err: err?.code });
    }
  }

  await createAuditLog({
    action: 'arena_sale_created',
    actor: user,
    details: { arena_id: arenaId, sale_id: saleId, total, dividida: outros.length > 0 },
  });
  return saleId;
}

/** A minha parte numa venda dividida. `null` quando não estou nela. */
export function myShareOf(sale, uid) {
  if (!sale || !uid) return null;
  if (!Array.isArray(sale.split_details) || sale.split_details.length === 0) {
    return sale.buyer_id === uid ? Number(sale.total) || 0 : null;
  }
  const meu = sale.split_details.find((x) => x?.user_id === uid);
  return meu ? Number(meu.amount) || 0 : null;
}

/**
 * Pago a MINHA parte de uma conta dividida.
 *
 * Cada pessoa grava o próprio documento (`payer_id == eu`), que é o que a
 * regra permite. Idempotente: pagar duas vezes não cria dois documentos.
 */
export async function payMyShare(saleId, user) {
  if (!saleId || !user?.uid) throw new Error('Parâmetros obrigatórios.');
  const snap = await getDoc(doc(db, COL_SALES, saleId));
  if (!snap.exists()) throw new Error('Compra não encontrada.');
  const sale = { id: snap.id, ...snap.data() };

  const valor = myShareOf(sale, user.uid);
  if (valor == null) throw new Error('Você não faz parte desta conta.');

  const payId = `${saleId}_${user.uid}`;
  const jaTem = await getDoc(doc(db, COL_PAYMENTS, payId));
  if (jaTem.exists()) return payId;

  await setDoc(doc(db, COL_PAYMENTS, payId), {
    id: payId,
    sale_id: saleId,
    arena_id: sale.arena_id,
    payer_id: user.uid,
    amount: valor,
    payment_method: sale.payment_method || PAYMENT_METHOD.PIX,
    status: SALE_STATUS.PENDING,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  });
  await createAuditLog({
    action: 'arena_sale_share_registered',
    actor: user,
    details: { arena_id: sale.arena_id, sale_id: saleId, amount: valor },
  });
  return payId;
}

/**
 * A arena ENTREGA a compra: baixa o estoque e conclui a venda.
 *
 * É aqui que o estoque sai — e não na compra. O motivo é o mesmo das horas de
 * pacote: reservar o que a arena ainda não entregou conta uma venda que pode
 * não acontecer, e a regra do Firestore não deixaria o atleta escrever
 * `arena_products` de qualquer forma.
 *
 * A conferência é refeita: entre a compra e a entrega outra pessoa pode ter
 * levado a última unidade.
 */
export async function confirmSale(saleId, actor) {
  if (!saleId) throw new Error('saleId obrigatório.');
  const ref = doc(db, COL_SALES, saleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Venda não encontrada.');
  const sale = { id: snap.id, ...snap.data() };
  if (sale.status === SALE_STATUS.CANCELLED) throw new Error('Esta venda foi cancelada.');
  if (sale.stock_applied) return;

  const itens = Array.isArray(sale.items) ? sale.items : [];
  for (const item of itens) {
    // eslint-disable-next-line no-await-in-loop
    const psnap = await getDoc(doc(db, COL_PRODUCTS, item.product_id));
    if (!psnap.exists()) continue;
    const p = psnap.data();
    if (!hasStock(p, item.quantity || 1)) {
      throw new Error(`Acabou o estoque de ${p.name} — ajuste a compra antes de entregar.`);
    }
  }

  const batch = writeBatch(db);
  itens.forEach((item) => {
    batch.update(doc(db, COL_PRODUCTS, item.product_id), {
      stock: increment(-(item.quantity || 1)),
      sold_count: increment(item.quantity || 1),
      updated_at: serverTimestamp(),
    });
  });
  batch.update(ref, {
    stock_applied: true,
    delivered_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await batch.commit();

  await createAuditLog({
    action: 'arena_sale_confirmed',
    actor,
    details: { arena_id: sale.arena_id, sale_id: saleId, total: sale.total },
  });
}

/**
 * Cancela a venda — e devolve o estoque se ele já tinha saído.
 *
 * Sem a devolução, cancelar uma entrega feita por engano tiraria produto do
 * estoque para sempre, e o inventário só apareceria errado na contagem.
 */
export async function cancelSale(saleId, motivo, actor) {
  if (!saleId) return;
  const ref = doc(db, COL_SALES, saleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const sale = { id: snap.id, ...snap.data() };
  if (sale.status === SALE_STATUS.CANCELLED) return;

  const batch = writeBatch(db);
  if (sale.stock_applied) {
    (sale.items || []).forEach((item) => {
      batch.update(doc(db, COL_PRODUCTS, item.product_id), {
        stock: increment(item.quantity || 1),
        sold_count: increment(-(item.quantity || 1)),
        updated_at: serverTimestamp(),
      });
    });
  }
  batch.update(ref, {
    status: SALE_STATUS.CANCELLED,
    stock_applied: false,
    cancel_reason: str(motivo).slice(0, 200),
    updated_at: serverTimestamp(),
  });
  await batch.commit();

  await createAuditLog({
    action: 'arena_sale_cancelled',
    actor,
    details: { arena_id: sale.arena_id, sale_id: saleId, devolveu_estoque: Boolean(sale.stock_applied) },
  });
}

/** Lista vendas da arena. Query simples por arena_id, ordenação em memória. */
export async function listArenaSales(arenaId, { limit: lim = 200 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_SALES), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => quando(b) - quando(a))
    .slice(0, lim);
}

/** Lista vendas do user. Query simples, ordenação em memória. */
export async function listUserSales(userId, { limit: lim = 100 } = {}) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL_SALES), where('buyer_id', '==', userId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => quando(b) - quando(a))
    .slice(0, lim);
}

/* ----------------------- Payments ---------------------- */

/** Lista pagamentos da arena. Query simples, ordenação em memória. */
export async function listArenaPayments(arenaId, { limit: lim = 200 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_PAYMENTS), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => quando(b) - quando(a))
    .slice(0, lim);
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
    // 🐞 Filtrava só por `sale_id`, e a regra deixa a arena ler conferindo o
    // `arena_id`: a consulta era recusada e a confirmação quebrava no meio —
    // o pagamento ficava "pago" e a VENDA nunca. Os dois filtros (só
    // igualdades: sem índice composto).
    const allPays = await getDocs(query(
      collection(db, COL_PAYMENTS),
      where('arena_id', '==', psnap.data().arena_id),
      where('sale_id', '==', saleId),
    ));
    const allPaid = allPays.docs.every((d) => d.id === paymentId || d.data().status === SALE_STATUS.PAID);
    if (allPaid) {
      await updateDoc(saleRef, { status: SALE_STATUS.PAID, paid_at: serverTimestamp(), updated_at: serverTimestamp() });
    }
  }
  await createAuditLog({ action: 'arena_payment_confirmed', actor, details: { payment_id: paymentId } });
}
