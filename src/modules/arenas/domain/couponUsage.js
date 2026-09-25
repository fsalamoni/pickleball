/**
 * Domínio: o CONTROLE DE USO dos cupons — quanto cada cupom foi usado, quanto
 * custou à arena e quanto trouxe. PURO, sem I/O.
 *
 * ## Por que existe
 *
 * A arena criava cupons e não tinha como responder a única pergunta que
 * decide se vale criar o próximo: *essa promoção se pagou?* A contagem de usos
 * existia (`used_count`), mas uso sem custo e sem receita é meia resposta —
 * cinquenta usos de um cupom de 50% numa semana cheia é prejuízo; dez usos de
 * uma hora grátis que trouxeram dez clientes novos é o melhor dinheiro gasto.
 *
 * ## De onde sai cada número (nenhuma consulta nova)
 *
 * - **Desconto na reserva** (desconto, hora grátis): as reservas da arena, que
 *   a Central já carrega. Cada reserva que usou o cupom grava o valor abatido
 *   em `member_benefit.coupon_value`. Só conta reserva CONFIRMADA ou
 *   CONCLUÍDA — pedido recusado ou cancelado não custou nem trouxe nada.
 *   - custo = soma do que foi abatido;
 *   - receita = soma do que as reservas pagaram (depois do desconto).
 * - **Vale** (aula, bebida, brinde…): `used_count` × o CUSTO UNITÁRIO que a
 *   arena informou. O custo mora em `arena_settings.coupon_costs` — coleção
 *   que só o gestor lê —, NUNCA no cupom, que é legível por qualquer conta
 *   logada: quanto a arena paga pela água de coco não é assunto do cliente.
 *   Sem custo informado, o custo é desconhecido (`null`), não zero.
 * - **Indicação**: os códigos dos atletas (`arena_referrals`). Custo = o que
 *   foi creditado (`reward_total`, gravado a cada resgate); receita = as
 *   reservas que chegaram com código de indicação (`booking.referral`).
 *
 * Um número desconhecido é mostrado como "—", nunca como zero: zero afirma
 * que não custou nada, e isso a arena não sabe.
 */

import {
  COUPON_FAMILY, COUPON_KIND, COUPON_KIND_META, couponBenefitText, couponFamily, couponKind,
  referralProgram,
} from './marketing.js';
import { instanteEmMs } from '@/core/domain/instant';

/** Reserva que de fato aconteceu (ou vai acontecer): conta no custo e na receita. */
const CONTA = new Set(['confirmed', 'completed']);

const centavos = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** O que a reserva pagou: o acordado vence o proposto. */
export function bookingPaid(booking) {
  return num(booking?.agreed_price) ?? num(booking?.proposed_price) ?? 0;
}

/**
 * O estado do cupom hoje.
 * @returns {'ativo'|'desligado'|'esgotado'|'vencido'}
 */
export function couponStatus(coupon, now = Date.now()) {
  if (!coupon || coupon.active === false) return 'desligado';
  const exp = instanteEmMs(coupon.expires_at);
  if (Number.isFinite(exp) && exp < now) return 'vencido';
  if (coupon.max_uses && (Number(coupon.used_count) || 0) >= coupon.max_uses) return 'esgotado';
  return 'ativo';
}

export const COUPON_STATUS_LABEL = Object.freeze({
  ativo: 'Ativo', desligado: 'Desligado', esgotado: 'Esgotado', vencido: 'Vencido',
});

/**
 * Uma linha por cupom e um total por TIPO.
 *
 * @param {{
 *   coupons?: object[],
 *   bookings?: object[],
 *   referrals?: object[],
 *   costs?: Record<string, number>,
 *   now?: number,
 * }} dados
 * @returns {{
 *   rows: Array<{
 *     id: string, code: string, kind: string, family: string, kindLabel: string,
 *     benefit: string, status: string, uses: number, maxUses: number|null,
 *     cost: number|null, revenue: number|null, unitCost: number|null,
 *     faceValue: number|null, newCustomers: number|null,
 *   }>,
 *   byKind: Array<{ kind: string, label: string, family: string, coupons: number,
 *     uses: number, cost: number|null, revenue: number|null }>,
 *   totals: { coupons: number, uses: number, cost: number, costKnown: boolean, revenue: number },
 * }}
 */
