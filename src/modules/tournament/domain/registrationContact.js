/**
 * Onde mora o contato de uma inscrição — achado P0-02.
 *
 * O documento de `tournament_registrations` é lido SEM login (quadro do
 * torneio, impressão, telão). Por isso o e-mail do inscrito não pode morar
 * nele. Mora em `tournament_registrations/{rid}/private/contact`.
 *
 * Mas as inscrições que JÁ EXISTEM têm o e-mail no documento público, e vão
 * continuar tendo até a migração apagar esses campos. Enquanto isso, todo
 * leitor precisa aceitar as duas formas — e é exatamente isso que este módulo
 * resolve, num lugar só, sem I/O e com teste.
 *
 * Regra: o que está na subcoleção privada MANDA; o campo público é apenas
 * plano B para o legado.
 */

/** Normaliza e-mail (trim + minúsculas), igual à convenção do serviço. */
export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/** Os quatro campos de contato, vazios. */
export function emptyContact() {
  return {
    player_a_email: '', player_a_email_lc: '',
    player_b_email: '', player_b_email_lc: '',
  };
}

/**
 * Contato efetivo de uma inscrição: prefere a subcoleção privada e cai no
 * campo público (legado) quando ela não existe.
 *
 * @param {object|null} reg      documento público da inscrição
 * @param {object|null} contact  documento `private/contact`, se houver
 * @returns {{player_a_email:string,player_a_email_lc:string,player_b_email:string,player_b_email_lc:string}}
 */
export function resolveRegistrationContact(reg, contact) {
  const r = reg || {};
  const c = contact || {};
  const escolher = (chave) => {
    const privado = String(c[chave] ?? '').trim();
    if (privado) return privado;
    return String(r[chave] ?? '').trim();
  };
  const a = escolher('player_a_email');
  const b = escolher('player_b_email');
  return {
    player_a_email: a,
    player_a_email_lc: escolher('player_a_email_lc') || normalizeEmail(a),
    player_b_email: b,
    player_b_email_lc: escolher('player_b_email_lc') || normalizeEmail(b),
  };
}

/**
 * A inscrição ainda carrega e-mail no documento PÚBLICO?
 * É o que distingue um documento legado (a migrar) de um já corrigido — e o
 * que decide se o `claim` pode reescrever esses campos ou tem de deixá-los
 * de fora para não reintroduzir o vazamento.
 */
export function hasLegacyPublicEmail(reg) {
  const r = reg || {};
  return Boolean(
    String(r.player_a_email || '').trim()
    || String(r.player_a_email_lc || '').trim()
    || String(r.player_b_email || '').trim()
    || String(r.player_b_email_lc || '').trim(),
  );
}

/** Só o que deve ir para a subcoleção privada (nunca para o doc público). */
export function buildContactPayload({ playerAEmail, playerBEmail } = {}) {
  const a = normalizeEmail(playerAEmail);
  const b = normalizeEmail(playerBEmail);
  return {
    player_a_email: a, player_a_email_lc: a,
    player_b_email: b, player_b_email_lc: b,
  };
}

/** Id determinístico da prova de inscrição provisória. Igual ao da regra. */
export function provisionalClaimId(registrationId, slot) {
  return `${registrationId}_${slot}`;
}

/**
 * As entradas de `provisional_claims` que uma inscrição precisa. Só existe
 * entrada para slot PROVISÓRIO (e-mail informado, sem conta vinculada) — quem
 * já tem conta não precisa reivindicar nada.
 *
 * @returns {Array<{id:string, slot:'a'|'b', data:object}>}
 */
export function buildProvisionalClaims({
  registrationId, tournamentId, modalityId = null,
  playerAEmail, playerAUserId, playerBEmail, playerBUserId,
} = {}) {
  const saida = [];
  const push = (slot, email, userId) => {
    const lc = normalizeEmail(email);
    if (!lc || userId) return;
    saida.push({
      id: provisionalClaimId(registrationId, slot),
      slot,
      data: {
        email_lc: lc,
        registration_id: registrationId,
        tournament_id: tournamentId || null,
        modality_id: modalityId || null,
        slot,
        claimed: false,
        claimed_by: null,
      },
    });
  };
  push('a', playerAEmail, playerAUserId);
  push('b', playerBEmail, playerBUserId);
  return saida;
}
