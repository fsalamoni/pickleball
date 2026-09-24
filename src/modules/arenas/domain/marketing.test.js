import { describe, it, expect } from 'vitest';
import {
  classifyNps, calculateNps, normalizeCouponInput, isCouponValid, applyCoupon, publicPromos, promoConditions,
  generateReferralCode, calculateLoyaltyPoints, CAMPAIGN_STATUS, COUPON_TYPE, NPS_SCORE,
  couponError,
  couponDiscount,
  couponLabel,
  redeemPoints,
  CAMPAIGN_AUDIENCE,
  campaignRecipients,
  shouldAskNps,
} from './marketing.js';

describe('classifyNps', () => {
  it('classifica detractor (0-6)', () => {
    expect(classifyNps(0)).toBe('detractor');
    expect(classifyNps(6)).toBe('detractor');
  });
  it('classifica passive (7-8)', () => {
    expect(classifyNps(7)).toBe('passive');
    expect(classifyNps(8)).toBe('passive');
  });
  it('classifica promoter (9-10)', () => {
    expect(classifyNps(9)).toBe('promoter');
    expect(classifyNps(10)).toBe('promoter');
  });
  it('null para inválido', () => {
    expect(classifyNps(NaN)).toBeNull();
    expect(classifyNps(null)).toBeNull();
  });
});

describe('calculateNps', () => {
  it('NPS 100 para todos promoters', () => {
    expect(calculateNps([{ score: 10 }, { score: 9 }])).toBe(100);
  });
  it('NPS -100 para todos detractors', () => {
    expect(calculateNps([{ score: 0 }, { score: 3 }])).toBe(-100);
  });
  it('NPS 0 para mix equilibrado', () => {
    expect(calculateNps([{ score: 10 }, { score: 0 }])).toBe(0);
  });
  it('0 para vazio', () => {
    expect(calculateNps([])).toBe(0);
  });
});

describe('normalizeCouponInput', () => {
  it('aceita cupom percent válido', () => {
    const r = normalizeCouponInput({ code: 'verao10', type: 'percent', value: 10 });
    expect(r.valid).toBe(true);
    expect(r.value.code).toBe('VERAO10');
  });
  it('aceita cupom fixed', () => {
    const r = normalizeCouponInput({ code: 'desconto', type: 'fixed', value: 50 });
    expect(r.valid).toBe(true);
  });
  it('rejeita sem código', () => {
    expect(normalizeCouponInput({ value: 10 }).valid).toBe(false);
  });
  it('rejeita percent > 100', () => {
    expect(normalizeCouponInput({ code: 'X', type: 'percent', value: 150 }).valid).toBe(false);
  });
});

describe('isCouponValid', () => {
  it('true se ativo e não expirou', () => {
    const c = { active: true, used_count: 0 };
    expect(isCouponValid(c, Date.now())).toBe(true);
  });
  it('false se inativo', () => {
    expect(isCouponValid({ active: false }, Date.now())).toBe(false);
  });
  it('false se atingiu max_uses', () => {
    expect(isCouponValid({ active: true, used_count: 10, max_uses: 10 }, Date.now())).toBe(false);
  });
  it('false se expirou', () => {
    const yesterday = Date.now() - 86_400_000;
    expect(isCouponValid({ active: true, used_count: 0, expires_at: yesterday }, Date.now())).toBe(false);
  });
});

describe('applyCoupon', () => {
  it('aplica percent', () => {
    expect(applyCoupon(100, { active: true, type: 'percent', value: 10 })).toBe(90);
  });
  it('aplica fixed', () => {
    expect(applyCoupon(100, { active: true, type: 'fixed', value: 30 })).toBe(70);
  });
  it('não aplica se inválido', () => {
    expect(applyCoupon(100, null)).toBe(100);
    expect(applyCoupon(100, { active: false, type: 'percent', value: 10 })).toBe(100);
  });
});

describe('generateReferralCode', () => {
  it('gera código único', () => {
    const c1 = generateReferralCode('user123abc');
    const c2 = generateReferralCode('user456def');
    expect(c1).toBeTruthy();
    expect(c2).toBeTruthy();
    expect(c1).not.toBe(c2);
  });
});

