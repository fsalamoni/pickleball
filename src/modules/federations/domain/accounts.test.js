import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_REPORT_STATUS, accountItems, accountsPendingItems, budgetActions, budgetTotals, budgetVsActual, buildSnapshot, chargeIncomeItems, closedPeriodFor,
  extraExpenseItems, legalDeadline, ledgerCsv, monthlySeries, periodLabel, periodRange, reportActions, reportTimeline, totalsByCategory, validateBudgetInput, validateEntryInput,
} from './accounts.js';

const CHARGES = [
  { id: 'c1', status: 'paid', origin: 'membership', amount_cents: 15000, paid_at: '2026-03-05' },
  { id: 'c2', status: 'paid', origin: 'renewal', amount_cents: 10000, paid_at_ms: Date.UTC(2026, 6, 1, 1, 0) },
  { id: 'c3', status: 'paid', origin: 'course', amount_cents: 30000, paid_at: '2026-10-01' },
  { id: 'c4', status: 'paid', origin: 'fine', amount_cents: 2000, paid_at: '2026-10-02' },
  { id: 'c5', status: 'declared', origin: 'membership', amount_cents: 9999 },
];
const LEDGER = [
  { id: 'l1', kind: 'expense', category: 'travel', date: '2026-05-10', amount_cents: 12000, status: 'posted', description: 'Passagem' },
  { id: 'l2', kind: 'expense', category: 'staff', date: '2026-05-11', amount_cents: 7000, status: 'void' },
  { id: 'l3', kind: 'income', category: 'sponsorship', date: '2026-11-30', amount_cents: 500000, status: 'posted' },
];

describe('contas: receitas e despesas', () => {
  it('cobrança paga vira receita pela origem; aberta/informada não entra; a data é de Brasília', () => {
    const r = chargeIncomeItems(CHARGES);
    expect(r.map((x) => [x.category, x.date])).toEqual([['memberships', '2026-03-05'], ['memberships', '2026-06-30'], ['courses', '2026-10-01'], ['other_income', '2026-10-02']]);
    expect(r.every((x) => x.auto === 'charge')).toBe(true);
  });

  it('despesa derivada (arbitragem) entra marcada; sem data ou com categoria estranha é tratada', () => {
    const r = extraExpenseItems([{ date: '2026-10-02', amount_cents: 25000, category: 'referees', ref: 'e1', auto: 'referees' }, { date: '2026-10-03', amount_cents: 10, category: 'x', ref: 'e2', auto: true }, { amount_cents: 5, ref: 'e3' }]);
    expect(r.map((x) => [x.id, x.category, x.auto])).toEqual([['extra:e1', 'referees', 'referees'], ['extra:e2', 'other_expense', 'derived']]);
  });

  it('o estorno sai da conta; os totais trazem toda categoria, com zero', () => {
    const itens = accountItems({ ledger: LEDGER, charges: CHARGES });
    const tot = totalsByCategory(itens);
    expect(tot.income).toMatchObject({ memberships: 25000, courses: 30000, sponsorship: 500000, other_income: 2000, store: 0 });
    expect(tot.expense).toMatchObject({ travel: 12000, staff: 0 });
    expect(tot).toMatchObject({ income_total: 557000, expense_total: 12000, balance: 545000 });
    expect(itens[0].date >= itens.at(-1).date).toBe(true);
  });

  it('a série mensal do ano', () => {
    const m = monthlySeries(accountItems({ ledger: LEDGER, charges: CHARGES }), 2026);
    expect(m).toHaveLength(12);
    expect(m[4]).toEqual({ month: '2026-05', income: 0, expense: 12000 });
    expect(m[10].income).toBe(500000);
  });
});

describe('contas: orçado × realizado', () => {
  it('percentual e alerta só na despesa (perto, estourou, sem orçamento)', () => {
    const tot = totalsByCategory([
      { kind: 'expense', category: 'travel', amount_cents: 9500 }, { kind: 'expense', category: 'events', amount_cents: 12000 },
      { kind: 'expense', category: 'taxes', amount_cents: 100 }, { kind: 'income', category: 'memberships', amount_cents: 30000 },
    ]);
    const rows = budgetVsActual({ 'expense.travel': 10000, 'expense.events': 10000, 'expense.admin': 5000, 'income.memberships': 20000 }, tot);
    const de = (k) => rows.find((r) => r.key === k);
    expect(de('expense.travel')).toMatchObject({ pct: 95, alert: 'near' });
    expect(de('expense.events')).toMatchObject({ pct: 120, alert: 'over' });
    expect(de('expense.taxes')).toMatchObject({ pct: null, alert: 'unbudgeted' });
    expect(de('expense.admin')).toMatchObject({ pct: 0, alert: 'ok' });
    expect(de('income.memberships')).toMatchObject({ pct: 150, alert: 'ok' });
    expect(budgetTotals({ 'income.memberships': 20000, 'expense.travel': 10000 })).toEqual({ income: 20000, expense: 10000, balance: 10000 });
  });

  it('o orçamento valida chave e valor', () => {
    expect(validateBudgetInput({ year: 2026, lines: {} }).errors.lines).toBeTruthy();
    expect(validateBudgetInput({ year: 2026, lines: { 'expense.travel': -1 } }).errors['lines.expense.travel']).toBeTruthy();
    expect(validateBudgetInput({ year: 2026, lines: { 'expense.travel': 100, 'expense.zzz': 9, 'income.store': 0 } }).value.lines).toEqual({ 'expense.travel': 100 });
  });
});

