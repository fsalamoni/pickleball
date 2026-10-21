/**
 * Equipe da federação: papel → permissões. A regra tem a MESMA tabela
 * (`fedHas` no `firestore.rules`); `staff.test.js` compara as duas.
 */
import { FED_MODULE, FED_PERMISSION, STAFF_ROLE, STAFF_ROLE_PERMISSIONS } from './constants.js';
import { fedModuleOn } from './federation.js';

/** O papel tem a permissão? Papel desconhecido não tem nenhuma. */
export function roleHas(role, permission) {
  return (STAFF_ROLE_PERMISSIONS[role] || []).includes(permission);
}

/** O membro da equipe (documento de `federation_staff`) tem a permissão? */
export function staffHas(staffDoc, permission) {
  return Boolean(staffDoc) && roleHas(staffDoc.role, permission);
}

/**
 * Quem pode mudar o papel de alguém? Presidente só é trocado por presidente
 * (ou admin da plataforma — na regra). Um presidente nunca se rebaixa sem
 * passar a presidência: a federação ficaria sem ninguém com o poder.
 */
export function canChangeStaff({ actorRole, targetRole, newRole, isSelf = false }) {
  if (!roleHas(actorRole, FED_PERMISSION.ADMIN)) return false;
  const mexeNoPresidente = targetRole === STAFF_ROLE.PRESIDENT || newRole === STAFF_ROLE.PRESIDENT;
  if (mexeNoPresidente && actorRole !== STAFF_ROLE.PRESIDENT) return false;
  if (isSelf && actorRole === STAFF_ROLE.PRESIDENT && newRole !== STAFF_ROLE.PRESIDENT) return false;
  return true;
}

/** Permissões de uma lista de papéis (a pessoa pode ter um só, mas a Central soma). */
export function permissionsOf(role) {
  return [...(STAFF_ROLE_PERMISSIONS[role] || [])];
}

/** Papéis que o ator pode atribuir. */
export function assignableRoles(actorRole) {
  if (!roleHas(actorRole, FED_PERMISSION.ADMIN)) return [];
  return Object.values(STAFF_ROLE).filter((r) => r !== STAFF_ROLE.PRESIDENT || actorRole === STAFF_ROLE.PRESIDENT);
}

/**
 * As federações pelas quais a pessoa vende no Mercado: a loja (`store`) ligada
 * e um papel com `admin` ou `finance` — a mesma conta de `isMarketOperator`
 * na regra. `roles` = documentos de `federation_staff` da pessoa.
 */
export function storeFederations(roles = [], federations = []) {
  const porId = new Map(federations.map((f) => [f.id, f]));
  return roles
    .filter((r) => roleHas(r.role, FED_PERMISSION.ADMIN) || roleHas(r.role, FED_PERMISSION.FINANCE))
    .map((r) => porId.get(r.federation_id))
    .filter((f, i, arr) => f && fedModuleOn(f, FED_MODULE.STORE) && arr.indexOf(f) === i);
}