describe('calculateLoyaltyPoints', () => {
  it('1 ponto por R$1', () => {
    expect(calculateLoyaltyPoints(100)).toBe(100);
    expect(calculateLoyaltyPoints(50.7)).toBe(50);
  });
  it('0 para inválido', () => {
    expect(calculateLoyaltyPoints(0)).toBe(0);
    expect(calculateLoyaltyPoints(-10)).toBe(0);
  });
});

/* ================================================================== */
/*  ⭐ O cupom precisa CHEGAR ao preço — e recusar dizendo por quê     */
/* ================================================================== */

describe('couponError — o motivo, não só "inválido"', () => {
  const cupom = (over = {}) => ({
    code: 'VERAO10', type: 'percent', value: 10, active: true,
    used_count: 0, max_uses: null, min_amount: null, once_per_user: true,
    ...over,
  });

  it('cupom bom devolve null', () => {
    expect(couponError(cupom(), { amount: 100 })).toBeNull();
  });

  it('cupom que não existe', () => {
    expect(couponError(null)).toMatch(/não encontrado/i);
  });

  it('cupom desligado', () => {
    expect(couponError(cupom({ active: false }))).toMatch(/não está mais valendo/i);
  });

  it('⭐ cupom vencido diz que VENCEU', () => {
    expect(couponError(cupom({ expires_at: Date.now() - 1000 })))
      .toMatch(/venceu/i);
  });

  it('⭐ limite de usos atingido', () => {
    expect(couponError(cupom({ max_uses: 5, used_count: 5 })))
      .toMatch(/limite de usos/i);
  });

  it('⭐ já usado por esta pessoa', () => {
    expect(couponError(cupom(), { usedByUser: true })).toMatch(/já usou/i);
  });

  it('livre por pessoa: usar de novo é permitido', () => {
    expect(couponError(cupom({ once_per_user: false }), { usedByUser: true })).toBeNull();
  });

  it('⭐ valor mínimo diz QUANTO falta atingir', () => {
    const msg = couponError(cupom({ min_amount: 100 }), { amount: 80 });
    expect(msg).toMatch(/100,00/);
  });

  it('valor mínimo atingido passa', () => {
    expect(couponError(cupom({ min_amount: 100 }), { amount: 100 })).toBeNull();
  });
});

describe('couponDiscount', () => {
  it('percentual desconta a fração', () => {
    expect(couponDiscount(200, { type: 'percent', value: 10 })).toBe(20);
  });

  it('valor fixo desconta o valor', () => {
    expect(couponDiscount(200, { type: 'fixed', value: 30 })).toBe(30);
  });

  it('⭐ nunca desconta mais do que a conta — a arena não fica devendo', () => {
    expect(couponDiscount(30, { type: 'fixed', value: 50 })).toBe(30);
  });

  it('conta zerada não desconta nada', () => {
    expect(couponDiscount(0, { type: 'percent', value: 50 })).toBe(0);
  });

  it('sem cupom, zero', () => {
    expect(couponDiscount(100, null)).toBe(0);
  });
});

describe('couponLabel', () => {
  it('escreve percentual e valor fixo em português', () => {
    expect(couponLabel({ code: 'VERAO10', type: 'percent', value: 10 }))
      .toBe('VERAO10 · 10% de desconto');
    expect(couponLabel({ code: 'DEZ', type: 'fixed', value: 10 }))
      .toBe('DEZ · R$ 10,00 de desconto');
  });

  it('sem código, sem etiqueta', () => {
    expect(couponLabel(null)).toBe('');
  });
});

describe('normalizeCouponInput — o que foi acrescentado', () => {
  it('⭐ o código ignora caixa e espaço: "verao 10" é VERAO10', () => {
    expect(normalizeCouponInput({ code: ' verao 10 ', value: 10 }).value.code).toBe('VERAO10');
  });

  it('guarda valor mínimo e uma-vez-por-pessoa', () => {
    const r = normalizeCouponInput({ code: 'X', value: 10, min_amount: 50 });
    expect(r.value.min_amount).toBe(50);
    expect(r.value.once_per_user).toBe(true);
  });

  it('mínimo inválido vira null (sem mínimo), não NaN', () => {
    expect(normalizeCouponInput({ code: 'X', value: 10, min_amount: 'abc' }).value.min_amount).toBeNull();
  });
});

