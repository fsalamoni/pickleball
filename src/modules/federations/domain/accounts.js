/**
 * ORÇAMENTO E PRESTAÇÃO DE CONTAS da federação (módulo `accounts`) — lógica pura.
 *
 * Três coleções, todas gravadas SÓ pelo servidor (`functions/federationAccounts.js`):
 *  - `federation_budgets/{fed}_{ano}`: o orçamento anual por categoria
 *    (rascunho → enviado → aprovado numa reunião da agenda → publicado);
 *  - `federation_ledger/{id}`: o lançamento MANUAL (receita ou despesa, com a
 *    nota ou o recibo). Errado não se apaga: estorna, com motivo;
 *  - `federation_account_reports/{fed}_{período}`: a prestação de contas do
 *    ano (`2026`) ou do trimestre (`2026-Q1`), com os totais CONGELADOS ao
 *    enviar, o parecer do conselho fiscal, a assembleia e a publicação.
 *    (Não é `federation_reports`: esse nome já é da ouvidoria.)
 *
 * Receita e despesa DERIVADAS não são gravadas: a cobrança paga
 * (`federation_charges`, `paid`) entra como receita pela `origin`, e o que
 * vier em `extraExpenses` (ponto de junção da arbitragem:
 * `refereeFeesAsExpenses(assignments)` de `domain/referees.js` devolve
 * `{ date, amount_cents, category, ref, auto }`) entra como despesa. Assim o
 * mesmo dinheiro nunca é lançado duas vezes.
 *
 * ⚠️ As categorias, os estados e os vereditos são GRAVADOS: nunca renomeie.
 * A conta (categorias, validação, totais, retrato congelado, prazo legal) tem
 * cópia no servidor (`functions/federationAccountsPolicy.js`, paridade em
 * `functions/federationAccounts.parity.test.js`).
 */
import { t, tk } from '@/core/i18n';
import { FED_PERMISSION } from './constants.js';
import { csvCell, csvReais } from './charges.js';

export const ACCOUNTS_COLLECTIONS = Object.freeze({
  budgets: 'federation_budgets',
  ledger: 'federation_ledger',
  reports: 'federation_account_reports',
});

