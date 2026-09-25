/**
 * Os TIPOS de cupom (2026-09-25).
 *
 * O que protege:
 *  1. ⭐ cupom antigo (sem `kind`) é desconto — idêntico ao que sempre foi;
 *  2. cada família grava só os seus campos — nada herdado do formulário;
 *  3. ⭐ hora grátis abate a PROPORÇÃO das horas, e nunca passa da conta;
 *  4. ⭐ vale e indicação NÃO entram no preço, e o erro diz onde usar;
 *  5. o programa de indicação: regras, o vigente, e o que cada lado ganha;
 *  6. as promoções públicas sabem o que é aplicável na reserva.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  COUPON_FAMILY, COUPON_KIND, COUPON_TYPE, REFERRED_REWARD,
  couponBenefitText, couponDiscount, couponError, couponFamily, couponKind, couponLabel,
  isBookingCoupon, normalizeCouponInput, publicPromos, referralProgram, referralRewards,
  referralRulesText, referralFriendReward, referralInviteText,
} from './marketing.js';
import { memberBookingPrice } from './memberBenefit.js';

describe('⭐ cupom antigo continua sendo o que era', () => {
  const antigo = { id: 'c1', code: 'VERAO10', type: 'percent', value: 10, active: true };
  it('sem kind é desconto, da família reserva', () => {
    expect(couponKind(antigo)).toBe(COUPON_KIND.DISCOUNT);
    expect(couponFamily(antigo)).toBe(COUPON_FAMILY.BOOKING);
    expect(isBookingCoupon(antigo)).toBe(true);
  });
  it('rótulo e desconto idênticos', () => {
    expect(couponLabel(antigo)).toBe('VERAO10 · 10% de desconto');
    expect(couponDiscount(200, antigo)).toBe(20);
    expect(couponLabel({ code: 'M30', type: 'fixed', value: 30 })).toBe('M30 · R$ 30,00 de desconto');
  });
  it('kind desconhecido também cai em desconto (nunca quebra)', () => {
    expect(couponKind({ kind: 'algo-novo' })).toBe(COUPON_KIND.DISCOUNT);
  });
});

describe('normalizeCouponInput por família', () => {
  it('desconto: igual ao de sempre, com kind gravado', () => {
    const { valid, value } = normalizeCouponInput({ code: 'x10', type: 'percent', value: 10 });
    expect(valid).toBe(true);
    expect(value).toMatchObject({ kind: 'discount', code: 'X10', type: 'percent', value: 10, benefit: null, face_value: null });
  });

  it('hora grátis: horas de meia em meia, sem tipo de desconto', () => {
    const { valid, value } = normalizeCouponInput({ kind: 'free_hours', code: 'HORA', value: 1.3, type: 'fixed' });
    expect(valid).toBe(true);
    expect(value).toMatchObject({ kind: 'free_hours', value: 1.5, type: null });
    expect(normalizeCouponInput({ kind: 'free_hours', code: 'H', value: 0 }).errors.value).toBeTruthy();
    expect(normalizeCouponInput({ kind: 'free_hours', code: 'H', value: 30 }).errors.value).toBeTruthy();
  });

  it('⭐ vale: exige o benefício, e não grava valor de desconto herdado do formulário', () => {
    const sem = normalizeCouponInput({ kind: 'drink', code: 'COCO', value: 10 });
    expect(sem.valid).toBe(false);
    expect(sem.errors.benefit).toBeTruthy();
    const { valid, value } = normalizeCouponInput({
      kind: 'drink', code: 'COCO', value: 10, type: 'percent', benefit: ' 1 água de coco ', face_value: '8', min_amount: 50,
    });
    expect(valid).toBe(true);
    expect(value).toMatchObject({ kind: 'drink', benefit: '1 água de coco', face_value: 8, value: null, type: null, min_amount: null });
  });

  it('indicação: código automático, regras com padrões seguros, nunca divulgada como promoção', () => {
    const { valid, value } = normalizeCouponInput({
      kind: 'referral', referrer_reward: 20, referred_reward_kind: 'percent', referred_reward_value: 10, show_public: true,
    });
    expect(valid).toBe(true);
    expect(value).toMatchObject({
      kind: 'referral', code: 'INDICACAO', referrer_reward: 20, referred_reward_kind: 'percent',
      referred_reward_value: 10, first_booking_only: true, once_per_user: true, show_public: false,
    });
  });

  it('indicação sem prêmio nenhum é recusada; percentual acima de 100 também', () => {
    expect(normalizeCouponInput({ kind: 'referral', referrer_reward: 0, referred_reward_value: 0 }).valid).toBe(false);
    expect(normalizeCouponInput({ kind: 'referral', referrer_reward: 5, referred_reward_kind: 'percent', referred_reward_value: 150 }).valid).toBe(false);
  });

  it('"nenhum prêmio" para quem chega zera o valor', () => {
    const { value } = normalizeCouponInput({ kind: 'referral', referrer_reward: 15, referred_reward_kind: 'none', referred_reward_value: 30 });
    expect(value.referred_reward_value).toBe(0);
  });
});

describe('⭐ hora grátis na conta da reserva', () => {
  const hora = { kind: 'free_hours', code: 'HORA', value: 1, active: true };
  it('abate a proporção das horas da reserva', () => {
    expect(couponDiscount(200, hora, { hours: 2 })).toBe(100);
    expect(couponDiscount(150, hora, { hours: 3 })).toBe(50);
  });
  it('nunca passa da conta (2 horas grátis numa reserva de 1 hora)', () => {
    expect(couponDiscount(80, { ...hora, value: 2 }, { hours: 1 })).toBe(80);
  });
  it('sem saber as horas, não abate nada', () => {
    expect(couponDiscount(200, hora)).toBe(0);
  });
  it('entra no preço da reserva, e a hora já coberta pelo pacote não é dada de novo', () => {
    const arena = { id: 'a1', base_price: 100 };
    const slots = [{ date: '2026-10-01', start: '19:00', end: '21:00' }];
    const r = memberBookingPrice(arena, { courtId: 'q1', slots }, { coupon: hora });
    expect(r.table).toBe(200);
    expect(r.couponValue).toBe(100);
    expect(r.total).toBe(100);
    expect(r.lines.at(-1).label).toBe('HORA · 1 hora grátis');
    // Membro com 1 hora de pacote: sobra 1 hora paga, e a hora grátis cobre ESSA.
    const comPacote = memberBookingPrice(arena, { courtId: 'q1', slots }, {
      coupon: hora,
      member: { user_id: 'u1', points: 0, status: 'active' },
      packages: [{ id: 'p1', total_hours: 1, used_hours: 0, expires_at: Date.now() + 86_400_000 }],
    });
    expect(comPacote.packageValue).toBe(100);
    expect(comPacote.couponValue).toBe(100);
    expect(comPacote.total).toBe(0);
  });
});

describe('⭐ vale e indicação não entram no preço', () => {
  const vale = { kind: 'drink', code: 'COCO', benefit: '1 água de coco', active: true };
  const ind = { kind: 'referral', code: 'INDICACAO', referrer_reward: 20, active: true };
  it('abatem zero', () => {
    expect(couponDiscount(200, vale)).toBe(0);
    expect(couponDiscount(200, ind)).toBe(0);
  });
  it('o erro diz ONDE usar', () => {
    expect(couponError(vale)).toMatch(/recepção/);
    expect(couponError(ind)).toMatch(/quem indicou/);
  });
  it('na recepção (anyFamily) o vale é conferido pelas regras de sempre', () => {
    expect(couponError(vale, { anyFamily: true })).toBeNull();
    expect(couponError({ ...vale, active: false }, { anyFamily: true })).toMatch(/não está mais valendo/);
    expect(couponError({ ...vale, once_per_user: true }, { anyFamily: true, usedByUser: true })).toMatch(/já usou/);
  });
  it('o benefício do vale é o texto que a arena escreveu', () => {
    expect(couponBenefitText(vale)).toBe('1 água de coco');
    expect(couponLabel(vale)).toBe('COCO · 1 água de coco');
  });
});

describe('o programa de indicação', () => {
  const agora = Date.UTC(2026, 8, 25);
  const programa = {
    id: 'p', kind: 'referral', code: 'INDICACAO', active: true,
    referrer_reward: 20, referred_reward_kind: REFERRED_REWARD.PERCENT, referred_reward_value: 10,
    created_at: Timestamp.fromMillis(agora - 1000),
  };

  it('as regras em uma linha', () => {
    expect(referralRulesText(programa)).toBe('Quem indica ganha R$ 20,00 em crédito · quem chega ganha 10% na primeira reserva');
    expect(referralRulesText({ referrer_reward: 0, referred_reward_kind: 'credit', referred_reward_value: 15 }))
      .toBe('Quem chega ganha R$ 15,00 em crédito');
  });

  it('o vigente é o ligado e no prazo — com dois, o mais novo', () => {
    const velho = { ...programa, id: 'v', created_at: Timestamp.fromMillis(agora - 99999) };
    const desligado = { ...programa, id: 'd', active: false, created_at: Timestamp.fromMillis(agora) };
    expect(referralProgram([velho, programa, desligado, { code: 'X', type: 'percent', value: 5, active: true }], agora).id).toBe('p');
    expect(referralProgram([desligado], agora)).toBeNull();
  });

  it('o que cada lado ganha', () => {
    expect(referralRewards(programa, { amount: 200 })).toEqual({
      referrerCredit: 20, referredCredit: 0, referredDiscount: 20, blocked: null,
    });
    const credito = { ...programa, referred_reward_kind: 'credit', referred_reward_value: 15 };
    expect(referralRewards(credito, { amount: 200 })).toMatchObject({ referredCredit: 15, referredDiscount: 0 });
    const fixo = { ...programa, referred_reward_kind: 'fixed', referred_reward_value: 50 };
    expect(referralRewards(fixo, { amount: 30 }).referredDiscount).toBe(30);
  });

  it('sem programa, ou abaixo do mínimo, nada — e diz por quê', () => {
    expect(referralRewards(null).blocked).toMatch(/ainda não definiu/);
    expect(referralRewards({ ...programa, min_amount: 100 }, { amount: 80 }).blocked).toMatch(/a partir de R\$ 100,00/);
  });
});

describe('promoções públicas', () => {
  const agora = Date.UTC(2026, 8, 25);
  const cupons = [
    { id: 'a', code: 'VERAO', type: COUPON_TYPE.PERCENT, value: 10, active: true, show_public: true },
    { id: 'b', kind: 'drink', code: 'COCO', benefit: '1 água de coco', active: true, show_public: true },
    { id: 'c', kind: 'referral', code: 'INDICACAO', referrer_reward: 20, active: true, show_public: true },
  ];
  it('sabem o que é aplicável na reserva, e a indicação não entra (ela tem o próprio cartão)', () => {
    const promos = publicPromos(cupons, agora);
    expect(promos.map((p) => p.code)).toEqual(['COCO', 'VERAO']);
    expect(promos.find((p) => p.code === 'VERAO')).toMatchObject({ bookable: true, discount: '10% de desconto' });
    expect(promos.find((p) => p.code === 'COCO')).toMatchObject({ bookable: false, family: 'vale', discount: '1 água de coco' });
  });
});

describe('o convite de indicação diz o que as regras dão', () => {
  const programa = { kind: 'referral', referrer_reward: 20, referred_reward_kind: 'percent', referred_reward_value: 10 };
  it('o que quem chega ganha', () => {
    expect(referralFriendReward(programa)).toBe('10% na primeira reserva');
    expect(referralFriendReward({ ...programa, referred_reward_kind: 'credit', referred_reward_value: 15 })).toBe('R$ 15,00 em crédito');
    expect(referralFriendReward({ ...programa, referred_reward_kind: 'none' })).toBeNull();
    expect(referralFriendReward(null)).toBeNull();
  });
  it('o convite, com e sem programa', () => {
    expect(referralInviteText({ arenaName: 'Arena X', code: 'ANA1', program: programa }))
      .toBe('Jogo na Arena X — use meu código ANA1 na sua primeira reserva e ganhe 10% de desconto nela.');
    expect(referralInviteText({ arenaName: 'Arena X', code: 'ANA1', program: { ...programa, referred_reward_value: 0 } }))
      .toBe('Jogo na Arena X — use meu código ANA1 na sua primeira reserva.');
    expect(referralInviteText({ arenaName: 'Arena X', code: 'ANA1' })).toMatch(/nós dois ganhamos crédito/);
  });
});
