/**
 * PICKLEBALL ADAPTADO (rodada 3, Bloco 4b, `docs/50` §41) — a conta PURA do
 * módulo `adapted`.
 *
 *  - Categorias adaptadas da federação (`federations.adapted_classes`):
 *    cadeira de rodas, em pé, deficiência intelectual — ou as que a
 *    federação definir. Ausente ou vazia ⇒ as padrão.
 *  - Classificação do atleta (`federation_adapted_classifications/{fed}_{uid}`):
 *    a pessoa pede, com o LAUDO (documento privado: só ela e a comissão — a
 *    equipe de competições — abrem, pelo servidor); a comissão classifica,
 *    com revisão opcional (`valid_until`), recusa ou cancela. A classificação
 *    vigente continua valendo enquanto um pedido novo está em análise.
 *  - A modalidade do torneio chancelado pode ser adaptada
 *    (`tournament_modalities.adapted_class`); quem organiza confere a
 *    classificação dos inscritos (`adaptedPlayerCheck`) sem ver o laudo.
 *
 * O servidor tem uma CÓPIA (`functions/federationAdaptedPolicy.js`) com
 * paridade em `federationAdapted.parity.test.js`. Ids de categoria, estados e
 * resultados da conferência são GRAVADOS: nunca renomeie.
 */
import { t, tk } from '@/core/i18n';

const str = (v, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);
const dias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const slug = (v) => str(v, 40).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export const ADAPTED_LIMITS = Object.freeze({ CLASSES_MAX: 10, LABEL_MAX: 60, DESC_MAX: 300, NOTE_MAX: 500, REASON_MAX: 300, WARN_DAYS: 30 });

export const DEFAULT_ADAPTED_CLASSES = Object.freeze([
  Object.freeze({ id: 'wheelchair', label: tk('Cadeira de rodas'), description: tk('Joga em cadeira de rodas; a bola pode quicar duas vezes do lado de quem está na cadeira.') }),
  Object.freeze({ id: 'standing', label: tk('Em pé (deficiência física)'), description: tk('Joga em pé, com deficiência física que limita o deslocamento ou um dos braços.') }),
  Object.freeze({ id: 'intellectual', label: tk('Deficiência intelectual'), description: tk('Atleta com deficiência intelectual, com apoio na quadra quando preciso.') }),
]);

export const CLASS_STATUS = Object.freeze({ PENDING: 'pending', CLASSIFIED: 'classified', DECLINED: 'declined', REVOKED: 'revoked' });
export const CLASS_STATUS_LABELS = Object.freeze({
  pending: tk('Em análise'), classified: tk('Classificado'), declined: tk('Pedido não aceito'), revoked: tk('Classificação cancelada'),
});

/** O resultado da conferência de um inscrito numa modalidade adaptada. */
export const ADAPTED_CHECK = Object.freeze({ OK: 'ok', OTHER_CLASS: 'other_class', EXPIRED: 'expired', PENDING: 'pending', MISSING: 'missing', NO_ACCOUNT: 'no_account' });
export const ADAPTED_CHECK_LABELS = Object.freeze({
  ok: tk('Classificado nesta categoria'),
  other_class: tk('Classificado em outra categoria'),
  expired: tk('Classificação vencida'),
  pending: tk('Classificação em análise'),
  missing: tk('Sem classificação'),
  no_account: tk('Sem conta na plataforma'),
});

/** Quem cuida da classificação: a equipe de competições e a administração. */
export const canManageAdapted = (perms) => lista(perms).includes('competitions') || lista(perms).includes('admin');

/** Caminho de arquivo enviado pela própria pessoa (`federacao/{uid}/…`). */
export const ownFilePath = (path, uid) => Boolean(uid) && new RegExp(`^federacao/${String(uid).replace(/[^A-Za-z0-9_-]/g, '')}/[A-Za-z0-9_-]+\\.(pdf|jpg|jpeg|png|webp)$`).test(String(path || ''));

/** As categorias limpas: id derivado do nome quando falta, sem repetir, até 10. */
export function normalizeAdaptedClasses(input) {
  const vistos = new Set();
  const out = [];
  lista(input).forEach((c) => {
    if (!c || out.length >= ADAPTED_LIMITS.CLASSES_MAX) return;
    const label = str(c.label, ADAPTED_LIMITS.LABEL_MAX);
    const id = slug(c.id || label);
    if (label.length < 2 || !id || vistos.has(id)) return;
    vistos.add(id);
    out.push({ id, label, description: txt(c.description, ADAPTED_LIMITS.DESC_MAX) });
  });
  return out;
}

/** As categorias da federação (ausente ou vazia ⇒ as padrão). */
export function adaptedClassesOf(federation) {
  const proprias = normalizeAdaptedClasses(federation && federation.adapted_classes);
  return proprias.length ? proprias : DEFAULT_ADAPTED_CLASSES.map((c) => ({ ...c }));
}