export const ACCOUNT_AMOUNT_MAX = 100_000_000_000; // R$ 1 bilhão, em centavos
export const ACCOUNT_DESCRIPTION_MAX = 300;
export const ACCOUNT_COUNTERPARTY_MAX = 120;
export const ACCOUNT_NOTES_MAX = 2000;
export const ACCOUNT_REASON_MIN = 10;
export const OPINION_TEXT_MIN = 20;
export const OPINION_TEXT_MAX = 8000;
export const STATEMENTS_MAX = 10;
/** Importação do extrato bancário: quantos movimentos por vez e o tamanho da identidade de cada um. */
export const BANK_IMPORT_MAX = 200;
export const BANK_REF_MAX = 160;
/** Anexo (nota, recibo, demonstração): PDF ou imagem até 9 MB — a equipe o abre pela função. */
export const ACCOUNT_FILE_MAX = 9 * 1024 * 1024;
export const ACCOUNT_FILE_TYPES = Object.freeze(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export const ENTRY_KIND = Object.freeze({ INCOME: 'income', EXPENSE: 'expense' });
export const ENTRY_STATUS = Object.freeze({ POSTED: 'posted', VOID: 'void' });

export const INCOME_CATEGORIES = Object.freeze([
  { id: 'memberships', label: tk('Filiações e anuidades') },
  { id: 'courses', label: tk('Cursos') },
  { id: 'events', label: tk('Eventos e inscrições') },
  { id: 'sponsorship', label: tk('Patrocínio') },
  { id: 'grants', label: tk('Convênios e repasses') },
  { id: 'donations', label: tk('Doações') },
  { id: 'store', label: tk('Loja') },
  { id: 'other_income', label: tk('Outras receitas') },
]);
export const EXPENSE_CATEGORIES = Object.freeze([
  { id: 'staff', label: tk('Pessoal') },
  { id: 'referees', label: tk('Arbitragem') },
  { id: 'events', label: tk('Eventos') },
  { id: 'travel', label: tk('Viagens') },
  { id: 'admin', label: tk('Administrativo') },
  { id: 'communication', label: tk('Comunicação') },
  { id: 'taxes', label: tk('Impostos e taxas') },
  { id: 'equipment', label: tk('Material e equipamento') },
  { id: 'other_expense', label: tk('Outras despesas') },
]);
export const categoriesOf = (kind) => (kind === ENTRY_KIND.EXPENSE ? EXPENSE_CATEGORIES : INCOME_CATEGORIES);
/** Chave das linhas do orçamento: `income.events` e `expense.events` são categorias diferentes. */
export const lineKey = (kind, cat) => `${kind}.${cat}`;
export const BUDGET_LINE_KEYS = Object.freeze([
  ...INCOME_CATEGORIES.map((c) => lineKey('income', c.id)),
  ...EXPENSE_CATEGORIES.map((c) => lineKey('expense', c.id)),
]);

/** A cobrança paga (pela `origin`) → a categoria de receita. Origem nova cai em "Outras receitas". */
export const CHARGE_ORIGIN_CATEGORY = Object.freeze({ membership: 'memberships', renewal: 'memberships', upgrade: 'memberships', course: 'courses', fine: 'other_income', sanction: 'events' });

export const BUDGET_STATUS = Object.freeze({ DRAFT: 'draft', SUBMITTED: 'submitted', APPROVED: 'approved', PUBLISHED: 'published' });
export const BUDGET_STATUS_LABELS = Object.freeze({ draft: tk('Rascunho'), submitted: tk('Enviado para aprovação'), approved: tk('Aprovado'), published: tk('Publicado') });

export const ACCOUNT_REPORT_STATUS = Object.freeze({ DRAFT: 'draft', SUBMITTED: 'submitted', OPINION: 'opinion', APPROVED: 'approved', REJECTED: 'rejected', PUBLISHED: 'published' });
export const ACCOUNT_REPORT_STATUS_LABELS = Object.freeze({
  draft: tk('Rascunho'), submitted: tk('Com o conselho fiscal'), opinion: tk('Parecer registrado'),
  approved: tk('Aprovada pela assembleia'), rejected: tk('Rejeitada pela assembleia'), published: tk('Publicada'),
});

export const OPINION_VERDICTS = Object.freeze([
  { id: 'approve', label: tk('Pela aprovação') },
  { id: 'approve_with_reservations', label: tk('Pela aprovação com ressalvas') },
  { id: 'reject', label: tk('Pela rejeição') },
]);
export const ASSEMBLY_RESULTS = Object.freeze([
  { id: 'approved', label: tk('Contas aprovadas') },
  { id: 'rejected', label: tk('Contas rejeitadas') },
]);
export const STATEMENT_KINDS = Object.freeze([
  { id: 'balance_sheet', label: tk('Balanço patrimonial') },
  { id: 'income_statement', label: tk('Demonstração do resultado (DRE)') },
  { id: 'cash_flow', label: tk('Fluxo de caixa') },
  { id: 'notes', label: tk('Notas explicativas') },
  { id: 'other', label: tk('Outro documento') },
]);

const BR_OFFSET_MS = 3 * 3600000;
const PERIOD_RE = /^(\d{4})(?:-Q([1-4]))?$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const UPLOAD_RE = /^(?:federacao|clube)-contas\/[A-Za-z0-9]+\/[A-Za-z0-9_-]+\.[a-z0-9]{2,4}$/;
const OFFICIAL_RE = /^(?:federacao|clube)-contas-oficial\/[A-Za-z0-9_-]+\/[A-Za-z0-9_/-]+\.[a-z0-9]{2,4}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

const line = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const str = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const cents = (v) => Math.max(0, Math.trunc(Number(v) || 0));
const isRealDate = (d) => ISO_RE.test(d) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;
const lista = (v) => (Array.isArray(v) ? v : []);

/** A identidade do movimento do extrato (FITID do OFX ou a assinatura da linha do CSV): importar de novo não repete. */
export const bankRef = (v) => line(v, BANK_REF_MAX);

/** A data de Brasília de um instante (ms). */
export const dateBR = (ms) => new Date(Number(ms) - BR_OFFSET_MS).toISOString().slice(0, 10);
export const accountBudgetDocId = (fedId, year) => `${fedId}_${year}`;
export const accountReportDocId = (fedId, period) => `${fedId}_${period}`;

/* -------------------------------------------------------------- período -- */

export const isValidPeriod = (p) => PERIOD_RE.test(String(p || '')) && Number(String(p).slice(0, 4)) >= 2000 && Number(String(p).slice(0, 4)) <= 2100;
export const isAnnualPeriod = (p) => isValidPeriod(p) && String(p).length === 4;
export const periodYear = (p) => Number(String(p || '').slice(0, 4)) || 0;

/** O primeiro e o último dia do período (`2026` ou `2026-Q2`). */
export function periodRange(p) {
  const m = String(p || '').match(PERIOD_RE);
  if (!m) return null;
  const y = m[1];
  if (!m[2]) return { from: `${y}-01-01`, to: `${y}-12-31` };
  const q = Number(m[2]);
  const ini = (q - 1) * 3 + 1;
  const fim = ini + 2;
  const ultimo = new Date(Date.UTC(Number(y), fim, 0)).getUTCDate();
  return { from: `${y}-${String(ini).padStart(2, '0')}-01`, to: `${y}-${String(fim).padStart(2, '0')}-${ultimo}` };
}

/** "2026" ou "1º trimestre de 2026". */
export function periodLabel(p) {
  const m = String(p || '').match(PERIOD_RE);
  if (!m) return String(p || '');
  return m[2] ? t('{n}º trimestre de {ano}', { n: m[2], ano: m[1] }) : m[1];
}

/**
 * O prazo legal das demonstrações do ano: o último dia ÚTIL de abril do ano
 * seguinte (Lei 14.597/2023, art. 36, X, f). Feriados não entram na conta.
 */
export function legalDeadline(year) {
  const d = new Date(Date.UTC(Number(year) + 1, 3, 30));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------ validação -- */

function validateFile(f, { kinds } = {}) {
  const v = {
    name: line(f?.name, 120) || 'arquivo',
    path: String(f?.path || ''),
    size: Math.max(0, Math.floor(Number(f?.size) || 0)),
    content_type: String(f?.content_type || ''),
  };
  if (kinds) v.kind = STATEMENT_KINDS.some((k) => k.id === f?.kind) ? f.kind : 'other';
  const ok = (UPLOAD_RE.test(v.path) || OFFICIAL_RE.test(v.path)) && ACCOUNT_FILE_TYPES.includes(v.content_type) && v.size > 0 && v.size <= ACCOUNT_FILE_MAX;
  return { ok, value: v };
}

/**
 * O lançamento manual. Mesma conta de `validateEntry` no servidor.
 * @param {object} input { kind, category, date, amount_cents, description, counterparty, document }
 * @param {{ hoje: string }} opts
 */
export function validateEntryInput(input = {}, { hoje } = {}) {
  const errors = {};
  const kind = Object.values(ENTRY_KIND).includes(input.kind) ? input.kind : '';
  if (!kind) errors.kind = t('Receita ou despesa?');
  const category = kind && categoriesOf(kind).some((c) => c.id === input.category) ? input.category : '';
  if (!category) errors.category = t('Escolha a categoria.');
  const date = line(input.date, 10);
  if (!isRealDate(date)) errors.date = t('Data inválida.');
  else if (hoje && date > hoje) errors.date = t('O lançamento é do que já aconteceu: a data não pode ser no futuro.');
  const n = Number(input.amount_cents);
  const amount_cents = Number.isInteger(n) ? n : NaN;
  if (!(amount_cents > 0) || amount_cents > ACCOUNT_AMOUNT_MAX) errors.amount_cents = t('Informe um valor maior que zero.');
  const description = line(input.description, ACCOUNT_DESCRIPTION_MAX);
  if (description.length < 3) errors.description = t('Descreva o lançamento (mínimo 3 caracteres).');
  const counterparty = line(input.counterparty, ACCOUNT_COUNTERPARTY_MAX);
  let document = null;
  if (input.document) {
    const f = validateFile(input.document);
    if (!f.ok) errors.document = t('Anexo inválido: PDF ou imagem de até 9 MB. Envie de novo.');
    document = f.value;
  }
  return { ok: Object.keys(errors).length === 0, errors, value: { kind, category, date, amount_cents: Number.isNaN(amount_cents) ? 0 : amount_cents, description, counterparty, document } };
}

/** O orçamento do ano: `lines` em centavos por `lineKey` (chave desconhecida é ignorada). */
export function validateBudgetInput(input = {}) {
  const errors = {};
  const year = Number(input.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) errors.year = t('Ano inválido.');
  const lines = {};
  const entrada = input.lines && typeof input.lines === 'object' ? input.lines : {};
  BUDGET_LINE_KEYS.forEach((k) => {
    if (entrada[k] == null || entrada[k] === '') return;
    const n = Number(entrada[k]);
    if (!Number.isInteger(n) || n < 0 || n > ACCOUNT_AMOUNT_MAX) { errors[`lines.${k}`] = t('Valor inválido.'); return; }
    if (n > 0) lines[k] = n;
  });
  if (!Object.keys(errors).length && !Object.keys(lines).length) errors.lines = t('Preencha ao menos uma categoria.');
  return { ok: Object.keys(errors).length === 0, errors, value: { year: Number.isInteger(year) ? year : 0, lines, notes: str(input.notes, ACCOUNT_NOTES_MAX) } };
}

/** As demonstrações anexadas à prestação de contas (balanço, DRE, notas…). */
export function validateStatements(list) {
  const errors = {};
  const entrada = lista(list);
  if (entrada.length > STATEMENTS_MAX) errors.statements = t('No máximo {n} arquivos.', { n: STATEMENTS_MAX });
  const value = entrada.slice(0, STATEMENTS_MAX).map((f, i) => {
    const r = validateFile(f, { kinds: true });
    if (!r.ok) errors[`statements.${i}`] = t('Arquivo inválido: PDF ou imagem de até 9 MB.');
    return r.value;
  });
  return { ok: Object.keys(errors).length === 0, errors, value };
}

export function validateOpinionInput(input = {}) {
  const errors = {};
  const verdict = OPINION_VERDICTS.some((v) => v.id === input.verdict) ? input.verdict : '';
  if (!verdict) errors.verdict = t('Escolha o parecer.');
  const text = str(input.text, OPINION_TEXT_MAX);
  if (text.length < OPINION_TEXT_MIN) errors.text = t('Escreva o parecer (mínimo {n} caracteres).', { n: OPINION_TEXT_MIN });
  return { ok: Object.keys(errors).length === 0, errors, value: { verdict, text } };
}

export function validateAssemblyInput(input = {}) {
  const errors = {};
  const date = line(input.date, 10);
  if (!isRealDate(date)) errors.date = t('Data inválida.');
  const result = ASSEMBLY_RESULTS.some((r) => r.id === input.result) ? input.result : '';
  if (!result) errors.result = t('Aprovadas ou rejeitadas?');
  const event_id = line(input.event_id, 80);
  if (event_id && !ID_RE.test(event_id)) errors.event_id = t('Reunião inválida.');
  return { ok: Object.keys(errors).length === 0, errors, value: { date, result, event_id, note: str(input.note, ACCOUNT_NOTES_MAX) } };
}

/* ---------------------------------------------------------------- contas -- */

/** A data da cobrança paga: `paid_at` (dia de Brasília) ou, na falta, `paid_at_ms`. */
export function chargePaidDate(c) {
  if (ISO_RE.test(String(c?.paid_at || ''))) return c.paid_at;
  const ms = Number(c?.paid_at_ms);
  return ms > 0 ? dateBR(ms) : '';
}

/** As cobranças PAGAS como receita (derivada: nada é gravado). */
export function chargeIncomeItems(charges) {
  return lista(charges).filter((c) => c && c.status === 'paid').map((c) => ({
    id: `charge:${c.id}`, kind: ENTRY_KIND.INCOME, category: CHARGE_ORIGIN_CATEGORY[c.origin] || 'other_income',
    date: chargePaidDate(c), amount_cents: cents(c.amount_cents), description: line(c.plan_name, ACCOUNT_DESCRIPTION_MAX),
    counterparty: line(c.payer_name || c.member_name, ACCOUNT_COUNTERPARTY_MAX), auto: 'charge', ref: String(c.id || ''),
  })).filter((x) => x.date && x.amount_cents > 0);
}

/** Despesas derivadas de outro módulo (a arbitragem): `{ date, amount_cents, category, ref, auto }`. */
export function extraExpenseItems(extra) {
  return lista(extra).map((x) => ({
    id: `extra:${String(x?.ref || '')}`, kind: ENTRY_KIND.EXPENSE,
    category: EXPENSE_CATEGORIES.some((c) => c.id === x?.category) ? x.category : 'other_expense',
    date: ISO_RE.test(String(x?.date || '')) ? x.date : '', amount_cents: cents(x?.amount_cents),
    description: line(x?.description, ACCOUNT_DESCRIPTION_MAX), counterparty: line(x?.counterparty, ACCOUNT_COUNTERPARTY_MAX),
    auto: typeof x?.auto === 'string' ? x.auto : 'derived', ref: String(x?.ref || ''),
  })).filter((x) => x.date && x.amount_cents > 0);
}

/** Receitas derivadas de outro módulo (as parcelas recebidas dos contratos de patrocínio), no mesmo formato. */
export function extraIncomeItems(extra) {
  return lista(extra).map((x) => ({
    id: `extra:${String(x?.ref || '')}`, kind: ENTRY_KIND.INCOME,
    category: INCOME_CATEGORIES.some((c) => c.id === x?.category) ? x.category : 'other_income',
    date: ISO_RE.test(String(x?.date || '')) ? x.date : '', amount_cents: cents(x?.amount_cents),
    description: line(x?.description, ACCOUNT_DESCRIPTION_MAX), counterparty: line(x?.counterparty, ACCOUNT_COUNTERPARTY_MAX),
    auto: typeof x?.auto === 'string' ? x.auto : 'derived', ref: String(x?.ref || ''),
  })).filter((x) => x.date && x.amount_cents > 0);
}

/** Os lançamentos manuais que valem (o estornado sai da conta, mas fica na lista). */
export function ledgerItems(ledger) {
  return lista(ledger).filter((e) => e && e.status !== ENTRY_STATUS.VOID).map((e) => ({
    id: String(e.id || ''), kind: e.kind === ENTRY_KIND.EXPENSE ? ENTRY_KIND.EXPENSE : ENTRY_KIND.INCOME, category: String(e.category || ''),
    date: String(e.date || ''), amount_cents: cents(e.amount_cents), description: String(e.description || ''), counterparty: String(e.counterparty || ''), auto: false, ref: String(e.id || ''),
  }));
}

/** Tudo o que entra na conta: manual + cobranças pagas + receitas e despesas derivadas, do mais recente ao mais antigo. */
export function accountItems({ ledger, charges, extraExpenses, extraIncome } = {}) {
  return [...ledgerItems(ledger), ...chargeIncomeItems(charges), ...extraIncomeItems(extraIncome), ...extraExpenseItems(extraExpenses)]
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.date < b.date ? 1 : -1));
}

