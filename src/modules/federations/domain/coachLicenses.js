/**
 * LICENÇA DE PROFESSOR (módulo `coach_licenses`, Bloco 4) — a conta PURA:
 * os níveis da federação (`federations.coach_rules`), o que cada nível exige
 * (credencial do curso de formação, horas de atualização nos últimos 12 meses
 * e a proteção de menores em dia), a situação da licença hoje e o SELO que
 * vai ao perfil do professor.
 *
 * Quem grava é SÓ o servidor (`functions/federationCoaching.js`); a régua é
 * copiada em `functions/federationCoachingPolicy.js` com paridade em
 * `federationCoaching.parity.test.js`. Os ids (situação, nível padrão,
 * requisito) são GRAVADOS: nunca renomeie.
 */
import { t, tk } from '@/core/i18n';
import { addMonthsISO } from './membership.js';

export const LICENSE_STATUS = Object.freeze({ PENDING: 'pending', ACTIVE: 'active', DECLINED: 'declined', SUSPENDED: 'suspended', REVOKED: 'revoked' });
export const LICENSE_STATUS_LABELS = Object.freeze({
  pending: tk('Pedido em análise'), active: tk('Licenciado'), declined: tk('Pedido recusado'), suspended: tk('Suspensa'), revoked: tk('Cassada'), expired: tk('Vencida'),
});

/** O que um nível pode exigir — `missing[]` guarda estes ids. */
export const LICENSE_REQ = Object.freeze({ CREDENTIAL: 'credential', HOURS: 'hours', SAFEGUARDING: 'safeguarding' });
export const LICENSE_REQ_LABELS = Object.freeze({
  credential: tk('Credencial do curso de formação do nível'),
  hours: tk('Horas de atualização nos últimos 12 meses'),
  safeguarding: tk('Proteção de menores em dia (curso e certidão)'),
});

export const DEFAULT_COACH_LEVELS = Object.freeze([
  { id: 'l1', label: 'Nível 1', requires_credential: true, update_hours: 8, valid_months: 12 },
  { id: 'l2', label: 'Nível 2', requires_credential: true, update_hours: 12, valid_months: 12 },
  { id: 'l3', label: 'Nível 3', requires_credential: true, update_hours: 16, valid_months: 12 },
]);

