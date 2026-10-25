/**
 * PROTEÇÃO DE MENORES DO CLUBE (Bloco E2b) — a conta PURA, no servidor. Cópia de
 * `src/modules/clubs/domain/safeguarding.js` (paridade: `clubSafeguarding.parity.test.js`).
 *
 * A régua da certidão (validade, conferida/revogada, "em dia até") é a MESMA da federação
 * (`federationCoachingPolicy.js`): este arquivo só acrescenta o que é do clube — quem precisa
 * (cargos da diretoria e pessoas designadas), o compromisso de conduta que substitui o curso
 * (o clube não tem curso na plataforma) e o responsável legal do associado menor de idade.
 */
const P = require('./federationCoachingPolicy.js');

/** Quem precisa estar em dia: quem tem cargo na diretoria e quem a disciplina designou (treinador, voluntário). */
const ROLES = Object.freeze(['staff', 'designated']);
const DEFAULT_REQUIRED = Object.freeze(['staff', 'designated']);
const PLEDGE_MAX = 2000;
const LABEL_MAX = 60;

const texto = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const inteiro = (v, min, max, padrao) => { if (v == null || v === '') return padrao; const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };

function normalizeRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    required_for: Array.isArray(r.required_for) ? ROLES.filter((x) => r.required_for.includes(x)) : [...DEFAULT_REQUIRED],
    background_months: inteiro(r.background_months, P.SG_LIMITS.MONTHS_MIN, P.SG_LIMITS.MONTHS_MAX, P.SG_LIMITS.MONTHS_DEFAULT),
    pledge_version: inteiro(r.pledge_version, 1, 1000, 1),
    pledge_text: texto(r.pledge_text, PLEDGE_MAX),
  };
}

function validateRules(input = {}) {
  const errors = {};
  const m = Number(input.background_months);
  if (input.background_months != null && input.background_months !== '' && (!Number.isInteger(m) || m < P.SG_LIMITS.MONTHS_MIN || m > P.SG_LIMITS.MONTHS_MAX)) {
    errors.background_months = `Validade entre ${P.SG_LIMITS.MONTHS_MIN} e ${P.SG_LIMITS.MONTHS_MAX} meses.`;
  }
  return { ok: Object.keys(errors).length === 0, errors, value: normalizeRules(input) };
}

/** O compromisso vale quando a pessoa aceitou a versão em vigor. */
const pledgeOk = (record, rules) => Boolean(record) && Number(record.pledge_version) === normalizeRules(rules).pledge_version;

/** A liberação de hoje: compromisso aceito + certidão conferida (a data é a da certidão). */
function clearance({ record = null, rules, hoje } = {}) {
  const ok = pledgeOk(record, rules);
  return { pledge: { ok }, ...P.clearance({ training: ok ? P.SG_FOREVER : '', record, hoje }) };
}

/** Por que a pessoa precisa estar em dia: cargo na diretoria ou designação. */
function requiredFor({ staff = false, designated = false, rules } = {}) {
  const exigidos = normalizeRules(rules).required_for;
  return (staff && exigidos.includes('staff')) || (designated && exigidos.includes('designated'));
}

/* --------------------------------------------------------------- menores -- */

const MAJORITY = 18;
const GUARDIAN_RELATIONS = Object.freeze(['mother', 'father', 'legal_guardian', 'other']);
const GUARDIAN_LIMITS = Object.freeze({ NAME_MIN: 3, NAME_MAX: 120, NOTE_MAX: 300 });

/** Idade completa em anos (data local ISO `AAAA-MM-DD`); `null` se faltar a data. */
function ageOn(birth, hoje) {
  const a = String(birth || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const h = String(hoje || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!a || !h) return null;
  let idade = Number(h[1]) - Number(a[1]);
  if (Number(h[2]) < Number(a[2]) || (Number(h[2]) === Number(a[2]) && Number(h[3]) < Number(a[3]))) idade -= 1;
  return idade;
}

const isMinor = (birth, hoje) => { const i = ageOn(birth, hoje); return i != null && i >= 0 && i < MAJORITY; };

function validateGuardian(input = {}) {
  const errors = {};
  const name = texto(input.name, GUARDIAN_LIMITS.NAME_MAX);
  if (name.length < GUARDIAN_LIMITS.NAME_MIN) errors.name = 'Informe o nome completo do responsável.';
  const relation = GUARDIAN_RELATIONS.includes(input.relation) ? input.relation : '';
  if (!relation) errors.relation = 'Diga quem é o responsável.';
  const phone = String(input.phone == null ? '' : input.phone).replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 13) errors.phone = 'Informe um telefone com DDD.';
  if (typeof input.consent !== 'boolean') errors.consent = 'Diga se o responsável autoriza a participação.';
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { name, relation, phone, consent: input.consent === true, image_consent: input.image_consent === true, note: texto(input.note, GUARDIAN_LIMITS.NOTE_MAX) },
  };
}

module.exports = {
  ROLES, DEFAULT_REQUIRED, PLEDGE_MAX, LABEL_MAX, MAJORITY, GUARDIAN_RELATIONS, GUARDIAN_LIMITS,
  normalizeRules, validateRules, pledgeOk, clearance, requiredFor, ageOn, isMinor, validateGuardian,
};
