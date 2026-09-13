import { describe, it, expect } from 'vitest';
import { DEFAULT_TIERS, MEMBER_STATUS } from './members.js';
import {
  isMemberActive,
  memberBookingPrice,
  memberTier,
  normalizeTiers,
  planPackageConsumption,
  pointsForBooking,
  slotsHours,
  tierProgress,
  usableHours,
} from './memberBenefit.js';

/** Arena com preço padrão de R$ 100/h. */
const ARENA = { id: 'a1', base_price: 100 };
const SLOT = (start, end, date = '2026-07-20') => ({ date, start, end });

/** Uma seleção de 2h (R$ 200 na tabela). */
const DUAS_HORAS = { courtId: 'q1', slots: [SLOT('19:00', '21:00')] };

const membro = (over = {}) => ({
  user_id: 'u1', points: 0, status: MEMBER_STATUS.ACTIVE, ...over,
});
const pacote = (over = {}) => ({
  id: 'p1', total_hours: 10, used_hours: 0, expires_at: Date.now() + 86_400_000, ...over,
});

describe('isMemberActive', () => {
  it('ativo é ativo; pausado, cancelado e ausente não são', () => {
    expect(isMemberActive(membro())).toBe(true);
    expect(isMemberActive(membro({ status: MEMBER_STATUS.PAUSED }))).toBe(false);
    expect(isMemberActive(membro({ status: MEMBER_STATUS.CANCELLED }))).toBe(false);
    expect(isMemberActive(null)).toBe(false);
  });

  it('sem status gravado, vale como ativo (documento antigo)', () => {
    expect(isMemberActive({ user_id: 'u1' })).toBe(true);
  });
});

