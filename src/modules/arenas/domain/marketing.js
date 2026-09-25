/**
 * Domínio: Marketing e fidelidade — cupons, campanhas, NPS, indicação e
 * resgate de pontos. PURO, sem I/O.
 *
 * ## O cupom PRECISA chegar ao preço
 *
 * Um cupom que a arena cria e que não desconta nada é pior do que não ter
 * cupom: a arena divulga, o atleta tenta usar e não acontece nada. Por isso a
 * validação aqui devolve o MOTIVO da recusa (`couponError`), e não só um
 * booleano — a tela precisa dizer "este cupom venceu" ou "vale a partir de
 * R$ 100", nunca um "cupom inválido" que não ensina nada.
 *
 * ## Onde o cupom entra na conta
 *
 * Depois do desconto de nível e ANTES da carteira:
 *
 *     tabela → pacote → desconto do nível → CUPOM → carteira
 *
 * Cupom sobre o valor já descontado (e não sobre a tabela) é a ordem
 * conservadora: o membro não acumula dois percentuais cheios, e a arena
 * consegue prever o pior caso de uma promoção.
 */

import { instanteEmMs } from '@/core/domain/instant';
import { formatDateShortBR } from './calendar.js';
import { formatPrice } from './pricing.js';

export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  SENT: 'sent',
  CANCELLED: 'cancelled',
});

export const COUPON_TYPE = Object.freeze({
  PERCENT: 'percent',
  FIXED: 'fixed',
});

/**
 * O TIPO do cupom — o que ele dá (2026-09-25).
 *
 * Até aqui todo cupom era desconto na reserva. A arena pedia mais: hora
 * grátis, aula, clínica, comida, bebida, e o próprio "indique e ganhe" como um
 * cupom configurável. Os tipos se dividem em TRÊS famílias, porque cada uma é
 * usada num lugar diferente:
 *
 *  - **reserva** — entra sozinho no PREÇO da reserva (desconto, hora grátis).
 *  - **vale** — um benefício entregue NA ARENA (aula, bebida, brinde…): quem
 *    tem o código mostra na recepção, e a arena registra o uso.
 *  - **indicacao** — as REGRAS do programa "indique e ganhe": quanto ganha
 *    quem indica, quanto ganha quem chega, e em que condições. Cada atleta tem
 *    o próprio código; o cupom de indicação diz o que ele vale.
 *
 * `kind` é campo NOVO e opcional: cupom gravado antes não tem, e é tratado
 * como desconto (`couponKind`) — exatamente o que ele sempre foi.
 */
export const COUPON_KIND = Object.freeze({
  DISCOUNT: 'discount',
  FREE_HOURS: 'free_hours',
  PRIVATE_LESSON: 'private_lesson',
  GROUP_LESSON: 'group_lesson',
  CLINIC: 'clinic',
  FOOD: 'food',
  DRINK: 'drink',
  PRODUCT: 'product',
  RENTAL: 'rental',
  EVENT: 'event',
  OTHER: 'other',
  REFERRAL: 'referral',
});

export const COUPON_FAMILY = Object.freeze({
  BOOKING: 'reserva',
  VOUCHER: 'vale',
  REFERRAL: 'indicacao',
});

/**
 * Como cada tipo se apresenta. `example` é o texto de exemplo do benefício
 * (placeholder do formulário) — dizer "1 água de coco" ensina mais do que
 * "descreva o benefício".
 */
export const COUPON_KIND_META = Object.freeze({
  [COUPON_KIND.DISCOUNT]: { label: 'Desconto', family: COUPON_FAMILY.BOOKING, hint: 'Percentual ou valor fixo abatido do preço da reserva.' },
  [COUPON_KIND.FREE_HOURS]: { label: 'Hora grátis', family: COUPON_FAMILY.BOOKING, hint: 'Horas de quadra sem custo, abatidas do preço da reserva.' },
  [COUPON_KIND.PRIVATE_LESSON]: { label: 'Aula particular', family: COUPON_FAMILY.VOUCHER, hint: 'Uma aula individual com professor da arena.', example: '1 aula particular de 1h' },
  [COUPON_KIND.GROUP_LESSON]: { label: 'Aula em grupo', family: COUPON_FAMILY.VOUCHER, hint: 'Uma vaga numa aula em grupo.', example: '1 aula em grupo (turma de iniciantes)' },
  [COUPON_KIND.CLINIC]: { label: 'Clínica', family: COUPON_FAMILY.VOUCHER, hint: 'Participação numa clínica ou treino especial.', example: 'Clínica de saque e devolução' },
  [COUPON_KIND.FOOD]: { label: 'Comida', family: COUPON_FAMILY.VOUCHER, hint: 'Um lanche ou refeição na arena.', example: '1 sanduíche natural' },
  [COUPON_KIND.DRINK]: { label: 'Bebida', family: COUPON_FAMILY.VOUCHER, hint: 'Uma bebida na arena.', example: '1 água de coco' },
  [COUPON_KIND.PRODUCT]: { label: 'Produto ou brinde', family: COUPON_FAMILY.VOUCHER, hint: 'Um item da loja ou um brinde.', example: '1 tubo de bolas' },
  [COUPON_KIND.RENTAL]: { label: 'Aluguel de equipamento', family: COUPON_FAMILY.VOUCHER, hint: 'Raquete, bolas ou outro equipamento emprestado.', example: 'Aluguel de 2 raquetes' },
  [COUPON_KIND.EVENT]: { label: 'Inscrição em evento', family: COUPON_FAMILY.VOUCHER, hint: 'Inscrição num torneio da casa, dia de jogo ou evento.', example: 'Inscrição no torneio de sábado' },
  [COUPON_KIND.OTHER]: { label: 'Outro benefício', family: COUPON_FAMILY.VOUCHER, hint: 'Qualquer outra vantagem que a arena queira dar.', example: 'Estacionamento grátis' },
  [COUPON_KIND.REFERRAL]: { label: 'Indicação', family: COUPON_FAMILY.REFERRAL, hint: 'As regras do "indique e ganhe": quem indica e quem chega ganham.' },
});