export function itemsInPeriod(items, period) {
  const r = periodRange(period);
  return r ? lista(items).filter((x) => x.date >= r.from && x.date <= r.to) : [];
}

/** Totais por categoria (toda categoria aparece, com zero). */
export function totalsByCategory(items) {
  const income = Object.fromEntries(INCOME_CATEGORIES.map((c) => [c.id, 0]));
  const expense = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, 0]));
  lista(items).forEach((x) => {
    const alvo = x.kind === ENTRY_KIND.EXPENSE ? expense : income;
    const cat = Object.prototype.hasOwnProperty.call(alvo, x.category) ? x.category : (x.kind === ENTRY_KIND.EXPENSE ? 'other_expense' : 'other_income');
    alvo[cat] += cents(x.amount_cents);
  });
  const income_total = Object.values(income).reduce((a, b) => a + b, 0);
  const expense_total = Object.values(expense).reduce((a, b) => a + b, 0);
  return { income, expense, income_total, expense_total, balance: income_total - expense_total };
}

/** Receitas e despesas mês a mês no ano (para o gráfico). */
export function monthlySeries(items, year) {
  const meses = Array.from({ length: 12 }, (_, i) => ({ month: `${year}-${String(i + 1).padStart(2, '0')}`, income: 0, expense: 0 }));
  lista(items).forEach((x) => {
    if (String(x.date).slice(0, 4) !== String(year)) return;
    const m = meses[Number(String(x.date).slice(5, 7)) - 1];
    if (m) m[x.kind === ENTRY_KIND.EXPENSE ? 'expense' : 'income'] += cents(x.amount_cents);
  });
  return meses;
}

