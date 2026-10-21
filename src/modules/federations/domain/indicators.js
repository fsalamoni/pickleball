/**
 * Os indicadores da federação (Central → Indicadores): filiados, renovação,
 * receita e atraso nos últimos 12 meses, mês a mês. Puro, sem React — a tela
 * só desenha. Fonte que não veio (`undefined`) vira `null`, nunca zero: a
 * tela diz "não deu para medir" (docs/27).
 *
 * Renovação, sem histórico gravado: a filiação renovada não deixa rastro na
 * própria filiação (a validade só anda para frente). A conta usa o que existe:
 * renovou = cobrança de RENOVAÇÃO paga nos 12 meses; não renovou = filiação
 * hoje VENCIDA cuja validade acabou nos 12 meses. Taxa = renovou ÷ (renovou +
 * não renovou). A tela escreve essa definição ao lado do número.
 */
import { CHARGE_ORIGIN, CHARGE_STATUS, MEMBER_STATUS } from './constants.js';
import { addMonthsISO, isoDate, membershipState, toISODate } from './membership.js';
import { isChargeOverdue } from './charges.js';

/** Os 12 meses que terminam no mês de `hoje`, do mais antigo ao atual: ['2025-11', …, '2026-10']. */
export function monthKeys(hoje = isoDate(), n = 12) {
  const base = `${String(hoje).slice(0, 7)}-01`;
  return Array.from({ length: n }, (_, i) => addMonthsISO(base, i - (n - 1)).slice(0, 7));
}

const centavos = (c) => Math.max(0, Math.trunc(Number(c?.amount_cents) || 0));

