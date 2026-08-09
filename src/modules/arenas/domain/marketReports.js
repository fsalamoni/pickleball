/**
 * Domínio puro de RELATÓRIOS do mercado da arena (flag arena_market_reports).
 *
 * A arena registra ENTRADAS (compras) e SAÍDAS (vendas/consumo/perda) de
 * produtos. Este módulo agrega esses registros em relatórios por período
 * (semanal ou mensal, à escolha do admin) para a gestão financeira.
 *
 * Princípios:
 *  - O relatório AUTOMÁTICO reflete integralmente o que foi registrado na
 *    plataforma (entradas + saídas do período).
 *  - Editar/excluir linhas do relatório NÃO altera os registros de entrada/
 *    saída — mexe apenas no documento do relatório (snapshot editável).
 *  - Produtos que zeram o estoque continuam existindo; só não podem ser
 *    vendidos até repor (isso é regra da UI de saída, não deste módulo).
 *
 * Sem I/O e sem React — apenas cálculo, testável.
 */

export const REPORT_PERIOD = Object.freeze({ WEEKLY: 'weekly', MONTHLY: 'monthly' });
export const REPORT_PERIODS_LIST = Object.values(REPORT_PERIOD);

export const REPORT_STATUS = Object.freeze({ OPEN: 'open', CLOSED: 'closed' });

const pad2 = (n) => String(n).padStart(2, '0');

/** Parse 'YYYY-MM-DD' como data UTC (evita deslocamento de fuso). */
function parseYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toYmd(date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/**
 * Semana ISO (segunda a domingo; a semana 1 contém a primeira quinta-feira).
 * @param {Date} date
 * @returns {{ year: number, week: number }}
 */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // 0 = segunda
  d.setUTCDate(d.getUTCDate() - day + 3); // quinta-feira desta semana
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
  return { year: d.getUTCFullYear(), week };
}

/** Chave do período de uma data ('YYYY-MM' ou 'YYYY-Www'). */
export function periodKeyFor(ymd, periodType) {
  const d = parseYmd(ymd) || parseYmd(new Date().toISOString().slice(0, 10));
  if (periodType === REPORT_PERIOD.WEEKLY) {
    const { year, week } = isoWeek(d);
    return `${year}-W${pad2(week)}`;
  }
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

const MONTHS_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Intervalo (início/fim inclusivos, YYYY-MM-DD) e rótulo de um período.
 * @param {string} periodKey
 * @param {string} periodType
 * @returns {{ start: string, end: string, label: string }}
 */
export function periodRange(periodKey, periodType) {
  if (periodType === REPORT_PERIOD.WEEKLY) {
    const m = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    if (!m) return { start: '', end: '', label: periodKey };
    const year = Number(m[1]);
    const week = Number(m[2]);
    // Segunda-feira da semana ISO.
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = (jan4.getUTCDay() + 6) % 7;
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
    const start = new Date(week1Monday);
    start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      start: toYmd(start),
      end: toYmd(end),
      label: `Semana ${pad2(week)}/${year} (${toBr(start)} a ${toBr(end)})`,
    };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!m) return { start: '', end: '', label: periodKey };
  const year = Number(m[1]);
  const month = Number(m[2]);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    start: toYmd(start),
    end: toYmd(end),
    label: `${capitalize(MONTHS_PT[month - 1])} de ${year}`,
  };
}

function toBr(date) { return `${pad2(date.getUTCDate())}/${pad2(date.getUTCMonth() + 1)}`; }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

/** true se `ymd` está dentro de [start, end] inclusivo (comparação lexicográfica). */
export function inRange(ymd, start, end) {
  const s = String(ymd || '');
  return !!s && s >= start && s <= end;
}

/**
 * Lista os períodos que têm QUALQUER movimento (entrada ou saída), do mais
 * recente para o mais antigo. Sempre inclui o período atual.
 */
