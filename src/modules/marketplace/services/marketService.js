/**
 * MERCADO — leitura e escrita direta no Firestore: vendedores, anúncios,
 * perguntas, favoritos, buscas salvas, carrinho e a configuração do admin.
 *
 * Pedido, oferta, avaliação e disputa NÃO passam por aqui: são escritos só
 * pelo servidor (`marketOrderService.js`). A REGRA é a defesa; este serviço
 * monta o documento que ela aceita e diz antes, com a frase certa, o que
 * seria recusado.
 *
 * Toda consulta é de igualdade/`in` — nenhum índice composto; a ordenação é
 * em memória (`domain/search.js`).
 */
import {
  collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp,
  setDoc, updateDoc, where, addDoc,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { MARKET_COLLECTIONS as C, MARKET_SETTINGS_DOC, PUBLIC_LISTING_STATUSES, REPORT_REASON_LABELS, SELLER_STATUS, SELLER_TYPE } from '../domain/constants.js';
import { validateListingInput } from '../domain/listing.js';
import { normalizeMarketSettings, findBannedTerm, validateQuestion, validateAnswer } from '../domain/settings.js';
import { sellerKeyFor, sellerReviewNotice, validatePayment, validateStoreApplication } from '../domain/seller.js';
import { createAuditLog } from '@/core/services/auditService';
import { couponDocId, giftCardConfig, normalizeCouponCode, validateCouponInput } from '../domain/promotions.js';
import { notifyUsers } from '@/core/services/notificationService';

const toDoc = (d) => ({ id: d.id, ...d.data() });

/** Erro de validação com os erros por campo (o formulário mostra cada um no lugar). */
export class MarketError extends Error {
  constructor(message, fieldErrors = {}) {
    super(message);
    this.name = 'MarketError';
    this.fieldErrors = fieldErrors;
  }
}

/** ponytail: teto da vitrine lida de uma vez; paginar por categoria quando passar disso. */
export const FEED_LIMIT = 600;

/* ------------------------------------------------------- configuração -- */

export async function getMarketSettings() {
  const snap = await getDoc(doc(db, 'platform_settings', MARKET_SETTINGS_DOC));
  return normalizeMarketSettings(snap.exists() ? snap.data() : {});
}

export async function saveMarketSettings(input, { uid } = {}) {
  const value = normalizeMarketSettings(input);
  await setDoc(doc(db, 'platform_settings', MARKET_SETTINGS_DOC), { ...value, updated_at: serverTimestamp(), updated_by: uid || null }, { merge: true });
  return value;
}

/* ---------------------------------------------------------- vendedores -- */

export async function getSeller(key) {
  if (!key) return null;
  const snap = await getDoc(doc(db, C.sellers, key));
  return snap.exists() ? toDoc(snap) : null;
}

export async function getSellers(keys = []) {
  const unicos = [...new Set(keys.filter(Boolean))];
  const lidos = await Promise.all(unicos.map(getSeller));
  return Object.fromEntries(lidos.filter(Boolean).map((s) => [s.id, s]));
}

/** As lojas (para o admin aprovar) — todas; o filtro de estado é em memória. */
export async function listStores() {
  const q = query(collection(db, C.sellers), where('seller_type', '==', SELLER_TYPE.STORE));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Pix e dados internos — só quem opera o vendedor e o admin leem. */
export async function getSellerPrivate(key) {
  const snap = await getDoc(doc(db, C.sellers, key, 'private', 'data'));
  return snap.exists() ? snap.data() : null;
}

/**
 * Cria (se não existe) a ficha de quem vende como atleta, professor ou arena.
 * A loja tem cadastro próprio (`applyStore`), que vai para análise.
 */
export async function ensureSeller({ type, entityId, uid, displayName, city = '', state = '', photoUrl = '' }) {
  const key = sellerKeyFor(type, entityId);
  if (!key || type === SELLER_TYPE.STORE) throw new MarketError('Tipo de vendedor inválido.');
  const atual = await getSeller(key);
  if (atual) return atual;
  const name = String(displayName || '').trim().slice(0, 60);
  if (name.length < 2) throw new MarketError('Diga o nome que aparece para os compradores.');
  const data = {
    seller_key: key, seller_type: type, entity_id: entityId, owner_uid: uid, status: SELLER_STATUS.ACTIVE,
    display_name: name, city, state, logo_url: photoUrl || '', bio: '',
    created_at: serverTimestamp(), updated_at: serverTimestamp(),
  };
  await setDoc(doc(db, C.sellers, key), data);
  return { id: key, ...data };
}

/** A vitrine do vendedor: nome, descrição, logo, capa, políticas. */
export async function updateSellerProfile(key, input = {}) {
  const patch = {};
  if (input.display_name != null) {
    const n = String(input.display_name).trim();
    if (n.length < 2 || n.length > 60) throw new MarketError('Nome entre 2 e 60 caracteres.', { display_name: 'Nome entre 2 e 60 caracteres.' });
    patch.display_name = n;
  }
  ['bio', 'city', 'state', 'logo_url', 'banner_url', 'website'].forEach((k) => {
    if (input[k] != null) patch[k] = String(input[k]).trim().slice(0, k === 'bio' ? 600 : 300);
  });
  if (input.policies) patch.policies = input.policies;
  patch.updated_at = serverTimestamp();
  await updateDoc(doc(db, C.sellers, key), patch);
  // O nome vai copiado em cada anúncio (a vitrine não lê a ficha de cada um).
  if (patch.display_name) {
    const anuncios = await listSellerListings(key);
    await Promise.all(anuncios.filter((l) => l.seller_name !== patch.display_name && l.status !== 'removed')
      .map((l) => updateDoc(doc(db, C.listings, l.id), { seller_name: patch.display_name })));
  }
}

export async function savePayment(key, input) {
  const r = validatePayment(input);
  if (!r.ok) throw new MarketError('Confira os dados do Pix.', r.errors);
  await setDoc(doc(db, C.sellers, key, 'private', 'data'), { ...r.value, updated_at: serverTimestamp() }, { merge: true });
  return r.value;
}

/** "Abrir minha loja": vai para análise do admin. A recusada pode pedir de novo. */
export async function applyStore(uid, input) {
  const r = validateStoreApplication(input);
  if (!r.ok) throw new MarketError('Confira os dados da loja.', r.errors);
  const key = sellerKeyFor(SELLER_TYPE.STORE, uid);
  const atual = await getSeller(key);
  if (atual && atual.status !== SELLER_STATUS.REJECTED) throw new MarketError('Você já tem uma loja cadastrada.');
  if (atual) {
    await updateDoc(doc(db, C.sellers, key), { ...r.public, status: SELLER_STATUS.PENDING, reject_reason: null, updated_at: serverTimestamp() });
  } else {
    await setDoc(doc(db, C.sellers, key), {
      ...r.public, seller_key: key, seller_type: SELLER_TYPE.STORE, entity_id: uid, owner_uid: uid,
      status: SELLER_STATUS.PENDING, logo_url: '', created_at: serverTimestamp(), updated_at: serverTimestamp(),
    });
  }
  await setDoc(doc(db, C.sellers, key, 'private', 'data'), { ...r.private, updated_at: serverTimestamp() }, { merge: true });
  return key;
}

/**
 * Admin: aprovar, recusar (com motivo), suspender, reativar ou verificar um
 * vendedor. Quem é afetado recebe um aviso, e fica na auditoria.
 */
export async function reviewSeller(seller, { status, reason = '', verified }, { actor }) {
  const key = seller.id || seller.seller_key;
  const patch = { reviewed_by: actor.uid, reviewed_at: serverTimestamp(), updated_at: serverTimestamp() };
  if (status) patch.status = status;
  if (status === SELLER_STATUS.REJECTED || status === SELLER_STATUS.SUSPENDED) {
    if (String(reason).trim().length < 5) throw new MarketError('Escreva o motivo (a pessoa vai ler).');
    patch.reject_reason = String(reason).trim().slice(0, 300);
  } else if (status === SELLER_STATUS.ACTIVE) {
    patch.reject_reason = null;
  }
  if (typeof verified === 'boolean') patch.verified = verified;
  await updateDoc(doc(db, C.sellers, key), patch);
  // Suspender tira os anúncios da vitrine; reativar devolve só os que a
  // suspensão tirou (o que o vendedor pausou por conta própria fica pausado).
  if (status === SELLER_STATUS.SUSPENDED || (status === SELLER_STATUS.ACTIVE && seller.status === SELLER_STATUS.SUSPENDED)) {
    const anuncios = await listSellerListings(key);
    const alvo = status === SELLER_STATUS.SUSPENDED
      ? anuncios.filter((l) => PUBLIC_LISTING_STATUSES.includes(l.status))
      : anuncios.filter((l) => l.admin_paused === true && l.status === 'paused');
    await Promise.all(alvo.map((l) => updateDoc(doc(db, C.listings, l.id), status === SELLER_STATUS.SUSPENDED
      ? { status: 'paused', admin_paused: true, paused_from: l.status, updated_at: serverTimestamp() }
      : { status: l.paused_from === 'sold_out' ? 'sold_out' : 'active', admin_paused: false, updated_at: serverTimestamp() })));
  }
  await createAuditLog({
    action: 'market_seller_review', actor, userId: seller.owner_uid || null,
    details: { seller_key: key, status: status || null, verified: typeof verified === 'boolean' ? verified : null, reason: patch.reject_reason || null },
  });
  const aviso = sellerReviewNotice(seller, { status, verified, reason: patch.reject_reason });
  if (aviso && seller.owner_uid) await notifyUsers([seller.owner_uid], { ...aviso, type: 'market', actor });
}

/* ------------------------------------------------------------ anúncios -- */

/** A vitrine pública: no ar e esgotados. */
export async function listPublicListings() {
  const q = query(collection(db, C.listings), where('status', 'in', [...PUBLIC_LISTING_STATUSES]), limit(FEED_LIMIT));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Tudo de um vendedor (para quem o opera: inclui rascunho e pausado). */
export async function listSellerListings(key, { publicOnly = false } = {}) {
  const wh = [where('seller_key', '==', key)];
  if (publicOnly) wh.push(where('status', 'in', [...PUBLIC_LISTING_STATUSES]));
  return (await getDocs(query(collection(db, C.listings), ...wh))).docs.map(toDoc);
}

/** Admin: os anúncios marcados pela moderação ou removidos. */
export async function listListingsByStatus(statuses) {
  const q = query(collection(db, C.listings), where('status', 'in', statuses), limit(FEED_LIMIT));
  return (await getDocs(q)).docs.map(toDoc);
}

/** Anúncio que a regra não deixa ler (pausado, encerrado, removido) = fora do ar, não falha. */
export const isNotPublicError = (err) => String(err?.code || '').includes('permission-denied');

/** O anúncio, ou `null` se não existe ou saiu do ar (a regra não deixa ler pausado/encerrado). */
export async function getListing(id) {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, C.listings, id));
    return snap.exists() ? toDoc(snap) : null;
  } catch (err) {
    if (isNotPublicError(err)) return null;
    throw err;
  }
}