/**
 * Orçado × realizado por categoria. `pct` é `null` sem orçamento na linha.
 * Alerta da despesa: `over` passou do orçado, `near` chegou a 90%,
 * `unbudgeted` gastou sem ter orçado. Receita não tem alerta (arrecadar mais é bom).
 */
export function budgetVsActual(lines = {}, totals = null) {
  const tot = totals || totalsByCategory([]);
  const linha = (kind, c) => {
    const budget = cents(lines?.[lineKey(kind, c.id)]);
    const actual = cents(kind === 'expense' ? tot.expense?.[c.id] : tot.income?.[c.id]);
    const pct = budget > 0 ? Math.round((actual * 100) / budget) : null;
    let alert = 'ok';
    if (kind === 'expense') {
      if (budget > 0 && actual > budget) alert = 'over';
      else if (pct != null && pct >= 90) alert = 'near';
      else if (!budget && actual > 0) alert = 'unbudgeted';
    }
    return { key: lineKey(kind, c.id), kind, category: c.id, label: c.label, budget, actual, pct, alert };
  };
  return [...INCOME_CATEGORIES.map((c) => linha('income', c)), ...EXPENSE_CATEGORIES.map((c) => linha('expense', c))];
}

export const budgetTotals = (lines = {}) => {
  let income = 0; let expense = 0;
  Object.entries(lines || {}).forEach(([k, v]) => { if (k.startsWith('income.')) income += cents(v); else if (k.startsWith('expense.')) expense += cents(v); });
  return { income, expense, balance: income - expense };
};

