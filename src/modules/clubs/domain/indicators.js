/**
 * Indicadores do clube (Central → Indicadores): associados, renovação e
 * dinheiro nos últimos 12 meses, mês a mês. Puro, sem React. Reaproveita as
 * contas da federação (`federations/domain/indicators.js`) sobre as filiações
 * e cobranças do clube — fonte que não veio (`undefined`) vira `null`, nunca
 * zero: a tela diz "não deu para medir" (docs/27).
 */
import { t } from '@/core/i18n';
import { CHARGE_ORIGIN_LABELS } from '@/modules/federations/domain/constants.js';
import { csvCell, csvReais } from '@/modules/federations/domain/charges.js';
import { financeIndicators, memberIndicators, monthKeys, renewalRate } from '@/modules/federations/domain/indicators.js';
import { isoDate } from '@/modules/federations/domain/membership.js';

/** Conta por categoria entre quem está em dia, do maior para o menor. */
function porCategoria(afiliacoes, emDia) {
  const mapa = new Map();
  afiliacoes.filter((a) => emDia.has(a.user_id)).forEach((a) => { const k = a.category || ''; mapa.set(k, (mapa.get(k) || 0) + 1); });
  return [...mapa.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

/** A filiação do clube no formato que a conta da federação lê (`requested_at` vem de `requested_at_ms`). */
const comoFiliado = (a) => ({ ...a, requested_at: a.requested_at ?? a.requested_at_ms });

export function clubIndicators({ affiliations, charges, hoje = isoDate() } = {}) {
  const lista = Array.isArray(affiliations) ? affiliations.map(comoFiliado) : undefined;
  const m = memberIndicators(lista, hoje);
  const f = financeIndicators(charges, hoje);
  let categorias = null;
  if (m && lista) {
    const emDia = new Set(lista.filter((a) => a.status === 'active' && (!a.valid_until || String(a.valid_until).slice(0, 10) >= hoje)).map((a) => a.user_id));
    categorias = porCategoria(lista, emDia);
  }
  return {
    months: monthKeys(hoje),
    members: m ? { ...m, byCategory: categorias } : null,
    finance: f,
    renewalRate: renewalRate(m, f),
  };
}

/**
 * O CSV dos indicadores (separado por ";", seções com linha em branco), com
 * rótulos legíveis, valores em reais ("150,00") e meses MM/AAAA. Só o que foi
 * medido entra.
 */
export function clubIndicatorsCsv(ind) {
  const linha = (cols) => cols.map(csvCell).join(';');
  const blocos = [];
  const cab = [t('Mês')];
  if (ind?.members) cab.push(t('Pedidos de associação'));
  if (ind?.finance) cab.push(t('Recebido (R$)'));
  if (cab.length > 1) {
    blocos.push([linha(cab), ...ind.months.map((mes, i) => linha([
      mes.split('-').reverse().join('/'),
      ...(ind.members ? [ind.members.requestsByMonth[i].n] : []),
      ...(ind.finance ? [csvReais(ind.finance.paidByMonth[i].cents)] : []),
    ]))]);
  }
  if (ind?.members) {
    blocos.push([linha([t('Plano'), t('Em dia')]), ...ind.members.byPlan.map((x) => linha([x.key || t('Sem plano'), x.n]))]);
    if (ind.members.byCategory) blocos.push([linha([t('Categoria'), t('Em dia')]), ...ind.members.byCategory.map((x) => linha([x.key || t('Sem categoria'), x.n]))]);
  }
  if (ind?.finance) blocos.push([linha([t('Origem'), t('Recebido (R$)')]), ...ind.finance.paidByOrigin.map((x) => linha([CHARGE_ORIGIN_LABELS[x.key] ? t(CHARGE_ORIGIN_LABELS[x.key]) : x.key, csvReais(x.cents)]))]);
  const resumo = [linha([t('Indicador'), t('Valor')])];
  if (ind?.members) resumo.push(linha([t('Em dia'), ind.members.active]), linha([t('Pedidos de associação em 12 meses'), ind.members.requests12]), linha([t('Venceram sem renovar em 12 meses'), ind.members.notRenewed12]));
  if (ind?.finance) resumo.push(linha([t('Recebido em 12 meses (R$)'), csvReais(ind.finance.paid12Cents)]), linha([t('Renovações pagas em 12 meses'), ind.finance.renewalsPaid12]), linha([t('Cobranças em atraso'), ind.finance.overdue]), linha([t('Valor em atraso (R$)'), csvReais(ind.finance.overdueCents)]));
  if (ind?.renewalRate != null) resumo.push(linha([t('Taxa de renovação (%)'), ind.renewalRate]));
  blocos.unshift(resumo);
  return blocos.map((b) => b.join('\n')).join('\n\n');
}
