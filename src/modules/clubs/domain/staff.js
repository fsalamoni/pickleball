/**
 * Diretoria do clube: CARGOS (que cada clube monta) → permissões, com MANDATO
 * e cargo MASTER (presidência).
 *
 * - Os cargos moram em `club_x/{clube}/roles/list` (`{ roles: [...] }`); sem
 *   eles valem os oito modelos (`DEFAULT_CLUB_ROLES`).
 * - A pessoa na diretoria (`club_x/{clube}/staff/{uid}`) leva a CÓPIA das
 *   permissões do cargo (`perms`), o mandato e `is_master`. Mandato vencido não
 *   dá permissão — na regra (`cxPerms`), no servidor (`functions/clubStaff.js`,
 *   com paridade) e aqui. Quem ADMINISTRA o clube já é master por natureza.
 * - Quem grava é SÓ o servidor (`clubStaff`); estas contas dizem antes, na tela.
 *
 * ⚠️ A conta pura tem cópia em `functions/clubStaffPolicy.js` (paridade em
 * `functions/clubStaff.parity.test.js`).
 */
import { t, tk } from '@/core/i18n';
import { ALL_CLUB_PERMS } from './association.js';

export const STAFF_ROLES_MAX = 30;
export const STAFF_TERM_MAX_MONTHS = 48;

const MODELOS = [
  ['president', tk('Presidente'), tk('Tudo: gestão do clube, inclusive montar os cargos e passar a presidência.'), [...ALL_CLUB_PERMS], true, STAFF_TERM_MAX_MONTHS],
  ['vice', tk('Vice-presidente'), tk('Quase tudo: menos montar os cargos e mexer no cargo de presidente.'), ALL_CLUB_PERMS.filter((p) => p !== 'admin'), false, STAFF_TERM_MAX_MONTHS],
  ['secretary', tk('Secretaria'), tk('Associados e documentos: aprova pedidos e filia pessoas.'), ['members', 'docs'], false, 0],
  ['treasurer', tk('Tesouraria'), tk('Cobranças: confirma pagamentos e vê o financeiro.'), ['finance'], false, 0],
  ['sports', tk('Esportes'), tk('Seleção do clube, torneios e ranking.'), ['sports'], false, 0],
  ['discipline', tk('Disciplina'), tk('Sanções e ouvidoria.'), ['discipline'], false, 0],
  ['communication', tk('Comunicação'), tk('Avisos, notícias, cupons e patrocínios.'), ['comms'], false, 0],
  ['fiscal_council', tk('Conselho fiscal'), tk('Lê as contas e dá o parecer sobre a prestação de contas.'), ['fiscal'], false, 0],
];

/** Os oito modelos — os cargos de quem ainda não montou os seus. */
export const DEFAULT_CLUB_ROLES = Object.freeze(MODELOS.map(([id, name, description, perms, is_master, term_months]) => Object.freeze({ id, name, description, perms, is_master, term_months })));
const MODELO = Object.fromEntries(DEFAULT_CLUB_ROLES.map((r) => [r.id, r]));

/** O que cada permissão abre — o texto ao lado de cada interruptor do cargo. */
export const CLUB_PERM_HINTS = Object.freeze({
  members: tk('Aprova pedidos, filia, suspende e importa associados; emite declarações.'),
  finance: tk('Confirma pagamentos, vê as cobranças, os indicadores e cria planos.'),
  comms: tk('Avisos, notícias, cupons e patrocínios.'),
  docs: tk('Atas, estatuto e documentos oficiais.'),
  sports: tk('Seleção do clube, torneios e ranking.'),
  discipline: tk('Sanções e ouvidoria.'),
  fiscal: tk('Lê as contas e dá o parecer sobre a prestação de contas.'),
  staff: tk('Nomeia a diretoria e prorroga mandatos.'),
});

/** Os cargos do clube: os que a presidência montou, ou os modelos. */
export const effectiveRoles = (lista) => (Array.isArray(lista) && lista.length ? lista : DEFAULT_CLUB_ROLES);

export const roleById = (lista, id) => effectiveRoles(lista).find((r) => r.id === id) || null;

/** O nome/descrição do modelo se traduz; o que a presidência escreveu aparece como está. */
export const roleLabel = (role) => (role && MODELO[role.id] && role.name === MODELO[role.id].name ? t(role.name) : role?.name || '');
export const roleDescription = (role) => (role && MODELO[role.id] && role.description === MODELO[role.id].description ? t(role.description) : role?.description || '');

export const staffIsMaster = (doc) => Boolean(doc) && (doc.is_master ?? doc.role === 'president');

export const staffTermActive = (doc, nowMs = Date.now()) => Boolean(doc) && (!doc.term_end_ms || Number(doc.term_end_ms) > nowMs);

export function staffPerms(doc, nowMs = Date.now()) {
  if (!staffTermActive(doc, nowMs)) return [];
  if (staffIsMaster(doc)) return [...ALL_CLUB_PERMS];
  return (Array.isArray(doc.perms) ? doc.perms : []).filter((p) => ALL_CLUB_PERMS.includes(p));
}

/** Mesma regra de `allowed` no servidor: quem pode nomear/prorrogar/tirar quem. */
export function staffActionAllowed({ actor, target = null, role = null, nowMs = Date.now() }) {
  if (!actor) return false;
  if (staffIsMaster(actor) && staffTermActive(actor, nowMs)) return true;
  const minhas = staffPerms(actor, nowMs);
  if (!minhas.includes('staff') || staffIsMaster(target) || Boolean(role && role.is_master)) return false;
  if (target && target.user_id === actor.user_id) return false;
  return !role || role.perms.every((p) => minhas.includes(p));
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** O mandato: início obrigatório, fim opcional (sem prazo) e depois do início. Mais de 4 anos vira alerta. */
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

/** Um cargo do clube. */
export function validateStaffRole(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  const description = String(input.description || '').trim();
  const is_master = input.is_master === true;
  // "Tudo" (admin) é só do cargo master: o cargo comum escolhe áreas, nunca a administração inteira.
  const perms = is_master ? [...ALL_CLUB_PERMS] : [...new Set((input.perms || []).filter((p) => ALL_CLUB_PERMS.includes(p) && p !== 'admin'))];
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
  if (dias <= 0) return { kind: 'expired', days: dias };
  if (dias <= 30) return { kind: 'ending', days: dias };
  return { kind: 'active', days: dias };
}

/** Quantas pessoas estão no cargo (cargo ocupado não sai). */
export const roleHolders = (roleId, staff = []) => staff.filter((s) => (s.role_id || s.role) === roleId).length;

/** O papel de quem abre a Central, na visão de `staffActionAllowed`: administrador do clube = master. */
export const actorOf = ({ isClubAdmin, uid, staffDoc }) => (isClubAdmin ? { user_id: uid, is_master: true, perms: [...ALL_CLUB_PERMS] } : staffDoc || null);
