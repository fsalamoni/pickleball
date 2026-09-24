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
 *
 * ## Um cadastro de produto só (2026-09-24)
 *
 * A loja do app passou a vender os produtos do **Mercado** (`catalog:
 * 'mercado'` na venda — ver `domain/shop.js`):
 *
 *  - o pedido é precificado pelo BANCO (`sale_price` do Mercado), nunca pelo
 *    que veio da tela, e só com produtos DESTA arena;
 *  - a arena é **avisada** do pedido, com o caminho direto para a aba de
 *    pedidos — antes o pedido só aparecia se alguém abrisse a tela da loja;
 *  - a **entrega** vira saída do Mercado (tipo venda, com o comprador) numa
 *    transação que confere de novo se o pedido já foi entregue: dois cliques
 *    no balcão não baixam o estoque duas vezes;
 *  - o **cancelamento** apaga as saídas daquele pedido (achadas pelo
 *    `sale_id`, nunca por uma lista que veio no documento), cancela os
 *    pagamentos em aberto e avisa quem pediu;
 *  - quem pediu pode **desistir** enquanto o pedido não foi entregue e não é
 *    dividido (a regra confere as duas coisas).
 *
 * Vendas antigas (sem `catalog`) seguem o caminho de sempre, em
 * `arena_products`.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, serverTimestamp, writeBatch, increment, runTransaction,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  splitAmount, hasStock, SALE_STATUS, PAYMENT_METHOD,
} from '../domain/pdv.js';
import { ARENA_COLLECTIONS } from '../domain/constants.js';
import { normalizeInventoryExit } from '../domain/inventory.js';
import {
  SHOP_CATALOG, shopProducts, priceCartFromCatalog, exitsForSale, stockDriftFixes,
  trackedStock, quantitiesByProduct, isSaleFullyPaid,
} from '../domain/shop.js';
import { todayISO } from '../domain/calendar.js';
import { formatPrice } from '../domain/pricing.js';
import {
  listInventoryProducts, listInventoryEntries, listInventoryExits, listArenaManagerIds,
} from './arenaService.js';

const COL_PRODUCTS = 'arena_products';
const COL_SALES = 'arena_sales';
const COL_PAYMENTS = 'arena_payments';
const COL_INV_PRODUCTS = ARENA_COLLECTIONS.inventory_products;
const COL_INV_EXITS = ARENA_COLLECTIONS.inventory_exits;

/** Quantas pessoas cabem numa conta dividida — uma mesa, não um grupo inteiro. */
const MAX_SPLIT = 12;

/** "2× Água, 1× Grip" — curto, para caber num aviso. */
function resumoDosItens(items = []) {
  const txt = (items || []).map((i) => `${i.quantity}× ${str(i.name)}`).join(', ');
  return txt.length > 90 ? `${txt.slice(0, 87)}…` : txt;
}

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

/* ----------------------- Loja do app (produtos do Mercado) ---------------------- */

/**
 * A vitrine da loja do app: os produtos do Mercado marcados "Vender pelo app".
 * Exige login — a regra só deixa conta autenticada ler o Mercado.
 */
export async function listShopProducts(arenaId) {
  if (!db || !arenaId) return [];
  return shopProducts(await listInventoryProducts(arenaId));
}

/**
 * A arena acerta a cópia do estoque que a loja lê (`stock_qty`), para TODOS
 * os produtos à venda pelo app, de uma vez. Grava só o que diverge.
 *
 * É a rede de segurança da cópia: cada entrada e saída já a atualiza
 * (`refreshShopStock`), mas uma edição fora desse caminho, ou um produto
 * antigo, só se acerta aqui. Roda quando a arena abre os pedidos.
 *
 * @returns {Promise<number>} quantos produtos foram acertados
 */
export async function syncShopStock(arenaId) {
  if (!db || !arenaId) return 0;
  const [produtos, entradas, saidas] = await Promise.all([
    listInventoryProducts(arenaId),
    listInventoryEntries(arenaId),
    listInventoryExits(arenaId),
  ]);
  const acertos = stockDriftFixes(produtos, entradas, saidas);
  if (acertos.length === 0) return 0;
  const batch = writeBatch(db);
  acertos.forEach(({ id, stock_qty: estoque }) => {
    batch.update(doc(db, COL_INV_PRODUCTS, id), { stock_qty: estoque, updated_at: serverTimestamp() });
  });
  await batch.commit();
  return acertos.length;
}

