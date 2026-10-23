/**
 * LICENÇA DE PROFESSOR e PROTEÇÃO DE MENORES (Bloco 4) — a conta PURA (sem
 * banco) que o servidor usa para conceder, renovar, liberar e mostrar o selo.
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/coachLicenses.js` e
 * `safeguarding.js` (o pacote de Functions é publicado isolado), com paridade
 * em `federationCoaching.parity.test.js`. Os ids são GRAVADOS: nunca renomeie.
 */
const { addMonthsISO, isoDateBR } = require('./federationMembership.js');

/* ------------------------------------------------------------- licença -- */

const LICENSE_STATUS = Object.freeze({ PENDING: 'pending', ACTIVE: 'active', DECLINED: 'declined', SUSPENDED: 'suspended', REVOKED: 'revoked' });
const LICENSE_REQ = Object.freeze({ CREDENTIAL: 'credential', HOURS: 'hours', SAFEGUARDING: 'safeguarding' });
const DEFAULT_COACH_LEVELS = Object.freeze([
  { id: 'l1', label: 'Nível 1', requires_credential: true, update_hours: 8, valid_months: 12 },
  { id: 'l2', label: 'Nível 2', requires_credential: true, update_hours: 12, valid_months: 12 },
  { id: 'l3', label: 'Nível 3', requires_credential: true, update_hours: 16, valid_months: 12 },
]);
const LICENSE_LIMITS = Object.freeze({ LEVELS_MAX: 8, LABEL_MAX: 40, HOURS_MAX: 200, MONTHS_MIN: 1, MONTHS_MAX: 60, NOTE_MAX: 500, REASON_MAX: 300, WAIVER_MIN: 10 });
const LICENSE_WARN_DAYS = 30;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const texto = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const inteiro = (v, min, max, padrao) => { if (v == null || v === '') return padrao; const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
const normLevel = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function addDaysISO(iso, n) {
  if (!ISO.test(String(iso || ''))) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function normalizeCoachRules(raw) {
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

function validateCoachRules(input = {}) {
  const errors = {};
  const brutos = Array.isArray(input.levels) ? input.levels : [];
  if (brutos.length === 0) errors.levels = 'Cadastre pelo menos um nível.';
  else if (brutos.length > LICENSE_LIMITS.LEVELS_MAX) errors.levels = `No máximo ${LICENSE_LIMITS.LEVELS_MAX} níveis.`;
  else if (brutos.some((l) => !slug(l && l.id) || !texto(l && l.label, LICENSE_LIMITS.LABEL_MAX))) errors.levels = 'Todo nível precisa de nome.';
  else if (new Set(brutos.map((l) => slug(l.id))).size !== brutos.length) errors.levels = 'Há dois níveis com o mesmo código.';
  return { ok: Object.keys(errors).length === 0, errors, value: normalizeCoachRules(input) };
}

const coachLevel = (rules, id) => normalizeCoachRules(rules).levels.find((l) => l.id === id) || null;
const credentialMatchesLevel = (cred, level) => Boolean(cred && level) && cred.kind === 'coach' && [normLevel(level.label), level.id].includes(normLevel(cred.level));
const credentialValid = (cred, hoje) => Boolean(cred) && (cred.status || 'active') === 'active' && (!cred.valid_until || String(cred.valid_until) >= hoje);

function hoursLast12Months(entries = [], hoje) {
  const desde = addMonthsISO(hoje, -12);
  return (entries || []).filter((e) => e && ISO.test(String(e.date || '')) && e.date >= desde && e.date <= hoje)
    .reduce((s, e) => s + Math.max(0, Math.trunc(Number(e.hours) || 0)), 0);
}

function licenseRequirements({ rules, levelId, credentials = [], hourEntries = [], safeguarding = {}, hoje } = {}) {
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

function licenseState(lic, hoje) {
  if (!lic) return { status: '', valid: false, expiring: false, canApply: true, renewing: false };
  let status = lic.status || LICENSE_STATUS.PENDING;
  if (status === LICENSE_STATUS.ACTIVE && lic.valid_until && String(lic.valid_until) < hoje) status = 'expired';
  const valid = status === LICENSE_STATUS.ACTIVE;
  const expiring = valid && Boolean(lic.valid_until) && String(lic.valid_until) <= addDaysISO(hoje, LICENSE_WARN_DAYS);
  const renewing = valid && Boolean(lic.renewal_requested_at_ms);
  const canApply = ['declined', 'expired'].includes(status) || (valid && !renewing);
  return { status, valid, expiring, canApply, renewing };
}

function nextValidUntil(lic, level, hoje) {
  const atual = lic && lic.status === LICENSE_STATUS.ACTIVE && lic.valid_until && String(lic.valid_until) >= hoje ? String(lic.valid_until) : hoje;
  return addMonthsISO(atual, (level && level.valid_months) || 12);
}

function badgeOf(lic, fed, hoje) {
  if (!lic || !fed || !licenseState(lic, hoje).valid || lic.public_listing === false) return null;
  if (!(fed.status === 'approved' && fed.published === true)) return null;
  return {
    federation_id: String(fed.id), acronym: texto(fed.acronym || fed.name, 20), name: texto(fed.name, 120), slug: texto(fed.slug, 60),
    level_id: lic.level || '', level_label: texto(lic.level_label, LICENSE_LIMITS.LABEL_MAX), valid_until: lic.valid_until || '',
  };
}

/* ---------------------------------------------------- proteção de menores -- */

const SG_ROLES = Object.freeze(['coach', 'referee', 'director', 'staff', 'ambassador']);
const SG_DEFAULT_REQUIRED = Object.freeze(['coach', 'referee', 'director', 'ambassador']);
const BACKGROUND_STATUS = Object.freeze({ PENDING: 'pending', VALID: 'valid', REJECTED: 'rejected', REVOKED: 'revoked' });
const SG_LIMITS = Object.freeze({ MONTHS_MIN: 1, MONTHS_MAX: 60, MONTHS_DEFAULT: 12, NOTE_MAX: 500, REASON_MIN: 5 });
const SG_FOREVER = '9999-12-31';
const SG_WARN_DAYS = 30;

function normalizeSgRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const required_for = Array.isArray(r.required_for) ? SG_ROLES.filter((x) => r.required_for.includes(x)) : [...SG_DEFAULT_REQUIRED];
  return { required_for, background_months: inteiro(r.background_months, SG_LIMITS.MONTHS_MIN, SG_LIMITS.MONTHS_MAX, SG_LIMITS.MONTHS_DEFAULT) };
}

function validateSgRules(input = {}) {
  const errors = {};
  const m = Number(input.background_months);
  if (input.background_months != null && input.background_months !== '' && (!Number.isInteger(m) || m < SG_LIMITS.MONTHS_MIN || m > SG_LIMITS.MONTHS_MAX)) {
    errors.background_months = `Validade entre ${SG_LIMITS.MONTHS_MIN} e ${SG_LIMITS.MONTHS_MAX} meses.`;
  }
  return { ok: Object.keys(errors).length === 0, errors, value: normalizeSgRules(input) };
}

function sgRequired(federation, role) {
  if (!(federation && federation.modules && federation.modules.safeguarding === true)) return false;
  return normalizeSgRules(federation.safeguarding_rules).required_for.includes(role);
}

function trainingUntil(credentials = [], fedId, hoje) {
  const validas = (credentials || []).filter((c) => c && c.kind === 'safeguarding' && c.federation_id === fedId
    && (c.status || 'active') === 'active' && (!c.valid_until || String(c.valid_until) >= hoje));
  if (!validas.length) return '';
  if (validas.some((c) => !c.valid_until)) return SG_FOREVER;
  return validas.map((c) => String(c.valid_until)).sort().pop();
}

function backgroundState(record, hoje) {
  const b = record && record.background;
  if (!b || !b.status) return { status: '', valid: false, until: '' };
  let status = b.status;
  if (status === BACKGROUND_STATUS.VALID && b.valid_until && String(b.valid_until) < hoje) status = 'expired';
  return { status, valid: status === BACKGROUND_STATUS.VALID, until: status === BACKGROUND_STATUS.VALID ? String(b.valid_until || '') : '' };
}

function clearance({ training = '', record = null, hoje } = {}) {
  const tr = { ok: Boolean(training) && training >= hoje, until: training || '' };
  const bg = backgroundState(record, hoje);
  const ok = tr.ok && bg.valid;
  return { training: tr, background: bg, ok, until: ok ? [tr.until, bg.until].sort()[0] : '' };
}

const clearedOn = (until, hoje) => Boolean(until) && String(until) >= hoje;
const backgroundDefaultUntil = (issuedAt, rules) => addMonthsISO(issuedAt, normalizeSgRules(rules).background_months);

function validateBackgroundSubmit({ issued_at, hoje, rules } = {}) {
  const errors = {};
  if (!ISO.test(String(issued_at || ''))) errors.issued_at = 'Informe a data de emissão da certidão.';
  else if (issued_at > hoje) errors.issued_at = 'A data de emissão não pode ser no futuro.';
  else if (backgroundDefaultUntil(issued_at, rules) < hoje) errors.issued_at = 'Esta certidão já venceu: tire uma nova.';
  return { ok: Object.keys(errors).length === 0, errors };
}

const expiresSoon = (until, hoje) => Boolean(until) && until !== SG_FOREVER && until >= hoje && until <= addDaysISO(hoje, SG_WARN_DAYS);

module.exports = {
  LICENSE_STATUS, LICENSE_REQ, DEFAULT_COACH_LEVELS, LICENSE_LIMITS, LICENSE_WARN_DAYS,
  addDaysISO, isoDateBR, normLevel, normalizeCoachRules, validateCoachRules, coachLevel, credentialMatchesLevel, credentialValid,
  hoursLast12Months, licenseRequirements, licenseState, nextValidUntil, badgeOf,
  SG_ROLES, SG_DEFAULT_REQUIRED, BACKGROUND_STATUS, SG_LIMITS, SG_FOREVER, SG_WARN_DAYS,
  normalizeSgRules, validateSgRules, sgRequired, trainingUntil, backgroundState, clearance, clearedOn, backgroundDefaultUntil, validateBackgroundSubmit, expiresSoon,
};
