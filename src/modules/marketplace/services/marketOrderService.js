/**
 * MERCADO — pedidos, ofertas, avaliações e disputas.
 *
 * Tudo isso é ESCRITO só pelo servidor (`functions/marketplace.js`): estoque,
 * preço e Pix são conferidos numa transação, e o navegador nunca grava um
 * pedido. Aqui ficam as chamadas às funções e as leituras (pelo campo que a
 * regra confere: `buyer_uid` ou `seller_key`).
 */
import { httpsCallable } from 'firebase/functions';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db, functions } from '@/core/config/firebase';
import { MARKET_COLLECTIONS as C } from '../domain/constants.js';
import { t } from '@/core/i18n';

const toDoc = (d) => ({ id: d.id, ...d.data() });
// Pedidos e ofertas gravam `placed_at_ms`/`created_at` (do servidor), não `created_at_ms`.
const quando = (x) => Number(x.created_at_ms || x.placed_at_ms || x.created_at?.toMillis?.() || 0);
const recentes = (xs) => xs.sort((a, b) => quando(b) - quando(a));

/** A frase certa para o erro do servidor (a mensagem dele já é em pt-BR). */
export function marketCallError(err) {
  const code = String(err?.code || '').replace('functions/', '');
  if (code === 'unimplemented') return t('Esta parte do Mercado ainda está sendo publicada. Tente de novo em alguns minutos.');
  if (code === 'unavailable' || code === 'deadline-exceeded') return t('O servidor não respondeu. Confira a conexão e tente de novo: nada foi cobrado.');
  if (code === 'internal') return t('O servidor falhou ao processar. Tente de novo.');
  if (code === 'unauthenticated') return t('Entre na sua conta.');
  return err?.message || t('Não foi possível concluir.');
}

async function chamar(nome, payload) {
  if (!functions) throw new Error(t('Firebase não está configurado neste ambiente.'));
  try {
    const { data } = await httpsCallable(functions, nome, { timeout: 60_000 })(payload);
    return data;
  } catch (err) {
    const e = new Error(marketCallError(err));
    e.code = err?.code;
    throw e;
  }
}

/**
 * Fecha o carrinho: um pedido por vendedor. Devolve `{ orders, failures }` —
 * um vendedor com problema não derruba os outros.
 * @param {{ groups: Array<{ seller_key, fulfillment, buyer_note?, items: Array<{ listing_id, quantity, expected_price_cents }> }>, shipping?: object }} p
 */
export const placeOrders = (p) => chamar('marketPlaceOrders', p);

/** Uma ação do pedido (aceitar, pagar, enviar, receber, cancelar, disputar…). */
export const orderAction = (p) => chamar('marketOrderAction', p);

/** Oferta: create | accept | decline | counter | accept_counter | counter_back | withdraw. */
export const offerAction = (p) => chamar('marketOfferAction', p);

export const submitReview = (p) => chamar('marketSubmitReview', p);

/** Vale-presente: buy | claim | issue | cancel (o servidor decide e grava). */
export const giftCardAction = (p) => chamar('marketGiftCardAction', p);

/** Liga o anúncio da arena a um produto do estoque dela (`productId: null` desliga). */
export const linkArenaProduct = (p) => chamar('marketLinkArenaProduct', p);

/* ------------------------------------------------------------- leituras -- */

export async function listMyOrders(uid) {
  const q = query(collection(db, C.orders), where('buyer_uid', '==', uid));
  return recentes((await getDocs(q)).docs.map(toDoc));
}

export async function listSellerOrders(key) {
  const q = query(collection(db, C.orders), where('seller_key', '==', key));
  return recentes((await getDocs(q)).docs.map(toDoc));
}

export async function getOrder(id) {
  const snap = await getDoc(doc(db, C.orders, id));
  return snap.exists() ? toDoc(snap) : null;
}

export async function listOrderEvents(id) {
  const snap = await getDocs(collection(db, C.orders, id, 'events'));
  return snap.docs.map(toDoc).sort((a, b) => (a.at_ms || 0) - (b.at_ms || 0));
}

/** Endereço de entrega: o comprador sempre; o vendedor depois de aceitar. */
export async function getOrderShipping(id) {
  const snap = await getDoc(doc(db, C.orders, id, 'private', 'shipping'));
  return snap.exists() ? snap.data() : null;
}

export async function listMyOffers(uid) {
  const q = query(collection(db, C.offers), where('buyer_uid', '==', uid));
  return recentes((await getDocs(q)).docs.map(toDoc));
}

export async function listSellerOffers(key) {
  const q = query(collection(db, C.offers), where('seller_key', '==', key));
  return recentes((await getDocs(q)).docs.map(toDoc));
}

export async function getOffer(id) {
  const snap = await getDoc(doc(db, C.offers, id));
  return snap.exists() ? toDoc(snap) : null;
}

/** As avaliações visíveis de um vendedor. */
export async function listSellerReviews(key) {
  const q = query(collection(db, C.reviews), where('seller_key', '==', key), where('visible', '==', true));
  return recentes((await getDocs(q)).docs.map(toDoc));
}

/** A resposta pública do vendedor a uma avaliação de comprador (só a regra decide quem pode). */
export async function replyReview(review, { uid, text }) {
  const reply = String(text || '').trim().slice(0, 500);
  if (reply.length < 2) throw new Error(t('Escreva a resposta.'));
  await updateDoc(doc(db, C.reviews, review.id), { reply, reply_at_ms: Date.now(), reply_by: uid });
  return reply;
}

/** O que vendedores disseram de quem compra (só as reveladas). */
export async function listBuyerReviews(uid) {
  const q = query(collection(db, C.reviews), where('target_uid', '==', uid), where('visible', '==', true));
  return recentes((await getDocs(q)).docs.map(toDoc));
}

export async function listMyReviews(uid) {
  const q = query(collection(db, C.reviews), where('author_uid', '==', uid));
  return recentes((await getDocs(q)).docs.map(toDoc));
}

/** As duas avaliações do pedido que eu posso ler (a minha e a outra, se revelada). */
export async function getOrderReviews(orderId) {
  const r = await Promise.allSettled(['buyer', 'seller'].map((role) => getDoc(doc(db, C.reviews, `${orderId}_${role}`))));
  const out = {};
  ['buyer', 'seller'].forEach((role, i) => {
    if (r[i].status === 'fulfilled' && r[i].value.exists()) out[role] = toDoc(r[i].value);
  });
  return out;
}

export async function getDispute(orderId) {
  const snap = await getDoc(doc(db, C.disputes, orderId));
  return snap.exists() ? toDoc(snap) : null;
}

/** Admin: as disputas abertas. */
export async function listOpenDisputes() {
  const q = query(collection(db, C.disputes), where('status', '==', 'open'));
  return recentes((await getDocs(q)).docs.map(toDoc));
}

/** Admin: todos os pedidos de um estado. */
export async function listOrdersByStatus(statuses) {
  const q = query(collection(db, C.orders), where('status', 'in', statuses));
  return recentes((await getDocs(q)).docs.map(toDoc));
}
