/**
 * PICKLEBALL ADAPTADO — a régua do servidor (docs/50 §41).
 *
 * ⚠️ CÓPIA de `src/modules/federations/domain/adapted.js` (o pacote de Functions é publicado isolado), com
 * paridade em `functions/federationAdapted.parity.test.js`. Estados, ids e chaves são GRAVADOS: nunca renomeie.
 */
const t = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? String(v[k]) : `{${k}}`));

const str = (v, max = 500) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const lista = (v) => (Array.isArray(v) ? v : []);
const dias = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const slug = (v) => str(v, 40).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const ADAPTED_LIMITS = Object.freeze({ CLASSES_MAX: 10, LABEL_MAX: 60, DESC_MAX: 300, NOTE_MAX: 500, REASON_MAX: 300, WARN_DAYS: 30 });

const DEFAULT_ADAPTED_CLASSES = Object.freeze([
  Object.freeze({ id: 'wheelchair', label: 'Cadeira de rodas', description: 'Joga em cadeira de rodas; a bola pode quicar duas vezes do lado de quem está na cadeira.' }),
  Object.freeze({ id: 'standing', label: 'Em pé (deficiência física)', description: 'Joga em pé, com deficiência física que limita o deslocamento ou um dos braços.' }),
  Object.freeze({ id: 'intellectual', label: 'Deficiência intelectual', description: 'Atleta com deficiência intelectual, com apoio na quadra quando preciso.' }),
]);

const CLASS_STATUS = Object.freeze({ PENDING: 'pending', CLASSIFIED: 'classified', DECLINED: 'declined', REVOKED: 'revoked' });
const CLASS_STATUS_LABELS = Object.freeze({
  pending: 'Em análise', classified: 'Classificado', declined: 'Pedido não aceito', revoked: 'Classificação cancelada',
});

/** O resultado da conferência de um inscrito numa modalidade adaptada. */
const ADAPTED_CHECK = Object.freeze({ OK: 'ok', OTHER_CLASS: 'other_class', EXPIRED: 'expired', PENDING: 'pending', MISSING: 'missing', NO_ACCOUNT: 'no_account' });
const ADAPTED_CHECK_LABELS = Object.freeze({
  ok: 'Classificado nesta categoria',
  other_class: 'Classificado em outra categoria',
  expired: 'Classificação vencida',
  pending: 'Classificação em análise',
  missing: 'Sem classificação',
  no_account: 'Sem conta na plataforma',
});

/** Quem cuida da classificação: a equipe de competições e a administração. */
const canManageAdapted = (perms) => lista(perms).includes('competitions') || lista(perms).includes('admin');

/** Caminho de arquivo enviado pela própria pessoa (`federacao/{uid}/…`). */
const ownFilePath = (path, uid) => Boolean(uid) && new RegExp(`^federacao/${String(uid).replace(/[^A-Za-z0-9_-]/g, '')}/[A-Za-z0-9_-]+\\.(pdf|jpg|jpeg|png|webp)$`).test(String(path || ''));

/** As categorias limpas: id derivado do nome quando falta, sem repetir, até 10. */
function normalizeAdaptedClasses(input) {
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
function adaptedClassesOf(federation) {
  const proprias = normalizeAdaptedClasses(federation && federation.adapted_classes);
  return proprias.length ? proprias : DEFAULT_ADAPTED_CLASSES.map((c) => ({ ...c }));
}

const adaptedClassLabel = (federation, id) => (adaptedClassesOf(federation).find((c) => c.id === id) || {}).label || '';

/** O que a comissão grava em "Categorias": ao menos uma, até 10, nomes de 2 letras. */
function validateAdaptedClasses(input) {
  const errors = {};
  const bruto = lista(input);
  const value = normalizeAdaptedClasses(bruto);
  if (bruto.length > ADAPTED_LIMITS.CLASSES_MAX) errors.classes = t('No máximo {n} categorias.', { n: ADAPTED_LIMITS.CLASSES_MAX });
  else if (!value.length) errors.classes = t('Inclua ao menos uma categoria.');
  else if (value.length < bruto.filter(Boolean).length) errors.classes = t('Cada categoria precisa de um nome (2 letras ou mais) diferente das outras.');
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** O pedido do atleta: a categoria (das da federação) e um recado opcional. */
function validateClassificationRequest(input, classes) {
  const errors = {};
  const class_id = str(input && input.class_id, 40);
  if (!lista(classes).some((c) => c.id === class_id)) errors.class_id = t('Escolha a categoria.');
  return { ok: Object.keys(errors).length === 0, errors, value: { class_id, note: txt(input && input.note, ADAPTED_LIMITS.NOTE_MAX) } };
}

/**
 * A decisão da comissão: classificar (categoria e, se quiser, a data de
 * revisão, sempre no futuro) ou recusar (com motivo).
 */
function validateClassificationDecision(input, classes, hoje) {
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
function classificationState(c, hoje) {
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
function adaptedPlayerCheck(uid, classification, classId, hoje) {
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
function classificationNotice(c, hoje) {
  const st = classificationState(c, hoje);
  if (st.expired && c.expired_notified_for !== c.valid_until) return 'expired';
  if (st.expiring && c.warned_for !== c.valid_until) return 'expiring';
  return null;
}

module.exports = {
  ADAPTED_LIMITS, DEFAULT_ADAPTED_CLASSES, CLASS_STATUS, CLASS_STATUS_LABELS, ADAPTED_CHECK, ADAPTED_CHECK_LABELS, canManageAdapted, ownFilePath, normalizeAdaptedClasses, adaptedClassesOf, adaptedClassLabel, validateAdaptedClasses, validateClassificationRequest, validateClassificationDecision, classificationState, adaptedPlayerCheck, classificationNotice,
};
