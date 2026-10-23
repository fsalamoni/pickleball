/**
 * PARIDADE cliente × servidor do orçamento e da prestação de contas: a tela
 * valida e soma com a mesma régua que o servidor aplica — categorias, mapa
 * da origem da cobrança, validação, totais, retrato congelado, período
 * fechado e prazo legal. O que a tela mostra antes de enviar é o que o
 * servidor congela.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/accounts.js';

const require = createRequire(import.meta.url);
const s = require('./federationAccountsPolicy.js');

const LANCAMENTOS = [
  { kind: 'expense', category: 'travel', date: '2026-05-10', amount_cents: 12000, description: 'Passagem', counterparty: '  Cia  Aérea ' },
  { kind: 'income', category: 'travel', date: '2026-05-10', amount_cents: 100, description: 'x' },
  { kind: 'expense', category: 'events', date: '2026-02-30', amount_cents: -5, description: 'Data errada' },
  { kind: 'income', category: 'sponsorship', date: '2027-01-01', amount_cents: 10.5, description: 'Futuro e quebrado' },
  { kind: 'nada', category: 'staff', date: '2026-01-01', amount_cents: 1, description: 'Sem tipo' },
  { kind: 'expense', category: 'admin', date: '2026-01-01', amount_cents: 500, description: 'Com anexo', document: { name: 'n.pdf', path: 'federacao-contas/u1/abc.pdf', size: 10, content_type: 'application/pdf' } },
  { kind: 'expense', category: 'admin', date: '2026-01-01', amount_cents: 500, description: 'Anexo ruim', document: { name: 'n.exe', path: 'outra/u1/abc.exe', size: 10, content_type: 'application/x-msdownload' } },
];

const LEDGER = [
  { id: 'l1', kind: 'expense', category: 'travel', date: '2026-05-10', amount_cents: 12000, status: 'posted' },
  { id: 'l2', kind: 'income', category: 'sponsorship', date: '2026-11-30', amount_cents: 500000, status: 'posted' },
  { id: 'l3', kind: 'expense', category: 'staff', date: '2026-07-01', amount_cents: 7000, status: 'void' },
  { id: 'l4', kind: 'expense', category: 'inventada', date: '2026-08-01', amount_cents: 300, status: 'posted' },
];
const CHARGES = [
  { id: 'c1', status: 'paid', origin: 'membership', amount_cents: 15000, paid_at: '2026-03-05', plan_name: 'Atleta', payer_name: 'Ana' },
  { id: 'c2', status: 'paid', origin: 'course', amount_cents: 30000, paid_at_ms: Date.UTC(2026, 6, 1, 1, 0) },
  { id: 'c3', status: 'paid', origin: 'fine', amount_cents: 2000, paid_at: '2026-09-09' },
  { id: 'c4', status: 'paid', origin: 'nova_origem', amount_cents: 100, paid_at: '2026-09-09' },
  { id: 'c5', status: 'open', origin: 'membership', amount_cents: 99999 },
  { id: 'c6', status: 'paid', origin: 'renewal', amount_cents: 0, paid_at: '2026-09-09' },
];
const EXTRA = [
  { date: '2026-10-02', amount_cents: 25000, category: 'referees', ref: 'esc1', auto: 'referees' },
  { date: '2026-10-03', amount_cents: 100, category: 'inexistente', ref: 'esc2', auto: true },
  { date: 'ontem', amount_cents: 100, category: 'referees', ref: 'esc3' },
];

describe('paridade: orçamento e prestação de contas', () => {
  it('as mesmas categorias, chaves, estados e tetos', () => {
    expect(s.INCOME).toEqual(c.INCOME_CATEGORIES.map((x) => x.id));
    expect(s.EXPENSE).toEqual(c.EXPENSE_CATEGORIES.map((x) => x.id));
    expect(s.LINE_KEYS).toEqual(c.BUDGET_LINE_KEYS);
    expect(s.CHARGE_ORIGIN_CATEGORY).toEqual(c.CHARGE_ORIGIN_CATEGORY);
    expect(s.BUDGET_STATUS).toEqual(c.BUDGET_STATUS);
    expect(s.REPORT_STATUS).toEqual(c.ACCOUNT_REPORT_STATUS);
    expect(s.VERDICTS).toEqual(c.OPINION_VERDICTS.map((x) => x.id));
    expect(s.ASSEMBLY_RESULTS).toEqual(c.ASSEMBLY_RESULTS.map((x) => x.id));
    expect(s.STATEMENT_KINDS).toEqual(c.STATEMENT_KINDS.map((x) => x.id));
    expect([s.AMOUNT_MAX, s.DESCRIPTION_MAX, s.COUNTERPARTY_MAX, s.NOTES_MAX, s.REASON_MIN, s.OPINION_MIN, s.OPINION_MAX, s.STATEMENTS_MAX, s.FILE_MAX])
      .toEqual([c.ACCOUNT_AMOUNT_MAX, c.ACCOUNT_DESCRIPTION_MAX, c.ACCOUNT_COUNTERPARTY_MAX, c.ACCOUNT_NOTES_MAX, c.ACCOUNT_REASON_MIN, c.OPINION_TEXT_MIN, c.OPINION_TEXT_MAX, c.STATEMENTS_MAX, c.ACCOUNT_FILE_MAX]);
    expect(s.FILE_TYPES).toEqual(c.ACCOUNT_FILE_TYPES);
    expect([s.BANK_IMPORT_MAX, s.BANK_REF_MAX]).toEqual([c.BANK_IMPORT_MAX, c.BANK_REF_MAX]);
    ['ofx:123', '  csv:2026-01-02|1500|PIX   RECEBIDO|1  ', '', null, 'x'.repeat(300)].forEach((v) => expect(s.bankRef(v)).toBe(c.bankRef(v)));
  });

  it('a mesma validação do lançamento (resultado, campos com erro e valor)', () => {
    LANCAMENTOS.forEach((e) => {
      const a = s.validateEntry(e, { hoje: '2026-12-31' });
      const b = c.validateEntryInput(e, { hoje: '2026-12-31' });
      expect(a.ok, e.description).toBe(b.ok);
      expect(Object.keys(a.errors).sort(), e.description).toEqual(Object.keys(b.errors).sort());
      expect(a.value, e.description).toEqual(b.value);
    });
  });

  it('a mesma validação do orçamento, das demonstrações, do parecer e da assembleia', () => {
    [{ year: 2026, lines: { 'income.memberships': 100, 'expense.events': '200', 'expense.nada': 9 } }, { year: 1999, lines: {} }, { year: 2026, lines: { 'income.store': -1 } }, { year: 2026, lines: { 'income.store': 1.5 } }]
      .forEach((b) => { const x = s.validateBudget(b); const y = c.validateBudgetInput(b); expect(x.ok).toBe(y.ok); expect(Object.keys(x.errors).sort()).toEqual(Object.keys(y.errors).sort()); expect(x.value).toEqual(y.value); });
    const st = [{ name: 'b.pdf', path: 'federacao-contas/u1/b.pdf', size: 9, content_type: 'application/pdf', kind: 'balance_sheet' }, { name: 'x', path: 'federacao-contas-oficial/f/reports/r/1.png', size: 1, content_type: 'image/png', kind: 'zzz' }, { path: 'x/y.pdf', size: 0 }];
    expect(s.validateStatements(st)).toEqual(c.validateStatements(st));
    [{ verdict: 'approve', text: 'Contas em ordem e conferidas.' }, { verdict: 'talvez', text: 'curto' }].forEach((o) => expect(s.validateOpinion(o).errors && Object.keys(s.validateOpinion(o).errors)).toEqual(Object.keys(c.validateOpinionInput(o).errors)));
    [{ date: '2027-03-01', result: 'approved', event_id: 'ago' }, { date: '2027-02-30', result: 'x', event_id: 'a/b' }].forEach((x) => {
      const a = s.validateAssembly(x); const b = c.validateAssemblyInput(x);
      expect(Object.keys(a.errors)).toEqual(Object.keys(b.errors)); expect(a.value).toEqual(b.value);
    });
  });

  it('as mesmas receitas e despesas derivadas, os mesmos totais e o mesmo retrato congelado', () => {
    const itensS = s.accountItems({ ledger: LEDGER, charges: CHARGES, extraExpenses: EXTRA, extraIncome: [{ ref: 'sponsor:k:p1', date: '2026-05-02', amount_cents: 7000, category: 'sponsorship', auto: 'sponsor', description: ' Parcela ', counterparty: 'S' }, { ref: 'x', date: 'ruim', amount_cents: 5 }] });
    const itensC = c.accountItems({ ledger: LEDGER, charges: CHARGES, extraExpenses: EXTRA, extraIncome: [{ ref: 'sponsor:k:p1', date: '2026-05-02', amount_cents: 7000, category: 'sponsorship', auto: 'sponsor', description: ' Parcela ', counterparty: 'S' }, { ref: 'x', date: 'ruim', amount_cents: 5 }] });
    expect(itensS).toEqual(itensC);
    expect(s.totalsByCategory(itensS)).toEqual(c.totalsByCategory(itensC));
    const budget = { status: 'approved', lines: { 'income.memberships': 20000 } };
    ['2026', '2026-Q2', '2026-Q4', '2025'].forEach((period) => {
      expect(s.buildSnapshot({ items: itensS, period, budget, nowMs: 1 })).toEqual(c.buildSnapshot({ items: itensC, period, budget, nowMs: 1 }));
    });
    expect(s.buildSnapshot({ items: itensS, period: '2026', budget: { status: 'draft', lines: {} }, nowMs: 1 })).toEqual(c.buildSnapshot({ items: itensC, period: '2026', budget: { status: 'draft', lines: {} }, nowMs: 1 }));
  });

  it('o mesmo período, o mesmo prazo legal e o mesmo período fechado', () => {
    ['2026', '2026-Q1', '2026-Q2', '2024-Q1', '2026-Q5', '26', '1999'].forEach((p) => {
      expect(s.isValidPeriod(p), p).toBe(c.isValidPeriod(p));
      expect(s.isAnnualPeriod(p), p).toBe(c.isAnnualPeriod(p));
      expect(s.periodRange(p), p).toEqual(c.periodRange(p));
    });
    [2024, 2025, 2026, 2027, 2030].forEach((y) => expect(s.legalDeadline(y)).toBe(c.legalDeadline(y)));
    const reps = [{ period: '2026-Q1', status: 'submitted' }, { period: '2026', status: 'draft' }];
    ['2026-02-01', '2026-05-01'].forEach((d) => expect(s.closedPeriodFor(d, reps)).toBe(c.closedPeriodFor(d, reps)));
    [Date.UTC(2026, 0, 1, 2, 59), Date.UTC(2026, 0, 1, 3, 0)].forEach((ms) => expect(s.dateBR(ms)).toBe(c.dateBR(ms)));
  });
});