/**
 * Vários anúncios por id. No mapa: o anúncio; `null` = não existe ou saiu do
 * ar; AUSENTE = a leitura falhou (a tela não pode dizer "não está mais à
 * venda" sobre uma queda de rede). Tudo falhando, a consulta falha.
 */
export async function getListings(ids = []) {
  const unicos = [...new Set(ids.filter(Boolean))];
  const r = await Promise.allSettled(unicos.map(getListing));
  const out = {};
  let failed = 0;
  r.forEach((x, i) => {
    if (x.status === 'fulfilled') out[unicos[i]] = x.value || null;
    else failed += 1;
  });
  if (failed && failed === unicos.length) throw new Error('Não foi possível carregar os anúncios.');
  return out;
}

/** Confere o texto contra os termos proibidos ANTES de gravar (o servidor confere de novo). */
function conferirTermos(value, settings) {
  const termo = findBannedTerm(`${value.title} ${value.description}`, settings?.banned_terms || []);
  if (termo) throw new MarketError(`O anúncio cita "${termo}", que não é permitido no Mercado.`, { title: 'Termo não permitido.' });
}

/**
 * Cria ou atualiza um anúncio. `publish` exige o mínimo para ir ao ar.
 * `seller` é a ficha (`market_sellers/{key}`) em nome de quem se vende.
 */
