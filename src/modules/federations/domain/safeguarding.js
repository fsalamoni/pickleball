/**
 * PROTEÇÃO DE MENORES (módulo `safeguarding`, Bloco 4, no modelo
 * SafeSport/Safe Play) — a conta PURA: quem precisa estar em dia
 * (`federations.safeguarding_rules.required_for`), o curso de proteção válido
 * (credencial de curso `safeguarding`), a certidão de antecedentes conferida
 * e a data até quando a pessoa está liberada para trabalhar com menores.
 *
 * Quem grava é SÓ o servidor (`functions/federationCoaching.js`); cópia em
 * `functions/federationCoachingPolicy.js` com paridade. A federação guarda a
 * CONFERÊNCIA da certidão (data, validade, quem conferiu) — o arquivo é apagado
 * quando a conferência é registrada. A certidão enviada espera em
 * `pending_background`; `background` é sempre a última CONFERIDA (`valid` ou
 * `revoked`). Ids gravados: nunca renomeie.
 */
import { t, tk } from '@/core/i18n';
import { addMonthsISO } from './membership.js';
import { addDaysISO } from './coachLicenses.js';

/** Quem trabalha com menores. */
export const SG_ROLE = Object.freeze({ COACH: 'coach', REFEREE: 'referee', DIRECTOR: 'director', STAFF: 'staff' });
export const SG_ROLES = Object.freeze(Object.values(SG_ROLE));
export const SG_ROLE_LABELS = Object.freeze({
  coach: tk('Professores licenciados'), referee: tk('Árbitros do quadro'), director: tk('Diretores de torneio'), staff: tk('Equipe da federação'),
});
export const SG_ROLE_SHORT = Object.freeze({ coach: tk('Professor'), referee: tk('Árbitro'), director: tk('Diretor de torneio'), staff: tk('Equipe') });
export const SG_DEFAULT_REQUIRED = Object.freeze(['coach', 'referee', 'director']);

export const BACKGROUND_STATUS = Object.freeze({ PENDING: 'pending', VALID: 'valid', REJECTED: 'rejected', REVOKED: 'revoked' });
export const BACKGROUND_STATUS_LABELS = Object.freeze({
  pending: tk('Certidão em conferência'), valid: tk('Certidão conferida'), rejected: tk('Certidão não aceita'), revoked: tk('Certidão revogada'), expired: tk('Certidão vencida'),
});

export const SG_LIMITS = Object.freeze({ MONTHS_MIN: 1, MONTHS_MAX: 60, MONTHS_DEFAULT: 12, NOTE_MAX: 500, REASON_MIN: 5 });
/** Data "sem validade" (curso de proteção sem vencimento). */
export const SG_FOREVER = '9999-12-31';
export const SG_WARN_DAYS = 30;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const inteiro = (v, min, max, padrao) => { if (v == null || v === '') return padrao; const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };

/** A régua da federação, sempre completa. Sem nada gravado: professor, árbitro e diretor; certidão vale 12 meses. */
export function normalizeSgRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const required_for = Array.isArray(r.required_for) ? SG_ROLES.filter((x) => r.required_for.includes(x)) : [...SG_DEFAULT_REQUIRED];
  return { required_for, background_months: inteiro(r.background_months, SG_LIMITS.MONTHS_MIN, SG_LIMITS.MONTHS_MAX, SG_LIMITS.MONTHS_DEFAULT) };
}

export function validateSgRules(input = {}) {
  const errors = {};
  const m = Number(input.background_months);
  if (input.background_months != null && input.background_months !== '' && (!Number.isInteger(m) || m < SG_LIMITS.MONTHS_MIN || m > SG_LIMITS.MONTHS_MAX)) {
    errors.background_months = t('Validade entre {min} e {max} meses.', { min: SG_LIMITS.MONTHS_MIN, max: SG_LIMITS.MONTHS_MAX });
  }
  return { ok: Object.keys(errors).length === 0, errors, value: normalizeSgRules(input) };
}