export const LICENSE_LIMITS = Object.freeze({ LEVELS_MAX: 8, LABEL_MAX: 40, HOURS_MAX: 200, MONTHS_MIN: 1, MONTHS_MAX: 60, NOTE_MAX: 500, REASON_MAX: 300, WAIVER_MIN: 10 });
/** Avisa o professor este tanto de dias antes de a licença vencer. */
export const LICENSE_WARN_DAYS = 30;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const inteiro = (v, min, max, padrao) => { if (v == null || v === '') return padrao; const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
/** Compara nomes de nível sem caixa nem acento ("Nível 1" = "nivel 1"). */
export const normLevel = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Soma dias a uma data ISO (UTC, sem fuso). */
export function addDaysISO(iso, n) {
  if (!ISO.test(String(iso || ''))) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/* --------------------------------------------------------------- régua -- */

/** A régua da federação, sempre completa (sem níveis gravados valem os três padrão). */
export function normalizeCoachRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const vistos = new Set();
  const levels = (Array.isArray(r.levels) ? r.levels : [])
    .map((l) => ({
      id: slug(l && l.id), label: texto(l && l.label, LICENSE_LIMITS.LABEL_MAX), requires_credential: !(l && l.requires_credential === false),
      update_hours: inteiro(l && l.update_hours, 0, LICENSE_LIMITS.HOURS_MAX, 0), valid_months: inteiro(l && l.valid_months, LICENSE_LIMITS.MONTHS_MIN, LICENSE_LIMITS.MONTHS_MAX, 12),
    }))
    .filter((l) => l.id && l.label && !vistos.has(l.id) && vistos.add(l.id))
    .slice(0, LICENSE_LIMITS.LEVELS_MAX);
  return { levels: levels.length ? levels : DEFAULT_COACH_LEVELS.map((l) => ({ ...l })) };
}

/** Valida o que a equipe salva em "Níveis da licença". */
export function validateCoachRules(input = {}) {
  const errors = {};
  const brutos = Array.isArray(input.levels) ? input.levels : [];
  if (brutos.length === 0) errors.levels = t('Cadastre pelo menos um nível.');
  else if (brutos.length > LICENSE_LIMITS.LEVELS_MAX) errors.levels = t('No máximo {n} níveis.', { n: LICENSE_LIMITS.LEVELS_MAX });
  else if (brutos.some((l) => !slug(l && l.id) || !texto(l && l.label, LICENSE_LIMITS.LABEL_MAX))) errors.levels = t('Todo nível precisa de nome.');
  else if (new Set(brutos.map((l) => slug(l.id))).size !== brutos.length) errors.levels = t('Há dois níveis com o mesmo código.');
  return { ok: Object.keys(errors).length === 0, errors, value: normalizeCoachRules(input) };
}

export const coachLevel = (rules, id) => normalizeCoachRules(rules).levels.find((l) => l.id === id) || null;

/* ---------------------------------------------------------- requisitos -- */

/** A credencial é do curso de formação DESTE nível (pelo nome ou pelo código do nível)? */
export const credentialMatchesLevel = (cred, level) => Boolean(cred && level) && cred.kind === 'coach'
  && [normLevel(level.label), level.id].includes(normLevel(cred.level));

/** Credencial válida hoje (ativa e sem vencer). */
export const credentialValid = (cred, hoje) => Boolean(cred) && (cred.status || 'active') === 'active' && (!cred.valid_until || String(cred.valid_until) >= hoje);

/** Horas de atualização nos últimos 12 meses: `entries` = `[{ date: 'AAAA-MM-DD', hours }]` (cursos aprovados). */
export function hoursLast12Months(entries = [], hoje) {
  const desde = addMonthsISO(hoje, -12);
  return (entries || []).filter((e) => e && ISO.test(String(e.date || '')) && e.date >= desde && e.date <= hoje)
    .reduce((s, e) => s + Math.max(0, Math.trunc(Number(e.hours) || 0)), 0);
}

/**
 * O que falta para conceder (ou renovar) a licença do nível.
 * `safeguarding`: `{ required, until }` — `until` é até quando a proteção de
 * menores vale ('' = não está em dia). A falta de proteção NUNCA é dispensável;
 * as demais, com motivo escrito (`waivable`).
 */
export function licenseRequirements({ rules, levelId, credentials = [], hourEntries = [], safeguarding = {}, hoje } = {}) {
  const level = coachLevel(rules, levelId);
  if (!level) return { level: null, ok: false, missing: [], waivable: [], credential: null, hours: null, safeguarding: null };
  const cred = (credentials || []).filter((c) => credentialMatchesLevel(c, level) && credentialValid(c, hoje))
    .sort((a, b) => String(b.valid_until || '9999').localeCompare(String(a.valid_until || '9999')))[0] || null;
  const done = hoursLast12Months(hourEntries, hoje);
  const sgReq = safeguarding.required === true;
  const sgOk = !sgReq || (Boolean(safeguarding.until) && String(safeguarding.until) >= hoje);
  const out = {
    level,
    credential: { required: level.requires_credential, ok: !level.requires_credential || Boolean(cred), found: cred ? { id: cred.id || '', course_name: cred.course_name || '', valid_until: cred.valid_until || '' } : null },
    hours: { needed: level.update_hours, done, ok: done >= level.update_hours },
    safeguarding: { required: sgReq, ok: sgOk, until: safeguarding.until || '' },
  };
  const missing = [
    !out.credential.ok && LICENSE_REQ.CREDENTIAL,
    !out.hours.ok && LICENSE_REQ.HOURS,
    !out.safeguarding.ok && LICENSE_REQ.SAFEGUARDING,
  ].filter(Boolean);
  return { ...out, missing, waivable: missing.filter((x) => x !== LICENSE_REQ.SAFEGUARDING), ok: missing.length === 0 };
}

/* ------------------------------------------------------------ situação -- */

/**
 * A licença HOJE: `active` vencida pela data vira `expired`; `expiring` = vence
 * em até 30 dias; `canApply` = o professor pode pedir (sem licença, recusada ou
 * vencida) ou pedir a renovação (ativa vencendo, sem pedido em aberto).
 */
export function licenseState(lic, hoje) {
  if (!lic) return { status: '', valid: false, expiring: false, canApply: true, renewing: false };
  let status = lic.status || LICENSE_STATUS.PENDING;
  if (status === LICENSE_STATUS.ACTIVE && lic.valid_until && String(lic.valid_until) < hoje) status = 'expired';
  const valid = status === LICENSE_STATUS.ACTIVE;
  const expiring = valid && Boolean(lic.valid_until) && String(lic.valid_until) <= addDaysISO(hoje, LICENSE_WARN_DAYS);
  const renewing = valid && Boolean(lic.renewal_requested_at_ms);
  const canApply = ['declined', 'expired'].includes(status) || (valid && !renewing);
  return { status, valid, expiring, canApply, renewing };
}

/** A nova validade: renovar antes de vencer soma a partir do vencimento; vencida, a partir de hoje. */
export function nextValidUntil(lic, level, hoje) {
  const atual = lic && lic.status === LICENSE_STATUS.ACTIVE && lic.valid_until && String(lic.valid_until) >= hoje ? String(lic.valid_until) : hoje;
  return addMonthsISO(atual, (level && level.valid_months) || 12);
}

/* ---------------------------------------------------------------- selo -- */

/**
 * O selo de UMA licença no perfil do professor: só licenciado, válido, que o
 * professor deixou aparecer, de federação publicada.
 */
export function badgeOf(lic, fed, hoje) {
  if (!lic || !fed || !licenseState(lic, hoje).valid || lic.public_listing === false) return null;
  if (!(fed.status === 'approved' && fed.published === true)) return null;
  return {
    federation_id: String(fed.id), acronym: texto(fed.acronym || fed.name, 20), name: texto(fed.name, 120), slug: texto(fed.slug, 60),
    level_id: lic.level || '', level_label: texto(lic.level_label, LICENSE_LIMITS.LABEL_MAX), valid_until: lic.valid_until || '',
  };
}

/** Os selos que a tela mostra: só os que ainda valem hoje (o servidor tira os vencidos na varredura). */
export const visibleBadges = (doc, hoje) => ((doc && Array.isArray(doc.badges)) ? doc.badges : []).filter((b) => b && (!b.valid_until || b.valid_until >= hoje));

/* ----------------------------------------------------------- pendências -- */

/** Pedidos de licença esperando a equipe (fonte que falhou ⇒ `undefined`, nunca zero). */
export const pendingLicenseRequests = (licenses) => (Array.isArray(licenses)
  ? licenses.filter((l) => l.status === LICENSE_STATUS.PENDING || (l.status === LICENSE_STATUS.ACTIVE && l.renewal_requested_at_ms)).length : undefined);

/** Ordem da lista da equipe: pedidos primeiro, depois vencendo, depois por nome. */
export function sortLicenses(list = [], hoje) {
  const peso = (l) => { const s = licenseState(l, hoje); if (l.status === 'pending' || s.renewing) return 0; if (s.expiring) return 1; if (s.valid) return 2; return 3; };
  return [...list].sort((a, b) => peso(a) - peso(b) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}