describe('contas: retrato congelado e períodos', () => {
  it('o retrato do ano leva o orçamento aprovado; o do trimestre, não', () => {
    const itens = accountItems({ ledger: LEDGER, charges: CHARGES });
    const ano = buildSnapshot({ items: itens, period: '2026', budget: { status: 'published', lines: { 'expense.travel': 1 } }, nowMs: 5 });
    expect(ano).toMatchObject({ from: '2026-01-01', to: '2026-12-31', balance: 545000, entries: 2, auto_entries: 4, budget_lines: { 'expense.travel': 1 }, frozen_at_ms: 5 });
    expect(buildSnapshot({ items: itens, period: '2026', budget: { status: 'draft', lines: { 'expense.travel': 1 } } }).budget_lines).toBeNull();
    const q2 = buildSnapshot({ items: itens, period: '2026-Q2', budget: { status: 'approved', lines: {} } });
    expect(q2).toMatchObject({ income_total: 10000, expense_total: 12000, budget_lines: null });
  });

  it('trimestres, rótulo e o prazo legal (último dia útil de abril do ano seguinte)', () => {
    expect(periodRange('2026-Q1')).toEqual({ from: '2026-01-01', to: '2026-03-31' });
    expect(periodRange('2028-Q1')).toEqual({ from: '2028-01-01', to: '2028-03-31' });
    expect(periodRange('2026-Q4')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(periodRange('2026-Q5')).toBeNull();
    expect(periodLabel('2026-Q3')).toBe('3º trimestre de 2026');
    expect(legalDeadline(2025)).toBe('2026-04-30'); // quinta
    expect(legalDeadline(2026)).toBe('2027-04-30'); // sexta
    expect(legalDeadline(2027)).toBe('2028-04-28'); // 30/04/2028 é domingo
  });

  it('período com prestação enviada fica fechado; rascunho não fecha', () => {
    const reps = [{ period: '2026-Q1', status: 'submitted' }, { period: '2026', status: 'draft' }];
    expect(closedPeriodFor('2026-02-10', reps)).toBe('2026-Q1');
    expect(closedPeriodFor('2026-05-10', reps)).toBeNull();
  });

  it('o lançamento não aceita data no futuro nem valor zero', () => {
    const r = validateEntryInput({ kind: 'income', category: 'donations', date: '2026-12-01', amount_cents: 0, description: 'Doação' }, { hoje: '2026-11-01' });
    expect(Object.keys(r.errors).sort()).toEqual(['amount_cents', 'date']);
  });
});

describe('contas: botões, linha do tempo e pendências', () => {
  const FIN = ['finance'];
  const FIS = ['fiscal'];
  it('o financeiro prepara; o conselho só dá parecer', () => {
    expect(reportActions({ status: 'draft' }, FIN)).toMatchObject({ save: true, submit: true, opinion: false });
    expect(reportActions({ status: 'submitted' }, FIS)).toMatchObject({ opinion: true, reopen: false, submit: false });
    expect(reportActions({ status: 'submitted' }, FIN)).toMatchObject({ opinion: false, reopen: true });
    expect(reportActions({ status: 'opinion' }, FIN)).toMatchObject({ assembly: true, publish: true });
    expect(reportActions({ status: 'published' }, ['admin'])).toMatchObject({ publish: false, assembly: false });
    expect(budgetActions({ status: 'approved' }, FIN)).toMatchObject({ reformulate: true, publish: true, submit: false });
    expect(budgetActions(null, FIS)).toMatchObject({ save: false });
  });

  it('a linha do tempo marca o que foi feito e o passo atual', () => {
    const tl = reportTimeline({ status: 'opinion', opened_at_ms: 1, submitted_at_ms: 2, fiscal_opinion: { at_ms: 3 } });
    expect(tl.map((x) => [x.id, x.done, x.current])).toEqual([['draft', true, false], ['submitted', true, false], ['opinion', false, true], ['assembly', false, false], ['published', false, false]]);
    expect(reportTimeline({ status: 'published' }).every((x) => x.done)).toBe(true);
    expect(reportTimeline(null).some((x) => x.done || x.current)).toBe(false);
  });

  it('pendências: parecer para o conselho, parecer recebido e o prazo de abril (a partir de março)', () => {
    const reps = [{ period: '2026', status: ACCOUNT_REPORT_STATUS.SUBMITTED }];
    expect(accountsPendingItems(reps, FIS, { hoje: '2027-03-05' }).map((i) => i.id)).toEqual(['contas-parecer']);
    expect(accountsPendingItems(reps, FIN, { hoje: '2027-02-10' })).toEqual([]);
    expect(accountsPendingItems(reps, FIN, { hoje: '2027-03-10' }).map((i) => i.id)).toEqual(['contas-prazo']);
    expect(accountsPendingItems([{ period: '2026', status: 'published' }], FIN, { hoje: '2027-04-10' })).toEqual([]);
    expect(accountsPendingItems([{ period: '2026', status: 'opinion' }], FIN, { hoje: '2027-05-10' }).map((i) => [i.id, i.label.includes('fora do prazo')])).toEqual([['contas-assembleia', false], ['contas-prazo', true]]);
    expect(accountsPendingItems(undefined, FIS)).toEqual([]);
  });

  it('a planilha marca automático e estornado; o valor vai sem sinal (o tipo diz)', () => {
    const csv = ledgerCsv([{ date: '2026-05-10', kind: 'expense', category: 'travel', description: 'Passagem', amount_cents: 12000, status: 'void' }, { date: '2026-03-05', kind: 'income', category: 'memberships', description: '=x', amount_cents: 15000, auto: 'charge' }]);
    const [, a, b] = csv.split('\n');
    expect(a).toContain('"120,00"');
    expect(a).toContain('"Estornado"');
    expect(b).toContain('"Cobrança paga"');
    expect(b).toContain("\"'=x\"");
  });
});
