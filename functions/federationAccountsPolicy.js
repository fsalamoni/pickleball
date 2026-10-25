/**
 * Orçamento e prestação de contas da federação — a conta PURA (sem banco):
 * categorias, validação, receitas e despesas derivadas, totais, orçado ×
 * realizado, o retrato congelado e o prazo legal.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/accounts.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationAccounts.parity.test.js`. Os ids são GRAVADOS: nunca renomeie.
 */
const AMOUNT_MAX = 100000000000;
const DESCRIPTION_MAX = 300;
const COUNTERPARTY_MAX = 120;
const NOTES_MAX = 2000;
const REASON_MIN = 10;
const OPINION_MIN = 20;
const OPINION_MAX = 8000;
const STATEMENTS_MAX = 10;
const BANK_IMPORT_MAX = 200;
const BANK_REF_MAX = 160;
const FILE_MAX = 9 * 1024 * 1024;
const FILE_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

const INCOME = Object.freeze(['memberships', 'courses', 'events', 'sponsorship', 'grants', 'donations', 'store', 'other_income']);
const EXPENSE = Object.freeze(['staff', 'referees', 'events', 'travel', 'admin', 'communication', 'taxes', 'equipment', 'other_expense']);
const LINE_KEYS = Object.freeze([...INCOME.map((c) => `income.${c}`), ...EXPENSE.map((c) => `expense.${c}`)]);
const CHARGE_ORIGIN_CATEGORY = Object.freeze({ membership: 'memberships', renewal: 'memberships', upgrade: 'memberships', course: 'courses', fine: 'other_income', sanction: 'events' });
const BUDGET_STATUS = Object.freeze({ DRAFT: 'draft', SUBMITTED: 'submitted', APPROVED: 'approved', PUBLISHED: 'published' });
const REPORT_STATUS = Object.freeze({ DRAFT: 'draft', SUBMITTED: 'submitted', OPINION: 'opinion', APPROVED: 'approved', REJECTED: 'rejected', PUBLISHED: 'published' });
const VERDICTS = Object.freeze(['approve', 'approve_with_reservations', 'reject']);
const ASSEMBLY_RESULTS = Object.freeze(['approved', 'rejected']);
const STATEMENT_KINDS = Object.freeze(['balance_sheet', 'income_statement', 'cash_flow', 'notes', 'other']);

const BR_OFFSET_MS = 3 * 3600000;
const PERIOD_RE = /^(\d{4})(?:-Q([1-4]))?$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const UPLOAD_RE = /^(?:federacao|clube)-contas\/[A-Za-z0-9]+\/[A-Za-z0-9_-]+\.[a-z0-9]{2,4}$/;
const OFFICIAL_RE = /^(?:federacao|clube)-contas-oficial\/[A-Za-z0-9_-]+\/[A-Za-z0-9_/-]+\.[a-z0-9]{2,4}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

const line = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const str = (v, max) => String(v == null ? '' : v).replace(/\r\n/g, '\n').trim().slice(0, max);
const cents = (v) => Math.max(0, Math.trunc(Number(v) || 0));
const isRealDate = (d) => ISO_RE.test(d) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;
const lista = (v) => (Array.isArray(v) ? v : []);
/** A identidade do movimento do extrato (FITID do OFX ou a assinatura da linha do CSV): importar de novo não repete. */
const bankRef = (v) => line(v, BANK_REF_MAX);
const dateBR = (ms) => new Date(Number(ms) - BR_OFFSET_MS).toISOString().slice(0, 10);

const isValidPeriod = (p) => PERIOD_RE.test(String(p || '')) && Number(String(p).slice(0, 4)) >= 2000 && Number(String(p).slice(0, 4)) <= 2100;
const isAnnualPeriod = (p) => isValidPeriod(p) && String(p).length === 4;

function periodRange(p) {
  const m = String(p || '').match(PERIOD_RE);
  if (!m) return null;
  const y = m[1];
  if (!m[2]) return { from: `${y}-01-01`, to: `${y}-12-31` };
  const ini = (Number(m[2]) - 1) * 3 + 1;
  const fim = ini + 2;
  const ultimo = new Date(Date.UTC(Number(y), fim, 0)).getUTCDate();
  return { from: `${y}-${String(ini).padStart(2, '0')}-01`, to: `${y}-${String(fim).padStart(2, '0')}-${ultimo}` };
}