export async function saveListing({ id, input, publish, seller, uid, settings, keepQuantity = false }) {
  if (!seller || seller.status !== SELLER_STATUS.ACTIVE) throw new MarketError('Este vendedor não está ativo no Mercado.');
  const r = validateListingInput(input, { publish });
  if (!r.ok) throw new MarketError('Confira os campos destacados.', r.errors);
  conferirTermos(r.value, settings);
  const antes = id ? await getListing(id) : null;
  const qtd = id && keepQuantity ? Number(antes?.quantity) || 0 : r.value.quantity;
  // Sem estoque, publicar é "esgotado" (no ar, sem botão de comprar).
  const status = publish ? (qtd > 0 ? 'active' : 'sold_out') : 'draft';
  const base = { ...r.value, status, seller_name: seller.display_name, updated_at: serverTimestamp() };
  // "Chegou agora" e o aviso das buscas salvas contam da PRIMEIRA vez no ar —
  // editar um anúncio que já está no ar não o faz "novo" de novo.
  if (publish && !['active', 'sold_out'].includes(antes?.status)) base.published_at = serverTimestamp();
  // A quantidade do anúncio ligado ao estoque da arena é do servidor: o
  // formulário aberto há minutos não pode regravá-la com um número velho.
  if (id && keepQuantity) delete base.quantity;
  if (id) {
    await updateDoc(doc(db, C.listings, id), base);
    return id;
  }
  const ref = await addDoc(collection(db, C.listings), {
    ...base, seller_key: seller.seller_key || seller.id, seller_type: seller.seller_type, created_by: uid,
    created_at: serverTimestamp(), created_at_ms: Date.now(),
  });
  return ref.id;
}

