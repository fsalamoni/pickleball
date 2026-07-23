/**
 * Domínio puro de pacotes e créditos do professor (Fase C — PRO-13/14).
 *
 * - `coach_packages/{id}`: definição de um pacote (N aulas, validade, preço).
 * - `coach_package_sales/{id}`: venda de um pacote a um aluno (créditos totais/
 *   usados, validade, pago).
 *
 * Saldo, validade, débito por aula concluída e resumo financeiro são calculados
 * aqui. Sem I/O — testável isoladamente.
 */

import { formatPrice } from '../../arenas/domain/pricing.js';

const str = (v) => String(v ?? '').trim();

export const PACKAGE_NAME_MAX = 80;
export const PACKAGE_LESSONS_MAX = 200;
export const PACKAGE_VALIDITY_MAX = 730; // dias

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Normaliza/valida a definição de um pacote. */
export function normalizePackage(input = {}) {
  const coach_id = str(input.coach_id);
  if (!coach_id) return { valid: false, error: 'coach_id é obrigatório.', value: {} };
  const name = str(input.name).slice(0, PACKAGE_NAME_MAX);
  if (!name) return { valid: false, error: 'Informe o nome do pacote.', value: { coach_id } };
  const lessons_count = Math.trunc(num(input.lessons_count, 0));
  if (!(lessons_count >= 1 && lessons_count <= PACKAGE_LESSONS_MAX)) {
    return { valid: false, error: `Número de aulas deve estar entre 1 e ${PACKAGE_LESSONS_MAX}.`, value: { coach_id, name } };
  }
  const price = num(input.price, null);
  if (price == null || price < 0) {
    return { valid: false, error: 'Informe um preço válido.', value: { coach_id, name, lessons_count } };
  }
  const validity_days = Math.trunc(num(input.validity_days, 0));
  if (!(validity_days >= 1 && validity_days <= PACKAGE_VALIDITY_MAX)) {
    return { valid: false, error: `Validade deve estar entre 1 e ${PACKAGE_VALIDITY_MAX} dias.`, value: { coach_id, name, lessons_count, price } };
  }
  return {
    valid: true,
    error: null,
    value: {
      coach_id,
      name,
      lessons_count,
      price: Math.round(price * 100) / 100,
      validity_days,
      description: str(input.description).slice(0, 300),
      active: input.active !== false,
    },
  };
}

/**
 * Calcula a data de expiração (ISO) a partir da data de venda e validade.
 * @param {Date|string} soldAt
 * @param {number} validityDays
 */
export function computeExpiresAt(soldAt, validityDays) {
  const base = soldAt instanceof Date ? soldAt : new Date(soldAt || Date.now());
  if (Number.isNaN(base.getTime())) return null;
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + Math.max(0, Math.trunc(Number(validityDays) || 0)));
  return toISODate(d);
}

/** Normaliza/valida a venda de um pacote. */
export function normalizePackageSale(input = {}) {
  const coach_id = str(input.coach_id);
  const student_id = str(input.student_id);
  const package_id = str(input.package_id);
  if (!coach_id) return { valid: false, error: 'coach_id é obrigatório.', value: {} };
  if (!student_id) return { valid: false, error: 'student_id é obrigatório.', value: { coach_id } };
  if (!package_id) return { valid: false, error: 'package_id é obrigatório.', value: { coach_id, student_id } };
  const credits_total = Math.trunc(num(input.credits_total, 0));
  if (!(credits_total >= 1)) return { valid: false, error: 'Créditos totais inválidos.', value: { coach_id, student_id, package_id } };
  const credits_used = Math.min(credits_total, Math.max(0, Math.trunc(num(input.credits_used, 0))));
  const price = Math.max(0, num(input.price, 0));
  return {
    valid: true,
    error: null,
    value: {
      coach_id,
      student_id,
      student_name: str(input.student_name).slice(0, 120),
      package_id,
      package_name: str(input.package_name).slice(0, PACKAGE_NAME_MAX),
      credits_total,
      credits_used,
      price: Math.round(price * 100) / 100,
      expires_at: str(input.expires_at) || null,
      paid: input.paid === true,
    },
  };
}

/** Créditos restantes de uma venda. */
export function creditsRemaining(sale = {}) {
  const total = Math.trunc(Number(sale.credits_total) || 0);
  const used = Math.trunc(Number(sale.credits_used) || 0);
  return Math.max(0, total - used);
}

/** Indica se a venda está expirada em relação a uma data. */
export function isSaleExpired(sale = {}, now = new Date()) {
  if (!sale.expires_at) return false;
  return str(sale.expires_at) < toISODate(now);
}

/** Venda ativa: paga, com saldo e não expirada. */
export function isSaleActive(sale = {}, now = new Date()) {
  return sale.paid === true && creditsRemaining(sale) > 0 && !isSaleExpired(sale, now);
}

/** Saldo total de créditos ativos de um aluno (somando vendas ativas). */
export function studentActiveCredits(sales = [], now = new Date()) {
  return sales.filter((s) => isSaleActive(s, now)).reduce((acc, s) => acc + creditsRemaining(s), 0);
}

/**
 * Aplica o débito de 1 crédito a uma venda (retorna nova cópia com
 * credits_used incrementado, sem exceder o total). Não muta a original.
 */
export function debitOne(sale = {}) {
  const remaining = creditsRemaining(sale);
  if (remaining <= 0) return { ...sale };
  return { ...sale, credits_used: (Math.trunc(Number(sale.credits_used) || 0)) + 1 };
}

/** Resumo financeiro das vendas do professor. */
export function revenueSummary(sales = []) {
  const paid = sales.filter((s) => s.paid === true);
  const pending = sales.filter((s) => s.paid !== true);
  const revenue = paid.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
  const expected = pending.reduce((acc, s) => acc + (Number(s.price) || 0), 0);
  return {
    total_sales: sales.length,
    paid_count: paid.length,
    pending_count: pending.length,
    revenue: Math.round(revenue * 100) / 100,
    pending_revenue: Math.round(expected * 100) / 100,
  };
}

/** Formata o resumo com valores em BRL (conveniência para UI). */
export function formatRevenue(summary) {
  return {
    ...summary,
    revenue_label: formatPrice(summary.revenue),
    pending_label: formatPrice(summary.pending_revenue),
  };
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta as vendas para CSV (string). */
export function salesToCSV(sales = []) {
  const header = ['Aluno', 'Pacote', 'Creditos', 'Usados', 'Restantes', 'Preco', 'Pago', 'Expira'];
  const rows = sales.map((s) => [
    s.student_name || s.student_id || '',
    s.package_name || '',
    s.credits_total ?? '',
    s.credits_used ?? 0,
    creditsRemaining(s),
    (Number(s.price) || 0).toFixed(2),
    s.paid ? 'sim' : 'nao',
    s.expires_at || '',
  ].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\n');
}