/** A federação exige a proteção para este papel? (Só com o módulo ligado.) */
export function sgRequired(federation, role) {
  if (!(federation && federation.modules && federation.modules.safeguarding === true)) return false;
  return normalizeSgRules(federation.safeguarding_rules).required_for.includes(role);
}

/** Até quando o CURSO de proteção vale (credenciais `safeguarding` válidas desta federação); '' = nenhum. */
export function trainingUntil(credentials = [], fedId, hoje) {
  const validas = (credentials || []).filter((c) => c && c.kind === 'safeguarding' && c.federation_id === fedId
    && (c.status || 'active') === 'active' && (!c.valid_until || String(c.valid_until) >= hoje));
  if (!validas.length) return '';
  if (validas.some((c) => !c.valid_until)) return SG_FOREVER;
  return validas.map((c) => String(c.valid_until)).sort().pop();
}

/** A certidão HOJE: `valid` vencida pela data vira `expired`. */
export function backgroundState(record, hoje) {
  const b = record && record.background;
  if (!b || !b.status) return { status: '', valid: false, until: '' };
  let status = b.status;
  if (status === BACKGROUND_STATUS.VALID && b.valid_until && String(b.valid_until) < hoje) status = 'expired';
  return { status, valid: status === BACKGROUND_STATUS.VALID, until: status === BACKGROUND_STATUS.VALID ? String(b.valid_until || '') : '' };
}

/**
 * A pessoa está liberada para trabalhar com menores? Precisa dos DOIS: curso
 * válido e certidão conferida e válida. `until` = o menor dos dois vencimentos
 * ('' = não está em dia).
 */
export function clearance({ training = '', record = null, hoje } = {}) {
  const tr = { ok: Boolean(training) && training >= hoje, until: training || '' };
  const bg = backgroundState(record, hoje);
  const ok = tr.ok && bg.valid;
  return { training: tr, background: bg, ok, until: ok ? [tr.until, bg.until].sort()[0] : '' };
}

/** A data snapshot (`safeguarding_until`) ainda vale hoje? */
export const clearedOn = (until, hoje) => Boolean(until) && String(until) >= hoje;

/** A validade padrão da certidão: a data em que foi emitida + os meses da régua. */
export const backgroundDefaultUntil = (issuedAt, rules) => addMonthsISO(issuedAt, normalizeSgRules(rules).background_months);

/** Confere a certidão enviada: data de emissão válida, não futura e ainda dentro da validade. */
export function validateBackgroundSubmit({ issued_at, hoje, rules } = {}) {
  const errors = {};
  if (!ISO.test(String(issued_at || ''))) errors.issued_at = t('Informe a data de emissão da certidão.');
  else if (issued_at > hoje) errors.issued_at = t('A data de emissão não pode ser no futuro.');
  else if (backgroundDefaultUntil(issued_at, rules) < hoje) errors.issued_at = t('Esta certidão já venceu: tire uma nova.');
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Vence em até 30 dias? */
export const expiresSoon = (until, hoje) => Boolean(until) && until !== SG_FOREVER && until >= hoje && until <= addDaysISO(hoje, SG_WARN_DAYS);

/**
 * A lista da Central (`sg_overview`): quem precisa e não está em dia primeiro,
 * depois quem vence em 30 dias, e o nome.
 */
export function sortOverview(rows = [], hoje) {
  const peso = (r) => (r.pending ? 0 : (r.required && !r.ok ? 1 : (expiresSoon(r.until, hoje) ? 2 : 3)));
  return [...rows].sort((a, b) => peso(a) - peso(b) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

/**
 * Certidões esperando conferência (fonte que falhou ⇒ `undefined`, nunca zero).
 * A certidão nova fica em `pending_background` até ser conferida, para quem já
 * está em dia não perder a liberação enquanto a renovação é conferida.
 */
export const pendingBackgrounds = (records) => (Array.isArray(records) ? records.filter((r) => r.pending_background || r.pending).length : undefined);

/** Denúncias de proteção em aberto (prioritárias). */
export const openMinorReports = (reports) => (Array.isArray(reports) ? reports.filter((r) => r.kind === 'minor_protection' && r.status !== 'closed').length : undefined);
