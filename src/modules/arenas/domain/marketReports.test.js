import { describe, it, expect } from 'vitest';
import {
  isoWeek, periodKeyFor, periodRange, inRange, listActivePeriods,
  buildAutoReport, computeReportTotals, reportDocId, normalizeReportLine,
  REPORT_PERIOD,
} from './marketReports.js';

describe('periodKeyFor / periodRange (mensal)', () => {
  it('gera chave e intervalo do mês', () => {
    expect(periodKeyFor('2026-08-09', REPORT_PERIOD.MONTHLY)).toBe('2026-08');
    const r = periodRange('2026-08', REPORT_PERIOD.MONTHLY);
    expect(r.start).toBe('2026-08-01');
    expect(r.end).toBe('2026-08-31');
    expect(r.label).toContain('Agosto');
  });
  it('fevereiro respeita o último dia', () => {
    expect(periodRange('2026-02', REPORT_PERIOD.MONTHLY).end).toBe('2026-02-28');
    expect(periodRange('2028-02', REPORT_PERIOD.MONTHLY).end).toBe('2028-02-29');
  });
});

describe('isoWeek / periodKeyFor (semanal)', () => {
  it('calcula semana ISO', () => {
    // 2026-01-01 é quinta → semana 1 de 2026.
    expect(isoWeek(new Date(Date.UTC(2026, 0, 1)))).toEqual({ year: 2026, week: 1 });
  });
  it('chave semanal e intervalo seg→dom', () => {
    const key = periodKeyFor('2026-08-12', REPORT_PERIOD.WEEKLY); // quarta
    const r = periodRange(key, REPORT_PERIOD.WEEKLY);
    // Segunda a domingo, 7 dias.
    expect(r.start <= '2026-08-12').toBe(true);
    expect(r.end >= '2026-08-12').toBe(true);
    const s = new Date(`${r.start}T00:00:00Z`);
    const e = new Date(`${r.end}T00:00:00Z`);
    expect(Math.round((e - s) / 86400000)).toBe(6);
    expect(s.getUTCDay()).toBe(1); // segunda
  });
});

describe('inRange', () => {
  it('inclusivo nas bordas', () => {
    expect(inRange('2026-08-01', '2026-08-01', '2026-08-31')).toBe(true);
    expect(inRange('2026-08-31', '2026-08-01', '2026-08-31')).toBe(true);
    expect(inRange('2026-09-01', '2026-08-01', '2026-08-31')).toBe(false);
  });
});

const products = [
  { id: 'p1', name: 'Coca-Cola 350ml', brand: 'Coca-Cola', category: 'Bebida' },
  { id: 'p2', name: 'Coxinha', brand: '', category: 'Comida' },
];
const entries = [
  { product_id: 'p1', date: '2026-08-03', quantity: 24, total_cost: 72 },
  { product_id: 'p1', date: '2026-07-30', quantity: 10, total_cost: 30 }, // fora do mês
  { product_id: 'p2', date: '2026-08-10', quantity: 50, total_cost: 100 },
];
const exits = [
  { product_id: 'p1', date: '2026-08-05', quantity: 10, exit_type: 'sale', total_price: 60 },
  { product_id: 'p1', date: '2026-08-06', quantity: 2, exit_type: 'loss', total_price: 0 },
  { product_id: 'p2', date: '2026-08-11', quantity: 30, exit_type: 'sale', total_price: 210 },
  { product_id: 'p2', date: '2026-09-01', quantity: 5, exit_type: 'sale', total_price: 35 }, // fora
];

describe('buildAutoReport (mensal)', () => {
  const report = buildAutoReport({ entries, exits, products, periodType: REPORT_PERIOD.MONTHLY, periodKey: '2026-08' });

  it('inclui só o movimento do período', () => {
    const p1 = report.lines.find((l) => l.product_id === 'p1');
    expect(p1.entered_qty).toBe(24); // ignora a entrada de julho
    expect(p1.entered_cost).toBe(72);
    expect(p1.sold_qty).toBe(10);
    expect(p1.sold_revenue).toBe(60);
    expect(p1.loss_qty).toBe(2);
  });
  it('ignora saída de setembro', () => {
    const p2 = report.lines.find((l) => l.product_id === 'p2');
    expect(p2.sold_qty).toBe(30); // não 35
  });
  it('totais: compras, vendas e resultado', () => {
    expect(report.totals.entered_cost).toBe(172); // 72 + 100
    expect(report.totals.sold_revenue).toBe(270); // 60 + 210
    expect(report.totals.result).toBe(98); // 270 - 172
    expect(report.totals.product_count).toBe(2);
  });
  it('resolve nome do produto e marca removido', () => {
    const r2 = buildAutoReport({ entries: [{ product_id: 'zzz', date: '2026-08-02', quantity: 1, total_cost: 5 }], exits: [], products, periodType: REPORT_PERIOD.MONTHLY, periodKey: '2026-08' });
    expect(r2.lines[0].name).toBe('Produto removido');
  });
});

describe('computeReportTotals (após edição)', () => {
  it('recalcula a partir das linhas', () => {
    const lines = [
      { entered_cost: 100, sold_revenue: 150, entered_qty: 10, sold_qty: 8 },
      { entered_cost: 50, sold_revenue: 90, entered_qty: 5, sold_qty: 4 },
    ];
    const t = computeReportTotals(lines);
    expect(t.entered_cost).toBe(150);
    expect(t.sold_revenue).toBe(240);
    expect(t.result).toBe(90);
  });
});

describe('listActivePeriods', () => {
  it('lista períodos com movimento + atual, desc', () => {
    const periods = listActivePeriods(entries, exits, REPORT_PERIOD.MONTHLY, '2026-08-15');
    const keys = periods.map((p) => p.key);
    expect(keys).toContain('2026-08');
    expect(keys).toContain('2026-07');
    expect(keys).toContain('2026-09');
    // Ordem decrescente.
    expect(keys[0] >= keys[keys.length - 1]).toBe(true);
  });
});

describe('reportDocId / normalizeReportLine', () => {
  it('id determinístico', () => {
    expect(reportDocId('a1', 'monthly', '2026-08')).toBe('a1_monthly_2026-08');
  });
  it('sanitiza linha manual', () => {
    const l = normalizeReportLine({ name: '  Água  ', sold_revenue: -5, sold_qty: 3.4, manual: true });
    expect(l.name).toBe('Água');
    expect(l.sold_revenue).toBe(0);
    expect(l.manual).toBe(true);
    expect(l.key).toBeTruthy();
  });
});