/* ================================================================== */
/*  Fidelidade — trocar pontos por crédito                             */
/* ================================================================== */

describe('redeemPoints', () => {
  it('troca em múltiplos exatos da taxa', () => {
    expect(redeemPoints(100, { available: 500 })).toEqual({ points: 100, credit: 5, error: null });
  });

  it('⭐ o resto fica com o atleta, não some', () => {
    // 105 pontos a 20/real = R$ 5, consumindo 100. Os 5 restantes ficam.
    expect(redeemPoints(105, { available: 500 })).toEqual({ points: 100, credit: 5, error: null });
  });

  it('não troca mais do que se tem, e diz quanto tem', () => {
    expect(redeemPoints(500, { available: 100 }).error).toMatch(/100 pontos/);
  });

  it('respeita o mínimo', () => {
    expect(redeemPoints(10, { available: 500, minPoints: 100 }).error).toMatch(/mínimo/i);
  });

  it('taxa customizada da arena', () => {
    expect(redeemPoints(100, { available: 500, pointsPerReal: 10 }).credit).toBe(10);
  });

  it('pedido inválido não vira NaN', () => {
    expect(redeemPoints(0, { available: 500 }).error).toBeTruthy();
    expect(redeemPoints('x', { available: 500 }).credit).toBe(0);
  });
});

/* ================================================================== */
/*  Campanha — para quem ela vai                                       */
/* ================================================================== */

