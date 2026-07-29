/**
 * Lógica pura de consentimento aos documentos legais (flag legal_center).
 *
 * Um consentimento é considerado VÁLIDO quando o usuário aceitou uma versão
 * do documento igual ou superior à versão vigente. Ao bumpar a `version` de um
 * documento, o consentimento anterior fica "desatualizado" e volta a ser
 * pendente. Sem I/O.
 *
 * `consentMap`: { [docKey]: { version: number } } — o aceite mais recente por
 * documento (materializado a partir de `legal_consents`).
 */

import { LEGAL_DOCUMENTS, LEGAL_ROLE } from './legalDocuments.js';

/** Id determinístico do doc de consentimento (um por usuário × documento). */
export function consentDocId(uid, key) {
  return `${uid}_${key}`;
}

/** Um documento está aceito e atualizado no mapa de consentimentos? */
export function isDocAccepted(consentMap, doc) {
  if (!doc) return false;
  const entry = (consentMap || {})[doc.key];
  if (!entry) return false;
  return Number(entry.version || 0) >= Number(doc.version || 0);
}

/** Documentos do portão bloqueante (essenciais, `gate: true`). */
export function gateDocuments(documents = LEGAL_DOCUMENTS) {
  return documents.filter((d) => d.gate === true);
}

/**
 * Converte sinais de papel em uma lista de audiências relevantes ao usuário
 * (sempre inclui 'all').
 * @param {{ isOrganizer?: boolean, isArenaOwner?: boolean, isCoach?: boolean }} flags
 */
export function rolesForUser(flags = {}) {
  const roles = [LEGAL_ROLE.ALL];
  if (flags.isOrganizer) roles.push(LEGAL_ROLE.ORGANIZER);
  if (flags.isArenaOwner) roles.push(LEGAL_ROLE.ARENA_OWNER);
  if (flags.isCoach) roles.push(LEGAL_ROLE.COACH);
  return roles;
}

/** Documentos por papel para as audiências informadas. */
export function documentsForRoles(roles, documents = LEGAL_DOCUMENTS) {
  const set = new Set(roles || []);
  return documents.filter((d) => set.has(d.audience));
}

/**
 * Documentos essenciais ainda pendentes (não aceitos ou desatualizados).
 * Alimenta o portão de consentimento bloqueante.
 */
export function pendingGateConsents(consentMap, documents = LEGAL_DOCUMENTS) {
  return gateDocuments(documents).filter((d) => !isDocAccepted(consentMap, d));
}

/**
 * Documentos por papel pendentes para o usuário (não bloqueiam; alimentam a
 * central e as caixas de aceite nos fluxos).
 */
export function pendingRoleConsents(consentMap, roles, documents = LEGAL_DOCUMENTS) {
  return documentsForRoles(roles, documents)
    .filter((d) => d.audience !== LEGAL_ROLE.ALL)
    .filter((d) => !isDocAccepted(consentMap, d));
}

/** Constrói o consentMap a partir de uma lista de registros `legal_consents`. */
export function buildConsentMap(records = []) {
  const map = {};
  (records || []).forEach((r) => {
    if (!r?.doc_key) return;
    const v = Number(r.version || 0);
    if (!map[r.doc_key] || v > Number(map[r.doc_key].version || 0)) {
      map[r.doc_key] = { version: v, accepted_at: r.accepted_at || null, accepted_at_ms: r.accepted_at_ms || 0 };
    }
  });
  return map;
}
