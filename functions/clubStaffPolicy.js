/**
 * Diretoria do clube — a conta PURA (sem banco): cargo → permissões, mandato,
 * cargo master e quem pode mexer em quem.
 *
 * ⚠️ CÓPIA de `src/modules/clubs/domain/staff.js` (o pacote de Functions é
 * publicado isolado), com paridade em `clubStaff.parity.test.js`. A regra do
 * Firestore tem a mesma conta em `cxPerms`/`cxHas`.
 *
 * Diferença para a federação: quem ADMINISTRA o clube (`club_members.role ==
 * 'admin'`) já é o "master" por natureza — o servidor o trata como tal; o
 * cargo master (Presidente) é um espelho disso para quem a administração
 * nomeia. A pessoa só tem poder de cargo enquanto é MEMBRO do clube.
 */
const ALL = Object.freeze(['admin', 'members', 'finance', 'comms', 'docs', 'sports', 'discipline', 'fiscal', 'staff']);

const TERM_MAX_MONTHS = 48;
const ROLES_MAX = 30;

/** Os modelos de cargo — nome e descrição iguais aos do cliente (a tela traduz). */
const DEFAULT_ROLES = Object.freeze([
  ['president', 'Presidente', 'Tudo: gestão do clube, inclusive montar os cargos e passar a presidência.', ALL, true, TERM_MAX_MONTHS],
  ['vice', 'Vice-presidente', 'Quase tudo: menos montar os cargos e mexer no cargo de presidente.', ALL.filter((p) => p !== 'admin'), false, TERM_MAX_MONTHS],
  ['secretary', 'Secretaria', 'Associados e documentos: aprova pedidos e filia pessoas.', ['members', 'docs'], false, 0],
  ['treasurer', 'Tesouraria', 'Cobranças: confirma pagamentos e vê o financeiro.', ['finance'], false, 0],
  ['sports', 'Esportes', 'Seleção do clube, torneios e ranking.', ['sports'], false, 0],
  ['discipline', 'Disciplina', 'Sanções e ouvidoria.', ['discipline'], false, 0],
  ['communication', 'Comunicação', 'Avisos, notícias, cupons e patrocínios.', ['comms'], false, 0],
  ['fiscal_council', 'Conselho fiscal', 'Lê as contas e dá o parecer sobre a prestação de contas.', ['fiscal'], false, 0],
].map(([id, name, description, perms, is_master, term_months]) => Object.freeze({ id, name, description, perms: [...perms], is_master, term_months })));

/** Os cargos do clube: os que a presidência montou, ou os modelos. */
const effectiveRoles = (lista) => (Array.isArray(lista) && lista.length ? lista : DEFAULT_ROLES);
const isMaster = (doc) => Boolean(doc) && (doc.is_master !== undefined && doc.is_master !== null ? Boolean(doc.is_master) : doc.role === 'president');

function termActive(doc, now) {
  if (!doc) return false;
  // Sem exceção para o cargo master: o clube sempre tem quem o administre (`club_members.role == 'admin'`).
  return !doc.term_end_ms || Number(doc.term_end_ms) > now;
}

function permsOf(doc, now) {
  if (!termActive(doc, now)) return [];
  if (isMaster(doc)) return [...ALL];
  return [...(Array.isArray(doc.perms) ? doc.perms : [])].filter((p) => ALL.includes(p));
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

const ID = /^[a-z0-9][a-z0-9_-]{1,39}$/;

function validateRole(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const is_master = input.is_master === true;
  // "Tudo" (admin) é só do cargo master: o cargo comum escolhe áreas, nunca a administração inteira.
  const perms = is_master ? [...ALL] : [...new Set((input.perms || []).filter((p) => ALL.includes(p) && p !== 'admin'))];
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

module.exports = {
  ALL, TERM_MAX_MONTHS, ROLES_MAX, DEFAULT_ROLES,
  effectiveRoles, isMaster, termActive, permsOf, allowed, validateRole, validateTerm,
};
