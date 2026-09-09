/**
 * Quem tem poder na plataforma — lógica pura, sem I/O.
 *
 * Existe porque um achado real passou despercebido: havia QUATRO contas com
 * `role: 'platform_admin'` em produção e não havia lugar nenhum, dentro do
 * produto, onde isso aparecesse. Descobrir exigia consultar o banco à mão.
 *
 * Dois pontos que este módulo torna explícitos, porque os dois já enganaram:
 *
 *  1. `hidden: true` é moderação de EXIBIÇÃO. Tira o atleta das listagens e
 *     **não mexe em `role`**. Uma conta oculta com `platform_admin` continua
 *     lendo qualquer perfil e apagando qualquer documento.
 *  2. Quem tem e-mail de dono é RE-PROMOVIDO a cada login
 *     (`FirebaseAuthContext`). Revogar essa conta não adianta — ela volta.
 *     Só faz sentido revogar quem NÃO tem e-mail de dono.
 */

/** Poderes que uma conta pode carregar. */
export const POWER = Object.freeze({
  PLATFORM_ADMIN: 'platform_admin',
  POOL_CREATOR: 'pool_creator',
});

/** Gravidade de um aviso, do mais grave para o menos. */
export const ALERT_LEVEL = Object.freeze({
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
});

const lower = (v) => String(v || '').trim().toLowerCase();

/**
 * Classifica UMA conta quanto ao poder que carrega.
 *
 * @param {object} u  documento de `users/{uid}`
 * @param {{ ownerEmails?: string[], currentUid?: string|null }} ctx
 */
export function classifyAccount(u, { ownerEmails = [], currentUid = null } = {}) {
  const donos = new Set((ownerEmails || []).map(lower));
  const uid = u?.uid || u?.id || '';
  const email = lower(u?.email);
  const isAdmin = u?.role === 'platform_admin';
  const isPoolCreator = u?.can_create_pools === true;
  const hidden = u?.hidden === true;
  const isOwnerEmail = Boolean(email) && donos.has(email);
  const isSelf = Boolean(currentUid) && uid === currentUid;

  const powers = [];
  if (isAdmin) powers.push(POWER.PLATFORM_ADMIN);
  if (isPoolCreator) powers.push(POWER.POOL_CREATOR);

  // Conta "esperada" é a que TEM e-mail de dono. Qualquer outra com poder de
  // admin é inesperada — não importa há quanto tempo esteja lá.
  const unexpectedAdmin = isAdmin && !isOwnerEmail;
  // A armadilha: ocultar não desarma.
  const hiddenButPowerful = hidden && powers.length > 0;
  // Conta sem e-mail no documento: não dá para dizer se é de dono.
  const missingEmail = isAdmin && !email;

  return {
    uid,
    name: u?.full_name || u?.platform_name || u?.name || '',
    email: u?.email || '',
    role: u?.role || 'user',
    canCreatePools: isPoolCreator,
    hidden,
    hiddenAt: u?.hidden_at || null,
    hiddenBy: u?.hidden_by || null,
    lastLogin: u?.last_login || null,
    powers,
    isAdmin,
    isOwnerEmail,
    isSelf,
    unexpectedAdmin,
    hiddenButPowerful,
    missingEmail,
    // Já foi revogada alguma vez? (campos aditivos gravados pela revogação)
    revokedAt: u?.role_revoked_at || null,
    previousRole: u?.role_previous || null,
  };
}

/**
 * Pode oferecer o botão "revogar" para esta conta?
 *
 * Três negativas, cada uma por um motivo diferente:
 *  - só o DONO revoga (a regra do Firestore exige o e-mail do token);
 *  - nunca em si mesmo (a regra permite, pela escotilha de emergência — quem
 *    impede o tiro no pé é esta função);
 *  - nunca numa conta com e-mail de dono: o login a re-promoveria, então o
 *    botão prometeria algo que não acontece.
 */
export function canRevokeAccount(account, { isOwner = false } = {}) {
  if (!isOwner) return false;
  if (!account || !account.uid) return false;
  if (account.isSelf) return false;
  if (account.isOwnerEmail) return false;
  return account.powers.length > 0;
}

