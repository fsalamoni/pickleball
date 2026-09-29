/**
 * Plano puro para limpar e-mails legados de coleções com leitura ampla.
 *
 * A execução real fica em scripts/privacy-legacy-email-cleanup.mjs. Este módulo
 * só decide o que precisa ser copiado para área privada antes de apagar campos
 * públicos, e o que pode ser removido sem perder contato/claim.
 */

export const REGISTRATION_PUBLIC_EMAIL_FIELDS = Object.freeze([
  'player_a_email',
  'player_a_email_lc',
  'player_b_email',
  'player_b_email_lc',
]);

export const WIDE_READ_USER_EMAIL_COLLECTIONS = Object.freeze([
  'club_members',
  'tournament_admins',
]);

const SLOT_CONFIG = Object.freeze({
  a: {
    email: 'player_a_email',
    emailLc: 'player_a_email_lc',
    userId: 'player_a_user_id',
    provisional: 'player_a_provisional',
  },
  b: {
    email: 'player_b_email',
    emailLc: 'player_b_email_lc',
    userId: 'player_b_user_id',
    provisional: 'player_b_provisional',
  },
});

export function normalizeLegacyEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function filled(obj, key) {
  return normalizeLegacyEmail(obj?.[key]);
}

export function hasLegacyRegistrationPublicEmail(reg) {
  return REGISTRATION_PUBLIC_EMAIL_FIELDS.some((field) => hasOwn(reg, field));
}

export function effectiveRegistrationContact(reg = {}, privateContact = {}) {
  const result = {};
  Object.values(SLOT_CONFIG).forEach(({ email, emailLc }) => {
    const privateEmail = filled(privateContact, email);
    const publicEmail = filled(reg, email) || filled(reg, emailLc);
    const finalEmail = privateEmail || publicEmail;
    result[email] = finalEmail;
    result[emailLc] = filled(privateContact, emailLc) || finalEmail;
  });
  return result;
}

/**
 * Campos que faltam em private/contact para poder apagar o e-mail público sem
 * perder contato do inscrito. A subcoleção privada sempre vence: o legado só
 * preenche buracos.
 */
export function privateContactBackfillPatch(reg = {}, privateContact = {}) {
  const effective = effectiveRegistrationContact(reg, privateContact);
  const patch = {};

  Object.values(SLOT_CONFIG).forEach(({ email, emailLc }) => {
    if (!filled(privateContact, email) && effective[email]) {
      patch[email] = effective[email];
    }
    if (!filled(privateContact, emailLc) && effective[emailLc]) {
      patch[emailLc] = effective[emailLc];
    }
  });

  return patch;
}

export function provisionalClaimsForLegacyRegistration(reg = {}, privateContact = {}) {
  const registrationId = String(reg.id || '').trim();
  if (!registrationId) return [];

  const contact = effectiveRegistrationContact(reg, privateContact);
  return Object.entries(SLOT_CONFIG).flatMap(([slot, cfg]) => {
    const emailLc = contact[cfg.emailLc] || contact[cfg.email];
    if (!emailLc || reg[cfg.userId]) return [];
    // Se não há user_id, o registro ainda depende de claim por e-mail. O flag
    // *_provisional antigo ajuda, mas a ausência de uid é a trava real.
    return [{
      id: `${registrationId}_${slot}`,
      data: {
        email_lc: emailLc,
        registration_id: registrationId,
        tournament_id: reg.tournament_id || null,
        modality_id: reg.modality_id || null,
        slot,
        claimed: false,
        claimed_by: null,
      },
    }];
  });
}

export function publicEmailDeletePatch(deleteValue) {
  return Object.fromEntries(REGISTRATION_PUBLIC_EMAIL_FIELDS.map((field) => [field, deleteValue]));
}

export function userEmailDeletePatch(doc = {}, deleteValue) {
  return hasOwn(doc, 'user_email') ? { user_email: deleteValue } : {};
}

/**
 * Antes de apagar os campos públicos, confirma se private/contact e
 * provisional_claims já preservam o que o legado ainda tinha.
 */
export function deletionPreconditions(reg = {}, privateContact = {}, existingClaimIds = new Set()) {
  const missingContact = Object.keys(privateContactBackfillPatch(reg, privateContact));
  const missingClaims = provisionalClaimsForLegacyRegistration(reg, privateContact)
    .map((claim) => claim.id)
    .filter((id) => !existingClaimIds.has(id));

  return {
    ok: missingContact.length === 0 && missingClaims.length === 0,
    missingContact,
    missingClaims,
  };
}
