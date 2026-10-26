/**
 * PROTEÇÃO DE MENORES DO CLUBE-ASSOCIAÇÃO (Bloco E2b) — a conta PURA: quem precisa estar em dia
 * (cargos da diretoria e pessoas designadas), o compromisso de conduta aceito, a certidão de
 * antecedentes conferida e o responsável legal do associado menor de idade.
 *
 * Quem grava é SÓ o servidor (`functions/clubSafeguarding.js`); cópia em
 * `functions/clubSafeguardingPolicy.js` com paridade (`clubSafeguarding.parity.test.js`). A régua
 * da certidão (validade, conferida/revogada) é a da federação (`federations/domain/safeguarding.js`):
 * no clube o compromisso aceito ocupa o lugar do curso. Ids gravados: nunca renomeie.
 */
import { t, tk } from '@/core/i18n';
import { SG_FOREVER, SG_LIMITS, clearance as clearanceBase } from '@/modules/federations/domain/safeguarding.js';

export { SG_FOREVER, SG_LIMITS };

/** Quem precisa estar em dia: quem tem cargo na diretoria e quem a disciplina designou (treinador, voluntário). */
export const CLUB_SG_ROLES = Object.freeze(['staff', 'designated']);
export const CLUB_SG_DEFAULT_REQUIRED = Object.freeze(['staff', 'designated']);
export const CLUB_SG_ROLE_LABELS = Object.freeze({ staff: tk('Diretoria e cargos'), designated: tk('Treinadores e voluntários designados') });
export const CLUB_SG_ROLE_SHORT = Object.freeze({ staff: tk('Diretoria'), designated: tk('Designado') });
export const CLUB_SG_PLEDGE_MAX = 2000;
export const CLUB_SG_LABEL_MAX = 60;

const texto = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const inteiro = (v, min, max, padrao) => { if (v == null || v === '') return padrao; const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };

export function normalizeClubSgRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    required_for: Array.isArray(r.required_for) ? CLUB_SG_ROLES.filter((x) => r.required_for.includes(x)) : [...CLUB_SG_DEFAULT_REQUIRED],
    background_months: inteiro(r.background_months, SG_LIMITS.MONTHS_MIN, SG_LIMITS.MONTHS_MAX, SG_LIMITS.MONTHS_DEFAULT),
    pledge_version: inteiro(r.pledge_version, 1, 1000, 1),
    pledge_text: texto(r.pledge_text, CLUB_SG_PLEDGE_MAX),
  };
}

export function validateClubSgRules(input = {}) {
  const errors = {};
  const m = Number(input.background_months);
  if (input.background_months != null && input.background_months !== '' && (!Number.isInteger(m) || m < SG_LIMITS.MONTHS_MIN || m > SG_LIMITS.MONTHS_MAX)) {
    errors.background_months = t('Validade entre {min} e {max} meses.', { min: SG_LIMITS.MONTHS_MIN, max: SG_LIMITS.MONTHS_MAX });
  }
  return { ok: Object.keys(errors).length === 0, errors, value: normalizeClubSgRules(input) };
}

/** O compromisso vale quando a pessoa aceitou a versão em vigor. */
export const clubPledgeOk = (record, rules) => Boolean(record) && Number(record.pledge_version) === normalizeClubSgRules(rules).pledge_version;

/** A liberação de hoje: compromisso aceito + certidão conferida. */
export function clubClearance({ record = null, rules, hoje } = {}) {
  const ok = clubPledgeOk(record, rules);
  return { pledge: { ok }, ...clearanceBase({ training: ok ? SG_FOREVER : '', record, hoje }) };
}

/** Por que a pessoa precisa estar em dia: cargo na diretoria ou designação. */
export function clubSgRequiredFor({ staff = false, designated = false, rules } = {}) {
  const exigidos = normalizeClubSgRules(rules).required_for;
  return (staff && exigidos.includes('staff')) || (designated && exigidos.includes('designated'));
}

/** O texto-padrão do compromisso, quando o clube não escreveu o seu. */
export const defaultPledgeText = () => t('Eu me comprometo a: tratar toda criança e todo adolescente com respeito; nunca ficar a sós com um menor fora da vista de outros adultos; não trocar mensagens privadas com menores sem o conhecimento do responsável; não aplicar castigo físico nem humilhar; e comunicar à diretoria qualquer suspeita de violência, abuso ou negligência.');

/* --------------------------------------------------------------- menores -- */

export const MAJORITY = 18;
export const GUARDIAN_RELATIONS = Object.freeze(['mother', 'father', 'legal_guardian', 'other']);
export const GUARDIAN_RELATION_LABELS = Object.freeze({ mother: tk('Mãe'), father: tk('Pai'), legal_guardian: tk('Tutor ou guardião legal'), other: tk('Outro responsável') });
export const GUARDIAN_LIMITS = Object.freeze({ NAME_MIN: 3, NAME_MAX: 120, NOTE_MAX: 300 });

/** Idade completa em anos (data ISO `AAAA-MM-DD`); `null` se faltar a data. */
export function ageOn(birth, hoje) {
  const a = String(birth || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const h = String(hoje || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!a || !h) return null;
  let idade = Number(h[1]) - Number(a[1]);
  if (Number(h[2]) < Number(a[2]) || (Number(h[2]) === Number(a[2]) && Number(h[3]) < Number(a[3]))) idade -= 1;
  return idade;
}

export const isMinor = (birth, hoje) => { const i = ageOn(birth, hoje); return i != null && i >= 0 && i < MAJORITY; };

export function validateGuardian(input = {}) {
  const errors = {};
  const name = texto(input.name, GUARDIAN_LIMITS.NAME_MAX);
  if (name.length < GUARDIAN_LIMITS.NAME_MIN) errors.name = t('Informe o nome completo do responsável.');
  const relation = GUARDIAN_RELATIONS.includes(input.relation) ? input.relation : '';
  if (!relation) errors.relation = t('Diga quem é o responsável.');
  const phone = String(input.phone == null ? '' : input.phone).replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 13) errors.phone = t('Informe um telefone com DDD.');
  if (typeof input.consent !== 'boolean') errors.consent = t('Diga se o responsável autoriza a participação.');
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { name, relation, phone, consent: input.consent === true, image_consent: input.image_consent === true, note: texto(input.note, GUARDIAN_LIMITS.NOTE_MAX) },
  };
}

/** Caminho da certidão no Storage: `clube-protecao/{uid}/{id}.{ext}` — o uid de quem envia é a pasta (a exclusão de conta apaga). */
export function certidaoStoragePath(uid, id, contentType) {
  const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType] || 'bin';
  return `clube-protecao/${uid}/${id}.${ext}`;
}

/** Quantos responsáveis faltam entre os associados menores (`undefined` = a fonte não carregou). */
export const minorsWithoutGuardian = (rows) => (Array.isArray(rows) ? rows.filter((r) => !r.guardian).length : undefined);
