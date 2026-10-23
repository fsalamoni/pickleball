/**
 * Equipe da federação: CARGOS (que cada federação monta) → permissões, com
 * MANDATO e ADMINS MASTER.
 *
 * - O cargo é da federação (`federations.staff_roles`): nome, descrição,
 *   permissões (`FED_PERMISSION`), se é admin master e o mandato padrão. Sem
 *   cargos gravados valem os oito modelos de sempre (`DEFAULT_STAFF_ROLES`).
 * - A pessoa na equipe (`federation_staff/{fed}_{uid}`) leva a CÓPIA das
 *   permissões do cargo (`perms`), o mandato (`term_start`/`term_end`) e
 *   `is_master`. Documento antigo, sem `perms`, vale pelo papel
 *   (`STAFF_ROLE_PERMISSIONS`; presidente = admin master).
 * - Mandato vencido não dá permissão nenhuma — na regra (`fedPerms`), no
 *   servidor (`functions/federationStaff.js`, com paridade) e aqui. O admin
 *   master é a exceção: a federação nunca fica sem ninguém, e o servidor só o
 *   tira quando sobra outro.
 * - Quem grava é SÓ o servidor (`federationStaff`): ele confere quem pode e
 *   que sempre sobra um admin master. Estas contas dizem antes, na tela.
 */
import { FED_MODULE, FED_PERMISSION, STAFF_ROLE, STAFF_ROLE_DESCRIPTIONS, STAFF_ROLE_LABELS, STAFF_ROLE_PERMISSIONS, STAFF_TERM_MAX_MONTHS } from './constants.js';
import { fedModuleOn, isFederationPublic } from './federation.js';
import { t } from '@/core/i18n';

export const ALL_PERMISSIONS = Object.freeze(Object.values(FED_PERMISSION));
export const STAFF_ROLES_MAX = 30;

/** Os oito modelos de sempre — os cargos de quem ainda não montou os seus. */
export const DEFAULT_STAFF_ROLES = Object.freeze(Object.values(STAFF_ROLE).map((id) => Object.freeze({
  id,
  name: STAFF_ROLE_LABELS[id],
  description: STAFF_ROLE_DESCRIPTIONS[id],
  perms: [...STAFF_ROLE_PERMISSIONS[id]],
  is_master: id === STAFF_ROLE.PRESIDENT,
  term_months: id === STAFF_ROLE.PRESIDENT || id === STAFF_ROLE.DIRECTOR ? STAFF_TERM_MAX_MONTHS : 0,
})));

/** Os cargos que valem nesta federação. */
export function effectiveRoles(federation) {
  const proprios = Array.isArray(federation?.staff_roles) ? federation.staff_roles : [];
  return proprios.length ? proprios : DEFAULT_STAFF_ROLES;
}

export const roleById = (federation, id) => effectiveRoles(federation).find((r) => r.id === id) || null;

/** É admin master? Documento antigo: o presidente. */
export const staffIsMaster = (doc) => Boolean(doc) && (doc.is_master ?? doc.role === STAFF_ROLE.PRESIDENT);

/** O mandato ainda vale? Sem fim = sem prazo; o admin master segura (ver acima). */
export function staffTermActive(doc, nowMs = Date.now()) {
  if (!doc) return false;
  if (staffIsMaster(doc)) return true;
  return !doc.term_end_ms || Number(doc.term_end_ms) > nowMs;
}

/** As permissões que a pessoa tem AGORA — a mesma conta de `fedPerms` na regra. */
export function staffPerms(doc, nowMs = Date.now()) {
  if (!staffTermActive(doc, nowMs)) return [];
  // Admin master é "tudo": ganha também as permissões criadas depois de o cargo ser gravado (ex.: proteção de menores).
  if (staffIsMaster(doc)) return [...ALL_PERMISSIONS];
  return [...(Array.isArray(doc.perms) ? doc.perms : (STAFF_ROLE_PERMISSIONS[doc.role] || []))];
}

export const staffHas = (doc, permission, nowMs = Date.now()) => staffPerms(doc, nowMs).includes(permission);

/** O papel antigo tem a permissão? (Usado só pelos modelos.) */
export const roleHas = (role, permission) => (STAFF_ROLE_PERMISSIONS[role] || []).includes(permission);

/** O nome do cargo para mostrar. */
export function staffRoleName(doc) {
  if (!doc) return '';
  const modelo = STAFF_ROLE_LABELS[doc.role_id || doc.role];
  if (doc.role_name) return modelo && doc.role_name === modelo ? t(modelo) : doc.role_name;
  return modelo ? t(modelo) : (doc.role || '');
}

/** O nome do cargo (modelo traduzido; cargo próprio como foi escrito). */
export const roleLabel = (role) => (role && STAFF_ROLE_LABELS[role.id] && role.name === STAFF_ROLE_LABELS[role.id] ? t(role.name) : role?.name || '');
export const roleDescription = (role) => (role && STAFF_ROLE_DESCRIPTIONS[role.id] && role.description === STAFF_ROLE_DESCRIPTIONS[role.id] ? t(role.description) : role?.description || '');

