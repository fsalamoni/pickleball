/**
 * Service: Marketing (Arena V3 — sprint 6).
 */

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, increment, limit, arrayUnion,
  runTransaction, deleteField,
} from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import {
  normalizeCouponInput, isCouponValid, applyCoupon, generateReferralCode,
  calculateLoyaltyPoints, classifyNps, calculateNps, CAMPAIGN_STATUS,
  couponError, couponDiscount, couponFamily, couponKind, COUPON_FAMILY, COUPON_KIND,
} from '../domain/marketing.js';
import { getOrCreateArenaSettings } from './v3SettingsService.js';
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

/**
 * Cria um cupom de QUALQUER tipo.
 *
 * O custo unitário de um vale (`input.unit_cost`) NÃO vai para o cupom — o
 * cupom é legível por qualquer conta logada. Vai para `arena_settings`, que
 * só o gestor lê (`setCouponUnitCost`).
 */
export async function createArenaCoupon(arenaId, input, actor) {
  if (!arenaId) throw new Error('arenaId obrigatório.');
  const { valid, errors, value } = normalizeCouponInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  if (value.kind === COUPON_KIND.REFERRAL && value.active) await garantirUmProgramaSo(arenaId);
  const id = doc(collection(db, COL_COUPONS)).id;
  await setDoc(doc(db, COL_COUPONS, id), {
    id, arena_id: arenaId, ...value, used_count: 0, created_at: serverTimestamp(), updated_at: serverTimestamp(),
  });
  if (couponFamily(value) === COUPON_FAMILY.VOUCHER && input?.unit_cost !== undefined) {
    await setCouponUnitCost(arenaId, id, input.unit_cost, actor).catch((err) => {
      logger.info('Cupom criado sem o custo unitário', { err: err?.code });
    });
  }
  await createAuditLog({
    action: 'arena_coupon_created', actor, details: { arena_id: arenaId, code: value.code, kind: value.kind },
  });
  return id;
}

/**
 * Um programa de indicação ATIVO por arena. Dois programas ativos dariam duas
 * respostas para "quanto eu ganho indicando?" — e a arena pagaria a maior.
 */
async function garantirUmProgramaSo(arenaId, exceptId = null) {
  const ativos = await listArenaCoupons(arenaId, { onlyActive: true });
  const outro = ativos.find((c) => c.id !== exceptId && couponKind(c) === COUPON_KIND.REFERRAL);
  if (outro) {
    throw new Error('Já existe um programa de indicação ativo nesta arena. Edite as regras dele — ou desligue-o antes de criar outro.');
  }
}

/**
 * O custo unitário de um vale — quanto a ARENA paga por cada uso (a água de
 * coco, a hora do professor). Mora em `arena_settings.coupon_costs`, que só o
 * gestor lê: o cupom é legível por qualquer conta logada, e custo interno não
 * é assunto do cliente. Vazio apaga (custo desconhecido, nunca zero).
 */
export async function setCouponUnitCost(arenaId, couponId, cost, actor = null) {
  if (!db || !arenaId || !couponId) return;
  const n = cost === '' || cost == null ? NaN : Number(cost);
  const valor = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  // O documento de configurações pode não existir ainda; nasce com os padrões,
  // senão um documento com SÓ o custo seria lido como a configuração inteira.
  await getOrCreateArenaSettings(arenaId);
  await updateDoc(doc(db, 'arena_settings', arenaId), {
    [`coupon_costs.${couponId}`]: valor == null ? deleteField() : valor,
    updated_at: serverTimestamp(),
  });
  await createAuditLog({
    action: 'arena_coupon_cost_set', actor, details: { arena_id: arenaId, coupon_id: couponId, unit_cost: valor },
  });
}

/** O cupom pelo CÓDIGO, para a arena (que lê todos os cupons dela). */
export async function findArenaCouponByCode(arenaId, code) {
  const limpo = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!db || !arenaId || !limpo) return null;
  const lista = await listArenaCoupons(arenaId, { onlyActive: false });
  return lista.find((c) => String(c.code || '').toUpperCase() === limpo) || null;
}