/** Pausar, retomar, encerrar. `active` exige estoque (sem estoque vira esgotado). */
export async function setListingStatus(listing, status) {
  const next = status === 'active' && !(listing.quantity > 0) ? 'sold_out' : status;
  await updateDoc(doc(db, C.listings, listing.id), { status: next, updated_at: serverTimestamp() });
  return next;
}

/** Ajuste rápido de preço e estoque (na lista do vendedor). */
export async function quickEditListing(listing, { price_cents, quantity, compare_at_cents }) {
  const patch = { updated_at: serverTimestamp() };
  if (price_cents != null) {
    const p = Math.round(Number(price_cents));
    if (!(p > 0)) throw new MarketError('Informe o preço.');
    patch.price_cents = p;
    if (compare_at_cents !== undefined) {
      const c = compare_at_cents == null || compare_at_cents === '' ? null : Math.round(Number(compare_at_cents));
      if (c != null && !(c > p)) throw new MarketError('O preço "de" precisa ser maior que o preço atual.');
      patch.compare_at_cents = c;
    } else if (listing.compare_at_cents && !(listing.compare_at_cents > p)) {
      patch.compare_at_cents = null; // o "de" deixou de ser maior: sai o riscado
    }
  }
  if (quantity != null && listing.source?.kind === 'arena_product' && listing.source.tracked) {
    throw new MarketError('A quantidade deste anúncio acompanha o estoque da arena. Registre a compra no estoque da arena.');
  }
  if (quantity != null) {
    const q = Math.floor(Number(quantity));
    if (!(q >= 0 && q <= 9999)) throw new MarketError('Quantidade entre 0 e 9999.');
    patch.quantity = q;
    if (q === 0 && listing.status === 'active') patch.status = 'sold_out';
    if (q > 0 && listing.status === 'sold_out') patch.status = 'active';
  }
  await updateDoc(doc(db, C.listings, listing.id), patch);
}

/** Só o que nunca vendeu pode ser apagado (o pedido aponta para ele). */
export async function deleteListing(listing) {
  if ((listing.quantity_sold || 0) > 0) throw new MarketError('Este anúncio já vendeu: encerre em vez de apagar.');
  await deleteDoc(doc(db, C.listings, listing.id));
}

/**
 * Admin: tirar do ar (com motivo) ou devolver. Avisa quem vende, vai para a
 * auditoria e encerra as denúncias abertas do anúncio (decididas aqui).
 */