export const COUPON_FAMILY_META = Object.freeze({
  [COUPON_FAMILY.BOOKING]: { label: 'Desconto na reserva', hint: 'Entra sozinho no preço, quando a pessoa digita o código.' },
  [COUPON_FAMILY.VOUCHER]: { label: 'Vale para usar na arena', hint: 'A pessoa mostra o código na recepção e a arena registra o uso.' },
  [COUPON_FAMILY.REFERRAL]: { label: 'Indique e ganhe', hint: 'Cada atleta tem o próprio código; aqui ficam as regras.' },
});

/** Como a pessoa que chega por indicação é premiada. */
export const REFERRED_REWARD = Object.freeze({
  CREDIT: 'credit',     // crédito em carteira
  PERCENT: 'percent',   // % de desconto na primeira reserva
  FIXED: 'fixed',       // R$ de desconto na primeira reserva
  NONE: 'none',
});

/** O tipo do cupom. Sem `kind` (cupom antigo) é desconto — o que sempre foi. */
export function couponKind(coupon) {
  const k = coupon?.kind;
  return k && COUPON_KIND_META[k] ? k : COUPON_KIND.DISCOUNT;
}

/** A família do cupom: `reserva`, `vale` ou `indicacao`. */
export function couponFamily(coupon) {
  return COUPON_KIND_META[couponKind(coupon)].family;
}

/** Entra no preço da reserva? */
export function isBookingCoupon(coupon) {
  return couponFamily(coupon) === COUPON_FAMILY.BOOKING;
}

const reais = (n) => `R$ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`;
const horasTexto = (h) => {
  const n = Number(h) || 0;
  const t = Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  return `${t} ${n === 1 ? 'hora grátis' : 'horas grátis'}`;
};

/**
 * O que o cupom dá, em uma linha e SEM o código: "10% de desconto",
 * "1 hora grátis", "1 água de coco", "R$ 20 para quem indica".
 */
export function couponBenefitText(coupon) {
  if (!coupon) return '';
  const kind = couponKind(coupon);
  if (kind === COUPON_KIND.DISCOUNT) {
    return coupon.type === COUPON_TYPE.FIXED
      ? `${reais(coupon.value)} de desconto`
      : `${Number(coupon.value) || 0}% de desconto`;
  }
  if (kind === COUPON_KIND.FREE_HOURS) return horasTexto(coupon.value);
  if (kind === COUPON_KIND.REFERRAL) return referralRulesText(coupon);
  return String(coupon.benefit || COUPON_KIND_META[kind].label).trim();
}

/**
 * As regras do programa de indicação, em uma linha.
 * "Quem indica ganha R$ 20 · quem chega ganha 10% na primeira reserva".
 */
export function referralRulesText(rules) {
  if (!rules) return '';
  const partes = [];
  const quemIndica = Number(rules.referrer_reward) || 0;
  if (quemIndica > 0) partes.push(`quem indica ganha ${reais(quemIndica)} em crédito`);
  const valor = Number(rules.referred_reward_value) || 0;
  if (valor > 0) {
    if (rules.referred_reward_kind === REFERRED_REWARD.PERCENT) partes.push(`quem chega ganha ${valor}% na primeira reserva`);
    else if (rules.referred_reward_kind === REFERRED_REWARD.FIXED) partes.push(`quem chega ganha ${reais(valor)} na primeira reserva`);
    else if (rules.referred_reward_kind === REFERRED_REWARD.CREDIT) partes.push(`quem chega ganha ${reais(valor)} em crédito`);
  }
  const txt = partes.join(' · ');
  return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : 'Sem prêmio definido';
}

export const NPS_SCORE = Object.freeze({
  DETRACTOR: 'detractor',     // 0-6
  PASSIVE: 'passive',         // 7-8
  PROMOTER: 'promoter',       // 9-10
});

/** Classifica nota NPS (0-10). */
export function classifyNps(score) {
  if (!Number.isFinite(score)) return null;
  if (score <= 6) return NPS_SCORE.DETRACTOR;
  if (score <= 8) return NPS_SCORE.PASSIVE;
  return NPS_SCORE.PROMOTER;
}