/** Motivo, em pt-BR, de o botão não aparecer. Vazio quando ele aparece. */
export function revokeBlockedReason(account, { isOwner = false } = {}) {
  if (!isOwner) return 'Só o dono da plataforma revoga poderes.';
  if (!account?.uid) return 'Conta inválida.';
  if (account.isSelf) return 'Esta é a sua conta.';
  if (account.isOwnerEmail) return 'E-mail de dono: o login devolveria o poder no acesso seguinte.';
  if (account.powers.length === 0) return 'Esta conta não tem poder algum.';
  return '';
}

/**
 * O quadro completo de acessos, a partir da lista de `users`.
 *
 * @param {Array} users
 * @param {{ ownerEmails?: string[], currentUid?: string|null }} ctx
 */
export function buildAccessRoster(users = [], ctx = {}) {
  const contas = (users || []).filter(Boolean).map((u) => classifyAccount(u, ctx));

  const admins = contas.filter((c) => c.isAdmin);
  const poolCreators = contas.filter((c) => c.canCreatePools && !c.isAdmin);
  const inesperados = admins.filter((c) => c.unexpectedAdmin);
  const ocultosComPoder = contas.filter((c) => c.hiddenButPowerful);
  const semEmail = admins.filter((c) => c.missingEmail);

  const alerts = [];
  if (inesperados.length > 0) {
    alerts.push({
      level: ALERT_LEVEL.CRITICAL,
      code: 'admins_inesperados',
      title: `${inesperados.length} conta(s) com poder de administrador sem e-mail de dono`,
      detail: 'Administrador lê qualquer perfil e apaga qualquer documento. '
        + 'Confira o histórico de cada uma na Auditoria antes de revogar.',
      uids: inesperados.map((c) => c.uid),
    });
  }
  if (ocultosComPoder.length > 0) {
    alerts.push({
      level: ALERT_LEVEL.CRITICAL,
      code: 'ocultos_com_poder',
      title: `${ocultosComPoder.length} conta(s) OCULTA(s) ainda com poder`,
      detail: 'Ocultar tira o atleta das listagens e NÃO remove o poder. '
        + 'Estas contas continuam com acesso total.',
      uids: ocultosComPoder.map((c) => c.uid),
    });
  }
  if (semEmail.length > 0) {
    alerts.push({
      level: ALERT_LEVEL.WARNING,
      code: 'admin_sem_email',
      title: `${semEmail.length} administrador(es) sem e-mail no documento`,
      detail: 'Sem e-mail não dá para dizer se a conta é legítima. Investigue.',
      uids: semEmail.map((c) => c.uid),
    });
  }
  if (admins.length === 0) {
    alerts.push({
      level: ALERT_LEVEL.CRITICAL,
      code: 'sem_admin',
      title: 'Nenhuma conta com poder de administrador',
      detail: 'Se você perdeu o acesso, use a restauração de emergência do dono.',
      uids: [],
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      level: ALERT_LEVEL.INFO,
      code: 'ok',
      title: 'Só o dono tem poder de administrador',
      detail: 'É a configuração esperada.',
      uids: [],
    });
  }

  // Mais crítico primeiro; dentro do mesmo nível, o inesperado antes.
  const peso = (c) => (c.unexpectedAdmin ? 0 : 1) + (c.hiddenButPowerful ? 0 : 1) + (c.isSelf ? 1 : 0);
  const ordenados = [...admins].sort((a, b) => peso(a) - peso(b));

  return {
    accounts: contas,
    admins: ordenados,
    poolCreators,
    unexpectedAdmins: inesperados,
    hiddenWithPower: ocultosComPoder,
    alerts,
    counts: {
      total: contas.length,
      admins: admins.length,
      unexpectedAdmins: inesperados.length,
      poolCreators: poolCreators.length,
      hiddenWithPower: ocultosComPoder.length,
    },
    healthy: inesperados.length === 0 && ocultosComPoder.length === 0 && admins.length > 0,
  };
}

/** O que a revogação grava. Puro, para o serviço só persistir. */
export function buildRevokePayload(account, actorUid) {
  return {
    role: 'user',
    can_create_pools: false,
    role_previous: account?.role || 'platform_admin',
    role_revoked_by: actorUid || null,
  };
}
