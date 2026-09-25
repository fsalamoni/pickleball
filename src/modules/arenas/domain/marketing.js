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

/** Normaliza cupom. */
export function normalizeCouponInput(input = {}) {
  const errors = {};
  // O código é sempre MAIÚSCULO e sem espaço: quem digita "verao 10" e quem
  // digita "VERAO10" querem o mesmo cupom.
  const code = String(input.code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) errors.code = 'Dê um código ao cupom.';
  if (code.length > 30) errors.code = 'No máximo 30 caracteres.';
  const type = Object.values(COUPON_TYPE).includes(input.type) ? input.type : COUPON_TYPE.PERCENT;
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) errors.value = 'O desconto deve ser maior que zero.';
  if (type === COUPON_TYPE.PERCENT && value > 100) errors.value = 'O desconto não passa de 100%.';
  const maxUses = Number(input.max_uses);
  const minAmount = Number(input.min_amount);
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      code,
      type,
      value,
      description: String(input.description || '').trim().slice(0, 160),
      max_uses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
      /** Valor mínimo da conta para o cupom valer. */
      min_amount: Number.isFinite(minAmount) && minAmount > 0 ? minAmount : null,
      /** Uma vez por pessoa (o padrão) ou livre. */
      once_per_user: input.once_per_user !== false,
      expires_at: input.expires_at || null,
      active: input.active !== false,
      /**
       * Divulgar na página da arena (2026-09-24). Um cupom é, por padrão, um
       * código que a arena ENTREGA a alguém; marcado, ele vira PROMOÇÃO — a
       * página da arena mostra, e o pedido de reserva oferece com um toque.
       */
      show_public: input.show_public === true,
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
 * @param {{ amount?: number, usedByUser?: boolean, now?: number }} [ctx]
 * @returns {string|null}
 */
export function couponError(coupon, ctx = {}) {
  const { amount = 0, usedByUser = false, now = Date.now() } = ctx;
  if (!coupon) return 'Cupom não encontrado.';
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
 * @returns {number}
 */
export function couponDiscount(amount, coupon) {
  const base = Number(amount) || 0;
  if (base <= 0 || !coupon) return 0;
  const bruto = coupon.type === COUPON_TYPE.FIXED
    ? Number(coupon.value) || 0
    : base * ((Number(coupon.value) || 0) / 100);
  return Math.max(0, Math.min(base, Math.round(bruto * 100) / 100));
}

/** O cupom em uma linha, para a tela: "VERAO10 · 10% de desconto". */
export function couponLabel(coupon) {
  if (!coupon?.code) return '';
  const valor = coupon.type === COUPON_TYPE.FIXED
    ? `R$ ${(Number(coupon.value) || 0).toFixed(2).replace('.', ',')}`
    : `${Number(coupon.value) || 0}%`;
  return `${coupon.code} · ${valor} de desconto`;
}

/**
 * As PROMOÇÕES da arena: os cupons que ela escolheu divulgar e que ainda
 * valem (ligados, no prazo e com uso disponível). Cupom não divulgado é
 * código entregue a alguém — nunca aparece aqui.
 *
 * @param {object[]} coupons
 * @param {number} [now]
 * @returns {Array<{ id: string, code: string, label: string, discount: string, description: string,
 *   min_amount: number|null, expires_at: number|null, once_per_user: boolean }>}
 */
export function publicPromos(coupons = [], now = Date.now()) {
  return coupons
    .filter((c) => c?.show_public === true && isCouponValid(c, now))
    .map((c) => ({
      id: c.id,
      code: c.code,
      label: couponLabel(c),
      // Sem o código — para o título, quando o código já está no botão ao lado.
      discount: couponLabel(c).slice(String(c.code).length + 3),
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
