/**
 * SUSPENDER, BLOQUEAR e REATIVAR uma conta — no servidor.
 *
 * O pedido do dono (2026-10-11): *"Faça tudo. Suspender, bloquear, editar
 * contas."* Excluir já existia (`accountDeletion.js`); faltava o meio-termo —
 * tirar alguém do ar SEM apagar nada.
 *
 * ## Por que no servidor
 *
 * Tirar o acesso de verdade é desligar a conta no Firebase Authentication
 * (`disabled: true`) e revogar os tokens vivos — só o Admin SDK faz isso. O
 * campo `users/{uid}.account_status` é a CÓPIA legível pela tela (e pelo
 * próprio app, que encerra a sessão ao vê-lo); a regra impede o titular de
 * escrevê-lo.
 *
 * ## Os três estados
 *
 * | status      | login | o que é                                             |
 * |-------------|-------|-----------------------------------------------------|
 * | `active`    | sim   | o padrão (campo ausente vale `active`)              |
 * | `suspended` | não   | temporário: tem prazo (`status_until`) e o admin    |
 * |             |       | reativa quando vence — o painel "Precisa de você"   |
 * |             |       | lembra; nada reativa sozinho                        |
 * | `blocked`   | não   | sem prazo; só o admin reativa                       |
 *
 * ## As travas (as mesmas da exclusão)
 *
 * Nunca a própria conta, nunca uma conta com poder de admin, nunca o e-mail
 * de dono. Motivo obrigatório (vai para a Auditoria e para o titular, que lê
 * ao tentar entrar). Nada é apagado; reativar devolve exatamente o que era.
 */
const { tx, textoDoAviso, i18nDoAviso } = require('./avisoI18n');

const { isOwnerEmail, targetBlockedReason } = require('./accountDeletion');

const ACCOUNT_STATUS = Object.freeze({ ACTIVE: 'active', SUSPENDED: 'suspended', BLOCKED: 'blocked' });
const ACTIONS = Object.freeze(['suspend', 'block', 'reactivate']);
const REASON_MIN = 5;
const REASON_MAX = 500;
/** Suspensão: entre 1 dia e 1 ano. Mais que isso é bloqueio. */
const SUSPEND_DAYS_MAX = 365;

const texto = (v) => String(v == null ? '' : v).trim();

/** O pedido do navegador não é confiável: validado de novo aqui. */
function validateStatusRequest(data = {}) {
  const uid = texto(data.uid);
  const action = texto(data.action);
  const reason = texto(data.reason).slice(0, REASON_MAX);
  if (!uid) return { error: 'Informe a conta.' };
  if (!ACTIONS.includes(action)) return { error: 'Ação desconhecida.' };
  if (reason.length < REASON_MIN) return { error: `Descreva o motivo (mínimo ${REASON_MIN} caracteres).` };
  let days = null;
  if (action === 'suspend') {
    days = Number(data.days);
    if (!Number.isInteger(days) || days < 1 || days > SUSPEND_DAYS_MAX) {
      return { error: `A suspensão vai de 1 a ${SUSPEND_DAYS_MAX} dias.` };
    }
  }
  return { uid, action, reason, days };
}

/** Para que status cada ação leva. */
function statusForAction(action) {
  if (action === 'suspend') return ACCOUNT_STATUS.SUSPENDED;
  if (action === 'block') return ACCOUNT_STATUS.BLOCKED;
  return ACCOUNT_STATUS.ACTIVE;
}

const LABELS = Object.freeze({
  suspend: ['admin_account_suspended', 'Conta suspensa pelo admin'],
  block: ['admin_account_blocked', 'Conta bloqueada pelo admin'],
  reactivate: ['admin_account_reactivated', 'Conta reativada pelo admin'],
});

/**
 * Aplica. `ctx.auth` é o Admin SDK de Auth (pode faltar no teste); o
 * documento é gravado DEPOIS do Auth: se o Auth falhar, a tela continua
 * mostrando o estado real, e o admin roda de novo.
 */
