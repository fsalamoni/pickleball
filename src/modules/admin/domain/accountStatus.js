/**
 * Suspender, bloquear e reativar contas — o que a TELA decide antes de pedir ao
 * servidor (`adminSetAccountStatus`, em `functions/accountStatus.js`, que
 * confere tudo de novo).
 *
 * `users/{uid}.account_status` ausente vale `active`. Suspensa tem prazo
 * (`status_until`) e nada reativa sozinho: vencida, aparece em "Precisa de
 * você" para o admin decidir. Bloqueada não tem prazo.
 */
import { deletionBlockedReason } from './accountDeletion.js';

export const ACCOUNT_STATUS = Object.freeze({ ACTIVE: 'active', SUSPENDED: 'suspended', BLOCKED: 'blocked' });
export const STATUS_REASON_MIN = 5;
export const SUSPEND_DAYS_MAX = 365;
export const SUSPEND_DAYS_OPTIONS = Object.freeze([1, 3, 7, 15, 30, 90]);

export const ACCOUNT_STATUS_META = Object.freeze({
  active: { label: 'Ativa', tone: 'green' },
  suspended: { label: 'Suspensa', tone: 'amber' },
  blocked: { label: 'Bloqueada', tone: 'red' },
});

export const STATUS_ACTION_META = Object.freeze({
  suspend: { label: 'Suspender', verb: 'suspensa', hint: 'Por um prazo. Reativar é decisão do admin quando ele vence.' },
  block: { label: 'Bloquear', verb: 'bloqueada', hint: 'Sem prazo. Só o admin reativa.' },
  reactivate: { label: 'Reativar', verb: 'reativada', hint: 'Devolve o acesso exatamente como era.' },
});

/** O estado da conta como a tela mostra. `vencida` = suspensão cujo prazo passou. */
export function accountStatusOf(user, now = Date.now()) {
  const status = user?.account_status || ACCOUNT_STATUS.ACTIVE;
  const until = Number(user?.status_until) || null;
  const vencida = status === ACCOUNT_STATUS.SUSPENDED && until != null && until <= now;
  return { status, until, vencida, reason: user?.status_reason || '', ...ACCOUNT_STATUS_META[status] };
}

export const isAccountOffline = (user) => accountStatusOf(user).status !== ACCOUNT_STATUS.ACTIVE;

/** As ações que fazem sentido para esta conta (as três portas da exclusão valem). */
export function accountStatusActions(user, ctx) {
  const porta = deletionBlockedReason(user, ctx);
  if (!porta.ok) return { actions: [], reason: porta.reason.replace('excluída', 'suspensa nem bloqueada') };
  const { status } = accountStatusOf(user);
  return {
    actions: status === ACCOUNT_STATUS.ACTIVE ? ['suspend', 'block'] : ['reactivate', status === ACCOUNT_STATUS.SUSPENDED ? 'block' : 'suspend'],
    reason: '',
  };
}

/** Valida o pedido antes de chamar o servidor. */
export function validateStatusRequest({ action, reason = '', days } = {}) {
  const erros = {};
  if (!STATUS_ACTION_META[action]) erros.action = 'Escolha a ação.';
  if (String(reason).trim().length < STATUS_REASON_MIN) {
    erros.reason = `Descreva o motivo (mínimo ${STATUS_REASON_MIN} caracteres). A pessoa lê ao tentar entrar.`;
  }
  if (action === 'suspend') {
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > SUSPEND_DAYS_MAX) erros.days = `Entre 1 e ${SUSPEND_DAYS_MAX} dias.`;
  }
  return { isValid: Object.keys(erros).length === 0, errors: erros };
}

/** Suspensões vencidas (para "Precisa de você"). */
export const expiredSuspensions = (users = [], now = Date.now()) => (users || []).filter((u) => accountStatusOf(u, now).vencida);
