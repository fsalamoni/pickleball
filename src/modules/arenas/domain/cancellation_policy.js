/**
 * Domínio puro de política de cancelamento da arena (flag cancellation_policy).
 *
 * A arena define um prazo em horas antes do início da reserva para cancelamento
 * "no prazo". Cancelar depois disso é um cancelamento tardio (o sistema só
 * avisa — não há cobrança de taxa, que dependeria de gateway de pagamento).
 *
 * Sem I/O — recebe o slot da reserva, a política e o instante atual.
 */

import { timeToMinutes } from './pricing.js';

export const DEFAULT_CANCELLATION_HOURS = 12;

/** Normaliza a política vinda da arena. */
export function normalizeCancellationPolicy(raw = {}) {
  const hours = Number(raw.cancellation_deadline_hours);
  return {
    enabled: raw.cancellation_policy_enabled === true,
    deadlineHours: Number.isFinite(hours) && hours >= 0 ? hours : DEFAULT_CANCELLATION_HOURS,
    notes: String(raw.cancellation_notes || '').slice(0, 500),
  };
}

/** Timestamp (ms) de início de um slot { date:'YYYY-MM-DD', start:'HH:MM' }. */
export function slotStartMs(slot) {
  if (!slot?.date) return NaN;
  const [y, m, d] = String(slot.date).split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return NaN;
  const mins = timeToMinutes(slot.start) || 0;
  // Interpreta no horário de Brasília (UTC-3): soma 3h ao construir em UTC.
  const dt = new Date(Date.UTC(y, m - 1, d, Math.floor(mins / 60) + 3, mins % 60, 0));
  return dt.getTime();
}

/**
 * Avalia um cancelamento contra a política.
 * @param {{date,start}} slot primeiro slot da reserva
 * @param {object} policy política normalizada (ou crua)
 * @param {number} [nowMs]
 * @returns {{ applies: boolean, late: boolean, hoursUntilStart: number|null, deadlineHours: number }}
 */
export function evaluateCancellation(slot, policy, nowMs = Date.now()) {
  const p = policy && policy.deadlineHours != null ? policy : normalizeCancellationPolicy(policy || {});
  const startMs = slotStartMs(slot);
  if (!p.enabled || Number.isNaN(startMs)) {
    return { applies: false, late: false, hoursUntilStart: null, deadlineHours: p.deadlineHours };
  }
  const hoursUntilStart = (startMs - nowMs) / (1000 * 60 * 60);
  return {
    applies: true,
    late: hoursUntilStart < p.deadlineHours,
    hoursUntilStart,
    deadlineHours: p.deadlineHours,
  };
}

/** Mensagem de aviso para um cancelamento tardio (pt-BR). */
export function lateCancellationMessage(policy) {
  const p = policy && policy.deadlineHours != null ? policy : normalizeCancellationPolicy(policy || {});
  const base = `A arena pede cancelamento com pelo menos ${p.deadlineHours}h de antecedência.`;
  return p.notes ? `${base} ${p.notes}` : `${base} Este é um cancelamento tardio.`;
}