/** Admins master com o cargo valendo. */
export const activeMasters = (staff = []) => staff.filter((s) => staffIsMaster(s));

/**
 * O que o ator pode fazer com a pessoa (`target`, documento da equipe ou nulo
 * para quem entra) no cargo `role`. Mesmas regras do servidor:
 *  - admin master faz tudo, menos deixar a federação sem admin master;
 *  - quem tem `staff` (sem ser master) nomeia, prorroga e tira só fora dos
 *    cargos de admin master, nunca a si mesmo, e só dá permissões que tem.
 */
export function staffActionAllowed({ actor, target = null, role = null, nowMs = Date.now() }) {
  if (!actor) return false;
  const actorMaster = staffIsMaster(actor) && staffTermActive(actor, nowMs);
  const mexeEmMaster = staffIsMaster(target) || Boolean(role?.is_master);
  if (actorMaster) return true;
  if (!staffHas(actor, FED_PERMISSION.STAFF, nowMs) || mexeEmMaster) return false;
  if (target && target.user_id === actor.user_id) return false;
  const minhas = staffPerms(actor, nowMs);
  return !role || role.perms.every((p) => minhas.includes(p));
}

/** Tirar (ou rebaixar) esta pessoa deixaria a federação sem admin master? */
export function isLastMaster(target, staff = []) {
  return staffIsMaster(target) && activeMasters(staff).filter((s) => s.user_id !== target.user_id).length === 0;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O mandato: início obrigatório, fim opcional (sem prazo) e depois do início.
 * Mais de 4 anos não bloqueia (o estatuto decide), mas vira alerta.
 */
export function validateTerm({ term_start = '', term_end = '' } = {}) {
  const errors = {};
  if (!DATA.test(String(term_start))) errors.term_start = t('Informe o início do mandato.');
  if (term_end && !DATA.test(String(term_end))) errors.term_end = t('Data inválida.');
  else if (term_end && term_start && term_end < term_start) errors.term_end = t('O fim vem depois do início.');
  const meses = term_end && DATA.test(term_start) && DATA.test(term_end)
    ? (Number(term_end.slice(0, 4)) - Number(term_start.slice(0, 4))) * 12 + Number(term_end.slice(5, 7)) - Number(term_start.slice(5, 7))
    : 0;
  return { ok: !Object.keys(errors).length, errors, longTerm: meses > STAFF_TERM_MAX_MONTHS };
}

const ID = /^[a-z0-9][a-z0-9_-]{1,39}$/;

/** Um cargo da federação. */
export function validateStaffRole(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const is_master = input.is_master === true;
  const perms = is_master ? [...ALL_PERMISSIONS] : [...new Set((input.perms || []).filter((p) => ALL_PERMISSIONS.includes(p)))];
  const term_months = Math.round(Number(input.term_months) || 0);
  if (input.id && !ID.test(String(input.id))) errors.id = t('Identificador inválido.');
  if (name.length < 2 || name.length > 60) errors.name = t('Dê um nome de 2 a 60 letras.');
  if (description.length > 300) errors.description = t('Até 300 letras.');
  if (!perms.length) errors.perms = t('Escolha ao menos uma permissão.');
  if (term_months < 0 || term_months > 120) errors.term_months = t('De 0 (sem prazo) a 120 meses.');
  return { ok: !Object.keys(errors).length, errors, value: { ...(input.id ? { id: String(input.id) } : {}), name, description, perms, is_master, term_months } };
}

/** Estado do mandato para a tela. */
export function termStatus(doc, nowMs = Date.now()) {
  if (!doc?.term_end_ms) return { kind: 'open' };
  const dias = Math.ceil((Number(doc.term_end_ms) - nowMs) / 86_400_000);
  if (dias <= 0) return { kind: staffIsMaster(doc) ? 'held' : 'expired', days: dias };
  if (dias <= 30) return { kind: 'ending', days: dias };
  return { kind: 'active', days: dias };
}

/** Quantas pessoas estão no cargo (cargo ocupado não sai). */
export const roleHolders = (roleId, staff = []) => staff.filter((s) => (s.role_id || s.role) === roleId).length;

/**
 * As federações pelas quais a pessoa vende no Mercado: a loja (`store`) ligada
 * e `admin` ou `finance` no cargo — a mesma conta de `isMarketOperator`
 * na regra. `roles` = documentos de `federation_staff` da pessoa.
 */
export function storeFederations(roles = [], federations = [], nowMs = Date.now()) {
  const porId = new Map(federations.map((f) => [f.id, f]));
  return roles
    .filter((r) => staffHas(r, FED_PERMISSION.ADMIN, nowMs) || staffHas(r, FED_PERMISSION.FINANCE, nowMs))
    .map((r) => porId.get(r.federation_id))
    .filter((f, i, arr) => f && isFederationPublic(f) && fedModuleOn(f, FED_MODULE.STORE) && arr.indexOf(f) === i);
}

/** O acesso de suporte do admin da plataforma ainda vale? */
export const grantActive = (grant, nowMs = Date.now()) => Boolean(grant) && Number(grant.expires_ms) > nowMs;