export const adaptedClassLabel = (federation, id) => (adaptedClassesOf(federation).find((c) => c.id === id) || {}).label || '';

/** O que a comissão grava em "Categorias": ao menos uma, até 10, nomes de 2 letras. */
export function validateAdaptedClasses(input) {
  const errors = {};
  const bruto = lista(input);
  const value = normalizeAdaptedClasses(bruto);
  if (bruto.length > ADAPTED_LIMITS.CLASSES_MAX) errors.classes = t('No máximo {n} categorias.', { n: ADAPTED_LIMITS.CLASSES_MAX });
  else if (!value.length) errors.classes = t('Inclua ao menos uma categoria.');
  else if (value.length < bruto.filter(Boolean).length) errors.classes = t('Cada categoria precisa de um nome (2 letras ou mais) diferente das outras.');
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** O pedido do atleta: a categoria (das da federação) e um recado opcional. */
export function validateClassificationRequest(input, classes) {
  const errors = {};
  const class_id = str(input && input.class_id, 40);
  if (!lista(classes).some((c) => c.id === class_id)) errors.class_id = t('Escolha a categoria.');
  return { ok: Object.keys(errors).length === 0, errors, value: { class_id, note: txt(input && input.note, ADAPTED_LIMITS.NOTE_MAX) } };
}

/**
 * A decisão da comissão: classificar (categoria e, se quiser, a data de
 * revisão, sempre no futuro) ou recusar (com motivo).
 */
export function validateClassificationDecision(input, classes, hoje) {
  const errors = {};
  const decision = input && input.decision === 'decline' ? 'decline' : input && input.decision === 'classify' ? 'classify' : '';
  if (!decision) errors.decision = t('Escolha classificar ou recusar.');
  const value = { decision, class_id: '', valid_until: '', note: '' };
  if (decision === 'classify') {
    value.class_id = str(input.class_id, 40);
    if (!lista(classes).some((c) => c.id === value.class_id)) errors.class_id = t('Escolha a categoria.');
    value.valid_until = isIso(input.valid_until) ? input.valid_until : '';
    if (input.valid_until && !value.valid_until) errors.valid_until = t('Data inválida.');
    else if (value.valid_until && value.valid_until <= hoje) errors.valid_until = t('A revisão tem de ser depois de hoje.');
    value.note = txt(input.note, ADAPTED_LIMITS.NOTE_MAX);
  }
  if (decision === 'decline') {
    value.note = txt(input.note, ADAPTED_LIMITS.REASON_MAX);
    if (value.note.length < 3) errors.note = t('Diga o motivo.');
  }
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/**
 * A situação de uma classificação hoje. `active` = tem categoria, não foi
 * cancelada e a revisão não passou (sem revisão, vale até a comissão mudar).
 * Um pedido novo em análise NÃO tira a classificação vigente.
 */
export function classificationState(c, hoje) {
  if (!c) return { status: 'none', active: false, expired: false, expiring: false, pending: false, daysLeft: null, class_id: '' };
  const temClasse = Boolean(c.class_id) && c.status !== CLASS_STATUS.REVOKED;
  const daysLeft = temClasse && isIso(c.valid_until) ? dias(hoje, c.valid_until) : null;
  const expired = temClasse && daysLeft !== null && daysLeft < 0;
  const active = temClasse && !expired;
  return {
    status: c.status || 'none', active, expired, pending: c.status === CLASS_STATUS.PENDING,
    expiring: active && daysLeft !== null && daysLeft <= ADAPTED_LIMITS.WARN_DAYS, daysLeft, class_id: temClasse ? c.class_id : '',
  };
}

/** A conferência de um inscrito numa modalidade adaptada (`classId`). */
export function adaptedPlayerCheck(uid, classification, classId, hoje) {
  if (!uid) return ADAPTED_CHECK.NO_ACCOUNT;
  const st = classificationState(classification, hoje);
  if (st.active) return st.class_id === classId ? ADAPTED_CHECK.OK : ADAPTED_CHECK.OTHER_CLASS;
  if (st.expired) return ADAPTED_CHECK.EXPIRED;
  if (st.pending) return ADAPTED_CHECK.PENDING;
  return ADAPTED_CHECK.MISSING;
}

/**
 * O aviso que a varredura deve dar hoje: `expiring` (até 30 dias antes da
 * revisão, uma vez por data) ou `expired` (passou, uma vez por data).
 */
export function classificationNotice(c, hoje) {
  const st = classificationState(c, hoje);
  if (st.expired && c.expired_notified_for !== c.valid_until) return 'expired';
  if (st.expiring && c.warned_for !== c.valid_until) return 'expiring';
  return null;
}