/** Calcula NPS score (-100 a +100). */
export function calculateNps(responses = []) {
  if (responses.length === 0) return 0;
  const promoters = responses.filter((r) => r.score >= 9).length;
  const detractors = responses.filter((r) => r.score <= 6).length;
  return Math.round(((promoters - detractors) / responses.length) * 100);
}

const num = (v) => (v === '' || v == null ? NaN : Number(v));
const positivoOuNull = (v) => { const n = num(v); return Number.isFinite(n) && n > 0 ? n : null; };

/**
 * Normaliza o cupom — de QUALQUER tipo.
 *
 * Os campos comuns (código, descrição, limites, prazo, divulgação) valem para
 * todos; cada família acrescenta os seus. Campo que não se aplica ao tipo é
 * gravado como `null`, nunca com o valor que sobrou no formulário: um vale
 * com `value: 10` herdado do desconto seria lido como "10% de desconto" por
 * quem não conhece o tipo.
 */
export function normalizeCouponInput(input = {}) {
  const errors = {};
  const kind = COUPON_KIND_META[input.kind] ? input.kind : COUPON_KIND.DISCOUNT;
  const family = COUPON_KIND_META[kind].family;
  // O código é sempre MAIÚSCULO e sem espaço: quem digita "verao 10" e quem
  // digita "VERAO10" querem o mesmo cupom.
  let code = String(input.code || '').trim().toUpperCase().replace(/\s+/g, '');
  // O cupom de indicação não é digitado por ninguém (cada atleta tem o
  // próprio código): o código é só um nome para a lista.
  if (!code && family === COUPON_FAMILY.REFERRAL) code = 'INDICACAO';
  if (!code) errors.code = 'Dê um código ao cupom.';
  if (code.length > 30) errors.code = 'No máximo 30 caracteres.';

  let type = null;
  let value = null;
  let benefit = null;
  let faceValue = null;
  let referral = {
    referrer_reward: null, referred_reward_kind: null, referred_reward_value: null,
    first_booking_only: null, max_per_referrer: null,
  };

  if (kind === COUPON_KIND.DISCOUNT) {
    type = Object.values(COUPON_TYPE).includes(input.type) ? input.type : COUPON_TYPE.PERCENT;
    value = Number(input.value);
    if (!Number.isFinite(value) || value <= 0) errors.value = 'O desconto deve ser maior que zero.';
    if (type === COUPON_TYPE.PERCENT && value > 100) errors.value = 'O desconto não passa de 100%.';
  } else if (kind === COUPON_KIND.FREE_HOURS) {
    value = Number(input.value);
    if (!Number.isFinite(value) || value <= 0) errors.value = 'Informe quantas horas são grátis.';
    else if (value > 24) errors.value = 'No máximo 24 horas.';
    else value = Math.round(value * 2) / 2; // de meia em meia hora
  } else if (family === COUPON_FAMILY.VOUCHER) {
    benefit = String(input.benefit || '').trim().slice(0, 120);
    if (!benefit) errors.benefit = 'Diga o que o vale dá (ex.: "1 água de coco").';
    faceValue = positivoOuNull(input.face_value);
  } else if (family === COUPON_FAMILY.REFERRAL) {
    const quemIndica = num(input.referrer_reward);
    const tipoChegada = Object.values(REFERRED_REWARD).includes(input.referred_reward_kind)
      ? input.referred_reward_kind : REFERRED_REWARD.CREDIT;
    const valorChegada = num(input.referred_reward_value);
    referral = {
      referrer_reward: Number.isFinite(quemIndica) && quemIndica > 0 ? quemIndica : 0,
      referred_reward_kind: tipoChegada,
      referred_reward_value: tipoChegada !== REFERRED_REWARD.NONE && Number.isFinite(valorChegada) && valorChegada > 0
        ? valorChegada : 0,
      // Indicação é para trazer gente NOVA: por padrão, só vale para quem
      // nunca reservou na arena. A arena pode abrir.
      first_booking_only: input.first_booking_only !== false,
      max_per_referrer: positivoOuNull(input.max_per_referrer),
    };
    if (tipoChegada === REFERRED_REWARD.PERCENT && referral.referred_reward_value > 100) {
      errors.referred_reward_value = 'O desconto não passa de 100%.';
    }
    if (referral.referrer_reward <= 0 && referral.referred_reward_value <= 0) {
      errors.referrer_reward = 'Defina o prêmio de pelo menos um dos lados.';
    }
  }

  const maxUses = num(input.max_uses);
  const minAmount = num(input.min_amount);
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      kind,
      code,
      type,
      value,
      benefit,
      /** Quanto o benefício custaria ao cliente — "valor de referência" do vale. */
      face_value: faceValue,
      ...referral,
      description: String(input.description || '').trim().slice(0, 160),
      max_uses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
      /** Valor mínimo da conta para o cupom valer (reserva e indicação). */
      min_amount: family !== COUPON_FAMILY.VOUCHER && Number.isFinite(minAmount) && minAmount > 0 ? minAmount : null,
      /** Uma vez por pessoa (o padrão) ou livre. */
      once_per_user: family === COUPON_FAMILY.REFERRAL ? true : input.once_per_user !== false,
      expires_at: input.expires_at || null,
      active: input.active !== false,
      /**
       * Divulgar na página da arena (2026-09-24). Um cupom é, por padrão, um
       * código que a arena ENTREGA a alguém; marcado, ele vira PROMOÇÃO — a
       * página da arena mostra, e o pedido de reserva oferece com um toque.
       * O cupom de indicação não é divulgado assim: ele aparece no "Indique e
       * ganhe" da página da arena, com o código de cada um.
       */
      show_public: family !== COUPON_FAMILY.REFERRAL && input.show_public === true,
      /**
       * Também como BANNER na tela inicial, para quem é da região da arena
       * (Onda BZ). Só vale para cupom divulgado — banner de um código secreto
       * não faz sentido.
       */
      show_home: family !== COUPON_FAMILY.REFERRAL && input.show_public === true && input.show_home === true,
    },
  };
}

