/**
 * Service: a INDICAÇÃO que chega junto com a reserva (Onda BY).
 *
 * O atleta digita, no pedido de reserva, o código de quem o indicou. O código
 * vai gravado na reserva (`referral: { code, status: 'pending' }`) e é
 * conferido **pela arena, na confirmação** — não no pedido, por dois motivos:
 *
 *  1. o atleta não lê os códigos dos outros (a regra só deixa o dono e a arena
 *     lerem `arena_referrals`), então ele não TEM como conferir;
 *  2. creditar carteira é escrita da arena. A confirmação é feita por ela —
 *     é o momento em que dá para conferir, creditar e avisar de uma vez.
 *
 * Tudo aqui NUNCA derruba a confirmação: a reserva já está confirmada, e uma
 * indicação que não fechou é um lançamento a acertar, não um jogo a desmarcar.
 * Recusada, ela fica gravada COM O MOTIVO — para a arena e para o atleta.
 */
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';
import { createAuditLog } from '@/core/services/auditService';
import { notifyUsers, NOTIFICATION_TYPE } from '@/core/services/notificationService';
import {
  BOOKING_REFERRAL_STATUS, normalizeReferralCode, referralProgram, referralRewards,
} from '../domain/marketing.js';
import { formatPrice } from '../domain/pricing.js';
import { listArenaCoupons, redeemReferral } from './marketingService.js';
import { creditWallet } from './membersService.js';

const COL_BOOKINGS = 'arena_bookings';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Confere e aplica a indicação de uma reserva que a arena está confirmando.
 *
 * @param {object} booking  a reserva (como estava antes da confirmação)
 * @param {{ agreedPrice?: number|null }} [opts]
 * @param {object|null} [actor]  o gestor que confirma
 * @returns {Promise<{ status: string, reason?: string }|null>} `null` quando
 *   não havia indicação a conferir.
 */
export async function applyBookingReferral(booking, { agreedPrice } = {}, actor = null) {
  const ref = booking?.referral;
  const code = normalizeReferralCode(ref?.code);
  if (!code || ref?.status !== BOOKING_REFERRAL_STATUS.PENDING) return null;
  const arenaId = booking.arena_id;
  const referredId = booking.athlete_id;
  if (!arenaId || !referredId) return null;

  const valor = num(agreedPrice ?? booking.agreed_price ?? booking.proposed_price) ?? 0;
  const bookingRef = doc(db, COL_BOOKINGS, booking.id);
  const arenaNome = String(booking.arena_name || 'a arena').slice(0, 40);

  const recusar = async (motivo) => {
    await updateDoc(bookingRef, {
      'referral.status': BOOKING_REFERRAL_STATUS.REFUSED,
      'referral.reason': String(motivo || 'Não foi possível aplicar.').slice(0, 200),
      'referral.decided_at': serverTimestamp(),
      updated_at: serverTimestamp(),
    }).catch(() => {});
    notifyUsers([referredId], {
      title: 'O código de indicação não foi aplicado',
      message: `Na reserva em ${arenaNome}: ${motivo}`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-reservas',
      actor,
    }).catch(() => {});
    return { status: BOOKING_REFERRAL_STATUS.REFUSED, reason: motivo };
  };

  let programa = null;
  try {
    programa = referralProgram(await listArenaCoupons(arenaId, { onlyActive: true }));
  } catch (err) {
    // Sem conseguir ler as regras, nada é decidido: a indicação continua
    // pendente, e a arena pode registrar depois, na aba Indicações.
    logger.warn('Indicação da reserva: regras não carregaram', { booking_id: booking.id, err: err?.code });
    return { status: BOOKING_REFERRAL_STATUS.PENDING };
  }
  if (!programa) return recusar('a arena não tem regras de indicação valendo.');

  const premios = referralRewards(programa, { amount: valor });
  if (premios.blocked) return recusar(premios.blocked);

  let resgate;
  try {
    resgate = await redeemReferral(arenaId, {
      code,
      referredId,
      referredName: booking.athlete_name || '',
      referrerReward: premios.referrerCredit,
      referredReward: premios.referredCredit,
      referredDiscount: premios.referredDiscount,
      program: programa,
      exceptBookingId: booking.id,
    }, actor);
  } catch (err) {
    return recusar(err?.message || 'Não foi possível aplicar.');
  }

  // Os créditos: cada um isolado, para a falha de um não levar o outro.
  if (resgate.referrerReward > 0) {
    await creditWallet(arenaId, resgate.referrerId, resgate.referrerReward,
      `indicou ${booking.athlete_name || 'um amigo'}`, actor).catch((err) => {
      logger.warn('Indicação: crédito de quem indicou falhou', { booking_id: booking.id, err: err?.code });
    });
  }
  if (resgate.referredReward > 0) {
    await creditWallet(arenaId, referredId, resgate.referredReward, 'veio por indicação', actor).catch((err) => {
      logger.warn('Indicação: crédito de quem chegou falhou', { booking_id: booking.id, err: err?.code });
    });
  }

  const desconto = Math.min(valor, premios.referredDiscount);
  const patch = {
    'referral.status': BOOKING_REFERRAL_STATUS.APPLIED,
    'referral.referrer_id': resgate.referrerId,
    'referral.referrer_reward': resgate.referrerReward,
    'referral.referred_reward': resgate.referredReward,
    'referral.discount_value': desconto,
    'referral.decided_at': serverTimestamp(),
    updated_at: serverTimestamp(),
  };
  // O desconto de quem chega entra no valor ACORDADO — é o que a arena cobra.
  if (desconto > 0) patch.agreed_price = Math.max(0, Math.round((valor - desconto) * 100) / 100);
  await updateDoc(bookingRef, patch);

  const paraQuemChegou = [
    desconto > 0 ? `${formatPrice(desconto)} de desconto nesta reserva` : null,
    resgate.referredReward > 0 ? `${formatPrice(resgate.referredReward)} em crédito na arena` : null,
  ].filter(Boolean).join(' e ');
  if (paraQuemChegou) {
    notifyUsers([referredId], {
      title: 'Indicação aplicada',
      message: `Em ${arenaNome}: ${paraQuemChegou}.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: '/minhas-reservas',
      actor,
    }).catch(() => {});
  }
  if (resgate.referrerReward > 0) {
    notifyUsers([resgate.referrerId], {
      title: 'Sua indicação deu certo',
      message: `${booking.athlete_name || 'Quem você indicou'} reservou em ${arenaNome}: ${formatPrice(resgate.referrerReward)} de crédito para você.`,
      type: NOTIFICATION_TYPE.GENERIC,
      link: `/arenas/${arenaId}`,
      actor,
    }).catch(() => {});
  }

  await createAuditLog({
    action: 'arena_booking_referral_applied',
    actor,
    details: {
      arena_id: arenaId, booking_id: booking.id, code, referrer_id: resgate.referrerId,
      referred_id: referredId, discount: desconto,
      referrer_reward: resgate.referrerReward, referred_reward: resgate.referredReward,
    },
  }).catch(() => {});

  return { status: BOOKING_REFERRAL_STATUS.APPLIED };
}