/** Conta por chave, do maior para o menor. */
function contar(itens, chave) {
  const mapa = new Map();
  itens.forEach((x) => { const k = chave(x) || ''; mapa.set(k, (mapa.get(k) || 0) + 1); });
  return [...mapa.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

/** Os filiados: o que está em dia, de onde veio e como se divide. */
export function memberIndicators(members, hoje = isoDate()) {
  if (!Array.isArray(members)) return null;
  const meses = monthKeys(hoje);
  const inicio = `${meses[0]}-01`;
  const estados = members.map((m) => ({ m, st: membershipState(m, hoje) }));
  const emDia = estados.filter((x) => x.st.status === MEMBER_STATUS.ACTIVE).map((x) => x.m);
  const pedidosPorMes = new Map(meses.map((k) => [k, 0]));
  members.forEach((m) => {
    const k = toISODate(m.requested_at).slice(0, 7);
    if (pedidosPorMes.has(k)) pedidosPorMes.set(k, pedidosPorMes.get(k) + 1);
  });
  const naoRenovaram = estados.filter((x) => x.st.status === MEMBER_STATUS.EXPIRED && x.st.validUntil >= inicio && x.st.validUntil < hoje).length;
  return {
    total: members.length,
    active: emDia.length,
    expiring: estados.filter((x) => x.st.expiring).length,
    requestsByMonth: meses.map((month) => ({ month, n: pedidosPorMes.get(month) })),
    requests12: [...pedidosPorMes.values()].reduce((a, b) => a + b, 0),
    notRenewed12: naoRenovaram,
    byPlan: contar(emDia, (m) => m.plan_name || ''),
    byPersonType: contar(emDia, (m) => m.person_type || 'athlete'),
    byTier: contar(emDia, (m) => m.tier || 'federated'),
    dependents: emDia.filter((m) => m.guardian_uid).length,
  };
}

/** O dinheiro: recebido mês a mês e por origem, e o que está em atraso. */
export function financeIndicators(charges, hoje = isoDate()) {
  if (!Array.isArray(charges)) return null;
  const meses = monthKeys(hoje);
  const porMes = new Map(meses.map((k) => [k, 0]));
  const porOrigem = new Map(Object.values(CHARGE_ORIGIN).map((o) => [o, 0]));
  let renovacoesPagas = 0;
  let atraso = 0;
  let atrasoCents = 0;
  charges.forEach((c) => {
    if (c.status === CHARGE_STATUS.PAID) {
      const k = toISODate(c.paid_at || c.paid_at_ms).slice(0, 7);
      if (!porMes.has(k)) return;
      porMes.set(k, porMes.get(k) + centavos(c));
      const origem = porOrigem.has(c.origin) ? c.origin : CHARGE_ORIGIN.MEMBERSHIP;
      porOrigem.set(origem, porOrigem.get(origem) + centavos(c));
      if (c.origin === CHARGE_ORIGIN.RENEWAL) renovacoesPagas += 1;
    } else if (c.status === CHARGE_STATUS.OPEN && isChargeOverdue(c, hoje)) {
      atraso += 1;
      atrasoCents += centavos(c);
    }
  });
  return {
    paidByMonth: meses.map((month) => ({ month, cents: porMes.get(month) })),
    paid12Cents: [...porMes.values()].reduce((a, b) => a + b, 0),
    paidByOrigin: [...porOrigem.entries()].map(([key, cents]) => ({ key, cents })).filter((x) => x.cents > 0).sort((a, b) => b.cents - a.cents),
    renewalsPaid12: renovacoesPagas,
    overdue: atraso,
    overdueCents: atrasoCents,
  };
}

/** A taxa de renovação (0–100, inteiro) — `null` sem as duas fontes ou sem ninguém para medir. */
export function renewalRate(membersInd, financeInd) {
  if (!membersInd || !financeInd) return null;
  const base = financeInd.renewalsPaid12 + membersInd.notRenewed12;
  return base > 0 ? Math.round((financeInd.renewalsPaid12 / base) * 100) : null;
}

/** Tudo junto, para a tela e para o CSV. */
export function federationIndicators({ members, charges, hoje = isoDate() } = {}) {
  const m = memberIndicators(members, hoje);
  const f = financeIndicators(charges, hoje);
  return { months: monthKeys(hoje), members: m, finance: f, renewalRate: renewalRate(m, f) };
}

/** O CSV dos indicadores (separado por ";", seções com linha em branco). Só o que foi medido entra. */
export function indicatorsCsv(ind) {
  const esc = (v) => { const s = String(v ?? ''); return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
  const linha = (cols) => cols.map(esc).join(';');
  const blocos = [];
  const cab = ['mes'];
  if (ind?.members) cab.push('pedidos_de_filiacao');
  if (ind?.finance) cab.push('recebido_centavos');
  if (cab.length > 1) {
    blocos.push([linha(cab), ...ind.months.map((mes, i) => linha([
      mes,
      ...(ind.members ? [ind.members.requestsByMonth[i].n] : []),
      ...(ind.finance ? [ind.finance.paidByMonth[i].cents] : []),
    ]))]);
  }
  if (ind?.members) {
    blocos.push([linha(['plano', 'em_dia']), ...ind.members.byPlan.map((x) => linha([x.key, x.n]))]);
    blocos.push([linha(['tipo', 'em_dia']), ...ind.members.byPersonType.map((x) => linha([x.key, x.n]))]);
    blocos.push([linha(['categoria', 'em_dia']), ...ind.members.byTier.map((x) => linha([x.key, x.n]))]);
  }
  if (ind?.finance) blocos.push([linha(['origem', 'recebido_centavos']), ...ind.finance.paidByOrigin.map((x) => linha([x.key, x.cents]))]);
  const resumo = [linha(['indicador', 'valor'])];
  if (ind?.members) resumo.push(linha(['em_dia', ind.members.active]), linha(['pedidos_12_meses', ind.members.requests12]), linha(['nao_renovaram_12_meses', ind.members.notRenewed12]));
  if (ind?.finance) resumo.push(linha(['recebido_12_meses_centavos', ind.finance.paid12Cents]), linha(['renovacoes_pagas_12_meses', ind.finance.renewalsPaid12]), linha(['cobrancas_em_atraso', ind.finance.overdue]), linha(['em_atraso_centavos', ind.finance.overdueCents]));
  if (ind?.renewalRate != null) resumo.push(linha(['taxa_de_renovacao_pct', ind.renewalRate]));
  blocos.unshift(resumo);
  return blocos.map((b) => b.join('\n')).join('\n\n');
}