async function applyAccountStatus(ctx, { uid, action, reason, days }, { actor, now = Date.now() }) {
  const { db, auth } = ctx;
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return { uid, status: 'error', error: 'Cadastro não encontrado.' };
  const target = { uid, ...snap.data() };
  const bloqueio = targetBlockedReason(target, { actorUid: actor.uid });
  if (bloqueio) return { uid, status: 'error', error: bloqueio };

  const status = statusForAction(action);
  const anterior = target.account_status || ACCOUNT_STATUS.ACTIVE;
  const disabled = status !== ACCOUNT_STATUS.ACTIVE;
  let authApplied = false;
  if (auth) {
    try {
      await auth.updateUser(uid, { disabled });
      if (disabled) await auth.revokeRefreshTokens(uid);
      authApplied = true;
    } catch (err) {
      // Conta sem login (cadastro órfão) não impede o resto — o documento é a
      // cópia que a tela e o app leem.
      if (!err || err.code !== 'auth/user-not-found') throw err;
    }
  }

  const until = status === ACCOUNT_STATUS.SUSPENDED ? now + days * 86_400_000 : null;
  await snap.ref.set({
    account_status: status,
    status_reason: disabled ? reason : null,
    status_until: until,
    status_set_at: now,
    status_set_by: actor.uid,
    updated_at: new Date(now),
  }, { merge: true });

  const [acao, rotulo] = LABELS[action];
  await db.collection('audit_logs').add({
    log_number: Number(`${now}${Math.floor(Math.random() * 900 + 100)}`),
    action: acao,
    action_label: rotulo,
    actor_id: actor.uid,
    actor_name: actor.name || actor.email || actor.uid,
    actor_email: actor.email || '',
    tournament_id: null,
    user_id: uid,
    user_name: target.platform_name || target.full_name || '',
    user_email: target.email || '',
    details: { reason, from: anterior, to: status, until, login_desligado: authApplied && disabled },
    created_at: new Date(now),
    created_at_ms: now,
  });
  await avisarTitular(db, { uid, action, reason, until, now });
  return { uid, status: 'ok', account_status: status, until, authApplied };
}

/**
 * O aviso ESSENCIAL ao titular (`origin: 'server'`, `essential: true`): com
 * os avisos por e-mail ligados, vai para o e-mail mesmo que a pessoa tenha
 * desligado tudo — suspensa, ela não entra no app para ler o sino. Falhar
 * aqui não desfaz a mudança de status.
 */
async function avisarTitular(db, { uid, action, reason, until, now }) {
  const data = until ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(new Date(until)) : '';
  const textos = {
    suspend: [tx('Sua conta foi suspensa'), tx('A conta fica suspensa até {data}. Motivo: {motivo}', { data, motivo: reason })],
    block: [tx('Sua conta foi bloqueada'), tx('Motivo: {motivo}', { motivo: reason })],
    reactivate: [tx('Sua conta foi reativada'), tx('Você já pode entrar de novo no PickleRush.')],
  }[action];
  if (!textos) return;
  const [title, message] = textos;
  const i18n = i18nDoAviso({ title, message });
  try {
    await db.collection('notifications').add({
      user_id: uid, title: textoDoAviso(title), message: textoDoAviso(message), type: 'account_status',
      link: '/configuracoes', read: false, archived: false, origin: 'server', essential: true,
      created_at: new Date(now), created_at_ms: now, ...(i18n ? { i18n } : {}),
    });
  } catch (_) { /* o status já foi gravado; o aviso é um extra */ }
}

module.exports = {
  ACCOUNT_STATUS, ACTIONS, REASON_MIN, SUSPEND_DAYS_MAX,
  validateStatusRequest, statusForAction, applyAccountStatus, isOwnerEmail,
};