function legalDeadline(year) {
  const d = new Date(Date.UTC(Number(year) + 1, 3, 30));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function validateFile(f, kinds) {
  const v = {
    name: line(f && f.name, 120) || 'arquivo',
    path: String((f && f.path) || ''),
    size: Math.max(0, Math.floor(Number(f && f.size) || 0)),
    content_type: String((f && f.content_type) || ''),
  };
  if (kinds) v.kind = STATEMENT_KINDS.includes(f && f.kind) ? f.kind : 'other';
  const ok = (UPLOAD_RE.test(v.path) || OFFICIAL_RE.test(v.path)) && FILE_TYPES.includes(v.content_type) && v.size > 0 && v.size <= FILE_MAX;
  return { ok, value: v };
}

function validateEntry(input = {}, { hoje } = {}) {
  const errors = {};
  const kind = ['income', 'expense'].includes(input.kind) ? input.kind : '';
  if (!kind) errors.kind = 'Receita ou despesa?';
  const category = kind && (kind === 'expense' ? EXPENSE : INCOME).includes(input.category) ? input.category : '';
  if (!category) errors.category = 'Escolha a categoria.';
  const date = line(input.date, 10);
  if (!isRealDate(date)) errors.date = 'Data inválida.';
  else if (hoje && date > hoje) errors.date = 'O lançamento é do que já aconteceu: a data não pode ser no futuro.';
  const n = Number(input.amount_cents);
  const amount = Number.isInteger(n) ? n : NaN;
  if (!(amount > 0) || amount > AMOUNT_MAX) errors.amount_cents = 'Informe um valor maior que zero.';
  const description = line(input.description, DESCRIPTION_MAX);
  if (description.length < 3) errors.description = 'Descreva o lançamento (mínimo 3 caracteres).';
  const counterparty = line(input.counterparty, COUNTERPARTY_MAX);
  let document = null;
  if (input.document) {
    const f = validateFile(input.document, false);
    if (!f.ok) errors.document = 'Anexo inválido: PDF ou imagem de até 9 MB. Envie de novo.';
    document = f.value;
  }
  return { ok: Object.keys(errors).length === 0, errors, value: { kind, category, date, amount_cents: Number.isNaN(amount) ? 0 : amount, description, counterparty, document } };
}

function validateBudget(input = {}) {
  const errors = {};
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.year = 'Ano inválido.';
  const lines = {};
  const entrada = input.lines && typeof input.lines === 'object' ? input.lines : {};
  LINE_KEYS.forEach((k) => {
    if (entrada[k] == null || entrada[k] === '') return;
    const n = Number(entrada[k]);
    if (!Number.isInteger(n) || n < 0 || n > AMOUNT_MAX) { errors[`lines.${k}`] = 'Valor inválido.'; return; }
    if (n > 0) lines[k] = n;
  });
  if (!Object.keys(errors).length && !Object.keys(lines).length) errors.lines = 'Preencha ao menos uma categoria.';
  return { ok: Object.keys(errors).length === 0, errors, value: { year: Number.isInteger(year) ? year : 0, lines, notes: str(input.notes, NOTES_MAX) } };
}

function validateStatements(list) {
  const errors = {};
  const entrada = lista(list);
  if (entrada.length > STATEMENTS_MAX) errors.statements = `No máximo ${STATEMENTS_MAX} arquivos.`;
  const value = entrada.slice(0, STATEMENTS_MAX).map((f, i) => {
    const r = validateFile(f, true);
    if (!r.ok) errors[`statements.${i}`] = 'Arquivo inválido: PDF ou imagem de até 9 MB.';
    return r.value;
  });
  return { ok: Object.keys(errors).length === 0, errors, value };
}

function validateOpinion(input = {}) {
  const errors = {};
  const verdict = VERDICTS.includes(input.verdict) ? input.verdict : '';
  if (!verdict) errors.verdict = 'Escolha o parecer.';
  const text = str(input.text, OPINION_MAX);
  if (text.length < OPINION_MIN) errors.text = `Escreva o parecer (mínimo ${OPINION_MIN} caracteres).`;
  return { ok: Object.keys(errors).length === 0, errors, value: { verdict, text } };
}

function validateAssembly(input = {}) {
  const errors = {};
  const date = line(input.date, 10);
  if (!isRealDate(date)) errors.date = 'Data inválida.';
  const result = ASSEMBLY_RESULTS.includes(input.result) ? input.result : '';
  if (!result) errors.result = 'Aprovadas ou rejeitadas?';
  const eventId = line(input.event_id, 80);
  if (eventId && !ID_RE.test(eventId)) errors.event_id = 'Reunião inválida.';
  return { ok: Object.keys(errors).length === 0, errors, value: { date, result, event_id: eventId, note: str(input.note, NOTES_MAX) } };
}

function chargePaidDate(c) {
  if (ISO_RE.test(String((c && c.paid_at) || ''))) return c.paid_at;
  const ms = Number(c && c.paid_at_ms);
  return ms > 0 ? dateBR(ms) : '';
}

function chargeIncomeItems(charges) {
  return lista(charges).filter((c) => c && c.status === 'paid').map((c) => ({
    id: `charge:${c.id}`, kind: 'income', category: CHARGE_ORIGIN_CATEGORY[c.origin] || 'other_income',
    date: chargePaidDate(c), amount_cents: cents(c.amount_cents), description: line(c.plan_name, DESCRIPTION_MAX),
    counterparty: line(c.payer_name || c.member_name, COUNTERPARTY_MAX), auto: 'charge', ref: String(c.id || ''),
  })).filter((x) => x.date && x.amount_cents > 0);
}

function extraExpenseItems(extra) {
  return lista(extra).map((x) => ({
    id: `extra:${String((x && x.ref) || '')}`, kind: 'expense',
    category: EXPENSE.includes(x && x.category) ? x.category : 'other_expense',
    date: ISO_RE.test(String((x && x.date) || '')) ? x.date : '', amount_cents: cents(x && x.amount_cents),
    description: line(x && x.description, DESCRIPTION_MAX), counterparty: line(x && x.counterparty, COUNTERPARTY_MAX),
    auto: typeof (x && x.auto) === 'string' ? x.auto : 'derived', ref: String((x && x.ref) || ''),
  })).filter((x) => x.date && x.amount_cents > 0);
}

function extraIncomeItems(extra) {
  return lista(extra).map((x) => ({
    id: `extra:${String((x && x.ref) || '')}`, kind: 'income',
    category: INCOME.includes(x && x.category) ? x.category : 'other_income',
    date: ISO_RE.test(String((x && x.date) || '')) ? x.date : '', amount_cents: cents(x && x.amount_cents),
    description: line(x && x.description, DESCRIPTION_MAX), counterparty: line(x && x.counterparty, COUNTERPARTY_MAX),
    auto: typeof (x && x.auto) === 'string' ? x.auto : 'derived', ref: String((x && x.ref) || ''),
  })).filter((x) => x.date && x.amount_cents > 0);
}

function ledgerItems(ledger) {
  return lista(ledger).filter((e) => e && e.status !== 'void').map((e) => ({
    id: String(e.id || ''), kind: e.kind === 'expense' ? 'expense' : 'income', category: String(e.category || ''),
    date: String(e.date || ''), amount_cents: cents(e.amount_cents), description: String(e.description || ''), counterparty: String(e.counterparty || ''), auto: false, ref: String(e.id || ''),
  }));
}

function accountItems({ ledger, charges, extraExpenses, extraIncome } = {}) {
  return [...ledgerItems(ledger), ...chargeIncomeItems(charges), ...extraIncomeItems(extraIncome), ...extraExpenseItems(extraExpenses)]
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.date < b.date ? 1 : -1));
}