/**
 * O retrato CONGELADO ao enviar a prestação: totais do período por categoria
 * e, no período anual, o orçamento aprovado ou publicado do ano. Depois de
 * enviado, lançar ou estornar no período é recusado — o retrato é o que o
 * conselho examina e o que vai a público.
 */
export function buildSnapshot({ items, period, budget = null, nowMs = Date.now() } = {}) {
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

/** O período (com prestação já enviada) que contém a data — fechado para lançar e estornar. */
export function closedPeriodFor(date, reports = []) {
  const r = lista(reports).find((x) => x && x.status && x.status !== ACCOUNT_REPORT_STATUS.DRAFT && (() => { const p = periodRange(x.period); return p && date >= p.from && date <= p.to; })());
  return r ? r.period : null;
}

/* ----------------------------------------------------------- permissões -- */

const temPerm = (perms, p) => Array.isArray(perms) && perms.includes(p);
/** Lança, monta o orçamento e prepara a prestação: financeiro ou admin. */
export const canPrepareAccounts = (perms) => temPerm(perms, FED_PERMISSION.FINANCE) || temPerm(perms, FED_PERMISSION.ADMIN);
/** Dá o parecer: conselho fiscal (o admin também, registrado como dele). */
export const canGiveOpinion = (perms) => temPerm(perms, FED_PERMISSION.FISCAL) || temPerm(perms, FED_PERMISSION.ADMIN);
export const canViewAccounts = (perms) => canPrepareAccounts(perms) || temPerm(perms, FED_PERMISSION.FISCAL);

/** Os botões do orçamento para quem vê. */
export function budgetActions(budget, perms) {
  const st = budget?.status || null;
  const prep = canPrepareAccounts(perms);
  return {
    save: prep && st !== BUDGET_STATUS.SUBMITTED,
    reformulate: prep && (st === BUDGET_STATUS.APPROVED || st === BUDGET_STATUS.PUBLISHED),
    submit: prep && st === BUDGET_STATUS.DRAFT,
    approve: prep && st === BUDGET_STATUS.SUBMITTED,
    back: prep && st === BUDGET_STATUS.SUBMITTED,
    publish: prep && st === BUDGET_STATUS.APPROVED,
  };
}

/** Os botões da prestação de contas para quem vê. */
export function reportActions(report, perms) {
  const st = report?.status || null;
  const prep = canPrepareAccounts(perms);
  return {
    save: prep && st === ACCOUNT_REPORT_STATUS.DRAFT,
    submit: prep && st === ACCOUNT_REPORT_STATUS.DRAFT,
    reopen: prep && st === ACCOUNT_REPORT_STATUS.SUBMITTED,
    opinion: canGiveOpinion(perms) && st === ACCOUNT_REPORT_STATUS.SUBMITTED,
    assembly: prep && st === ACCOUNT_REPORT_STATUS.OPINION,
    publish: prep && [ACCOUNT_REPORT_STATUS.OPINION, ACCOUNT_REPORT_STATUS.APPROVED, ACCOUNT_REPORT_STATUS.REJECTED].includes(st),
  };
}

/** A linha do tempo da prestação: rascunho → enviada → parecer → assembleia → publicada. */
export function reportTimeline(report) {
  const r = report || {};
  const st = r.status;
  const ordem = ['draft', 'submitted', 'opinion', 'assembly', 'published'];
  const passo = st === 'published' ? 4 : (st === 'approved' || st === 'rejected') ? 3 : st === 'opinion' ? 2 : st === 'submitted' ? 1 : 0;
  const at = {
    draft: Number(r.opened_at_ms) || null,
    submitted: Number(r.submitted_at_ms) || null,
    opinion: Number(r.fiscal_opinion?.at_ms) || null,
    assembly: r.assembly?.date || null,
    published: Number(r.published_at_ms) || null,
  };
  const labels = { draft: tk('Rascunho'), submitted: tk('Enviada ao conselho fiscal'), opinion: tk('Parecer do conselho'), assembly: tk('Assembleia'), published: tk('Publicada') };
  const tem = Boolean(report);
  return ordem.map((id, i) => ({ id, label: labels[id], done: tem && (i < passo || st === 'published'), current: tem && i === passo && st !== 'published', at: at[id] }));
}

/* ------------------------------------------------------- "Precisa de você" -- */

const plural = (n, um, varios) => (n === 1 ? um : varios);

/**
 * As pendências das contas: prestação esperando parecer (conselho fiscal),
 * parecer recebido (financeiro: leve à assembleia e publique) e a prestação
 * do ano anterior não publicada a partir de março (o prazo é abril).
 * `reports` undefined = não carregou: nada entra (nunca vira zero).
 */
export function accountsPendingItems(reports, perms, { hoje } = {}) {
  if (!Array.isArray(reports)) return [];
  const itens = [];
  if (temPerm(perms, FED_PERMISSION.FISCAL) || (temPerm(perms, FED_PERMISSION.ADMIN) && !temPerm(perms, FED_PERMISSION.FINANCE))) {
    const n = reports.filter((r) => r.status === ACCOUNT_REPORT_STATUS.SUBMITTED).length;
    if (n) itens.push({ id: 'contas-parecer', count: n, aba: 'prestacao-contas', label: plural(n, tk('prestação de contas esperando o parecer do conselho fiscal'), tk('prestações de contas esperando o parecer do conselho fiscal')) });
  }
  if (canPrepareAccounts(perms)) {
    const n = reports.filter((r) => r.status === ACCOUNT_REPORT_STATUS.OPINION).length;
    if (n) itens.push({ id: 'contas-assembleia', count: n, aba: 'prestacao-contas', label: plural(n, tk('parecer do conselho fiscal recebido: leve à assembleia e publique'), tk('pareceres do conselho fiscal recebidos: leve à assembleia e publique')) });
    const dia = String(hoje || '');
    const ano = Number(dia.slice(0, 4));
    if (ano && dia.slice(5) >= '03-01') {
      const anterior = String(ano - 1);
      const pub = reports.some((r) => r.period === anterior && r.status === ACCOUNT_REPORT_STATUS.PUBLISHED);
      if (!pub) itens.push({ id: 'contas-prazo', count: 1, aba: 'prestacao-contas', label: dia > legalDeadline(ano - 1) ? tk('prestação de contas do ano passado fora do prazo legal (abril)') : tk('prestação de contas do ano passado: o prazo legal é o fim de abril') });
    }
  }
  return itens;
}

/* -------------------------------------------------------------- rótulos -- */

export function categoryLabel(kind, id) {
  const c = categoriesOf(kind).find((x) => x.id === id);
  return c ? t(c.label) : String(id || '');
}

export const AUTO_LABELS = Object.freeze({ charge: tk('Cobrança paga'), referees: tk('Diária de arbitragem'), sponsor: tk('Parcela de patrocínio'), incentive: tk('Aporte da Lei de Incentivo'), dues: tk('Anuidade da confederação'), derived: tk('Automático') });

/** A planilha dos lançamentos (manuais, estornados marcados, e os automáticos). */
export function ledgerCsv(rows = []) {
  const cab = [t('Data'), t('Tipo'), t('Categoria'), t('Descrição'), t('Contraparte'), t('Valor (R$)'), t('Origem'), t('Situação')];
  const corpo = lista(rows).map((x) => [
    x.date ? x.date.split('-').reverse().join('/') : '', x.kind === ENTRY_KIND.EXPENSE ? t('Despesa') : t('Receita'), categoryLabel(x.kind, x.category),
    x.description, x.counterparty || '', csvReais(cents(x.amount_cents)),
    x.auto ? t(AUTO_LABELS[x.auto] || AUTO_LABELS.derived) : t('Manual'), x.status === ENTRY_STATUS.VOID ? t('Estornado') : t('Valendo'),
  ].map(csvCell).join(';'));
  return [cab.map(csvCell).join(';'), ...corpo].join('\n');
}