/**
 * A ARENA registra o uso de um VALE na recepção — a pessoa mostrou o código e
 * recebeu a bebida, a aula, o brinde.
 *
 * Numa transação: entre abrir a tela e confirmar, outra pessoa da equipe pode
 * ter registrado o último uso de um vale limitado, e contar os dois passaria
 * do limite que a arena escolheu. `userId` é opcional — quem não tem cadastro
 * também pode usar um vale divulgado; aí "uma vez por pessoa" não tem como ser
 * conferido, e a tela diz isso.
 *
 * @param {string} arenaId
 * @param {string} couponId
 * @param {{ userId?: string|null, userName?: string }} [quem]
 * @param {object|null} [actor]
 */
export async function redeemVoucher(arenaId, couponId, { userId = null, userName = '' } = {}, actor = null) {
  if (!db || !arenaId || !couponId) throw new Error('Cupom não informado.');
  const ref = doc(db, COL_COUPONS, couponId);
  const cupom = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Cupom não encontrado.');
    const c = { id: snap.id, ...snap.data() };
    if (c.arena_id !== arenaId) throw new Error('Este cupom é de outra arena.');
    const familia = couponFamily(c);
    if (familia === COUPON_FAMILY.BOOKING) {
      throw new Error('Este cupom é desconto na reserva: ele entra sozinho no preço quando a pessoa digita o código ao reservar.');
    }
    if (familia === COUPON_FAMILY.REFERRAL) {
      throw new Error('Este é o programa de indicação: registre a indicação na aba Indicações.');
    }
    const erro = couponError(c, {
      anyFamily: true,
      usedByUser: Boolean(userId) && (c.used_by || []).includes(userId),
    });
    if (erro) throw new Error(erro.replace('Você já usou', 'Esta pessoa já usou'));
    const patch = { used_count: increment(1), last_used_at: serverTimestamp(), updated_at: serverTimestamp() };
    if (userId) patch.used_by = arrayUnion(userId);
    tx.update(ref, patch);
    return c;
  });
  await createAuditLog({
    action: 'arena_voucher_redeemed',
    actor,
    details: { arena_id: arenaId, coupon_id: couponId, code: cupom.code, user_id: userId, user_name: userName || null },
  });
  return cupom;
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

/**
 * Os MEUS códigos de indicação, de todas as arenas — para o perfil (Onda BY).
 * Consulta pelo campo que a regra confere (`referrer_id`). Só entram os
 * documentos legítimos (id `{arena}_{eu}`): um código forjado antes da trava
 * da Onda BX não aparece como meu.
 */
