/**
 * Avisos do organizador aos inscritos (flag tournament_announcements).
 *
 * Extrai os destinatários únicos (contas vinculadas às inscrições ativas) e
 * monta textos auxiliares. Puro — sem Firebase.
 */

import { REGISTRATION_STATUS } from './constants.js';

/**
 * Destinatários únicos de um aviso: uids vinculados a inscrições ativas do
 * torneio (opcionalmente filtradas por modalidade). Inscrições canceladas e
 * fictícias ficam de fora; convidados sem conta não têm como ser notificados.
 *
 * @param {Array<object>} registrations
 * @param {{ modalityId?: string|null }} [options]
 * @returns {string[]}
 */
export function announcementRecipients(registrations = [], { modalityId = null } = {}) {
  const uids = new Set();
  registrations.forEach((registration) => {
    if (!registration || registration.is_placeholder) return;
    if (registration.status === REGISTRATION_STATUS.CANCELLED) return;
    if (modalityId && registration.modality_id !== modalityId) return;
    [registration.user_id, registration.player_a_user_id, registration.player_b_user_id]
      .forEach((uid) => { if (uid) uids.add(uid); });
  });
  return Array.from(uids);
}

/** Valida o conteúdo de um aviso antes do envio. */
export function validateAnnouncement({ title, message } = {}) {
  const errors = {};
  if (!String(title || '').trim()) errors.title = 'Informe o título do aviso.';
  if (!String(message || '').trim()) errors.message = 'Escreva a mensagem do aviso.';
  return { isValid: Object.keys(errors).length === 0, errors };
}

/** Texto pronto para colar em um grupo de WhatsApp. */
export function buildAnnouncementWhatsAppText({ tournamentName, title, message } = {}) {
  const head = [String(title || '').trim(), String(tournamentName || '').trim()]
    .filter(Boolean)
    .join(' — ');
  return [head ? `*${head}*` : null, String(message || '').trim()].filter(Boolean).join('\n\n');
}