export function listActivePeriods(entries = [], exits = [], periodType, today) {
  const keys = new Set();
  const now = today || new Date().toISOString().slice(0, 10);
  keys.add(periodKeyFor(now, periodType));
  for (const e of entries) if (e?.date) keys.add(periodKeyFor(e.date, periodType));
  for (const x of exits) if (x?.date) keys.add(periodKeyFor(x.date, periodType));
  return Array.from(keys)
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((key) => ({ key, ...periodRange(key, periodType) }));
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Constrói o relatório AUTOMÁTICO de um período: linhas por produto com
 * quantidades e valores de entrada e saída, e os totais financeiros.
 *
 * @param {object} args
 * @param {object[]} args.entries
 * @param {object[]} args.exits
 * @param {object[]} args.products  para resolver nome/marca (pode faltar)
 * @param {string} args.periodType
 * @param {string} args.periodKey
 * @returns {object} snapshot do relatório
 */
export function buildAutoReport({ entries = [], exits = [], products = [], periodType, periodKey }) {
  const { start, end, label } = periodRange(periodKey, periodType);
  const productById = new Map(products.map((p) => [p.id, p]));

  const lineMap = new Map();
  const lineFor = (productId) => {
    const key = productId || 'sem-produto';
    if (!lineMap.has(key)) {
      const p = productById.get(productId);
      lineMap.set(key, {
        key,
        product_id: productId || null,
        name: p?.name || 'Produto removido',
        brand: p?.brand || '',
        category: p?.category || '',
        entered_qty: 0,
        entered_cost: 0,
        sold_qty: 0,
        sold_revenue: 0,
        loss_qty: 0,
        consumption_qty: 0,
        other_qty: 0,
        manual: false,
      });
    }
    return lineMap.get(key);
  };

  for (const e of entries) {
    if (!inRange(e.date, start, end)) continue;
    const l = lineFor(e.product_id);
    l.entered_qty += Number(e.quantity || 0);
    l.entered_cost = round2(l.entered_cost + Number(e.total_cost || 0));
  }
  for (const x of exits) {
    if (!inRange(x.date, start, end)) continue;
    const l = lineFor(x.product_id);
    const qty = Number(x.quantity || 0);
    if (x.exit_type === 'sale') {
      l.sold_qty += qty;
      l.sold_revenue = round2(l.sold_revenue + Number(x.total_price || 0));
    } else if (x.exit_type === 'loss') {
      l.loss_qty += qty;
    } else if (x.exit_type === 'consumption') {
      l.consumption_qty += qty;
    } else {
      l.other_qty += qty;
    }
  }

  const lines = Array.from(lineMap.values())
    .filter((l) => l.entered_qty || l.sold_qty || l.loss_qty || l.consumption_qty || l.other_qty)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return {
    period_type: periodType,
    period_key: periodKey,
    period_start: start,
    period_end: end,
    label,
    lines,
    totals: computeReportTotals(lines),
    edited: false,
  };
}

/** Recalcula os totais a partir das linhas (usado após edições manuais). */
export function computeReportTotals(lines = []) {
  const t = {
    entered_qty: 0, entered_cost: 0, sold_qty: 0, sold_revenue: 0,
    loss_qty: 0, consumption_qty: 0, other_qty: 0, result: 0, product_count: lines.length,
  };
  for (const l of lines) {
    t.entered_qty += Number(l.entered_qty || 0);
    t.entered_cost = round2(t.entered_cost + Number(l.entered_cost || 0));
    t.sold_qty += Number(l.sold_qty || 0);
    t.sold_revenue = round2(t.sold_revenue + Number(l.sold_revenue || 0));
    t.loss_qty += Number(l.loss_qty || 0);
    t.consumption_qty += Number(l.consumption_qty || 0);
    t.other_qty += Number(l.other_qty || 0);
  }
  // Resultado do período (caixa): vendas - compras.
  t.result = round2(t.sold_revenue - t.entered_cost);
  return t;
}

/** Id determinístico do relatório salvo. */
export function reportDocId(arenaId, periodType, periodKey) {
  return `${arenaId}_${periodType}_${periodKey}`;
}

/** Normaliza uma linha manual/editada (sanitiza números). */
export function normalizeReportLine(input = {}) {
  const num = (v) => Math.max(0, round2(v));
  return {
    key: String(input.key || `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    product_id: input.product_id || null,
    name: String(input.name || '').trim().slice(0, 120) || 'Item',
    brand: String(input.brand || '').trim().slice(0, 60),
    category: String(input.category || '').trim().slice(0, 40),
    entered_qty: num(input.entered_qty),
    entered_cost: num(input.entered_cost),
    sold_qty: num(input.sold_qty),
    sold_revenue: num(input.sold_revenue),
    loss_qty: num(input.loss_qty),
    consumption_qty: num(input.consumption_qty),
    other_qty: num(input.other_qty),
    manual: input.manual === true,
  };
}