/** Verifica se cupom é válido. */
export function isCouponValid(coupon, now = Date.now()) {
  if (!coupon) return false;
  if (!coupon.active) return false;
  if (coupon.max_uses && (coupon.used_count || 0) >= coupon.max_uses) return false;
  if (coupon.expires_at) {
    const exp = instanteEmMs(coupon.expires_at);
    if (Number.isFinite(exp) && exp < now) return false;
  }
  return true;
}

/** Aplica cupom a um preço. */
export function applyCoupon(price, coupon) {
  if (!isCouponValid(coupon) || !Number.isFinite(price) || price <= 0) return price;
  if (coupon.type === COUPON_TYPE.PERCENT) {
    return Math.max(0, Math.round(price * (1 - coupon.value / 100) * 100) / 100);
  }
  return Math.max(0, Math.round((price - coupon.value) * 100) / 100);
}

/**
 * Por que este cupom NÃO vale — em português, para a pessoa.
 *
 * Devolve `null` quando vale. "Cupom inválido" não ensina nada: a diferença
 * entre "venceu ontem" e "vale a partir de R$ 100" muda o que a pessoa faz a
 * seguir.
 *
 * @param {object|null} coupon
 * `ctx.anyFamily` confere o cupom sem exigir que ele entre no preço — é o que
 * a arena usa ao registrar o uso de um vale na recepção.
 *
 * @param {{ amount?: number, usedByUser?: boolean, now?: number, anyFamily?: boolean }} [ctx]
 * @returns {string|null}
 */
export function couponError(coupon, ctx = {}) {
  const { amount = 0, usedByUser = false, now = Date.now() } = ctx;
  if (!coupon) return 'Cupom não encontrado.';
  // Vale e indicação não entram no preço da reserva — e dizer por quê ensina
  // onde usar, em vez de parecer que o código está errado.
  if (!ctx.anyFamily) {
    const familia = couponFamily(coupon);
    if (familia === COUPON_FAMILY.VOUCHER) return 'Este código é um vale: mostre na recepção da arena para usar.';
    if (familia === COUPON_FAMILY.REFERRAL) return 'Este é o programa de indicação: use o código de quem indicou você.';
  }
  if (coupon.active === false) return 'Este cupom não está mais valendo.';
  if (coupon.expires_at) {
    const exp = instanteEmMs(coupon.expires_at);
    if (Number.isFinite(exp) && exp < now) return 'Este cupom venceu.';
  }
  if (coupon.max_uses && (coupon.used_count || 0) >= coupon.max_uses) {
    return 'Este cupom já atingiu o limite de usos.';
  }
  if (coupon.once_per_user !== false && usedByUser) {
    return 'Você já usou este cupom.';
  }
  const minimo = Number(coupon.min_amount) || 0;
  if (minimo > 0 && Number(amount) < minimo) {
    return `Este cupom vale a partir de R$ ${minimo.toFixed(2).replace('.', ',')}.`;
  }
  return null;
}

/**
 * Quanto o cupom abate de `amount` — o VALOR do desconto, não o preço final.
 *
 * Nunca passa do próprio valor da conta: um cupom de R$ 50 numa conta de R$ 30
 * desconta 30, não 50 (e a arena não fica devendo).
 *
 * **Hora grátis** abate a PROPORÇÃO das horas: 1 hora grátis numa reserva de 2
 * horas de R$ 200 abate R$ 100 — o preço médio da hora da própria reserva. Usar
 * o preço de uma faixa específica daria margem a escolher a hora mais cara.
 * Sem saber as horas (`ctx.hours`), não abate nada: melhor não descontar do que
 * descontar errado.
 *
 * Vale e indicação não entram no preço: abatem zero.
 *
 * @param {number} amount
 * @param {object|null} coupon
 * @param {{ hours?: number }} [ctx]
 * @returns {number}
 */
