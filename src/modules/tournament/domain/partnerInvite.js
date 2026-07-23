/**
 * Convite e aceite de dupla (flag partner_invites).
 *
 * Quando o atleta escolhe um parceiro cadastrado na plataforma, a inscrição
 * de dupla carrega um convite: o parceiro é notificado e pode confirmar ou
 * recusar a participação. O status do convite NÃO altera a máquina de status
 * da inscrição (pagamento/confirmação seguem como hoje) — é uma camada
 * paralela e puramente aditiva. Puro — sem Firebase.
 */

import { COMPETITION_GENDER, REGISTRATION_STATUS } from './constants.js';

export const PARTNER_INVITE_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
});

export const PARTNER_INVITE_STATUS_LABELS = Object.freeze({
  [PARTNER_INVITE_STATUS.PENDING]: 'Aguardando a dupla confirmar',
  [PARTNER_INVITE_STATUS.ACCEPTED]: 'Dupla confirmou',
  [PARTNER_INVITE_STATUS.DECLINED]: 'Dupla recusou',
});

/** Campos gravados na inscrição quando ela nasce com convite de dupla. */
export function buildPartnerInviteFields(partnerUid) {
  const uid = String(partnerUid || '').trim();
  if (!uid) return {};
  return {
    partner_invite_uid: uid,
    partner_invite_status: PARTNER_INVITE_STATUS.PENDING,
    partner_invite_responded_at: null,
  };
}

/** A inscrição carrega um convite de dupla? */
export function registrationHasPartnerInvite(registration) {
  return Boolean(registration?.partner_invite_uid && registration?.partner_invite_status);
}

/** O usuário pode responder (aceitar/recusar) o convite desta inscrição? */
export function canRespondToPartnerInvite(registration, uid) {
  if (!registration || !uid) return false;
  if (registration.status === REGISTRATION_STATUS.CANCELLED) return false;
  return registration.partner_invite_uid === uid
    && registration.partner_invite_status === PARTNER_INVITE_STATUS.PENDING;
}

/** Convites pendentes endereçados ao usuário dentro de uma lista de inscrições. */
export function findPendingPartnerInvites(registrations = [], uid) {
  if (!uid) return [];
  return registrations.filter((registration) => canRespondToPartnerInvite(registration, uid));
}

/**
 * Tom e rótulo do chip de status do convite (para tabelas/cards).
 * @returns {{ text: string, tone: 'amber'|'green'|'red' }|null}
 */
export function partnerInviteBadge(registration) {
  if (!registrationHasPartnerInvite(registration)) return null;
  const status = registration.partner_invite_status;
  const tone = status === PARTNER_INVITE_STATUS.ACCEPTED
    ? 'green'
    : status === PARTNER_INVITE_STATUS.DECLINED
      ? 'red'
      : 'amber';
  const text = PARTNER_INVITE_STATUS_LABELS[status];
  return text ? { text, tone } : null;
}

const COMPETITION_GENDER_VALUES = new Set(Object.values(COMPETITION_GENDER));

/**
 * Converte o perfil público do diretório (`athlete_profiles/{uid}`) nos
 * campos de jogador B da inscrição. O gênero só é aproveitado quando coincide
 * com uma categoria competitiva válida; e-mail pode ser vazio (privacidade) —
 * a identidade fica garantida pelo `user_id`.
 */
export function publicProfileToPartnerFields(profile = {}) {
  return {
    name: String(profile.platform_name || '').trim(),
    email: String(profile.email || '').trim(),
    level: profile.leveling_level || profile.level || '',
    competition_gender: COMPETITION_GENDER_VALUES.has(profile.gender) ? profile.gender : '',
    user_id: profile.uid || profile.id || null,
    photo_url: profile.photo_url || null,
  };
}

/**
 * Filtra candidatos a parceiro no diretório: busca por nome (sem acentos),
 * exclui o próprio usuário e quem já está inscrito na modalidade.
 */
export function filterPartnerCandidates(profiles = [], { term = '', selfUid = null, excludedUids = [] } = {}) {
  const normalized = normalizeText(term);
  const excluded = new Set([selfUid, ...excludedUids].filter(Boolean));
  return profiles.filter((profile) => {
    const uid = profile.uid || profile.id;
    if (!uid || excluded.has(uid)) return false;
    if (!normalized) return true;
    return normalizeText(profile.platform_name).includes(normalized)
      || normalizeText(profile.city).includes(normalized);
  });
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
