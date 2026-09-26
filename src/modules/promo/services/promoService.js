/**
 * Service: DIVULGAÇÃO da plataforma e dos professores (Onda CG).
 *
 * Cupons (`promo_coupons`), campanhas (`promo_campaigns`) e as configurações
 * privadas de cada emissor (`promo_settings/{platform|uid}`: modelos de banner
 * e de cupom, custo interno dos vales). As regras do Firestore garantem que só
 * o emissor escreve o que é dele (ver `firestore.rules` § Divulgação).
 *
 * Como no marketing da arena, o serviço REFAZ toda a validação do domínio
 * antes de gravar: a tela ajuda, quem grava confere.
 *
 * Consultas: só igualdades (emissor, `show_home`, `active`…), que o Firestore
 * resolve sem índice composto; a ordem é feita em memória.
 */
import {
  arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, limit, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import { CAMPAIGN_STATUS, couponError } from '@/modules/arenas/domain/marketing';
import { normalizeCampaignBanner } from '@/modules/arenas/domain/campaignBanner';
import { ARENA_TEMPLATES_MAX, arenaTemplatesFrom } from '@/modules/arenas/domain/bannerArt';
import { COUPON_TEMPLATES_FIELD, arenaCouponTemplatesFrom } from '@/modules/arenas/domain/couponArt';
import { todayISO } from '@/modules/arenas/domain/subscription';
import {
  PROMO_COLLECTIONS, PROMO_FAMILY, PROMO_ISSUER, PROMO_VISIBILITY, issuerOf, normalizeIssuer,
  normalizePromoCouponInput, normalizePromoDestination, normalizePromoPlacement, normalizeReach,
  promoDestinationLink, promoFamily, promoNoticeLink, promoSettingsId,
} from '../domain/promo.js';

const COL_COUPONS = PROMO_COLLECTIONS.coupons;
const COL_CAMPAIGNS = PROMO_COLLECTIONS.campaigns;
const COL_SETTINGS = PROMO_COLLECTIONS.settings;

const str = (v) => String(v ?? '').trim();
const primeiroErro = (errors = {}) => Object.values(errors).find(Boolean) || null;
const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const recentesPrimeiro = (a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0);

function exigirEmissor(issuer) {
  const e = normalizeIssuer(issuer);
  if (!e) throw new Error('Emissor inválido.');
  return e;
}

/** O prefixo do registro de auditoria: `platform_promo_…` ou `coach_promo_…`. */
const acao = (issuer, verbo) => `${issuer.type}_promo_${verbo}`;

/* ------------------------------------------------------------------ */
/*  Configurações do emissor (privadas)                               */
/* ------------------------------------------------------------------ */

/** As configurações do emissor: custos dos vales e modelos. */
export async function getPromoSettings(issuer) {
  const id = promoSettingsId(normalizeIssuer(issuer));
  if (!db || !id) return { coupon_costs: {}, banner_templates: [], coupon_templates: [] };
  const snap = await getDoc(doc(db, COL_SETTINGS, id));
  const data = snap.exists() ? snap.data() : {};
  return {
    coupon_costs: data.coupon_costs && typeof data.coupon_costs === 'object' ? data.coupon_costs : {},
    banner_templates: arenaTemplatesFrom(data),
    coupon_templates: arenaCouponTemplatesFrom(data),
  };
}

/**
 * O custo unitário de um vale — quanto o EMISSOR paga por cada uso. Mora nas
 * configurações privadas: o cupom é legível por qualquer conta logada, e custo
 * interno não é assunto de quem usa. Vazio apaga (custo desconhecido, nunca
 * zero).
 */
export async function setPromoCouponUnitCost(issuer, couponId, cost, actor = null) {
  const e = exigirEmissor(issuer);
  if (!db || !couponId) return;
  const n = cost === '' || cost == null ? NaN : Number(cost);
  const valor = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  await setDoc(doc(db, COL_SETTINGS, promoSettingsId(e)), {
    issuer_type: e.type,
    issuer_id: e.id,
    coupon_costs: { [couponId]: valor == null ? deleteField() : valor },
    updated_at: serverTimestamp(),
  }, { merge: true });
  await createAuditLog({
    action: acao(e, 'coupon_cost_set'), actor, details: { issuer_id: e.id, coupon_id: couponId, unit_cost: valor },
  });
}

async function gravarModelos(issuer, campo, limpa, actor) {
  const e = exigirEmissor(issuer);
  await setDoc(doc(db, COL_SETTINGS, promoSettingsId(e)), {
    issuer_type: e.type, issuer_id: e.id, [campo]: limpa, updated_at: serverTimestamp(),
  }, { merge: true });
  await createAuditLog({
    action: acao(e, `${campo}_saved`), actor, details: { issuer_id: e.id, count: limpa.length },
  });
  return limpa;
}

const limparModelo = (t) => ({
  id: t.id,
  name: str(t.name).slice(0, 40),
  design: t.design,
  created_at_ms: Number(t.created_at_ms) || Date.now(),
  updated_at_ms: Number(t.updated_at_ms) || Date.now(),
});

/** Grava os modelos de BANNER do emissor (a lista é conferida de novo aqui). */
export async function savePromoBannerTemplates(issuer, list = [], actor = null) {
  if (!db) throw new Error('Firestore indisponível.');
  const limpa = arenaTemplatesFrom({ banner_templates: list }).slice(0, ARENA_TEMPLATES_MAX).map(limparModelo);
  return gravarModelos(issuer, 'banner_templates', limpa, actor);
}

/** Grava os modelos de CUPOM do emissor. */
export async function savePromoCouponTemplates(issuer, list = [], actor = null) {
  if (!db) throw new Error('Firestore indisponível.');
  const limpa = arenaCouponTemplatesFrom({ [COUPON_TEMPLATES_FIELD]: list }).slice(0, ARENA_TEMPLATES_MAX).map(limparModelo);
  return gravarModelos(issuer, COUPON_TEMPLATES_FIELD, limpa, actor);
}

/* ------------------------------------------------------------------ */
/*  Cupons                                                            */
/* ------------------------------------------------------------------ */

/** Todos os cupons do emissor (a lista da gestão). */
export async function listIssuerCoupons(issuer) {
  const e = normalizeIssuer(issuer);
  if (!db || !e) return [];
  const snap = await getDocs(query(
    collection(db, COL_COUPONS),
    where('issuer_type', '==', e.type),
    where('issuer_id', '==', e.id),
  ));
  return lista(snap).sort(recentesPrimeiro);
}

/**
 * Cria um cupom. O custo unitário de um vale (`input.unit_cost`) NÃO vai no
 * cupom: vai para as configurações privadas do emissor.
 */
export async function createPromoCoupon(issuer, input = {}, actor = null) {
  const e = exigirEmissor(issuer);
  if (!db) throw new Error('Firestore indisponível.');
  const { valid, errors, value } = normalizePromoCouponInput(input, { issuerType: e.type });
  if (!valid) throw new Error(primeiroErro(errors) || 'Dados inválidos.');
  const repetido = (await listIssuerCoupons(e)).find((c) => String(c.code || '').toUpperCase() === value.code);
  if (repetido) throw new Error(`Você já tem um cupom com o código ${value.code}.`);
  const id = doc(collection(db, COL_COUPONS)).id;
  await setDoc(doc(db, COL_COUPONS, id), {
    id,
    issuer_type: e.type,
    issuer_id: e.id,
    issuer_name: e.name,
    ...value,
    used_count: 0,
    used_by: [],
    created_by: actor?.uid || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  if (promoFamily(value) === PROMO_FAMILY.VOUCHER && input.unit_cost !== undefined) {
    await setPromoCouponUnitCost(e, id, input.unit_cost, actor).catch((err) => {
      logger.info('Cupom criado sem o custo unitário', { err: err?.code });
    });
  }
  await createAuditLog({
    action: acao(e, 'coupon_created'), actor, details: { issuer_id: e.id, coupon_id: id, code: value.code, kind: value.kind },
  });
  return id;
}

/**
 * Edita um cupom com a MESMA validação da criação. O emissor não muda (a
 * regra também recusa) e o uso já registrado não é tocado.
 */
export async function updatePromoCoupon(issuer, couponId, input = {}, actor = null) {
  const e = exigirEmissor(issuer);
  if (!db || !couponId) throw new Error('Cupom inválido.');
  const { valid, errors, value } = normalizePromoCouponInput(input, { issuerType: e.type });
  if (!valid) throw new Error(primeiroErro(errors) || 'Dados inválidos.');
  const repetido = (await listIssuerCoupons(e))
    .find((c) => c.id !== couponId && String(c.code || '').toUpperCase() === value.code);
  if (repetido) throw new Error(`Você já tem um cupom com o código ${value.code}.`);
  await updateDoc(doc(db, COL_COUPONS, couponId), { ...value, issuer_name: e.name, updated_at: serverTimestamp() });
  if (input.unit_cost !== undefined) {
    // Deixou de ser vale: o custo unitário não se aplica mais e sai.
    const custo = promoFamily(value) === PROMO_FAMILY.VOUCHER ? input.unit_cost : null;
    await setPromoCouponUnitCost(e, couponId, custo, actor).catch((err) => {
      logger.info('Cupom salvo sem o custo unitário', { err: err?.code });
    });
  }
  await createAuditLog({
    action: acao(e, 'coupon_updated'), actor, details: { issuer_id: e.id, coupon_id: couponId, code: value.code, kind: value.kind },
  });
}

/**
 * Liga/desliga sem apagar o histórico — quase sempre o que se quer: apagar
 * leva junto a contagem de usos, e ninguém responde mais "quanto rendeu?".
 */
export async function setPromoCouponActive(issuer, couponId, active, actor = null) {
  const e = exigirEmissor(issuer);
  if (!db || !couponId) return;
  await updateDoc(doc(db, COL_COUPONS, couponId), { active: Boolean(active), updated_at: serverTimestamp() });
  await createAuditLog({
    action: acao(e, active ? 'coupon_enabled' : 'coupon_disabled'), actor, details: { issuer_id: e.id, coupon_id: couponId },
  });
}

/** Apaga de vez (e o custo unitário sai junto). */
export async function deletePromoCoupon(issuer, couponId, actor = null) {
  const e = exigirEmissor(issuer);
  if (!db || !couponId) return;
  await deleteDoc(doc(db, COL_COUPONS, couponId));
  await setPromoCouponUnitCost(e, couponId, null, actor).catch(() => {});
  await createAuditLog({ action: acao(e, 'coupon_deleted'), actor, details: { issuer_id: e.id, coupon_id: couponId } });
}

/** Um cupom do emissor pelo CÓDIGO (a gestão lê todos os dela). */
export async function findPromoCouponByCode(issuer, code) {
  const limpo = str(code).toUpperCase().replace(/\s+/g, '');
  if (!limpo) return null;
  const todos = await listIssuerCoupons(issuer);
  return todos.find((c) => String(c.code || '').toUpperCase() === limpo) || null;
}

/**
 * Um cupom de PROFESSOR pelo código, para o aluno conferir no pedido de aula.
 * Três igualdades (emissor + código), sem índice composto. Não escreve nada: o
 * uso só é contado quando o professor confirma a aula.
 */
export async function findCoachCouponByCode(coachId, code) {
  const limpo = str(code).toUpperCase().replace(/\s+/g, '');
  if (!db || !coachId || !limpo) return null;
  const snap = await getDocs(query(
    collection(db, COL_COUPONS),
    where('issuer_type', '==', PROMO_ISSUER.COACH),
    where('issuer_id', '==', coachId),
    where('code', '==', limpo),
    limit(1),
  ));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/** Um cupom pelo id (`null` se não existe). */
export async function getPromoCoupon(couponId) {
  if (!db || !couponId) return null;
  const snap = await getDoc(doc(db, COL_COUPONS, couponId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * O emissor REGISTRA o uso de um cupom — a pessoa mostrou o código e recebeu
 * o benefício. Numa transação: entre abrir a tela e confirmar, outro uso pode
 * ter esgotado um cupom limitado.
 *
 * `userId` é opcional (quem não tem conta também usa um vale divulgado); aí
 * "uma vez por pessoa" não tem como ser conferido, e a tela diz isso.
 */
export async function redeemPromoCoupon(issuer, couponId, { userId = null, userName = '' } = {}, actor = null) {
  const e = exigirEmissor(issuer);
  if (!db || !couponId) throw new Error('Cupom não informado.');
  const ref = doc(db, COL_COUPONS, couponId);
  const cupom = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Cupom não encontrado.');
    const c = { id: snap.id, ...snap.data() };
    if (c.issuer_type !== e.type || c.issuer_id !== e.id) throw new Error('Este cupom é de outro emissor.');
    const erro = couponError(c, { anyFamily: true, usedByUser: Boolean(userId) && (c.used_by || []).includes(userId) });
    if (erro) throw new Error(erro.replace('Você já usou', 'Esta pessoa já usou'));
    const patch = { used_count: increment(1), last_used_at: serverTimestamp(), updated_at: serverTimestamp() };
    if (userId) patch.used_by = arrayUnion(userId);
    tx.update(ref, patch);
    return c;
  });
  await createAuditLog({
    action: acao(e, 'coupon_redeemed'),
    actor,
    details: { issuer_id: e.id, coupon_id: couponId, code: cupom.code, user_id: userId, user_name: userName || null },
  });
  return cupom;
}

/**
 * Conta o USO de um cupom do professor quando ele confirma a aula que o
 * aluno pediu com o código. Guardar QUEM usou é o que torna "uma vez por
 * pessoa" conferível. (O nome não começa com `use`: o ESLint o trataria como
 * hook do React.)
 */
export async function registrarUsoDePromo(couponId, userId) {
  if (!db || !couponId) return;
  await updateDoc(doc(db, COL_COUPONS, couponId), {
    used_count: increment(1),
    ...(userId ? { used_by: arrayUnion(userId) } : {}),
    last_used_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

/* ------------------------------------------------------------------ */
/*  Vitrines (tela inicial, perfil do professor, promoções)           */
/* ------------------------------------------------------------------ */

/** Os cupons marcados para a TELA INICIAL (de todos os emissores). */
export async function listHomePromoCoupons({ lim = 60 } = {}) {
  if (!db) return [];
  const snap = await getDocs(query(
    collection(db, COL_COUPONS), where('show_home', '==', true), where('active', '==', true), limit(lim),
  ));
  return lista(snap);
}

/** Os banners de campanha da TELA INICIAL (de todos os emissores). */
export async function listHomePromoCampaigns({ lim = 40 } = {}) {
  if (!db) return [];
  const snap = await getDocs(query(
    collection(db, COL_CAMPAIGNS), where('show_home', '==', true), where('banner_active', '==', true), limit(lim),
  ));
  return lista(snap);
}

/** Os cupons DIVULGADOS (vitrine de promoções), de todos os emissores. */
export async function listPublicPromoCoupons({ lim = 80 } = {}) {
  if (!db) return [];
  const snap = await getDocs(query(
    collection(db, COL_COUPONS), where('show_public', '==', true), where('active', '==', true), limit(lim),
  ));
  return lista(snap);
}

/** Os banners de campanha das PÁGINAS (vitrine / perfil), de todos os emissores. */
export async function listPagePromoCampaigns({ lim = 60 } = {}) {
  if (!db) return [];
  const snap = await getDocs(query(
    collection(db, COL_CAMPAIGNS), where('show_on_page', '==', true), where('banner_active', '==', true), limit(lim),
  ));
  return lista(snap);
}

/** Os cupons divulgados e os banners de UM professor (o perfil dele). */
export async function listCoachPublicPromos(coachId) {
  if (!db || !coachId) return { coupons: [], campaigns: [] };
  const [cupons, campanhas] = await Promise.all([
    getDocs(query(
      collection(db, COL_COUPONS),
      where('issuer_type', '==', PROMO_ISSUER.COACH), where('issuer_id', '==', coachId), where('show_public', '==', true),
    )),
    getDocs(query(
      collection(db, COL_CAMPAIGNS),
      where('issuer_type', '==', PROMO_ISSUER.COACH), where('issuer_id', '==', coachId), where('show_on_page', '==', true),
    )),
  ]);
  return { coupons: lista(cupons), campaigns: lista(campanhas) };
}

/* ------------------------------------------------------------------ */
/*  Campanhas                                                         */
/* ------------------------------------------------------------------ */

/** As campanhas do emissor (a lista da gestão), as mais novas primeiro. */
export async function listIssuerCampaigns(issuer) {
  const e = normalizeIssuer(issuer);
  if (!db || !e) return [];
  const snap = await getDocs(query(
    collection(db, COL_CAMPAIGNS),
    where('issuer_type', '==', e.type),
    where('issuer_id', '==', e.id),
  ));
  return lista(snap).sort(recentesPrimeiro);
}

/** Uma campanha pelo id (`null` se não existe). */
export async function getPromoCampaign(campaignId) {
  if (!db || !campaignId) return null;
  const snap = await getDoc(doc(db, COL_CAMPAIGNS, campaignId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Publica uma campanha: banner (na página do emissor e/ou na tela inicial) e/ou
 * aviso ao público escolhido. Pelo menos um dos dois — campanha que não
 * aparece em lugar nenhum não é campanha.
 *
 * @param {{ type: string, id: string, name: string }} issuer
 * @param {{
 *   name: string, message?: string, audience?: string, audience_detail?: object, notify?: boolean,
 *   banner?: object|null, destination?: object, reach?: object, visibility?: string,
 *   show_on_page?: boolean, show_home?: boolean, banner_until?: string,
 * }} input
 * @param {string[]} recipients uids (de `platformRecipients` / `coachRecipients`)
 * @returns {Promise<{ id: string, sent: number, link: string }>}
 */
export async function publishPromoCampaign(issuer, input = {}, recipients = [], actor = null, { today = todayISO() } = {}) {
  const e = exigirEmissor(issuer);
  if (!db) throw new Error('Firestore indisponível.');
  const nome = str(input.name).slice(0, 120);
  const mensagem = str(input.message).slice(0, 1000);
  const avisar = input.notify !== false;
  if (!nome) throw new Error('Dê um nome à campanha.');
  if (avisar && !mensagem) throw new Error('Escreva a mensagem do aviso.');

  const banner = normalizeCampaignBanner(input.banner || null);
  if (!banner.valid) throw new Error(primeiroErro(banner.errors) || 'Confira o banner.');
  const destino = normalizePromoDestination(input.destination || {}, e.type);
  if (!destino.valid) throw new Error(primeiroErro(destino.errors));
  const lugar = banner.value ? normalizePromoPlacement(input, { today }) : null;
  if (lugar && !lugar.valid) throw new Error(primeiroErro(lugar.errors));
  const alcance = normalizeReach(input.reach || {});
  if (!alcance.valid) throw new Error(primeiroErro(alcance.errors));

  const destinatarios = avisar ? [...new Set((recipients || []).filter(Boolean))] : [];
  if (avisar && destinatarios.length === 0) throw new Error('Não há ninguém neste público.');
  if (!avisar && !banner.value) {
    throw new Error('Escolha um banner ou um aviso — a campanha precisa aparecer em algum lugar.');
  }

  const id = doc(collection(db, COL_CAMPAIGNS)).id;
  const ctxLink = { issuerType: e.type, issuerId: e.id, campaignId: id };
  const link = promoDestinationLink(destino.value, ctxLink);
  const detalhe = input.audience_detail && typeof input.audience_detail === 'object' ? {
    interest: str(input.audience_detail.interest).slice(0, 40),
    state: str(input.audience_detail.state).toUpperCase().slice(0, 2),
    city: str(input.audience_detail.city).slice(0, 80),
  } : null;
  await setDoc(doc(db, COL_CAMPAIGNS, id), {
    id,
    issuer_type: e.type,
    issuer_id: e.id,
    issuer_name: e.name,
    name: nome,
    message: mensagem,
    channel: avisar ? 'in_app' : 'banner',
    target_audience: avisar ? str(input.audience).slice(0, 60) : '',
    audience_detail: avisar ? detalhe : null,
    status: CAMPAIGN_STATUS.SENT,
    sent_count: destinatarios.length,
    sent_at: serverTimestamp(),
    destination: destino.value,
    reach: alcance.value,
    visibility: e.type === PROMO_ISSUER.COACH && input.visibility === PROMO_VISIBILITY.STUDENTS
      ? PROMO_VISIBILITY.STUDENTS : PROMO_VISIBILITY.ALL,
    ...(banner.value ? {
      banner: banner.value,
      show_on_page: lugar.value.show_on_page,
      show_home: lugar.value.show_home,
      banner_until: lugar.value.banner_until,
      banner_active: true,
    } : {}),
    created_by: actor?.uid || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  if (avisar) {
    // A entrega não derruba o registro: se parte dos avisos falhar, a
    // campanha continua gravada e o emissor vê quantos foram.
    try {
      await notifyUsers(destinatarios, {
        title: nome.slice(0, 80),
        message: mensagem,
        type: NOTIFICATION_TYPE.GENERIC,
        link: promoNoticeLink(destino.value, ctxLink),
        actor,
      });
    } catch (err) {
      logger.info('Falha ao entregar parte da campanha', { err: err?.code });
    }
  }

  await createAuditLog({
    action: acao(e, 'campaign_sent'),
    actor,
    details: {
      issuer_id: e.id,
      campaign_id: id,
      audience: avisar ? input.audience : null,
      count: destinatarios.length,
      banner: banner.value ? banner.value.source : null,
      destination: destino.value.type,
    },
  });
  return { id, sent: destinatarios.length, link };
}

/**
 * Edita o banner de uma campanha já publicada — desenho/imagem, destino, onde
 * aparece, até quando, alcance, para quem — ou só pausa/retoma. O AVISO já
 * enviado não é tocado (não há como "desenviar" uma notificação).
 */
export async function updatePromoCampaign(campaignId, patch = {}, actor = null, { today = todayISO() } = {}) {
  if (!db || !campaignId) throw new Error('Campanha inválida.');
  const atual = await getPromoCampaign(campaignId);
  if (!atual) throw new Error('Campanha não encontrada.');
  const e = issuerOf(atual);
  if (!e) throw new Error('Campanha sem emissor.');

  const mudancas = {};
  if ('banner' in patch) {
    const banner = normalizeCampaignBanner(patch.banner || null);
    if (!banner.valid) throw new Error(primeiroErro(banner.errors) || 'Confira o banner.');
    mudancas.banner = banner.value;
  }
  if ('destination' in patch) {
    const destino = normalizePromoDestination(patch.destination || {}, e.type);
    if (!destino.valid) throw new Error(primeiroErro(destino.errors));
    mudancas.destination = destino.value;
  }
  if ('reach' in patch) {
    const alcance = normalizeReach(patch.reach || {});
    if (!alcance.valid) throw new Error(primeiroErro(alcance.errors));
    mudancas.reach = alcance.value;
  }
  if ('visibility' in patch) {
    mudancas.visibility = e.type === PROMO_ISSUER.COACH && patch.visibility === PROMO_VISIBILITY.STUDENTS
      ? PROMO_VISIBILITY.STUDENTS : PROMO_VISIBILITY.ALL;
  }
  const mexeNoLugar = ['show_on_page', 'show_home', 'banner_until'].some((k) => k in patch);
  if (mexeNoLugar) {
    const lugar = normalizePromoPlacement({
      show_on_page: 'show_on_page' in patch ? patch.show_on_page : atual.show_on_page,
      show_home: 'show_home' in patch ? patch.show_home : atual.show_home,
      banner_until: 'banner_until' in patch ? patch.banner_until : atual.banner_until,
    }, { today });
    if (!lugar.valid) throw new Error(primeiroErro(lugar.errors));
    Object.assign(mudancas, lugar.value);
  }
  if ('banner_active' in patch) mudancas.banner_active = patch.banner_active !== false;
  if (Object.keys(mudancas).length === 0) return atual;

  // Banner novo numa campanha que só tinha aviso: nasce no ar, na página.
  if (mudancas.banner && !atual.banner) {
    if (!('banner_active' in mudancas)) mudancas.banner_active = true;
    if (!mexeNoLugar) Object.assign(mudancas, normalizePromoPlacement({}, { today }).value);
  }

  await updateDoc(doc(db, COL_CAMPAIGNS, campaignId), { ...mudancas, updated_at: serverTimestamp() });
  await createAuditLog({
    action: acao(e, 'campaign_updated'),
    actor,
    details: { issuer_id: e.id, campaign_id: campaignId, fields: Object.keys(mudancas) },
  });
  return { ...atual, ...mudancas };
}

/** Apaga uma campanha (o aviso já entregue continua no sino de quem recebeu). */
export async function deletePromoCampaign(campaignId, actor = null) {
  if (!db || !campaignId) return;
  const atual = await getPromoCampaign(campaignId);
  await deleteDoc(doc(db, COL_CAMPAIGNS, campaignId));
  const e = issuerOf(atual) || { type: 'promo', id: null };
  await createAuditLog({ action: acao(e, 'campaign_deleted'), actor, details: { issuer_id: e.id, campaign_id: campaignId } });
}