/** Lê os produtos do Mercado citados, só os DESTA arena. */
async function produtosDaArena(arenaId, ids) {
  const snaps = await Promise.all([...new Set(ids)].map((id) => getDoc(doc(db, COL_INV_PRODUCTS, id))));
  const porId = new Map();
  snaps.forEach((snap) => {
    if (!snap.exists()) return;
    const p = { id: snap.id, ...snap.data() };
    // Produto de OUTRA arena não entra no pedido desta — nem por engano, nem
    // por um carrinho montado à mão.
    if (p.arena_id === arenaId) porId.set(p.id, p);
  });
  return porId;
}

/* ----------------------- Sales ---------------------- */

/**
 * O atleta faz um pedido na loja do app.
 *
 * O pedido nasce **pendente** e NÃO baixa estoque: quem baixa é a entrega. O
 * preço é o do **Mercado** naquele instante — a tela manda produto e
 * quantidade, e só —, e o estoque é conferido como aviso (quem decide é a
 * entrega, porque entre um e outro alguém pode levar a última unidade).
 *
 * @param {string} arenaId
 * @param {Array<{product_id: string, quantity: number}>} items
 * @param {string} paymentMethod
 * @param {Array<string>} splitWith uids que dividem a conta (inclusive o comprador)
 */
export async function createSale(arenaId, items, paymentMethod, splitWith, user, profile) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  if (!user?.uid) throw new Error('Faça login.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Carrinho vazio.');

  const pedidos = [...quantitiesByProduct(items)].map(([product_id, quantity]) => ({ product_id, quantity }));
  const porId = await produtosDaArena(arenaId, pedidos.map((i) => i.product_id));
  const conta = priceCartFromCatalog(pedidos, porId);
  if (!conta.ok) throw new Error(conta.error);
  const { items: itens, total } = conta;

  const arenaSnap = await getDoc(doc(db, ARENA_COLLECTIONS.arenas, arenaId)).catch(() => null);
  const arenaName = arenaSnap?.exists?.() ? str(arenaSnap.data().name).slice(0, 80) : '';

  const metodo = Object.values(PAYMENT_METHOD).includes(paymentMethod) ? paymentMethod : PAYMENT_METHOD.PIX;
  const saleId = doc(collection(db, COL_SALES)).id;
  // O comprador SEMPRE entra na divisão, uma vez só.
  const outrosPedidos = (Array.isArray(splitWith) ? splitWith : []).filter((uid) => uid && uid !== user.uid);
  const participantes = outrosPedidos.length > 0 ? [...new Set([user.uid, ...outrosPedidos])] : [];
  if (participantes.length > MAX_SPLIT) throw new Error(`Divida entre no máximo ${MAX_SPLIT} pessoas.`);
  const splits = participantes.length > 1 ? splitAmount(total, participantes) : null;
  const minhaParte = splits
    ? (splits.find((x) => x.user_id === user.uid)?.amount ?? 0)
    : total;
  const nome = displayName(user, profile);

  await setDoc(doc(db, COL_SALES, saleId), {
    id: saleId,
    arena_id: arenaId,
    arena_name: arenaName,
    catalog: SHOP_CATALOG,
    buyer_id: user.uid,
    buyer_name: nome,
    items: itens,
    total,
    payment_method: metodo,
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
      payment_method: metodo,
      status: SALE_STATUS.PENDING,
      created_at: serverTimestamp(),
      created_at_ms: Date.now(),
    });
  }

  // A ARENA é avisada. Sem isto o pedido só aparecia para quem abrisse a tela
  // da loja por acaso — e o atleta chegava ao balcão sem nada separado.
  try {
    const gestores = await listArenaManagerIds(arenaId);
    await notifyUsers(gestores, {
      title: 'Novo pedido na loja',
      message: `${nome} pediu ${resumoDosItens(itens)} (${formatPrice(total)}). Separe para entregar no balcão.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/arenas/${arenaId}/gerir?aba=pedidos`,
      actor: user,
    });
  } catch (err) {
    logger.info('Falha ao avisar a arena do pedido', { err: err?.code });
  }

  // Os outros são AVISADOS para pagar a parte deles. Sem o aviso, "dividir a
  // conta" seria o comprador cobrando os amigos por fora — que é justamente o
  // que a funcionalidade promete resolver.
  const outros = participantes.filter((uid) => uid !== user.uid);
  if (outros.length > 0) {
    try {
      await notifyUsers(outros, {
        title: 'Sua parte da conta',
        message: `${nome} dividiu uma compra${arenaName ? ` na ${arenaName}` : ''} com você. Toque para registrar a sua parte.`,
        type: NOTIFICATION_TYPE.GENERIC,
        link: '/minhas-reservas',
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
 *
 * 🐞 Quem dividia a conta sem ser o comprador **não conseguia ler a venda**
 * (a regra só deixava o comprador e a arena), então este `getDoc` era
 * recusado e a parte nunca era registrada. A regra passou a deixar ler quem
 * está em `split_with`.
 */
export async function payMyShare(saleId, user) {
  if (!saleId || !user?.uid) throw new Error('Parâmetros obrigatórios.');
  const snap = await getDoc(doc(db, COL_SALES, saleId));
  if (!snap.exists()) throw new Error('Compra não encontrada.');
  const sale = { id: snap.id, ...snap.data() };
  if (sale.status === SALE_STATUS.CANCELLED) throw new Error('Esta compra foi cancelada.');

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
 * Entrega de um pedido da loja do app: vira SAÍDA do Mercado.
 *
 * Uma transação: se o pedido já tiver sido entregue (dois cliques no balcão,
 * duas pessoas da equipe), nada é gravado de novo. O estoque é conferido pela
 * conta verdadeira (entradas − saídas) de quem controla estoque; produto sem
 * controle entrega sempre (ver `trackedStock`).
 */
async function entregarPedidoDoMercado(ref, sale, actor) {
  const arenaId = sale.arena_id;
  const qtd = quantitiesByProduct(sale.items);
  const [entradas, saidas, produtos] = await Promise.all([
    listInventoryEntries(arenaId),
    listInventoryExits(arenaId),
    produtosDaArena(arenaId, [...qtd.keys()]),
  ]);

  const nomeDe = (pid) => produtos.get(pid)?.name
    || (sale.items || []).find((i) => i.product_id === pid)?.name || 'um produto';
  for (const [pid, q] of qtd) {
    const estoque = trackedStock(pid, entradas, saidas);
    if (estoque != null && estoque < q) {
      throw new Error(`Acabou o estoque de ${nomeDe(pid)} (restam ${Math.max(0, estoque)}). Registre a compra no Mercado ou cancele o pedido.`);
    }
  }

  const novasSaidas = exitsForSale(sale, todayISO()).map((s) => {
    const { valid, error, value } = normalizeInventoryExit(s);
    if (!valid) throw new Error(error);
    return value;
  });

  await runTransaction(db, async (tx) => {
    const atual = await tx.get(ref);
    if (!atual.exists()) throw new Error('Pedido não encontrado.');
    const d = atual.data();
    if (d.status === SALE_STATUS.CANCELLED) throw new Error('Este pedido foi cancelado.');
    if (d.stock_applied) return; // já entregue: nada a fazer

    novasSaidas.forEach((value) => {
      tx.set(doc(collection(db, COL_INV_EXITS)), {
        ...value, arena_id: arenaId, created_by: actor?.uid || null, created_at: serverTimestamp(),
      });
    });
    // A cópia que a loja lê acompanha a entrega.
    for (const [pid, q] of qtd) {
      if (!produtos.has(pid)) continue; // saiu do Mercado: a saída fica registrada, sem cópia a acertar
      const estoque = trackedStock(pid, entradas, saidas);
      tx.update(doc(db, COL_INV_PRODUCTS, pid), {
        stock_qty: estoque == null ? null : estoque - q,
        updated_at: serverTimestamp(),
      });
    }
    tx.update(ref, {
      stock_applied: true,
      delivered_at: serverTimestamp(),
      delivered_by: actor?.uid || null,
      updated_at: serverTimestamp(),
    });
  });
}

/**
 * A arena ENTREGA a compra: baixa o estoque e conclui a venda.
 *
 * É aqui que o estoque sai — e não na compra. O motivo é o mesmo das horas de
 * pacote: reservar o que a arena ainda não entregou conta uma venda que pode
 * não acontecer, e a regra do Firestore não deixaria o atleta escrever o
 * estoque de qualquer forma.
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

  if (sale.catalog === SHOP_CATALOG) {
    await entregarPedidoDoMercado(ref, sale, actor);
  } else {
    // Venda ANTIGA, do catálogo próprio da loja (`arena_products`).
    const itens = Array.isArray(sale.items) ? sale.items : [];
    for (const item of itens) {
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
  }

  await createAuditLog({
    action: 'arena_sale_confirmed',
    actor,
    details: { arena_id: sale.arena_id, sale_id: saleId, total: sale.total },
  });
}

/**
 * A ARENA cancela a venda — e devolve o estoque se ele já tinha saído.
 *
 * Sem a devolução, cancelar uma entrega feita por engano tiraria produto do
 * estoque para sempre, e o inventário só apareceria errado na contagem. No
 * pedido do app, as saídas do Mercado daquele pedido são apagadas — achadas
 * pelo `sale_id` gravado NELAS, nunca por uma lista que veio no documento da
 * venda. Os pagamentos em aberto são cancelados junto, e quem pediu é avisado
 * com o motivo.
 */
export async function cancelSale(saleId, motivo, actor) {
  if (!saleId) return;
  const ref = doc(db, COL_SALES, saleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const sale = { id: snap.id, ...snap.data() };
  if (sale.status === SALE_STATUS.CANCELLED) return;
  const arenaId = sale.arena_id;
  const doMercado = sale.catalog === SHOP_CATALOG;

  const batch = writeBatch(db);
  if (sale.stock_applied && doMercado) {
    const [entradas, saidas, produtos] = await Promise.all([
      listInventoryEntries(arenaId),
      listInventoryExits(arenaId),
      produtosDaArena(arenaId, (sale.items || []).map((i) => i.product_id).filter(Boolean)),
    ]);
    const doPedido = saidas.filter((x) => x.sale_id === saleId);
    const restantes = saidas.filter((x) => x.sale_id !== saleId);
    doPedido.forEach((x) => batch.delete(doc(db, COL_INV_EXITS, x.id)));
    produtos.forEach((p, pid) => {
      batch.update(doc(db, COL_INV_PRODUCTS, pid), {
        stock_qty: trackedStock(pid, entradas, restantes),
        updated_at: serverTimestamp(),
      });
    });
  } else if (sale.stock_applied) {
    (sale.items || []).forEach((item) => {
      batch.update(doc(db, COL_PRODUCTS, item.product_id), {
        stock: increment(item.quantity || 1),
        sold_count: increment(-(item.quantity || 1)),
        updated_at: serverTimestamp(),
      });
    });
  }

  // Pagamento em aberto de pedido cancelado não é dívida de ninguém. Os já
  // PAGOS ficam como estão: a devolução é combinada no balcão.
  try {
    const pays = await getDocs(query(
      collection(db, COL_PAYMENTS), where('arena_id', '==', arenaId), where('sale_id', '==', saleId),
    ));
    pays.docs.forEach((d) => {
      if (d.data().status !== SALE_STATUS.PAID) {
        batch.update(d.ref, { status: SALE_STATUS.CANCELLED, updated_at: serverTimestamp() });
      }
    });
  } catch (err) {
    logger.info('Pagamentos do pedido não lidos ao cancelar', { err: err?.code });
  }

  batch.update(ref, {
    status: SALE_STATUS.CANCELLED,
    stock_applied: false,
    cancel_reason: str(motivo).slice(0, 200),
    cancelled_by: actor?.uid || null,
    updated_at: serverTimestamp(),
  });
  await batch.commit();

  const avisar = [sale.buyer_id, ...(Array.isArray(sale.split_with) ? sale.split_with : [])];
  try {
    await notifyUsers(avisar, {
      title: 'Pedido cancelado',
      message: `${sale.arena_name ? `A ${sale.arena_name}` : 'A arena'} cancelou o pedido de ${resumoDosItens(sale.items)}.${str(motivo) ? ` Motivo: ${str(motivo).slice(0, 120)}` : ''}`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-reservas',
      actor,
    });
  } catch (err) {
    logger.info('Falha ao avisar do pedido cancelado', { err: err?.code });
  }

  await createAuditLog({
    action: 'arena_sale_cancelled',
    actor,
    details: { arena_id: arenaId, sale_id: saleId, devolveu_estoque: Boolean(sale.stock_applied) },
  });
}

/**
 * Quem pediu DESISTE do pedido — enquanto ele não foi entregue e não é
 * dividido. (Conta dividida pode já ter parte paga por outra pessoa: essa
 * se cancela no balcão.) A regra confere as mesmas condições.
 */
export async function cancelMyOrder(saleId, user, profile) {
  if (!saleId || !user?.uid) throw new Error('Parâmetros obrigatórios.');
  const ref = doc(db, COL_SALES, saleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Pedido não encontrado.');
  const sale = { id: snap.id, ...snap.data() };
  if (sale.buyer_id !== user.uid) throw new Error('Só quem fez o pedido pode desistir dele.');
  if (sale.status === SALE_STATUS.CANCELLED) return;
  if (sale.stock_applied) throw new Error('Este pedido já foi entregue. Fale com a arena.');
  if (sale.status !== SALE_STATUS.PENDING) throw new Error('Este pedido já foi pago. Fale com a arena.');
  if (Array.isArray(sale.split_with) && sale.split_with.length > 1) {
    throw new Error('Conta dividida se cancela no balcão — alguém pode já ter pago a parte dele.');
  }

  const batch = writeBatch(db);
  batch.update(ref, {
    status: SALE_STATUS.CANCELLED,
    cancel_reason: 'Quem pediu desistiu',
    cancelled_by: user.uid,
    updated_at: serverTimestamp(),
  });
  const payRef = doc(db, COL_PAYMENTS, `${saleId}_${user.uid}`);
  const pay = await getDoc(payRef).catch(() => null);
  if (pay?.exists?.() && pay.data().status === SALE_STATUS.PENDING) {
    batch.update(payRef, { status: SALE_STATUS.CANCELLED, updated_at: serverTimestamp() });
  }
  await batch.commit();

  try {
    const gestores = await listArenaManagerIds(sale.arena_id);
    await notifyUsers(gestores, {
      title: 'Pedido cancelado por quem pediu',
      message: `${displayName(user, profile)} desistiu de ${resumoDosItens(sale.items)}. Não precisa separar.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/arenas/${sale.arena_id}/gerir?aba=pedidos`,
      actor: user,
    });
  } catch (err) {
    logger.info('Falha ao avisar a arena da desistência', { err: err?.code });
  }
  await createAuditLog({
    action: 'arena_sale_withdrawn',
    actor: user,
    details: { arena_id: sale.arena_id, sale_id: saleId },
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

/**
 * TODAS as minhas compras, em todas as arenas: as que eu fiz E as que
 * dividem a conta comigo. Duas consultas, cada uma pelo campo que a regra
 * confere (`buyer_id`, e `split_with` para quem divide).
 */
export async function listMyShopSales(userId, { limit: lim = 100 } = {}) {
  if (!db || !userId) return [];
  const [compras, divididas] = await Promise.all([
    getDocs(query(collection(db, COL_SALES), where('buyer_id', '==', userId))),
    getDocs(query(collection(db, COL_SALES), where('split_with', 'array-contains', userId))),
  ]);
  const porId = new Map();
  [...compras.docs, ...divididas.docs].forEach((d) => porId.set(d.id, { id: d.id, ...d.data() }));
  return [...porId.values()].sort((a, b) => quando(b) - quando(a)).slice(0, lim);
}

/** Os MEUS pagamentos (partes de conta), para saber o que já registrei. */
export async function listMyPayments(userId) {
  if (!db || !userId) return [];
  const snap = await getDocs(query(collection(db, COL_PAYMENTS), where('payer_id', '==', userId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

/**
 * Fecha o pedido como PAGO quando todas as partes estão pagas.
 *
 * 🐞 Antes contava só os documentos de pagamento que existiam: numa conta
 * dividida em que os amigos ainda não tinham registrado a parte, confirmar o
 * pagamento do comprador declarava a conta inteira paga. Quem deve pagar sai
 * do PEDIDO (`saleShares`), não dos pagamentos.
 */
async function fecharPedidoSePago(saleId, arenaId) {
  const saleRef = doc(db, COL_SALES, saleId);
  const saleSnap = await getDoc(saleRef);
  if (!saleSnap.exists()) return;
  const sale = { id: saleSnap.id, ...saleSnap.data() };
  if (sale.status === SALE_STATUS.CANCELLED || sale.status === SALE_STATUS.PAID) return;
  // 🐞 (anterior) Filtrava só por `sale_id`, e a regra deixa a arena ler
  // conferindo o `arena_id`: a consulta era recusada e a confirmação quebrava
  // no meio. Os dois filtros (só igualdades: sem índice composto).
  const pays = await getDocs(query(
    collection(db, COL_PAYMENTS),
    where('arena_id', '==', arenaId),
    where('sale_id', '==', saleId),
  ));
  const pagamentos = pays.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (isSaleFullyPaid(sale, pagamentos)) {
    await updateDoc(saleRef, { status: SALE_STATUS.PAID, paid_at: serverTimestamp(), updated_at: serverTimestamp() });
  }
}

/** A arena confirma que RECEBEU um pagamento registrado. */
export async function confirmPayment(paymentId, actor) {
  if (!paymentId) return;
  await updateDoc(doc(db, COL_PAYMENTS, paymentId), {
    status: SALE_STATUS.PAID,
    paid_at: serverTimestamp(),
    confirmed_by: actor?.uid || null,
    updated_at: serverTimestamp(),
  });
  const psnap = await getDoc(doc(db, COL_PAYMENTS, paymentId));
  if (psnap.exists()) await fecharPedidoSePago(psnap.data().sale_id, psnap.data().arena_id);
  await createAuditLog({ action: 'arena_payment_confirmed', actor, details: { payment_id: paymentId } });
}

/**
 * A arena recebe NO BALCÃO a parte de alguém que ainda não a registrou pelo
 * app (pagou em dinheiro, no cartão da maquininha…). Cria o pagamento já
 * pago, em nome de quem pagou — a regra deixa a arena, e só a arena.
 */
export async function receiveShareAtCounter(saleId, payerId, actor) {
  if (!saleId || !payerId) throw new Error('Parâmetros obrigatórios.');
  const snap = await getDoc(doc(db, COL_SALES, saleId));
  if (!snap.exists()) throw new Error('Pedido não encontrado.');
  const sale = { id: snap.id, ...snap.data() };
  if (sale.status === SALE_STATUS.CANCELLED) throw new Error('Este pedido foi cancelado.');
  const valor = myShareOf(sale, payerId);
  if (valor == null) throw new Error('Esta pessoa não faz parte da conta.');

  const payId = `${saleId}_${payerId}`;
  await setDoc(doc(db, COL_PAYMENTS, payId), {
    id: payId,
    sale_id: saleId,
    arena_id: sale.arena_id,
    payer_id: payerId,
    amount: valor,
    payment_method: PAYMENT_METHOD.CASH,
    status: SALE_STATUS.PAID,
    paid_at: serverTimestamp(),
    confirmed_by: actor?.uid || null,
    received_at_counter: true,
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  }, { merge: true });
  await fecharPedidoSePago(saleId, sale.arena_id);
  await createAuditLog({
    action: 'arena_payment_received_at_counter',
    actor,
    details: { arena_id: sale.arena_id, sale_id: saleId, payer_id: payerId, amount: valor },
  });
}
