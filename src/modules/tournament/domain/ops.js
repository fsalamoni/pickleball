/**
 * Resumo operacional do torneio (flag tournament_ops_dashboard).
 *
 * Agrega inscrições e jogos em contadores acionáveis para o organizador
 * ("como está meu torneio?"), inclusive alertas de pendências. Puro — sem
 * Firebase, totalmente testável.
 */

import { MATCH_STATUS, REGISTRATION_STATUS, TOURNAMENT_STATUS } from './constants.js';

const DONE_MATCH_STATUSES = new Set([MATCH_STATUS.FINISHED, MATCH_STATUS.WALKOVER]);

function countRegistrations(registrations) {
  const counters = {
    total: 0,
    confirmed: 0,
    checkedIn: 0,
    pendingPayment: 0,
    waitlist: 0,
    cancelled: 0,
    paymentDeclared: 0,
  };
  registrations.forEach((registration) => {
    if (registration.is_placeholder) return;
    counters.total += 1;
    switch (registration.status) {
      case REGISTRATION_STATUS.CONFIRMED:
        counters.confirmed += 1;
        break;
      case REGISTRATION_STATUS.CHECKED_IN:
        counters.confirmed += 1;
        counters.checkedIn += 1;
        break;
      case REGISTRATION_STATUS.PENDING_PAYMENT:
        counters.pendingPayment += 1;
        if (registration.payment_declared_at) counters.paymentDeclared += 1;
        break;
      case REGISTRATION_STATUS.WAITLIST:
        counters.waitlist += 1;
        break;
      case REGISTRATION_STATUS.CANCELLED:
        counters.cancelled += 1;
        break;
      default:
        break;
    }
  });
  return counters;
}

function countMatches(matches) {
  const counters = { total: 0, done: 0, inProgress: 0, pending: 0, unscheduled: 0 };
  matches.forEach((match) => {
    if (match.status === MATCH_STATUS.CANCELLED) return;
    counters.total += 1;
    if (DONE_MATCH_STATUSES.has(match.status)) counters.done += 1;
    else if (match.status === MATCH_STATUS.IN_PROGRESS) counters.inProgress += 1;
    else counters.pending += 1;
    if (!match.scheduled_at) counters.unscheduled += 1;
  });
  counters.completionPct = counters.total > 0
    ? Math.round((counters.done / counters.total) * 100)
    : 0;
  return counters;
}

/**
 * Consolida a visão operacional do torneio.
 *
 * @param {{
 *   tournament?: { status?: string },
 *   modalities?: Array<{ id: string, name?: string }>,
 *   registrations?: Array<object>,
 *   matches?: Array<object>,
 * }} input
 * @returns {{
 *   registrations: object,
 *   matches: object,
 *   perModality: Array<{ id: string, name: string, registrations: object, matches: object }>,
 *   alerts: Array<{ severity: 'amber'|'red'|'blue', text: string }>,
 * }}
 */
export function computeTournamentOps({ tournament = {}, modalities = [], registrations = [], matches = [] } = {}) {
  const perModality = modalities.map((modality) => ({
    id: modality.id,
    name: modality.name || 'Modalidade',
    registrations: countRegistrations(registrations.filter((r) => r.modality_id === modality.id)),
    matches: countMatches(matches.filter((m) => m.modality_id === modality.id)),
  }));

  const totals = {
    registrations: countRegistrations(registrations),
    matches: countMatches(matches),
  };

  const alerts = [];
  if (totals.registrations.pendingPayment > 0) {
    const declared = totals.registrations.paymentDeclared;
    alerts.push({
      severity: 'amber',
      text: `${totals.registrations.pendingPayment} inscrição(ões) aguardando confirmação de pagamento`
        + (declared > 0 ? ` — ${declared} já declararam ter pago` : ''),
    });
  }
  if (totals.registrations.waitlist > 0) {
    alerts.push({ severity: 'blue', text: `${totals.registrations.waitlist} inscrição(ões) na lista de espera` });
  }
  if (totals.matches.unscheduled > 0) {
    alerts.push({ severity: 'amber', text: `${totals.matches.unscheduled} jogo(s) sem data/horário definido` });
  }
  const started = tournament.status === TOURNAMENT_STATUS.IN_PROGRESS;
  perModality.forEach((entry) => {
    if (entry.matches.total === 0 && entry.registrations.confirmed > 0 && started) {
      alerts.push({ severity: 'red', text: `Modalidade "${entry.name}" ainda sem sorteio` });
    }
  });

  return { ...totals, perModality, alerts };
}