export async function moderateListing(listing, { action, reason = '' }, { uid, actor } = {}) {
  const by = uid || actor?.uid || null;
  const motivo = String(reason).trim().slice(0, 300);
  if (action === 'remove' && !motivo) throw new MarketError('Diga o motivo: quem vende vai ler.');
  const moderation = { status: action === 'remove' ? 'removed' : 'ok', reason: motivo, by, at_ms: Date.now(), auto: false };
  const patch = { moderation, updated_at: serverTimestamp() };
  if (action === 'remove') patch.status = 'removed';
  if (action === 'restore') patch.status = 'paused';
  await updateDoc(doc(db, C.listings, listing.id), patch);
  const extras = await Promise.allSettled([
    resolveListingReports(listing.id, { outcome: action === 'remove' ? 'removed' : 'kept', uid: by }),
    createAuditLog({
      action: action === 'remove' ? 'market_listing_removed' : 'market_listing_restored',
      actor: actor || { uid: by }, userId: listing.created_by || null,
      details: { listing_id: listing.id, title: listing.title, seller_key: listing.seller_key, reason: motivo },
    }),
    listing.created_by ? notifyUsers([listing.created_by], action === 'remove'
      ? { title: 'Anúncio retirado pela moderação', message: `"${String(listing.title || '').slice(0, 60)}" saiu do Mercado. Motivo: ${motivo}`, type: 'market', link: `/mercado/vender?aba=anuncios&como=${encodeURIComponent(listing.seller_key || '')}` }
      : { title: 'Anúncio liberado', message: `"${String(listing.title || '').slice(0, 60)}" foi liberado pela moderação. Ele está pausado: retome quando quiser.`, type: 'market', link: `/mercado/vender?aba=anuncios&como=${encodeURIComponent(listing.seller_key || '')}` }) : null,
  ]);
  return { warnings: extras.filter((r) => r.status === 'rejected').length };
}

/* ----------------------------------------------------------- denúncias -- */

const reportId = (listingId, uid) => `${listingId}_${uid}`;

/** A denúncia desta pessoa para este anúncio (ou `null`). */
export async function getMyReport(listingId, uid) {
  if (!listingId || !uid) return null;
  const snap = await getDoc(doc(db, C.reports, reportId(listingId, uid)));
  return snap.exists() ? toDoc(snap) : null;
}

export async function reportListing({ listing, uid, reason, text = '' }) {
  if (!REPORT_REASON_LABELS[reason]) throw new MarketError('Escolha o motivo.');
  const t = String(text || '').trim();
  if (t.length > 500) throw new MarketError('Use até 500 caracteres.');
  await setDoc(doc(db, C.reports, reportId(listing.id, uid)), {
    listing_id: listing.id,
    listing_title: String(listing.title || '').slice(0, 120),
    seller_key: listing.seller_key,
    reporter_uid: uid,
    reason,
    text: t,
    status: 'open',
    created_at: serverTimestamp(),
    created_at_ms: Date.now(),
  });
}

/** Admin: as denúncias ainda sem decisão. */
export async function listOpenReports() {
  const q = query(collection(db, C.reports), where('status', '==', 'open'));
  return (await getDocs(q)).docs.map(toDoc).sort((a, b) => (a.created_at_ms || 0) - (b.created_at_ms || 0));
}

/** Admin: fecha as denúncias abertas de um anúncio com a decisão tomada. */
export async function resolveListingReports(listingId, { outcome, uid }) {
  const q = query(collection(db, C.reports), where('listing_id', '==', listingId), where('status', '==', 'open'));
  const docs = (await getDocs(q)).docs;
  await Promise.all(docs.map((d) => updateDoc(d.ref, { status: 'resolved', outcome, resolved_by: uid || null, resolved_at_ms: Date.now() })));
  return docs.length;
}

/* ----------------------------------------------------------- perguntas -- */

export async function listQuestions(listingId) {
  const q = query(collection(db, C.questions), where('listing_id', '==', listingId), where('status', 'in', ['open', 'answered']));
  return (await getDocs(q)).docs.map(toDoc).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
}

/** As perguntas que chegaram para um vendedor (as abertas primeiro). */
export async function listSellerQuestions(key) {
  const q = query(collection(db, C.questions), where('seller_key', '==', key), where('status', 'in', ['open', 'answered']));
  return (await getDocs(q)).docs.map(toDoc)
    .sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || (b.created_at_ms || 0) - (a.created_at_ms || 0));
}

