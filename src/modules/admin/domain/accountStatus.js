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
import { t, tk } from '../../../core/i18n/index.js';

export const ACCOUNT_STATUS = Object.freeze({ ACTIVE: 'active', SUSPENDED: 'suspended', BLOCKED: 'blocked' });
export const STATUS_REASON_MIN = 5;
export const SUSPEND_DAYS_MAX = 365;
export const SUSPEND_DAYS_OPTIONS = Object.freeze([1, 3, 7, 15, 30, 90]);

export const ACCOUNT_STATUS_META = Object.freeze({
  active: { label: tk('Ativa'), tone: 'green' },
  suspended: { label: tk('Suspensa'), tone: 'amber' },
  blocked: { label: tk('Bloqueada'), tone: 'red' },
});

export const STATUS_ACTION_META = Object.freeze({
  suspend: { label: tk('Suspender'), verb: 'suspensa', hint: tk('Por um prazo. Reativar é decisão do admin quando ele vence.') },
  block: { label: tk('Bloquear'), verb: 'bloqueada', hint: tk('Sem prazo. Só o admin reativa.') },
  reactivate: { label: tk('Reativar'), verb: 'reativada', hint: tk('Devolve o acesso exatamente como era.') },
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
  if (!porta.ok) {
    const dono = porta.reason === t('Conta de dono da plataforma. Não pode ser excluída.');
    return { actions: [], reason: dono ? t('Conta de dono da plataforma. Não pode ser suspensa nem bloqueada.') : porta.reason };
  }
  const { status } = accountStatusOf(user);
  return {
    actions: status === ACCOUNT_STATUS.ACTIVE ? ['suspend', 'block'] : ['reactivate', status === ACCOUNT_STATUS.SUSPENDED ? 'block' : 'suspend'],
    reason: '',
  };
}

/** Valida o pedido antes de chamar o servidor. */
export function validateStatusRequest({ action, reason = '', days } = {}) {
  const erros = {};
  if (!STATUS_ACTION_META[action]) erros.action = t('Escolha a ação.');
  if (String(reason).trim().length < STATUS_REASON_MIN) {
    erros.reason = t('Descreva o motivo (mínimo {min} caracteres). A pessoa lê ao tentar entrar.', { min: STATUS_REASON_MIN });
  }
  if (action === 'suspend') {
    const d = Number(days);
    if (!Number.isInteger(d) || d < 1 || d > SUSPEND_DAYS_MAX) erros.days = t('Entre 1 e {max} dias.', { max: SUSPEND_DAYS_MAX });
  }
  return { isValid: Object.keys(erros).length === 0, errors: erros };
}

/** Suspensões vencidas (para "Precisa de você"). */
export const expiredSuspensions = (users = [], now = Date.now()) => (users || []).filter((u) => accountStatusOf(u, now).vencida);