describe('normalizeTiers', () => {
  it('sem configuração da arena, usa a padrão', () => {
    expect(normalizeTiers(null)).toHaveLength(DEFAULT_TIERS.length);
    expect(normalizeTiers([])[0].id).toBe('bronze');
  });

  it('descarta nível malformado', () => {
    const out = normalizeTiers([
      { id: 'ok', name: 'Ok', min_points: 0, discount_pct: 5 },
      { name: 'sem id', min_points: 10 },
      { id: 'sem pontos' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('ok');
  });

  it('prende o desconto entre 0 e 100', () => {
    const out = normalizeTiers([{ id: 'x', min_points: 0, discount_pct: 500 }]);
    expect(out[0].discount_pct).toBe(100);
  });
});

describe('memberTier', () => {
  it('o nível vem dos pontos', () => {
    expect(memberTier(membro({ points: 0 })).tier.id).toBe('bronze');
    expect(memberTier(membro({ points: 600 })).tier.id).toBe('gold');
    expect(memberTier(membro({ points: 600 })).discountPct).toBe(10);
  });

  it('membro pausado não tem benefício', () => {
    const r = memberTier(membro({ points: 9999, status: MEMBER_STATUS.PAUSED }));
    expect(r.tier).toBeNull();
    expect(r.discountPct).toBe(0);
  });

  it('quem não é membro não tem benefício', () => {
    expect(memberTier(null).discountPct).toBe(0);
  });
});

describe('tierProgress', () => {
  it('diz quanto falta para o próximo nível', () => {
    const p = tierProgress(membro({ points: 60 }));
    expect(p.current.id).toBe('bronze');
    expect(p.next.id).toBe('silver');
    expect(p.missing).toBe(40);
    expect(p.progress).toBe(60);
  });

  it('no topo, não há próximo', () => {
    const p = tierProgress(membro({ points: 99999 }));
    expect(p.next).toBeNull();
    expect(p.progress).toBe(100);
  });

  it('sem membro, começa do começo', () => {
    expect(tierProgress(null).current.id).toBe('bronze');
  });
});

describe('usableHours', () => {
  it('conta o que sobra do pacote', () => {
    expect(usableHours(pacote({ total_hours: 10, used_hours: 3 }))).toBe(7);
  });

  it('⭐ pacote VENCIDO não tem hora nenhuma, mesmo com saldo', () => {
    expect(usableHours(pacote({ expires_at: Date.now() - 1000 }))).toBe(0);
  });

  it('pacote sem validade nunca vence', () => {
    expect(usableHours(pacote({ expires_at: null }))).toBe(10);
  });

  it('usado além do total não vira negativo', () => {
    expect(usableHours(pacote({ total_hours: 2, used_hours: 5 }))).toBe(0);
  });
});

describe('slotsHours', () => {
  it('soma a duração dos horários', () => {
    expect(slotsHours([SLOT('19:00', '21:00'), SLOT('08:00', '09:30')])).toBe(3.5);
  });

  it('ignora horário inválido ou invertido', () => {
    expect(slotsHours([SLOT('21:00', '19:00'), SLOT('xx', 'yy'), null])).toBe(0);
  });
});

describe('⭐ memberBookingPrice — o benefício chega ao preço', () => {
  it('sem membro, o preço é o da tabela', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {});
    expect(r.table).toBe(200);
    expect(r.total).toBe(200);
    expect(r.discountValue).toBe(0);
  });

  it('membro Ouro paga 10% menos', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, { member: membro({ points: 600 }) });
    expect(r.discountPct).toBe(10);
    expect(r.discountValue).toBe(20);
    expect(r.total).toBe(180);
  });

  it('membro PAUSADO paga cheio', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro({ points: 600, status: MEMBER_STATUS.PAUSED }),
    });
    expect(r.total).toBe(200);
  });

  it('o pacote abate HORAS, não percentual', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro(), packages: [pacote({ total_hours: 1 })],
    });
    expect(r.packageHours).toBe(1);
    expect(r.packageValue).toBe(100);
    expect(r.total).toBe(100);
  });

  it('pacote com horas de sobra cobre tudo', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro(), packages: [pacote({ total_hours: 10 })],
    });
    expect(r.packageHours).toBe(2);
    expect(r.total).toBe(0);
  });

  it('⭐ o pacote vem ANTES do desconto — senão o desconto seria dado duas vezes', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro({ points: 600 }),          // 10%
      packages: [pacote({ total_hours: 1 })],   // 1h de 2h
    });
    // 200 − 100 (pacote) = 100; 10% de 100 = 10; total 90.
    // Se o desconto viesse antes: 200 − 20 = 180; − 90 (pacote) = 90 … mas o
    // abatimento do pacote teria sido descontado junto, dando 92 e não 90.
    expect(r.packageValue).toBe(100);
    expect(r.discountValue).toBe(10);
    expect(r.total).toBe(90);
  });

  it('a carteira abate por último, e nunca deixa negativo', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro(), wallet: { balance: 500 },
    });
    expect(r.walletValue).toBe(200);
    expect(r.total).toBe(0);
  });

  it('carteira menor que a conta abate só o que tem', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro(), wallet: { balance: 30 },
    });
    expect(r.walletValue).toBe(30);
    expect(r.total).toBe(170);
  });

  it('dá para pedir para NÃO usar carteira nem pacote', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro({ points: 600 }),
      packages: [pacote()],
      wallet: { balance: 500 },
      usePackage: false,
      useWallet: false,
    });
    expect(r.packageValue).toBe(0);
    expect(r.walletValue).toBe(0);
    expect(r.total).toBe(180);
  });

  it('⭐ o detalhamento explica CADA abatimento', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro({ points: 600 }),
      packages: [pacote({ total_hours: 1 })],
      wallet: { balance: 50 },
    });
    const rotulos = r.lines.map((l) => l.label);
    expect(rotulos[0]).toBe('Valor da tabela');
    expect(rotulos.some((l) => l.startsWith('Pacote'))).toBe(true);
    expect(rotulos.some((l) => l.startsWith('Desconto Ouro'))).toBe(true);
    expect(rotulos.some((l) => l.includes('carteira'))).toBe(true);
    // A soma do detalhamento é o total.
    expect(r.lines.reduce((a, l) => a + l.value, 0)).toBeCloseTo(r.total, 2);
  });

  it('pacote vencido não abate nada', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro(), packages: [pacote({ expires_at: Date.now() - 1 })],
    });
    expect(r.total).toBe(200);
  });

  it('seleção vazia não quebra', () => {
    const r = memberBookingPrice(ARENA, { slots: [] }, { member: membro({ points: 600 }) });
    expect(r.total).toBe(0);
    expect(r.hours).toBe(0);
  });
});