export async function askQuestion({ listing, uid, name, text }) {
  const r = validateQuestion(text);
  if (r.error) throw new MarketError(r.error);
  const ref = await addDoc(collection(db, C.questions), {
    listing_id: listing.id, listing_title: listing.title, seller_key: listing.seller_key,
    asker_uid: uid, asker_name: String(name || 'Comprador').slice(0, 60), text: r.value,
    status: 'open', created_at: serverTimestamp(), created_at_ms: Date.now(),
  });
  return ref.id;
}

export async function answerQuestion(question, { uid, text }) {
  const r = validateAnswer(text);
  if (r.error) throw new MarketError(r.error);
  await updateDoc(doc(db, C.questions, question.id), {
    answer: r.value, answered_at: serverTimestamp(), answered_by: uid, status: 'answered',
  });
}

export const deleteQuestion = (q) => deleteDoc(doc(db, C.questions, q.id));

/* --------------------------------------------------- favoritos e buscas -- */

export async function listMyFavorites(uid) {
  const q = query(collection(db, C.favorites), where('uid', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function toggleFavorite(uid, listingId, on) {
  const ref = doc(db, C.favorites, `${uid}_${listingId}`);
  if (on) await setDoc(ref, { uid, listing_id: listingId, created_at: serverTimestamp() });
  else await deleteDoc(ref);
}

export async function listSavedSearches(uid) {
  const q = query(collection(db, C.savedSearches), where('uid', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

export async function saveSearch(uid, { label, params, notify = true }) {
  const ref = await addDoc(collection(db, C.savedSearches), {
    uid, label: String(label || 'Minha busca').slice(0, 60), params: String(params || '').slice(0, 500), notify: Boolean(notify),
    created_at: serverTimestamp(), last_seen_ms: Date.now(),
  });
  return ref.id;
}

export const deleteSavedSearch = (id) => deleteDoc(doc(db, C.savedSearches, id));
export const touchSavedSearch = (id) => updateDoc(doc(db, C.savedSearches, id), { last_seen_ms: Date.now() });
export const setSavedSearchNotify = (id, on) => updateDoc(doc(db, C.savedSearches, id), { notify: Boolean(on) });

/* ------------------------------------------------------------ carrinho -- */

export async function getCart(uid) {
  const snap = await getDoc(doc(db, C.carts, uid));
  const d = snap.exists() ? snap.data() : {};
  return { items: d.items || [], saved: d.saved || [] };
}

export async function saveCart(uid, cart) {
  await setDoc(doc(db, C.carts, uid), { items: cart.items || [], saved: cart.saved || [], updated_at: serverTimestamp() });
}

/** As perguntas que eu fiz (a exportação de dados lê). */
export async function listMyQuestions(uid) {
  const q = query(collection(db, C.questions), where('asker_uid', '==', uid));
  return (await getDocs(q)).docs.map(toDoc);
}

/* -------------------------------------------------------------- cupons -- */

/** Os cupons de uma loja (todos: para quem vende). */
export async function listSellerCoupons(key) {
  const q = query(collection(db, C.coupons), where('seller_key', '==', key));
  return (await getDocs(q)).docs.map(toDoc).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
}

/** Os cupons DIVULGADOS: de uma loja, ou de todo o Mercado (sem `key`). */
export async function listPublicCoupons(key) {
  const cond = [where('public', '==', true), where('active', '==', true)];
  if (key) cond.unshift(where('seller_key', '==', key));
  return (await getDocs(query(collection(db, C.coupons), ...cond))).docs.map(toDoc);
}

/** O cupom pelo código digitado (ou `null`). Quem sabe o código lê o cupom. */
export async function findCoupon(sellerKey, code) {
  const c = normalizeCouponCode(code);
  if (!sellerKey || c.length < 3) return null;
  const snap = await getDoc(doc(db, C.coupons, couponDocId(sellerKey, c)));
  return snap.exists() ? toDoc(snap) : null;
}

/** Quantas vezes esta pessoa já usou o cupom (para "1 por pessoa"). */
export async function getMyCouponUses(couponId, uid) {
  if (!couponId || !uid) return 0;
  const snap = await getDoc(doc(db, C.coupons, couponId, 'market_coupon_uses', uid));
  return snap.exists() ? Number(snap.data().count) || 0 : 0;
}

export async function saveCoupon({ id, input, sellerKey, uid, actor }) {
  const r = validateCouponInput(input);
  if (!r.ok) throw new MarketError('Confira os campos destacados.', r.errors);
  const docId = id || couponDocId(sellerKey, r.value.code);
  if (!id) {
    const existe = await getDoc(doc(db, C.coupons, docId));
    if (existe.exists()) throw new MarketError('Você já tem um cupom com este código.', { code: 'Código já usado nesta loja.' });
    await setDoc(doc(db, C.coupons, docId), {
      ...r.value, seller_key: sellerKey, uses_count: 0, created_by: uid,
      created_at: serverTimestamp(), created_at_ms: Date.now(), updated_at: serverTimestamp(),
    });
  } else {
    const { code, ...resto } = r.value;
    await updateDoc(doc(db, C.coupons, docId), { ...resto, updated_at: serverTimestamp() });
  }
  await createAuditLog({
    action: id ? 'market_coupon_updated' : 'market_coupon_created', actor,
    details: { coupon_id: docId, seller_key: sellerKey, kind: r.value.kind, value: r.value.value },
  }).catch(() => {});
  return docId;
}

export const setCouponActive = (id, active) => updateDoc(doc(db, C.coupons, id), { active: Boolean(active), updated_at: serverTimestamp() });
export const deleteCoupon = (id) => deleteDoc(doc(db, C.coupons, id));

/** Admin: todos os cupons do Mercado. */
export async function listAllCoupons() {
  return (await getDocs(collection(db, C.coupons))).docs.map(toDoc);
}

/**
 * Admin desliga um cupom (abuso, erro de digitação que dá 100%): com motivo,
 * auditoria e aviso a quem vende. Religar é com a loja.
 */
export async function adminDisableCoupon(coupon, { reason = '', actor } = {}) {
  const motivo = String(reason).trim().slice(0, 300);
  if (!motivo) throw new MarketError('Diga o motivo: quem vende vai ler.');
  await updateDoc(doc(db, C.coupons, coupon.id), { active: false, updated_at: serverTimestamp() });
  const extras = await Promise.allSettled([
    createAuditLog({
      action: 'market_coupon_disabled_by_admin', actor,
      details: { coupon_id: coupon.id, seller_key: coupon.seller_key, code: coupon.code, reason: motivo },
    }),
    coupon.created_by ? notifyUsers([coupon.created_by], {
      title: 'Cupom desligado pela moderação',
      message: `O cupom ${coupon.code} foi desligado. Motivo: ${motivo}`,
      type: 'market', link: `/mercado/vender?aba=divulgar&como=${encodeURIComponent(coupon.seller_key || '')}`,
    }) : null,
  ]);
  return { warnings: extras.filter((r) => r.status === 'rejected').length };
}

/** Admin: todos os vales-presente do Mercado. */
export async function listAllGiftCards() {
  return (await getDocs(collection(db, C.giftCards))).docs.map(toDoc);
}

/* ------------------------------------------------------- vale-presente -- */

/** Os vales que estão na minha conta (para usar) e os que comprei (para dar). */
export async function listMyGiftCards(uid) {
  const [meus, comprados] = await Promise.all([
    getDocs(query(collection(db, C.giftCards), where('holder_uid', '==', uid))),
    getDocs(query(collection(db, C.giftCards), where('buyer_uid', '==', uid))),
  ]);
  const porId = new Map();
  [...meus.docs, ...comprados.docs].forEach((d) => porId.set(d.id, toDoc(d)));
  return [...porId.values()].sort((a, b) => (b.issued_at_ms || 0) - (a.issued_at_ms || 0));
}

/** Os vales de uma loja (para quem vende). */
export async function listSellerGiftCards(key) {
  const q = query(collection(db, C.giftCards), where('seller_key', '==', key));
  return (await getDocs(q)).docs.map(toDoc).sort((a, b) => (b.issued_at_ms || 0) - (a.issued_at_ms || 0));
}

/** Liga, desliga e ajusta o vale-presente da loja (o servidor confere de novo na compra). */
export async function saveGiftCardSettings(key, input) {
  const cfg = giftCardConfig({ gift_cards: input });
  await updateDoc(doc(db, C.sellers, key), { gift_cards: cfg, updated_at: serverTimestamp() });
  return cfg;
}