export function couponDiscount(amount, coupon, ctx = {}) {
  const base = Number(amount) || 0;
  if (base <= 0 || !coupon || !isBookingCoupon(coupon)) return 0;
  let bruto = 0;
  if (couponKind(coupon) === COUPON_KIND.FREE_HOURS) {
    const horas = Number(ctx.hours) || 0;
    if (horas <= 0) return 0;
    bruto = base * Math.min(1, (Number(coupon.value) || 0) / horas);
  } else {
    bruto = coupon.type === COUPON_TYPE.FIXED
      ? Number(coupon.value) || 0
      : base * ((Number(coupon.value) || 0) / 100);
  }
  return Math.max(0, Math.min(base, Math.round(bruto * 100) / 100));
}

/**
 * O cupom em uma linha, para a tela: "VERAO10 · 10% de desconto",
 * "HORA1 · 1 hora grátis", "COCO · 1 água de coco".
 */
export function couponLabel(coupon) {
  if (!coupon?.code) return '';
  return `${coupon.code} · ${couponBenefitText(coupon)}`;
}

/**
 * As PROMOÇÕES da arena: os cupons que ela escolheu divulgar e que ainda
 * valem (ligados, no prazo e com uso disponível). Cupom não divulgado é
 * código entregue a alguém — nunca aparece aqui.
 *
 * @param {object[]} coupons
 * @param {number} [now]
 * @returns {Array<{ id: string, code: string, kind: string, family: string, bookable: boolean,
 *   label: string, discount: string, description: string,
 *   min_amount: number|null, expires_at: number|null, once_per_user: boolean }>}
 */
export function publicPromos(coupons = [], now = Date.now()) {
  return coupons
    .filter((c) => c?.show_public === true && couponFamily(c) !== COUPON_FAMILY.REFERRAL && isCouponValid(c, now))
    .map((c) => ({
      id: c.id,
      arena_id: c.arena_id || null,
      code: c.code,
      kind: couponKind(c),
      family: couponFamily(c),
      /** Entra no preço da reserva (pode ser aplicado no pedido com um toque). */
      bookable: isBookingCoupon(c),
      label: couponLabel(c),
      // Sem o código — para o título, quando o código já está no botão ao lado.
      discount: couponBenefitText(c),
      description: c.description || '',
      min_amount: Number(c.min_amount) > 0 ? Number(c.min_amount) : null,
      expires_at: instanteEmMs(c.expires_at) > 0 ? instanteEmMs(c.expires_at) : null,
      once_per_user: c.once_per_user !== false,
    }))
    // A que vence primeiro vem primeiro: é a que a pessoa pode perder.
    .sort((a, b) => (a.expires_at ?? Infinity) - (b.expires_at ?? Infinity) || String(a.code).localeCompare(String(b.code)));
}

/**
 * A regra da promoção em uma linha — "a partir de R$ 100,00 · até Qui, 01/10 ·
 * uma vez por pessoa". Vazia quando não há condição.
 */
export function promoConditions(promo) {
  if (!promo) return '';
  let ate = null;
  if (promo.expires_at) {
    const d = new Date(Number(promo.expires_at));
    const p = (n) => String(n).padStart(2, '0');
    ate = `até ${formatDateShortBR(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)}`;
  }
  return [
    promo.min_amount ? `a partir de ${formatPrice(promo.min_amount)}` : null,
    ate,
    promo.once_per_user ? 'uma vez por pessoa' : null,
  ].filter(Boolean).join(' · ');
}

/**
 * O programa de indicação VIGENTE da arena: o cupom de indicação ligado e no
 * prazo. Com mais de um (não deveria — o serviço impede), vale o mais novo.
 * Sem nenhum, `null`: a arena ainda não definiu as regras.
 *
 * @param {object[]} coupons
 * @param {number} [now]
 * @returns {object|null}
 */
export function referralProgram(coupons = [], now = Date.now()) {
  const vigentes = (coupons || []).filter(
    (c) => couponKind(c) === COUPON_KIND.REFERRAL && isCouponValid(c, now),
  );
  if (vigentes.length === 0) return null;
  const quando = (c) => instanteEmMs(c.created_at) || 0;
  return [...vigentes].sort((a, b) => quando(b) - quando(a))[0];
}

/**
 * O que cada lado ganha numa indicação, pelas regras do programa.
 *
 * `amount` é o valor da primeira reserva de quem chegou (para o desconto
 * percentual e para o mínimo). Sem programa, nada — e quem chama não inventa.
 *
 * @param {object|null} program
 * @param {{ amount?: number }} [ctx]
 * @returns {{ referrerCredit: number, referredCredit: number, referredDiscount: number, blocked: string|null }}
 */