describe('campaignRecipients', () => {
  const AGORA = new Date('2026-09-13T12:00:00').getTime();
  const DIA = 86_400_000;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const reserva = (uid, quandoMs) => ({ athlete_id: uid, slots: [{ date: iso(quandoMs) }] });

  const dados = {
    members: [{ user_id: 'membro1' }, { user_id: 'membro2' }],
    bookings: [
      reserva('recente', AGORA - 5 * DIA),
      reserva('sumido', AGORA - 200 * DIA),
      reserva('membro1', AGORA - 3 * DIA),
    ],
    now: AGORA,
  };

  it('membros: só quem está no programa', () => {
    expect(campaignRecipients(CAMPAIGN_AUDIENCE.MEMBERS, dados).sort())
      .toEqual(['membro1', 'membro2']);
  });

  it('⭐ sumidos: quem não reserva há mais de 60 dias', () => {
    expect(campaignRecipients(CAMPAIGN_AUDIENCE.LAPSED, dados)).toEqual(['sumido']);
  });

  it('frequentes: quem reservou nos últimos 60 dias', () => {
    expect(campaignRecipients(CAMPAIGN_AUDIENCE.RECENT, dados).sort())
      .toEqual(['membro1', 'recente']);
  });

  it('todo mundo: membros + quem já reservou, sem repetir', () => {
    const todos = campaignRecipients(CAMPAIGN_AUDIENCE.ALL, dados);
    expect(todos.sort()).toEqual(['membro1', 'membro2', 'recente', 'sumido']);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it('⭐ conta a reserva MAIS RECENTE de cada pessoa, não a primeira', () => {
    const comDuas = {
      ...dados,
      bookings: [reserva('x', AGORA - 300 * DIA), reserva('x', AGORA - 2 * DIA)],
      members: [],
    };
    expect(campaignRecipients(CAMPAIGN_AUDIENCE.LAPSED, comDuas)).toEqual([]);
    expect(campaignRecipients(CAMPAIGN_AUDIENCE.RECENT, comDuas)).toEqual(['x']);
  });

  it('sem dados, ninguém recebe (e não quebra)', () => {
    expect(campaignRecipients(CAMPAIGN_AUDIENCE.ALL, {})).toEqual([]);
    expect(campaignRecipients('inventado', dados).length).toBeGreaterThan(0);
  });

  it('reserva sem data não conta', () => {
    const semData = { members: [], bookings: [{ athlete_id: 'y', slots: [] }], now: AGORA };
    expect(campaignRecipients(CAMPAIGN_AUDIENCE.ALL, semData)).toEqual([]);
  });
});

/* ================================================================== */
/*  NPS — quando perguntar                                             */
/* ================================================================== */

describe('shouldAskNps', () => {
  const AGORA = new Date('2026-09-13T12:00:00').getTime();
  const DIA = 86_400_000;
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

  it('pergunta depois de uma visita recente', () => {
    expect(shouldAskNps({ lastVisitISO: iso(AGORA - 2 * DIA), now: AGORA })).toBe(true);
  });

  it('não pergunta a quem nunca veio', () => {
    expect(shouldAskNps({ lastVisitISO: null, now: AGORA })).toBe(false);
  });

  it('⭐ não pergunta sobre visita velha — ninguém lembra', () => {
    expect(shouldAskNps({ lastVisitISO: iso(AGORA - 60 * DIA), now: AGORA })).toBe(false);
  });

  it('não pergunta sobre visita que ainda não aconteceu', () => {
    expect(shouldAskNps({ lastVisitISO: iso(AGORA + 5 * DIA), now: AGORA })).toBe(false);
  });

  it('⭐ não pergunta de novo dentro do período de descanso', () => {
    expect(shouldAskNps({
      lastVisitISO: iso(AGORA - 2 * DIA),
      lastAnswerMs: AGORA - 10 * DIA,
      now: AGORA,
    })).toBe(false);
  });

  it('depois do descanso, volta a perguntar', () => {
    expect(shouldAskNps({
      lastVisitISO: iso(AGORA - 2 * DIA),
      lastAnswerMs: AGORA - 120 * DIA,
      now: AGORA,
    })).toBe(true);
  });

  it('data inválida não quebra', () => {
    expect(shouldAskNps({ lastVisitISO: 'ontem', now: AGORA })).toBe(false);
  });
});

describe('publicPromos — as promoções que a arena divulga', () => {
  const agora = new Date(2026, 8, 24, 12).getTime();
  const base = { active: true, type: 'percent', value: 10, show_public: true };

  it('⭐ só entra cupom DIVULGADO — o código entregue a alguém nunca aparece', () => {
    const r = publicPromos([
      { ...base, id: 'a', code: 'TARDE10' },
      { ...base, id: 'b', code: 'SEGREDO', show_public: false },
      { ...base, id: 'c', code: 'ANTIGO', show_public: undefined },
    ], agora);
    expect(r.map((p) => p.code)).toEqual(['TARDE10']);
    expect(r[0].label).toBe('TARDE10 · 10% de desconto');
    expect(r[0].discount).toBe('10% de desconto');
  });

  it('⭐ promoção desligada, vencida ou esgotada some', () => {
    const r = publicPromos([
      { ...base, id: 'a', code: 'OFF', active: false },
      { ...base, id: 'b', code: 'VENCEU', expires_at: agora - 1000 },
      { ...base, id: 'c', code: 'ACABOU', max_uses: 5, used_count: 5 },
      { ...base, id: 'd', code: 'VALE', expires_at: agora + 86400000 },
    ], agora);
    expect(r.map((p) => p.code)).toEqual(['VALE']);
  });

  it('a que vence primeiro vem primeiro; sem prazo vai para o fim', () => {
    const r = publicPromos([
      { ...base, id: 'a', code: 'SEMPRAZO' },
      { ...base, id: 'b', code: 'LOGO', expires_at: agora + 1000 },
      { ...base, id: 'c', code: 'DEPOIS', expires_at: agora + 90000000 },
    ], agora);
    expect(r.map((p) => p.code)).toEqual(['LOGO', 'DEPOIS', 'SEMPRAZO']);
  });

  it('normalizeCouponInput só marca como divulgado quando pedido', () => {
    expect(normalizeCouponInput({ code: 'X', value: 5 }).value.show_public).toBe(false);
    expect(normalizeCouponInput({ code: 'X', value: 5, show_public: true }).value.show_public).toBe(true);
  });
});

describe('promoConditions — a regra da promoção em uma linha', () => {
  it('junta mínimo, prazo e uma-vez-por-pessoa, como gente lê', () => {
    const txt = promoConditions({ min_amount: 100, expires_at: new Date(2026, 9, 1, 23, 59).getTime(), once_per_user: true })
      .replace(/\u00a0/g, ' ');
    expect(txt).toMatch(/^a partir de R\$ 100,00 · até .*01\/10 · uma vez por pessoa$/);
    expect(txt).not.toContain('2026-10-01');
  });

  it('sem condição, vazia', () => {
    expect(promoConditions({ once_per_user: false })).toBe('');
  });
});
