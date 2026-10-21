/**
 * Cobranças da federação: o Pix "copia e cola" de cada uma, o vencimento e o
 * resumo financeiro. Lógica pura.
 */
import { buildPixPayload, formatBrlCents } from '@/modules/tournament/domain/payment.js';
import { CHARGE_DUE_DAYS, CHARGE_STATUS } from './constants.js';
import { addMonthsISO, daysBetween, isoDate, toISODate } from './membership.js';

export { formatBrlCents };

/**
 * O valor digitado em reais → centavos. Aceita "1.234,56", "1234,56", "10.50",
 * "10", "R$ 10,5". A vírgula é SEMPRE decimal; o ponto é decimal quando é o
 * único separador seguido de 1–2 dígitos ("10.50") e milhar nos demais casos
 * ("1.000"). 🐞 Havia três cópias desta conta nas telas, e todas trocavam o
 * ponto por nada: "10.00" virava R$ 1.000,00. Lixo devolve NaN (a validação
 * acusa), nunca zero (zero é "gratuito").
 * @param {*} txt
 * @returns {number} centavos inteiros, ou NaN
 */
export function parseBrlCents(txt) {
  let s = String(txt ?? '').replace(/R\$|\s/g, '').trim();
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

/** Identificador do Pix (≤ 25 alfanuméricos): o id da cobrança, limpo. */
export function chargeTxid(chargeId) {
  return String(chargeId || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
}

/** O payload Pix de UMA cobrança, com o valor e o identificador dela. `null` sem chave. */
export function chargePixPayload(charge, federation) {
  const p = federation?.payment || {};
  if (!p.pix_key || !charge) return null;
  return buildPixPayload({
    key: p.pix_key,
    merchantName: p.receiver_name || federation.acronym || federation.name,
    merchantCity: federation.city || federation.state || 'BRASIL',
    amountCents: charge.amount_cents,
    txid: chargeTxid(charge.id),
  });
}

/** Vencimento padrão de uma cobrança criada em `fromISO`. */
export function chargeDueDate(fromISO, dias = CHARGE_DUE_DAYS) {
  const base = new Date(`${fromISO}T12:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + dias);
  return isoDate(base);
}

/** A cobrança em aberto venceu? (declarada não vence — espera o financeiro.) */
export function isChargeOverdue(charge, hoje = isoDate()) {
  if (charge?.status !== CHARGE_STATUS.OPEN) return false;
  const due = toISODate(charge.due_date);
  return Boolean(due) && daysBetween(hoje, due) < 0;
}

/** O pagador ainda pode declarar o pagamento desta cobrança? */
export const canDeclarePayment = (charge) => charge?.status === CHARGE_STATUS.OPEN || charge?.status === CHARGE_STATUS.DECLARED;

/** O financeiro pode confirmar? (aberta ou declarada.) */
export const canConfirmCharge = (charge) => charge?.status === CHARGE_STATUS.OPEN || charge?.status === CHARGE_STATUS.DECLARED;

/**
 * O resumo do financeiro: a receber, informados (esperando confirmação),
 * recebido no mês e total. Só sobre o que carregou.
 * @param {object[]} charges
 * @param {string} [hoje]
 */
export function financeSummary(charges = [], hoje = isoDate()) {
  const mes = hoje.slice(0, 7);
  const mesAnterior = addMonthsISO(hoje, -1).slice(0, 7);
  const out = { open: 0, open_cents: 0, declared: 0, declared_cents: 0, paid_month_cents: 0, paid_prev_month_cents: 0, paid_total_cents: 0, overdue: 0 };
  charges.forEach((c) => {
    const v = Math.max(0, Math.trunc(Number(c.amount_cents) || 0));
    if (c.status === CHARGE_STATUS.OPEN) { out.open += 1; out.open_cents += v; if (isChargeOverdue(c, hoje)) out.overdue += 1; }
    if (c.status === CHARGE_STATUS.DECLARED) { out.declared += 1; out.declared_cents += v; }
    if (c.status === CHARGE_STATUS.PAID) {
      out.paid_total_cents += v;
      const pago = toISODate(c.paid_at).slice(0, 7);
      if (pago === mes) out.paid_month_cents += v;
      if (pago === mesAnterior) out.paid_prev_month_cents += v;
    }
  });
  return out;
}

/** Ordem do caixa: informadas primeiro (esperam o financeiro), depois abertas, depois pagas; recentes em cima. */
export function sortChargesForStaff(charges = []) {
  const peso = { declared: 0, open: 1, paid: 2, cancelled: 3 };
  const ms = (c) => Number(c.created_at_ms) || 0;
  return [...charges].sort((a, b) => (peso[a.status] ?? 9) - (peso[b.status] ?? 9) || ms(b) - ms(a));
}

/** Linhas do CSV do contador (uma por cobrança), cabeçalho incluso. */
export function chargesCsv(charges = []) {
  // Célula que começa com = + - @ (ou tab/CR) vira FÓRMULA ao abrir no Excel/Sheets; o apóstrofo a neutraliza.
  const esc = (v) => { const s = String(v ?? ''); return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
  const linhas = [['id', 'filiado', 'origem', 'valor_centavos', 'status', 'vencimento', 'informado_em', 'pago_em', 'confirmado_por'].join(';')];
  charges.forEach((c) => linhas.push([
    c.id, c.payer_name, c.origin, c.amount_cents, c.status, toISODate(c.due_date), toISODate(c.declared_at), toISODate(c.paid_at), c.confirmed_by_name,
  ].map(esc).join(';')));
  return linhas.join('\n');
}