export function referralRewards(program, ctx = {}) {
  const vazio = { referrerCredit: 0, referredCredit: 0, referredDiscount: 0, blocked: null };
  if (!program) return { ...vazio, blocked: 'A arena ainda não definiu as regras do indique e ganhe.' };
  const amount = Number(ctx.amount) || 0;
  const minimo = Number(program.min_amount) || 0;
  if (minimo > 0 && amount > 0 && amount < minimo) {
    return { ...vazio, blocked: `A indicação vale para a primeira reserva a partir de ${reais(minimo)}.` };
  }
  const valor = Number(program.referred_reward_value) || 0;
  let referredDiscount = 0;
  if (program.referred_reward_kind === REFERRED_REWARD.PERCENT) {
    referredDiscount = Math.round(amount * Math.min(100, valor)) / 100;
  } else if (program.referred_reward_kind === REFERRED_REWARD.FIXED) {
    referredDiscount = Math.min(amount, valor);
  }
  return {
    referrerCredit: Math.max(0, Number(program.referrer_reward) || 0),
    referredCredit: program.referred_reward_kind === REFERRED_REWARD.CREDIT ? Math.max(0, valor) : 0,
    referredDiscount: Math.max(0, Math.round(referredDiscount * 100) / 100),
    blocked: null,
  };
}

/**
 * O que quem CHEGA por indicação ganha, em texto — "R$ 20,00 em crédito",
 * "10% na primeira reserva". `null` quando não ganha nada.
 */
export function referralFriendReward(program) {
  const valor = Number(program?.referred_reward_value) || 0;
  if (!program || valor <= 0) return null;
  if (program.referred_reward_kind === REFERRED_REWARD.PERCENT) return `${valor}% na primeira reserva`;
  if (program.referred_reward_kind === REFERRED_REWARD.FIXED) return `${reais(valor)} na primeira reserva`;
  if (program.referred_reward_kind === REFERRED_REWARD.CREDIT) return `${reais(valor)} em crédito`;
  return null;
}

/**
 * O convite que o atleta manda — dizendo o que as REGRAS dão, não uma
 * promessa genérica. Sem programa, o texto de sempre.
 */
export function referralInviteText({ arenaName = 'arena', code = '', program = null } = {}) {
  if (!program) return `Jogo na ${arenaName} — use meu código ${code} na primeira visita e nós dois ganhamos crédito.`;
  const valor = Number(program.referred_reward_value) || 0;
  const base = `Jogo na ${arenaName} — use meu código ${code} na sua primeira reserva`;
  if (valor > 0 && program.referred_reward_kind === REFERRED_REWARD.PERCENT) return `${base} e ganhe ${valor}% de desconto nela.`;
  if (valor > 0 && program.referred_reward_kind === REFERRED_REWARD.FIXED) return `${base} e ganhe ${reais(valor)} de desconto nela.`;
  if (valor > 0 && program.referred_reward_kind === REFERRED_REWARD.CREDIT) return `${base} e ganhe ${reais(valor)} em crédito.`;
  return `${base}.`;
}

/* ------------------------------------------------------------------ */
/*  A indicação NA RESERVA (Onda BY)                                   */
/* ------------------------------------------------------------------ */

