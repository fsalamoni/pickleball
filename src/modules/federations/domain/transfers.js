/**
 * TRANSFERÊNCIAS (`federation_transfers`): troca do CLUBE representado (a
 * própria federação decide) ou de FEDERAÇÃO (a antiga libera; silêncio por
 * `TRANSFER_RELEASE_DAYS` = liberada — D9). Carência entre transferências
 * (`rules.transfer_cooldown_days`). Os pontos no ranking ficam onde foram
 * feitos. Lógica pura; quem grava é o servidor (`functions/federationTransfers.js`).
 */
import { t } from '@/core/i18n';
import { TRANSFER_COOLDOWN_DAYS, TRANSFER_KIND, TRANSFER_RELEASE_DAYS, TRANSFER_STATUS } from './constants.js';
import { daysBetween, isoDate, LIVE_MEMBER_STATUSES } from './membership.js';

/** Dias de carência desta federação (padrão 90; 0 = sem carência). */
export const transferCooldownDays = (federation) => {
  const n = Number(federation?.rules?.transfer_cooldown_days);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : TRANSFER_COOLDOWN_DAYS;
};

/** Dias para a federação antiga responder (padrão 15). */
export const transferReleaseDays = (federation) => {
  const n = Number(federation?.rules?.transfer_release_days);
  return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : TRANSFER_RELEASE_DAYS;
};

/**
 * Pode pedir transferência? Precisa de filiação viva, nenhuma pendente, e a
 * carência desde a última aprovada.
 * @returns {{ ok: boolean, reason: string }}
 */
export function canRequestTransfer(member, { pending = [], federation = null, hoje = isoDate() } = {}) {
  if (!member || !LIVE_MEMBER_STATUSES.includes(member.status)) return { ok: false, reason: t('Só quem tem filiação nesta federação pede transferência.') };
  if (pending.some((x) => x.status === TRANSFER_STATUS.PENDING)) return { ok: false, reason: t('Já existe uma transferência aguardando resposta.') };
  const dias = transferCooldownDays(federation);
  const ultima = String(member.last_transfer_at || '');
  if (dias > 0 && ultima && daysBetween(ultima, hoje) < dias) {
    return { ok: false, reason: t('Carência de {dias} dias desde a última transferência (até {data}).', { dias, data: ultima }) };
  }
  return { ok: true, reason: '' };
}

/** A data limite para a federação antiga responder (só na troca de federação). */
export function transferDeadline(requestedISO, federation) {
  const d = new Date(`${requestedISO}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + transferReleaseDays(federation));
  return isoDate(d);
}

/** Pendente de federação cujo prazo passou: a varredura libera. */
export function isReleaseOverdue(transfer, hoje = isoDate()) {
  return transfer?.kind === TRANSFER_KIND.FEDERATION && transfer.status === TRANSFER_STATUS.PENDING
    && Boolean(transfer.deadline) && String(transfer.deadline) < hoje;
}

/** O que a tela diz de uma transferência. */
export function transferSummary(tr) {
  if (!tr) return '';
  if (tr.kind === TRANSFER_KIND.CLUB) return tr.to_club_name ? t('para o clube {clube}', { clube: tr.to_club_name }) : t('para "sem clube"');
  return t('para a {sigla}', { sigla: tr.to_federation_acronym || tr.to_federation_name || '' });
}

/** Pendentes primeiro, depois as mais recentes. */
export function sortTransfers(list = []) {
  const peso = { pending: 0, approved: 1, rejected: 2, cancelled: 3 };
  return [...list].sort((a, b) => (peso[a.status] ?? 9) - (peso[b.status] ?? 9) || (b.requested_at_ms || 0) - (a.requested_at_ms || 0));
}

/** Validação do pedido (a mesma do servidor, dita antes). */
export function validateTransferInput(input = {}, { member } = {}) {
  const errors = {};
  const kind = Object.values(TRANSFER_KIND).includes(input.kind) ? input.kind : null;
  if (!kind) errors.kind = t('Escolha o tipo de transferência.');
  if (kind === TRANSFER_KIND.CLUB && String(input.to_club_id || '') === String(member?.represented_club_id || '')) errors.to_club_id = t('Escolha um clube diferente do atual.');
  if (kind === TRANSFER_KIND.FEDERATION) {
    if (!input.to_federation_id) errors.to_federation_id = t('Escolha a federação de destino.');
    else if (input.to_federation_id === member?.federation_id) errors.to_federation_id = t('Escolha uma federação diferente da atual.');
  }
  const reason = String(input.reason || '').trim().slice(0, 500);
  return { ok: Object.keys(errors).length === 0, errors, value: { kind, to_club_id: input.to_club_id || null, to_federation_id: input.to_federation_id || null, reason } };
}