export async function listMyReferralCodes(uid) {
  if (!db || !uid) return [];
  const snap = await getDocs(query(collection(db, COL_REFERRALS), where('referrer_id', '==', uid)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.arena_id && r.id === `${r.arena_id}_${uid}` && r.code);
}

/**
 * As indicações (códigos dos atletas) desta arena — para o controle de uso.
 * A arena lê as dela (regra de 2026-09-24).
 */
export async function listArenaReferrals(arenaId) {
  if (!db || !arenaId) return [];
  const snap = await getDocs(query(collection(db, COL_REFERRALS), where('arena_id', '==', arenaId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  const existente = await getMyReferralCode(arenaId, user.uid);
  if (existente) return existente;
  const id = `${arenaId}_${user.uid}`;
  const ref = doc(db, COL_REFERRALS, id);

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

/**
 * O MEU código nesta arena, se já existir — sem criar.
 *
 * É o que a página da arena usa: criar o documento só porque alguém ABRIU a
 * página gravaria um código para cada curioso. O código nasce quando a pessoa
 * pede ("Quero meu código"). Id determinístico: um `get`, sem consulta — e a
 * regra deixa o dono ler o próprio documento mesmo antes de ele existir
 * (`canGetMissingArenaUserDoc`; antes esse `get` dava erro e o código nunca
 * era criado).
 */
export async function getMyReferralCode(arenaId, userId) {
  if (!db || !arenaId || !userId) return null;
  const snap = await getDoc(doc(db, COL_REFERRALS, `${arenaId}_${userId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Um código de indicação é LEGÍTIMO quando o documento é o do próprio
 * indicador (`{arena}_{uid}`) e o código começa pelo uid dele — que é como
 * `generateReferralCode` o monta.
 *
 * 🐞 Antes da trava da Onda BX, dava para criar o documento de outra pessoa,
 * ou reescrever o próprio código com o código de outra pessoa; um documento
 * assim fica no banco. Conferir aqui é o que impede o crédito de ir para
 * quem copiou o código.
 */
export function isLegitReferral(referral, arenaId, code) {
  const limpo = String(code || '').trim().toUpperCase();
  if (!referral?.referrer_id || !limpo) return false;
  if (referral.id !== `${arenaId}_${referral.referrer_id}`) return false;
  if (String(referral.code || '').toUpperCase() !== limpo) return false;
  return String(referral.referrer_id).slice(0, 6).toUpperCase() === limpo.slice(0, 6);
}

/** Procura o dono de um código nesta arena. Um `where` só. */
export async function findReferralByCode(arenaId, code) {
  const limpo = String(code || '').trim().toUpperCase();
  if (!db || !arenaId || !limpo) return null;
  const snap = await getDocs(query(collection(db, COL_REFERRALS), where('arena_id', '==', arenaId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((r) => isLegitReferral(r, arenaId, limpo)) || null;
}

/**
 * Esta pessoa já tem reserva CONFIRMADA ou CONCLUÍDA nesta arena (fora
 * `exceptBookingId`)? É o que "indicação só para quem nunca reservou aqui"
 * pergunta. Duas igualdades — não pedem índice composto; a arena lê as
 * reservas dela.
 */
export async function hasPriorArenaBooking(arenaId, userId, { exceptBookingId = null } = {}) {
  if (!db || !arenaId || !userId) return false;
  const snap = await getDocs(query(
    collection(db, 'arena_bookings'),
    where('arena_id', '==', arenaId),
    where('athlete_id', '==', userId),
  ));
  return snap.docs.some((d) => d.id !== exceptBookingId && ['confirmed', 'completed'].includes(d.data()?.status));
}

/**
 * A ARENA registra a indicação.
 *
 * Quem chama é o gestor — é ele que tem permissão de creditar carteira, e é
 * ele que sabe que a pessoa realmente veio por indicação. O crédito em si fica
 * com quem chama (o serviço de membros, dono da carteira); aqui a indicação é
 * conferida e registrada.
 *
 * As REGRAS vêm do programa de indicação (o cupom do tipo indicação), quando
 * passado em `program`: limite de indicações por pessoa e "só para quem nunca
 * reservou aqui". Cada lado pode ganhar um valor diferente — `reward` sozinho
 * (o formato antigo) vale para os dois.
 *
 * @param {string} arenaId
 * @param {{
 *   code: string, referredId: string, referredName?: string,
 *   reward?: number, referrerReward?: number, referredReward?: number,
 *   referredDiscount?: number, program?: object|null, exceptBookingId?: string|null,
 * }} input
 * @param {object|null} actor
 * @returns {Promise<{ referrerId: string, referrerReward: number, referredReward: number, reward: number }>}
 */
export async function redeemReferral(arenaId, input, actor) {
  const {
    code, referredId, referredName = '', reward,
    referrerReward, referredReward, referredDiscount = 0, program = null, exceptBookingId = null,
  } = input || {};
  const paraQuemIndica = Math.max(0, Number(referrerReward ?? reward) || 0);
  const paraQuemChega = Math.max(0, Number(referredReward ?? reward) || 0);
  // O desconto na primeira reserva também é prêmio: uma indicação que dá SÓ
  // desconto a quem chega (e nada a quem indica) é válida.
  const descontoChegada = Math.max(0, Number(referredDiscount) || 0);
  if (!arenaId || !referredId) throw new Error('Informe quem foi indicado.');
  if (paraQuemIndica + paraQuemChega + descontoChegada <= 0) throw new Error('Informe o prêmio de pelo menos um dos lados.');

  const indicacao = await findReferralByCode(arenaId, code);
  if (!indicacao) throw new Error('Código de indicação não encontrado nesta arena.');
  if (indicacao.referrer_id === referredId) {
    throw new Error('Ninguém pode indicar a si mesmo.');
  }
  if ((indicacao.redeemed_by || []).includes(referredId)) {
    throw new Error('Esta pessoa já foi creditada com este código.');
  }
  const limite = Number(program?.max_per_referrer) || 0;
  if (limite > 0 && (Number(indicacao.redeemed_count) || 0) >= limite) {
    throw new Error(`Este código já chegou ao limite de ${limite} ${limite === 1 ? 'indicação' : 'indicações'}.`);
  }
  if (program?.first_booking_only && await hasPriorArenaBooking(arenaId, referredId, { exceptBookingId })) {
    throw new Error('A indicação vale só para quem nunca reservou nesta arena — e esta pessoa já reservou.');
  }

  await updateDoc(doc(db, COL_REFERRALS, indicacao.id), {
    redeemed_count: increment(1),
    redeemed_by: arrayUnion(referredId),
    // O quanto foi creditado, somado a cada resgate: é o CUSTO do programa no
    // controle de uso. Sem isto a arena só saberia quantas indicações pagou.
    reward_total: increment(paraQuemIndica + paraQuemChega),
    last_redeemed_at: serverTimestamp(),
    status: 'redeemed',
  });

  await createAuditLog({
    action: 'arena_referral_redeemed',
    actor,
    details: {
      arena_id: arenaId,
      code: indicacao.code,
      referrer_id: indicacao.referrer_id,
      referred_id: referredId,
      referred_name: referredName,
      referrer_reward: paraQuemIndica,
      referred_reward: paraQuemChega,
      referred_discount: descontoChegada,
      booking_id: exceptBookingId,
    },
  });
  return {
    referrerId: indicacao.referrer_id,
    referrerReward: paraQuemIndica,
    referredReward: paraQuemChega,
    // Compatibilidade: quem ainda lê `reward` recebe o de quem indicou.
    reward: paraQuemIndica,
  };
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
export async function updateArenaCoupon(couponId, input, actor, { arenaId = null } = {}) {
  if (!couponId) throw new Error('couponId obrigatório.');
  const { valid, errors, value } = normalizeCouponInput(input);
  if (!valid) throw new Error(Object.values(errors)[0] || 'Dados inválidos.');
  if (arenaId && value.kind === COUPON_KIND.REFERRAL && value.active) await garantirUmProgramaSo(arenaId, couponId);
  await updateDoc(doc(db, COL_COUPONS, couponId), { ...value, updated_at: serverTimestamp() });
  if (arenaId && input?.unit_cost !== undefined) {
    // Deixou de ser vale: o custo unitário não se aplica mais e sai.
    const custo = couponFamily(value) === COUPON_FAMILY.VOUCHER ? input.unit_cost : null;
    await setCouponUnitCost(arenaId, couponId, custo, actor).catch((err) => {
      logger.info('Cupom salvo sem o custo unitário', { err: err?.code });
    });
  }
  await createAuditLog({
    action: 'arena_coupon_updated',
    actor,
    details: { coupon_id: couponId, code: value.code, kind: value.kind },
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
  if (active) {
    // Religar um programa de indicação com outro já ativo daria duas regras.
    const snap = await getDoc(doc(db, COL_COUPONS, couponId));
    const c = snap.exists() ? snap.data() : null;
    if (c && couponKind(c) === COUPON_KIND.REFERRAL) await garantirUmProgramaSo(c.arena_id, couponId);
  }
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
export async function deleteArenaCoupon(couponId, actor, { arenaId = null } = {}) {
  if (!couponId) return;
  await deleteDoc(doc(db, COL_COUPONS, couponId));
  // O custo unitário do vale apagado sai junto — sem cupom, é um número solto.
  if (arenaId) {
    await setCouponUnitCost(arenaId, couponId, null, actor).catch(() => {});
  }
  await createAuditLog({ action: 'arena_coupon_deleted', actor, details: { coupon_id: couponId } });
}