/** O código como a pessoa digitou → como ele é gravado. */
export function normalizeReferralCode(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Por que ESTA pessoa não pode usar este código — a conferência da TELA.
 * Vazio não é problema (o campo é opcional). A arena confere de novo na
 * confirmação, contra o banco; aqui só se evita o engano óbvio.
 * @param {string} code
 * @param {{ userId?: string|null }} [ctx]
 * @returns {string|null}
 */
export function referralCodeProblem(code, { userId = null } = {}) {
  const c = normalizeReferralCode(code);
  if (!c) return null;
  if (c.length < 6 || c.length > 20 || !/^[A-Z0-9]+$/.test(c)) {
    return 'Confira o código: são letras e números, como ele aparece para quem indicou.';
  }
  if (userId && c.slice(0, 6) === String(userId).slice(0, 6).toUpperCase()) {
    return 'Esse é o seu próprio código — ele é para quem você indicar.';
  }
  return null;
}

/** Reserva que conta como "já reservou aqui". */
const RESERVA_QUE_CONTA = new Set(['confirmed', 'completed']);

/**
 * Esta seria a primeira reserva da pessoa nesta arena? Pedido em aberto,
 * recusado ou cancelado não conta — ninguém jogou.
 */
export function isFirstArenaBooking(myBookings = [], arenaId) {
  return !(myBookings || []).some((b) => b?.arena_id === arenaId && RESERVA_QUE_CONTA.has(b?.status));
}

/**
 * O pedido de reserva oferece o campo "Foi indicado por alguém?"?
 *
 * Só com um programa valendo. Se o programa vale só para quem nunca reservou
 * aqui, só na primeira reserva — e sem saber as reservas da pessoa (consulta
 * carregando ou falhando), NÃO oferece: prometer um prêmio que a arena vai
 * recusar é pior do que não oferecer.
 */
export function shouldOfferReferral({ program = null, myBookings, arenaId } = {}) {
  if (!program) return false;
  if (program.first_booking_only === false) return true;
  if (!Array.isArray(myBookings)) return false;
  return isFirstArenaBooking(myBookings, arenaId);
}

export const BOOKING_REFERRAL_STATUS = Object.freeze({
  PENDING: 'pending',
  APPLIED: 'aplicada',
  REFUSED: 'recusada',
});

/**
 * A indicação de uma reserva, em uma linha, para quem olha a reserva.
 * @param {object|null} referral  `booking.referral`
 * @param {{ perspective?: 'arena'|'athlete' }} [ctx]
 * @returns {{ tone: 'amber'|'green'|'red', text: string }|null}
 */
export function bookingReferralLine(referral, { perspective = 'athlete' } = {}) {
  if (!referral?.code) return null;
  const code = normalizeReferralCode(referral.code);
  if (referral.status === BOOKING_REFERRAL_STATUS.APPLIED) {
    const partes = [];
    const desconto = Number(referral.discount_value) || 0;
    const credito = Number(referral.referred_reward) || 0;
    if (desconto > 0) partes.push(`${reais(desconto)} de desconto`);
    if (credito > 0) partes.push(`${reais(credito)} em crédito`);
    if (perspective === 'arena' && Number(referral.referrer_reward) > 0) {
      partes.push(`${reais(referral.referrer_reward)} para quem indicou`);
    }
    return { tone: 'green', text: `Indicação registrada (${code})${partes.length ? ` · ${partes.join(' · ')}` : ''}` };
  }
  if (referral.status === BOOKING_REFERRAL_STATUS.REFUSED) {
    return { tone: 'red', text: `Indicação não aplicada (${code})${referral.reason ? `: ${referral.reason}` : ''}` };
  }
  return {
    tone: 'amber',
    text: perspective === 'arena'
      ? `Chegou por indicação (${code}) — a arena confere e credita ao confirmar`
      : `Código de indicação ${code} — a arena confere ao confirmar a reserva`,
  };
}

/**
 * As indicações que chegaram com reservas e ainda não foram decididas.
 *
 *  - `toRegister`: a reserva JÁ está confirmada (ou concluída) e o código segue
 *    pendente — a reserva instantânea nasce confirmada e não passa pela
 *    confirmação da arena, e uma confirmação em que as regras não carregaram
 *    deixa a indicação pendente. Precisa de um toque da arena.
 *  - `awaitingConfirmation`: pedido ainda em aberto; a indicação será conferida
 *    quando a arena confirmar. Não há o que fazer além de confirmar.
 */
export function pendingBookingReferrals(bookings = []) {
  const pendentes = (bookings || []).filter(
    (b) => b?.referral?.code && b.referral.status === BOOKING_REFERRAL_STATUS.PENDING,
  );
  return {
    toRegister: pendentes.filter((b) => ['confirmed', 'completed'].includes(b.status)),
    awaitingConfirmation: pendentes.filter((b) => ['requested', 'negotiating'].includes(b.status)),
  };
}

/** Gera código de indicação único. */
export function generateReferralCode(userId) {
  if (!userId) return '';
  return userId.slice(0, 6).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

/** Calcula pontos de fidelidade baseado em gasto. */
export function calculateLoyaltyPoints(amountSpent) {
  if (!Number.isFinite(amountSpent) || amountSpent <= 0) return 0;
  return Math.floor(amountSpent);  // 1 ponto por R$1
}

/* ------------------------------------------------------------------ */
/*  Fidelidade — o outro lado dos pontos: TROCAR                       */
/* ------------------------------------------------------------------ */

/**
 * Quantos pontos valem R$ 1, por padrão.
 *
 * Ganhar ponto sem poder trocar por nada é um número que não significa nada.
 * A arena pode mudar a taxa; 20 pontos por real é um começo conservador (uma
 * reserva de R$ 100 rende ~120 pontos, ou seja, ~R$ 6 de volta).
 */
export const DEFAULT_POINTS_PER_REAL = 20;

/**
 * O resgate de pontos: quantos pontos viram quanto crédito.
 *
 * Sempre em múltiplos exatos da taxa — resgatar 25 pontos a 20/real daria
 * R$ 1,25 e sobraria um resto invisível. Aqui os 5 pontos ficam com o atleta.
 *
 * @param {number} points pontos que a pessoa quer trocar
 * @param {{ available?: number, pointsPerReal?: number, minPoints?: number }} [opts]
 * @returns {{ points: number, credit: number, error: string|null }}
 */
export function redeemPoints(points, opts = {}) {
  const {
    available = 0,
    pointsPerReal = DEFAULT_POINTS_PER_REAL,
    minPoints = DEFAULT_POINTS_PER_REAL,
  } = opts;
  const taxa = Math.max(1, Math.trunc(Number(pointsPerReal) || DEFAULT_POINTS_PER_REAL));
  const pedido = Math.trunc(Number(points) || 0);
  const saldo = Math.max(0, Math.trunc(Number(available) || 0));

  if (pedido <= 0) return { points: 0, credit: 0, error: 'Informe quantos pontos quer trocar.' };
  if (pedido > saldo) return { points: 0, credit: 0, error: `Você tem ${saldo} pontos.` };
  if (pedido < minPoints) {
    return { points: 0, credit: 0, error: `O mínimo para trocar é ${minPoints} pontos.` };
  }

  const reais = Math.floor(pedido / taxa);
  if (reais <= 0) return { points: 0, credit: 0, error: `São necessários ${taxa} pontos para R$ 1.` };
  return { points: reais * taxa, credit: reais, error: null };
}

/* ------------------------------------------------------------------ */
/*  Campanha — para QUEM ela vai                                       */
/* ------------------------------------------------------------------ */

/**
 * Os públicos que a arena pode escolher.
 *
 * São poucos e concretos de propósito. "Segmentação avançada" com dez filtros
 * combináveis é a funcionalidade que ninguém usa: quem toca uma arena quer
 * "avisar os sumidos", não montar uma consulta.
 */
export const CAMPAIGN_AUDIENCE = Object.freeze({
  MEMBERS: 'members',
  LAPSED: 'lapsed',
  RECENT: 'recent',
  ALL: 'all',
});

export const CAMPAIGN_AUDIENCE_META = Object.freeze({
  [CAMPAIGN_AUDIENCE.MEMBERS]: {
    label: 'Membros',
    hint: 'Quem faz parte do programa de membros da arena.',
  },
  [CAMPAIGN_AUDIENCE.LAPSED]: {
    label: 'Sumidos',
    hint: 'Já jogou aqui, mas não reserva há mais de 60 dias.',
  },
  [CAMPAIGN_AUDIENCE.RECENT]: {
    label: 'Frequentes',
    hint: 'Reservou nos últimos 60 dias.',
  },
  [CAMPAIGN_AUDIENCE.ALL]: {
    label: 'Todo mundo',
    hint: 'Qualquer pessoa que já reservou ou é membro.',
  },
});

/** Quantos dias sem reservar contam como "sumido". */
export const LAPSED_DAYS = 60;

/**
 * Quem recebe a campanha, a partir do que a arena já tem em mãos.
 *
 * PURO: recebe membros e reservas já carregados e devolve os uids. Fazer isso
 * no domínio é o que permite a tela mostrar **quantas pessoas vão receber**
 * ANTES de enviar — mandar mensagem para um número desconhecido de pessoas é
 * como a arena queima a paciência da própria comunidade.
 *
 * @param {string} audience
 * @param {{ members?: Array, bookings?: Array, now?: number }} dados
 * @returns {string[]} uids, sem repetição
 */
export function campaignRecipients(audience, { members = [], bookings = [], now = Date.now() } = {}) {
  const uidsMembros = (members || []).map((m) => m?.user_id).filter(Boolean);
  const corte = now - LAPSED_DAYS * 86_400_000;

  /** uid → data (ms) da reserva mais recente. */
  const ultimaPorUid = new Map();
  (bookings || []).forEach((b) => {
    const uid = b?.athlete_id;
    if (!uid) return;
    const datas = (b.slots || []).map((s) => s?.date).filter(Boolean).sort();
    const iso = datas[datas.length - 1];
    const ms = iso ? new Date(`${iso}T12:00:00`).getTime() : NaN;
    if (!Number.isFinite(ms)) return;
    if (!ultimaPorUid.has(uid) || ms > ultimaPorUid.get(uid)) ultimaPorUid.set(uid, ms);
  });

  let alvo = [];
  switch (audience) {
    case CAMPAIGN_AUDIENCE.MEMBERS:
      alvo = uidsMembros;
      break;
    case CAMPAIGN_AUDIENCE.LAPSED:
      alvo = [...ultimaPorUid.entries()].filter(([, ms]) => ms < corte).map(([uid]) => uid);
      break;
    case CAMPAIGN_AUDIENCE.RECENT:
      alvo = [...ultimaPorUid.entries()].filter(([, ms]) => ms >= corte).map(([uid]) => uid);
      break;
    case CAMPAIGN_AUDIENCE.ALL:
    default:
      alvo = [...new Set([...uidsMembros, ...ultimaPorUid.keys()])];
      break;
  }
  return [...new Set(alvo.filter(Boolean))];
}

/* ------------------------------------------------------------------ */
/*  NPS — quando perguntar                                             */
/* ------------------------------------------------------------------ */

/** Só perguntamos depois da visita, e não mais de uma vez por período. */
export const NPS_COOLDOWN_DAYS = 90;

/**
 * Vale perguntar "como foi?" a esta pessoa nesta arena?
 *
 * Três condições, todas por um motivo:
 *
 * - **teve visita concluída** — perguntar a quem nunca veio não faz sentido;
 * - **a visita foi recente** (30 dias) — depois disso ninguém lembra;
 * - **não respondeu nos últimos 90 dias** — pedir nota toda semana é a forma
 *   mais rápida de a pessoa parar de responder para sempre.
 *
 * @param {{ lastVisitISO?: string|null, lastAnswerMs?: number|null, now?: number }} ctx
 * @returns {boolean}
 */
export function shouldAskNps({ lastVisitISO = null, lastAnswerMs = null, now = Date.now() } = {}) {
  if (!lastVisitISO) return false;
  const visitaMs = new Date(`${lastVisitISO}T12:00:00`).getTime();
  if (!Number.isFinite(visitaMs)) return false;
  if (visitaMs > now) return false;                       // ainda não aconteceu
  if (now - visitaMs > 30 * 86_400_000) return false;     // velha demais
  if (Number.isFinite(lastAnswerMs) && now - lastAnswerMs < NPS_COOLDOWN_DAYS * 86_400_000) {
    return false;
  }
  return true;
}