export function couponUsageReport({ coupons = [], bookings = [], referrals = [], costs = {}, now = Date.now() } = {}) {
  // As reservas que contam, indexadas pelo cupom — uma passada só pela lista.
  const porCupom = new Map();
  const comIndicacao = [];
  for (const b of bookings || []) {
    if (!CONTA.has(b?.status)) continue;
    const id = b?.member_benefit?.coupon_id;
    if (id) {
      const acc = porCupom.get(id) || { count: 0, cost: 0, revenue: 0 };
      acc.count += 1;
      acc.cost += Number(b.member_benefit.coupon_value) || 0;
      acc.revenue += bookingPaid(b);
      porCupom.set(id, acc);
    }
    if (b?.referral?.code) comIndicacao.push(b);
  }

  // O programa de indicação: o que já foi creditado e quantos chegaram.
  let indicacoes = 0;
  let creditadoIndicacao = 0;
  let creditoConhecido = true;
  for (const r of referrals || []) {
    const n = Number(r?.redeemed_count) || 0;
    indicacoes += n;
    if (n > 0) {
      if (Number.isFinite(Number(r?.reward_total))) creditadoIndicacao += Number(r.reward_total);
      else creditoConhecido = false;
    }
  }
  const receitaIndicacao = comIndicacao.reduce((acc, b) => acc + bookingPaid(b), 0);
  const descontoIndicacao = comIndicacao.reduce((acc, b) => acc + (Number(b.referral?.discount_value) || 0), 0);

  // Os números do programa de indicação vão para UM cupom só — o vigente, ou
  // o mais novo —, senão um programa com as regras refeitas contaria duas vezes.
  const doPrograma = referralProgram(coupons, now)
    || [...(coupons || [])].filter((c) => couponKind(c) === COUPON_KIND.REFERRAL)
      .sort((a, b) => (instanteEmMs(b.created_at) || 0) - (instanteEmMs(a.created_at) || 0))[0]
    || null;

  const rows = (coupons || []).map((c) => {
    const kind = couponKind(c);
    const family = couponFamily(c);
    const usados = Number(c.used_count) || 0;
    let uses = usados;
    let cost = null;
    let revenue = null;
    let newCustomers = null;
    const unitCost = num(costs?.[c.id]);

    if (family === COUPON_FAMILY.BOOKING) {
      const r = porCupom.get(c.id) || { count: 0, cost: 0, revenue: 0 };
      // A contagem do cupom sobe na confirmação; as reservas contam o mesmo
      // evento. Vale a maior — uma reserva antiga pode ter saído da lista.
      uses = Math.max(usados, r.count);
      cost = centavos(r.cost);
      revenue = centavos(r.revenue);
    } else if (family === COUPON_FAMILY.VOUCHER) {
      cost = unitCost != null ? centavos(unitCost * usados) : null;
    } else if (family === COUPON_FAMILY.REFERRAL) {
      const eODoPrograma = doPrograma?.id === c.id;
      uses = eODoPrograma ? indicacoes : 0;
      newCustomers = uses;
      cost = !eODoPrograma ? 0 : creditoConhecido ? centavos(creditadoIndicacao + descontoIndicacao) : null;
      revenue = eODoPrograma ? centavos(receitaIndicacao) : 0;
    }

    return {
      id: c.id,
      code: c.code || '',
      kind,
      family,
      kindLabel: COUPON_KIND_META[kind].label,
      benefit: couponBenefitText(c),
      status: couponStatus(c, now),
      uses,
      maxUses: Number(c.max_uses) > 0 ? Number(c.max_uses) : null,
      cost,
      revenue,
      unitCost,
      faceValue: num(c.face_value),
      newCustomers,
    };
  });

  // Total por tipo — na ordem do catálogo, só os tipos que a arena usa.
  const byKind = Object.keys(COUPON_KIND_META)
    .map((kind) => {
      const doTipo = rows.filter((r) => r.kind === kind);
      if (doTipo.length === 0) return null;
      const custos = doTipo.map((r) => r.cost);
      const receitas = doTipo.map((r) => r.revenue).filter((v) => v != null);
      return {
        kind,
        label: COUPON_KIND_META[kind].label,
        family: COUPON_KIND_META[kind].family,
        coupons: doTipo.length,
        uses: doTipo.reduce((acc, r) => acc + r.uses, 0),
        // Um custo desconhecido torna o total do tipo desconhecido — somar só
        // os conhecidos apresentaria um número menor como se fosse o total.
        cost: custos.some((v) => v == null) ? null : centavos(custos.reduce((a, v) => a + v, 0)),
        revenue: receitas.length ? centavos(receitas.reduce((a, v) => a + v, 0)) : null,
      };
    })
    .filter(Boolean);

  const custoConhecido = rows.every((r) => r.cost != null);
  return {
    rows,
    byKind,
    totals: {
      coupons: rows.length,
      uses: rows.reduce((acc, r) => acc + r.uses, 0),
      cost: centavos(rows.reduce((acc, r) => acc + (r.cost ?? 0), 0)),
      costKnown: custoConhecido,
      revenue: centavos(rows.reduce((acc, r) => acc + (r.revenue ?? 0), 0)),
    },
  };
}

/**
 * Quanto voltou para cada real dado — "R$ 4,20 por R$ 1". `null` quando a
 * conta não faz sentido (sem custo, ou custo desconhecido).
 */
export function returnPerReal(revenue, cost) {
  const r = Number(revenue);
  const c = Number(cost);
  if (!Number.isFinite(r) || !Number.isFinite(c) || c <= 0 || revenue == null || cost == null) return null;
  return Math.round((r / c) * 100) / 100;
}
