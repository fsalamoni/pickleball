/**
 * Equipe da federação — a conta PURA (sem banco): cargo → permissões,
 * mandato, admin master e quem pode mexer em quem.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/staff.js` (o pacote de
 * Functions é publicado isolado), com paridade em
 * `federationStaff.parity.test.js`. A regra do Firestore tem a mesma conta
 * em `fedPerms`/`fedRolePerms`.
 */
const ALL = Object.freeze(['admin', 'members', 'finance', 'competitions', 'courses', 'discipline', 'comms', 'docs', 'staff', 'fiscal']);

/** Papel antigo → permissões (documento sem `perms`). */
const PERMS = Object.freeze({
  president: ALL, director: ALL,
  secretary: ['members', 'docs'], treasurer: ['finance'], competitions: ['competitions'], referees: ['courses'],
  discipline: ['discipline'], communication: ['comms'], fiscal_council: ['fiscal'],
});

const TERM_MAX_MONTHS = 48;
const ROLES_MAX = 30;

/** Os oito modelos — nome e descrição iguais aos do cliente (a tela traduz). */
const DEFAULT_ROLES = Object.freeze([
  ['president', 'Presidente', 'Admin master: tudo, inclusive montar os cargos e passar a administração.'],
  ['director', 'Diretor(a)', 'Tudo na Central, menos montar os cargos e mexer nos admins master.'],
  ['secretary', 'Secretaria', 'Filiados e acervo: aprova filiações e publica atos, atas e editais.'],
  ['treasurer', 'Financeiro', 'Cobranças: confirma pagamentos e vê o financeiro.'],
  ['competitions', 'Competições', 'Chancela de torneios, calendário e ranking oficial.'],
  ['referees', 'Arbitragem e cursos', 'Cursos, árbitros e credenciais.'],
  ['discipline', 'Disciplina', 'Sanções e ouvidoria.'],
  ['communication', 'Comunicação', 'Avisos, notícias, cupons e campanhas.'],
  ['fiscal_council', 'Conselho fiscal', 'Lê o orçamento e as contas e dá o parecer sobre a prestação de contas.'],
].map(([id, name, description]) => Object.freeze({
  id, name, description, perms: [...PERMS[id]], is_master: id === 'president',
  term_months: id === 'president' || id === 'director' ? TERM_MAX_MONTHS : 0,
})));

const effectiveRoles = (fed) => (Array.isArray(fed && fed.staff_roles) && fed.staff_roles.length ? fed.staff_roles : DEFAULT_ROLES);
const isMaster = (doc) => Boolean(doc) && (doc.is_master !== undefined && doc.is_master !== null ? Boolean(doc.is_master) : doc.role === 'president');

function termActive(doc, now) {
  if (!doc) return false;
  if (isMaster(doc)) return true;
  return !doc.term_end_ms || Number(doc.term_end_ms) > now;
}

function permsOf(doc, now) {
  if (!termActive(doc, now)) return [];
  return [...(Array.isArray(doc.perms) ? doc.perms : (PERMS[doc.role] || []))];
}

/** Mesma regra de `staffActionAllowed` no cliente. */
function allowed({ actor, target = null, role = null, now }) {
  if (!actor) return false;
  if (isMaster(actor) && termActive(actor, now)) return true;
  if (!permsOf(actor, now).includes('staff') || isMaster(target) || Boolean(role && role.is_master)) return false;
  if (target && target.user_id === actor.user_id) return false;
  const minhas = permsOf(actor, now);
  return !role || role.perms.every((p) => minhas.includes(p));
}

const isLastMaster = (target, staff) => isMaster(target) && staff.filter((s) => isMaster(s) && s.user_id !== target.user_id).length === 0;

const ID = /^[a-z0-9][a-z0-9_-]{1,39}$/;

function validateRole(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const is_master = input.is_master === true;
  const perms = is_master ? [...ALL] : [...new Set((input.perms || []).filter((p) => ALL.includes(p)))];
  const term_months = Math.round(Number(input.term_months) || 0);
  if (input.id && !ID.test(String(input.id))) errors.id = 'Identificador inválido.';
  if (name.length < 2 || name.length > 60) errors.name = 'Dê um nome de 2 a 60 letras.';
  if (description.length > 300) errors.description = 'Até 300 letras.';
  if (!perms.length) errors.perms = 'Escolha ao menos uma permissão.';
  if (term_months < 0 || term_months > 120) errors.term_months = 'De 0 (sem prazo) a 120 meses.';
  return { ok: !Object.keys(errors).length, errors, value: { ...(input.id ? { id: String(input.id) } : {}), name, description, perms, is_master, term_months } };
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function validateTerm({ term_start = '', term_end = '' } = {}) {
  const errors = {};
  if (!DATA.test(String(term_start))) errors.term_start = 'Informe o início do mandato.';
  if (term_end && !DATA.test(String(term_end))) errors.term_end = 'Data inválida.';
  else if (term_end && term_start && term_end < term_start) errors.term_end = 'O fim vem depois do início.';
  return { ok: !Object.keys(errors).length, errors };
}

const grantActive = (grant, now) => Boolean(grant) && Number(grant.expires_ms) > now;

module.exports = {
  ALL, PERMS, TERM_MAX_MONTHS, ROLES_MAX, DEFAULT_ROLES,
  effectiveRoles, isMaster, termActive, permsOf, allowed, isLastMaster, validateRole, validateTerm, grantActive,
};
