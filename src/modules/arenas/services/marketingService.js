/**
 * Service: Marketing (Arena V3 — sprint 6).
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, increment, limit, arrayUnion,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import {
  normalizeCouponInput, isCouponValid, applyCoupon, generateReferralCode,
  calculateLoyaltyPoints, classifyNps, calculateNps, CAMPAIGN_STATUS,
  couponError, couponDiscount,
} from '../domain/marketing.js';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';

const COL_COUPONS = 'arena_coupons';
const COL_CAMPAIGNS = 'arena_campaigns';
const COL_NPS = 'arena_nps_responses';
const COL_REFERRALS = 'arena_referrals';

function str(v) { return String(v ?? '').trim(); }

/* --------------------- Coupons -------------------- */

export async function listArenaCoupons(arenaId, { onlyActive = true, lim = 100 } = {}) {
  if (!db || !arenaId) return [];
  const c = [where('arena_id', '==', arenaId)];
  if (onlyActive) c.push(where('active', '==', true));
  c.push(limit(lim));
  const snap = await getDocs(query(collection(db, COL_COUPONS), ...c));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createArenaCoupon(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeCouponInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  const id = doc(collection(db, COL_COUPONS)).id;
  await setDoc(doc(db, COL_COUPONS, id), {
    id, arena_id: arenaId, ...value, used_count: 0, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_coupon_created', actor, details: { arena_id: arenaId, code: value.code } });
  return id;
}

/**
 * Contabiliza o USO de um cupom.
 *
 * O nome não começa com `use` de propósito: o ESLint (`rules-of-hooks`) trata
 * qualquer função `useX` como hook do React, e um serviço chamado assim
 * derruba o lint de todo arquivo que o invoque fora de um componente.
 */
export async function registrarUsoDeCupom(couponId, userId) {
  if (!couponId || !userId) return;
  await updateDoc(doc(db, COL_COUPONS, couponId), {
    used_count: increment(1),
    // Guardar QUEM usou é o que permite "uma vez por pessoa". Sem isso, o
    // limite existiria no papel e não teria como ser conferido.
    used_by: arrayUnion(userId),
    updated_at: serverTimestamp(),
  });
}

/**
 * Procura um cupom pelo CÓDIGO e diz se ele vale para esta pessoa e esta conta.
 *
 * Devolve sempre `{ coupon, discount, error }`: a tela precisa do motivo da
 * recusa ("venceu", "vale a partir de R$ 100"), não de um "inválido" que não
 * ensina nada.
 *
 * Não escreve nada — o uso só é contabilizado quando a arena confirma.
 *
 * @param {string} arenaId
 * @param {string} code
 * @param {{ userId?: string, amount?: number }} [ctx]
 * @returns {Promise<{ coupon: object|null, discount: number, error: string|null }>}
 */
export async function validateCouponCode(arenaId, code, ctx = {}) {
  const limpo = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!db || !arenaId || !limpo) {
    return { coupon: null, discount: 0, error: 'Informe o código do cupom.' };
  }
  let achado = null;
  try {
    // Um `where` só (a arena) e o código conferido em memória: a lista de
    // cupons de uma arena é curta, e assim não é preciso índice novo.
    const snap = await getDocs(query(collection(db, COL_COUPONS), where('arena_id', '==', arenaId)));
    achado = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .find((c) => String(c.code || '').toUpperCase() === limpo) || null;
  } catch {
    return { coupon: null, discount: 0, error: 'Não foi possível conferir o cupom agora.' };
  }

  const erro = couponError(achado, {
    amount: Number(ctx.amount) || 0,
    usedByUser: Boolean(ctx.userId) && (achado?.used_by || []).includes(ctx.userId),
  });
  if (erro) return { coupon: achado, discount: 0, error: erro };

  return {
    coupon: achado,
    discount: couponDiscount(Number(ctx.amount) || 0, achado),
    error: null,
  };
}

/* --------------------- Campaigns -------------------- */

export async function listArenaCampaigns(arenaId, { lim = 50 } = {}) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_CAMPAIGNS), where('arena_id', '==', arenaId), orderBy('created_at', 'desc'), limit(lim)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCampaign(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const id = doc(collection(db, COL_CAMPAIGNS)).id;
  await setDoc(doc(db, COL_CAMPAIGNS, id), {
    id, arena_id: arenaId,
    name: str(input.name).slice(0, 120),
    channel: input.channel || 'email',
    message: str(input.message).slice(0, 1000),
    target_audience: str(input.target_audience).slice(0, 60),
    status: CAMPAIGN_STATUS.DRAFT,
    scheduled_at: input.scheduled_at || null,
    sent_count: 0,
    created_by: actor?.uid, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  await createAuditLog({ action: 'arena_campaign_created', actor, details: { arena_id: arenaId, name: input.name } });
  return id;
}

/* --------------------- NPS -------------------- */

export async function submitNps(arenaId, userId, score, comment) {
  if (!arenaId || !userId) throw new Error('Parâmetros obrigatórios.');
  if (!Number.isFinite(score) || score < 0 || score > 10) throw new Error('Score 0-10.');
  const id = `${arenaId}_${userId}_${Date.now()}`;
  await setDoc(doc(db, COL_NPS, id), {
    id, arena_id: arenaId, user_id: userId, score, classification: classifyNps(score),
    comment: str(comment).slice(0, 500), created_at: serverTimestamp(),
  });
}

export async function getArenaNpsResponses(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_NPS), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => d.data());
}

export function getArenaNpsSummary(responses) {
  const summary = calculateNps(responses);
  return { nps: summary, count: responses.length };
}

/* --------------------- Referral -------------------- */

export async function createReferral(arenaId, userId, referredUserId) {
  if (!arenaId || !userId) return null;
  const id = `${arenaId}_${userId}_${referredUserId || 'open'}`;
  const code = generateReferralCode(userId);
  await setDoc(doc(db, COL_REFERRALS, id), {
    id, arena_id: arenaId, referrer_id: userId, referred_id: referredUserId || null,
    code, status: 'pending', created_at: serverTimestamp(),
  });
  return code;
}

/* ================================================================== */
/*  Campanha que CHEGA                                                 */
/* ================================================================== */

/**
 * Cria a campanha e **entrega** — cria a notificação de cada destinatário.
 *
 * 🐞 Antes, `createCampaign` só gravava um documento com `sent_count: 0`. A
 * arena escrevia a mensagem, clicava em criar, e nada acontecia com ninguém.
 *
 * O canal é o **aviso dentro da plataforma** (que vira push para quem optou
 * por push). E-mail, SMS e WhatsApp exigem provedor e consentimento próprios —
 * oferecê-los na tela sem entregar seria a mesma promessa vazia de novo.
 *
 * @param {string} arenaId
 * @param {{ name: string, message: string, audience: string, link?: string }} input
 * @param {string[]} recipients uids (calculados por `campaignRecipients`)
 * @param {object|null} actor
 * @returns {Promise<{ id: string, sent: number }>}
 */
export async function sendCampaign(arenaId, input, recipients = [], actor = null) {
  if (!arenaId) throw new Error('arenaId é obrigatório.');
  const nome = str(input?.name).slice(0, 120);
  const mensagem = str(input?.message).slice(0, 1000);
  if (!nome) throw new Error('Dê um nome à campanha.');
  if (!mensagem) throw new Error('Escreva a mensagem.');

  const destinatarios = [...new Set((recipients || []).filter(Boolean))];
  if (destinatarios.length === 0) throw new Error('Não há ninguém neste público.');

  const id = doc(collection(db, COL_CAMPAIGNS)).id;
  await setDoc(doc(db, COL_CAMPAIGNS, id), {
    id,
    arena_id: arenaId,
    name: nome,
    message: mensagem,
    channel: 'in_app',
    target_audience: str(input?.audience).slice(0, 60),
    status: CAMPAIGN_STATUS.SENT,
    sent_count: destinatarios.length,
    sent_at: serverTimestamp(),
    created_by: actor?.uid || null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // A entrega não pode derrubar o registro da campanha: se algum aviso falhar,
  // a campanha continua gravada e a arena vê quantos foram.
  try {
    await notifyUsers(destinatarios, {
      title: nome.slice(0, 80),
      message: mensagem,
      type: NOTIFICATION_TYPE.GENERIC,
      link: str(input?.link) || `/arenas/${arenaId}`,
      actor,
    });
  } catch (err) {
    logger.info('Falha ao entregar parte da campanha', { err: err?.code });
  }

  await createAuditLog({
    action: 'arena_campaign_sent',
    actor,
    details: { arena_id: arenaId, campaign_id: id, audience: input?.audience, count: destinatarios.length },
  });
  return { id, sent: destinatarios.length };
}

/* ================================================================== */
/*  Indique e ganhe                                                    */
/* ================================================================== */

/**
 * O MEU código de indicação nesta arena. Cria na primeira vez.
 *
 * O documento é do indicador (`referrer_id == eu`), que é exatamente o que a
 * regra do Firestore permite escrever. Quem foi indicado NÃO escreve nada: o
 * resgate é feito pela arena, que é quem tem permissão de creditar carteira.
 * É também como funciona no balcão — a pessoa chega e diz quem indicou.
 */
export async function getOrCreateReferralCode(arenaId, user) {
  if (!db || !arenaId || !user?.uid) return null;
  const id = `${arenaId}_${user.uid}`;
  const ref = doc(db, COL_REFERRALS, id);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };

  const code = generateReferralCode(user.uid);
  const payload = {
    id,
    arena_id: arenaId,
    referrer_id: user.uid,
    referred_id: null,
    code,
    status: 'open',
    redeemed_count: 0,
    created_at: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return payload;
}

/** Procura o dono de um código nesta arena. Um `where` só. */
export async function findReferralByCode(arenaId, code) {
  const limpo = String(code || '').trim().toUpperCase();
  if (!db || !arenaId || !limpo) return null;
  const snap = await getDocs(query(collection(db, COL_REFERRALS), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((r) => String(r.code || '').toUpperCase() === limpo) || null;
}

/**
 * A ARENA registra a indicação e credita os dois lados.
 *
 * Quem chama é o gestor — é ele que tem permissão de creditar carteira, e é
 * ele que sabe que a pessoa realmente veio por indicação.
 *
 * @param {string} arenaId
 * @param {{ code: string, referredId: string, referredName?: string, reward: number }} input
 * @param {object|null} actor
 */
export async function redeemReferral(arenaId, input, actor) {
  const { code, referredId, referredName = '', reward } = input || {};
  const premio = Math.max(0, Number(reward) || 0);
  if (!arenaId || !referredId) throw new Error('Informe quem foi indicado.');
  if (premio <= 0) throw new Error('Informe o valor do prêmio.');

  const indicacao = await findReferralByCode(arenaId, code);
  if (!indicacao) throw new Error('Código de indicação não encontrado nesta arena.');
  if (indicacao.referrer_id === referredId) {
    throw new Error('Ninguém pode indicar a si mesmo.');
  }
  if ((indicacao.redeemed_by || []).includes(referredId)) {
    throw new Error('Esta pessoa já foi creditada com este código.');
  }

  await updateDoc(doc(db, COL_REFERRALS, indicacao.id), {
    redeemed_count: increment(1),
    redeemed_by: arrayUnion(referredId),
    last_redeemed_at: serverTimestamp(),
    status: 'redeemed',
  });

  // O crédito dos dois lados fica com quem chamou (o serviço de membros), que
  // é o dono da carteira. Aqui só registramos a indicação.
  await createAuditLog({
    action: 'arena_referral_redeemed',
    actor,
    details: {
      arena_id: arenaId,
      code: indicacao.code,
      referrer_id: indicacao.referrer_id,
      referred_id: referredId,
      referred_name: referredName,
      reward: premio,
    },
  });
  return { referrerId: indicacao.referrer_id, reward: premio };
}

/** As respostas de NPS de UMA pessoa nesta arena — para saber quando calar. */
export async function listMyNpsAnswers(arenaId, userId) {
  if (!db || !arenaId || !userId) return [];
  try {
    // Um `where` só (a arena) e o filtro por pessoa em memória: a regra já
    // deixa o respondente ler a própria resposta, e assim não é preciso
    // índice novo.
    const snap = await getDocs(query(collection(db, COL_NPS), where('user_id', '==', userId)));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.arena_id === arenaId);
  } catch {
    return [];
  }
}

/* --------------------- Cupom: editar e apagar --------------------- */

/**
 * Edita um cupom existente.
 *
 * Só a arena dona escreve (regra do Firestore). Passa pela MESMA validação da
 * criação: um cupom editado para "-50%" com valor 500 seria aceito em silêncio
 * e só apareceria como estrago no caixa.
 *
 * @param {string} couponId
 * @param {object} input
 * @param {object|null} actor
 */
export async function updateArenaCoupon(couponId, input, actor) {
  if (!couponId) throw new Error('couponId obrigatório.');
  const { valid, errors, value } = normalizeCouponInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  await updateDoc(doc(db, COL_COUPONS, couponId), { ...value, updated_at: serverTimestamp() });
  await createAuditLog({
    action: 'arena_coupon_updated',
    actor,
    details: { coupon_id: couponId, code: value.code },
  });
}

/**
 * Liga/desliga um cupom sem apagar o histórico de uso.
 *
 * Desligar é quase sempre o que a arena quer: apagar leva junto a contagem de
 * usos, e aí ninguém consegue mais responder "quanto essa promoção rendeu?".
 */
export async function setCouponActive(couponId, active, actor) {
  if (!couponId) return;
  await updateDoc(doc(db, COL_COUPONS, couponId), {
    active: Boolean(active),
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: active ? 'arena_coupon_enabled' : 'arena_coupon_disabled',
    actor,
    details: { coupon_id: couponId },
  });
}

/** Apaga o cupom de vez. A regra de `delete` foi corrigida na Onda AG. */
export async function deleteArenaCoupon(couponId, actor) {
  if (!couponId) return;
  await deleteDoc(doc(db, COL_COUPONS, couponId));
  await createAuditLog({ action: 'arena_coupon_deleted', actor, details: { coupon_id: couponId } });
}