function itemsInPeriod(items, period) {
  const r = periodRange(period);
  return r ? lista(items).filter((x) => x.date >= r.from && x.date <= r.to) : [];
}

function totalsByCategory(items) {
  const income = Object.fromEntries(INCOME.map((c) => [c, 0]));
  const expense = Object.fromEntries(EXPENSE.map((c) => [c, 0]));
  lista(items).forEach((x) => {
    const alvo = x.kind === 'expense' ? expense : income;
    const cat = Object.prototype.hasOwnProperty.call(alvo, x.category) ? x.category : (x.kind === 'expense' ? 'other_expense' : 'other_income');
    alvo[cat] += cents(x.amount_cents);
  });
  const incomeTotal = Object.values(income).reduce((a, b) => a + b, 0);
  const expenseTotal = Object.values(expense).reduce((a, b) => a + b, 0);
  return { income, expense, income_total: incomeTotal, expense_total: expenseTotal, balance: incomeTotal - expenseTotal };
}

function buildSnapshot({ items, period, budget = null, nowMs }) {
  const r = periodRange(period);
  const doPeriodo = itemsInPeriod(items, period);
  const aprovado = budget && [BUDGET_STATUS.APPROVED, BUDGET_STATUS.PUBLISHED].includes(budget.status);
  return {
    period, from: r ? r.from : '', to: r ? r.to : '',
    ...totalsByCategory(doPeriodo),
    entries: doPeriodo.filter((x) => !x.auto).length,
    auto_entries: doPeriodo.filter((x) => x.auto).length,
    budget_lines: isAnnualPeriod(period) && aprovado ? { ...budget.lines } : null,
    frozen_at_ms: nowMs,
  };
}

function closedPeriodFor(date, reports = []) {
  const r = lista(reports).find((x) => {
    if (!x || !x.status || x.status === REPORT_STATUS.DRAFT) return false;
    const p = periodRange(x.period);
    return p && date >= p.from && date <= p.to;
  });
  return r ? r.period : null;
}

module.exports = {
  BANK_IMPORT_MAX, BANK_REF_MAX, bankRef, AMOUNT_MAX, DESCRIPTION_MAX, COUNTERPARTY_MAX, NOTES_MAX, REASON_MIN, OPINION_MIN, OPINION_MAX, STATEMENTS_MAX, FILE_MAX, FILE_TYPES,
  INCOME, EXPENSE, LINE_KEYS, CHARGE_ORIGIN_CATEGORY, BUDGET_STATUS, REPORT_STATUS, VERDICTS, ASSEMBLY_RESULTS, STATEMENT_KINDS,
  UPLOAD_RE, OFFICIAL_RE, dateBR, isValidPeriod, isAnnualPeriod, periodRange, legalDeadline,
  validateEntry, validateBudget, validateStatements, validateOpinion, validateAssembly,
  chargePaidDate, chargeIncomeItems, extraExpenseItems, extraIncomeItems, ledgerItems, accountItems, itemsInPeriod, totalsByCategory, buildSnapshot, closedPeriodFor,
};