describe('pointsForBooking', () => {
  it('pontua por real e por hora', () => {
    expect(pointsForBooking({ amount: 200, hours: 2 })).toBe(220);
  });

  it('⭐ quem usou pacote pagou antes e continua vindo: pontua pela presença', () => {
    expect(pointsForBooking({ amount: 0, hours: 2 })).toBe(20);
  });

  it('nunca negativo, sempre inteiro', () => {
    expect(pointsForBooking({ amount: -50, hours: -1 })).toBe(0);
    expect(Number.isInteger(pointsForBooking({ amount: 33.33, hours: 1.5 }))).toBe(true);
  });

  it('sem argumento, zero', () => {
    expect(pointsForBooking()).toBe(0);
  });
});

describe('planPackageConsumption', () => {
  const agora = Date.now();
  const dia = 86_400_000;

  it('⭐ consome primeiro o que VENCE ANTES', () => {
    const plano = planPackageConsumption([
      pacote({ id: 'novo', total_hours: 5, expires_at: agora + 30 * dia }),
      pacote({ id: 'velho', total_hours: 5, expires_at: agora + 2 * dia }),
    ], 3, agora);
    expect(plano).toEqual([{ id: 'velho', hours: 3 }]);
  });

  it('atravessa mais de um pacote quando precisa', () => {
    const plano = planPackageConsumption([
      pacote({ id: 'velho', total_hours: 2, expires_at: agora + 2 * dia }),
      pacote({ id: 'novo', total_hours: 5, expires_at: agora + 30 * dia }),
    ], 4, agora);
    expect(plano).toEqual([{ id: 'velho', hours: 2 }, { id: 'novo', hours: 2 }]);
  });

  it('pula pacote vencido', () => {
    const plano = planPackageConsumption([
      pacote({ id: 'vencido', total_hours: 9, expires_at: agora - 1 }),
      pacote({ id: 'valido', total_hours: 9, expires_at: agora + dia }),
    ], 2, agora);
    expect(plano).toEqual([{ id: 'valido', hours: 2 }]);
  });

  it('sem horas a consumir, plano vazio', () => {
    expect(planPackageConsumption([pacote()], 0)).toEqual([]);
  });

  it('mais horas do que existe: consome tudo o que há', () => {
    const plano = planPackageConsumption([pacote({ total_hours: 2 })], 10, agora);
    expect(plano).toEqual([{ id: 'p1', hours: 2 }]);
  });
});

describe('⭐ cupom na conta', () => {
  const cupom = (over = {}) => ({
    code: 'VERAO10', type: 'percent', value: 10, active: true, ...over,
  });

  it('desconta sobre o valor da tabela quando não há membro', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, { coupon: cupom() });
    expect(r.couponValue).toBe(20);
    expect(r.total).toBe(180);
  });

  it('⭐ vale para quem NÃO é membro — é promoção da arena, não benefício', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, { member: null, coupon: cupom() });
    expect(r.couponValue).toBeGreaterThan(0);
  });

  it('⭐ vem DEPOIS do desconto de nível, não sobre a tabela', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro({ points: 600 }), // 10%
      coupon: cupom(),                 // 10%
    });
    // 200 − 20 (nível) = 180; 10% de 180 = 18; total 162.
    // Se o cupom fosse sobre a tabela: 200 − 20 − 20 = 160.
    expect(r.discountValue).toBe(20);
    expect(r.couponValue).toBe(18);
    expect(r.total).toBe(162);
  });

  it('cupom de valor fixo maior que a conta não deixa negativo', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      coupon: cupom({ type: 'fixed', value: 999 }),
    });
    expect(r.total).toBe(0);
  });

  it('a carteira abate DEPOIS do cupom', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, {
      member: membro(), coupon: cupom(), wallet: { balance: 1000 },
    });
    expect(r.couponValue).toBe(20);
    expect(r.walletValue).toBe(180);
    expect(r.total).toBe(0);
  });

  it('o código do cupom vai no resultado, para gravar na reserva', () => {
    const r = memberBookingPrice(ARENA, DUAS_HORAS, { coupon: cupom() });
    expect(r.couponCode).toBe('VERAO10');
  });

  it('sem cupom, o campo fica nulo (e não "sem cupom")', () => {
    expect(memberBookingPrice(ARENA, DUAS_HORAS, {}).couponCode).toBeNull();
  });
});
