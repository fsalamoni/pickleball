/**
 * Jogo limpo (rodada 3, Bloco 1) — a régua PURA dos equipamentos homologados.
 *
 * ⚠️ CÓPIA da parte de `src/modules/federations/domain/integrity.js` que o
 * servidor confere (o pacote de Functions é publicado isolado), com paridade
 * em `federationIntegrity.parity.test.js`. Tipos e situações são GRAVADOS:
 * nunca renomeie.
 */
const t = (s) => String(s);
const str = (v, max = 500) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const txt = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

const EQUIPMENT_KINDS = Object.freeze(['paddle', 'ball', 'net', 'other']);
const EQUIPMENT_STATUS = Object.freeze({ APPROVED: 'approved', REJECTED: 'rejected', DECERTIFIED: 'decertified' });
const EQUIPMENT_NOTES_MAX = 500;
const EQUIPMENT_HISTORY_MAX = 30;

function validateEquipment(input = {}) {
  const v = {
    kind: EQUIPMENT_KINDS.includes(input.kind) ? input.kind : 'paddle',
    brand: str(input.brand, 60),
    model: str(input.model, 80),
    reference: str(input.reference, 60),
    source: str(input.source, 120),
    notes: txt(input.notes, EQUIPMENT_NOTES_MAX),
  };
  const errors = {};
  if (v.brand.length < 2) errors.brand = t('Informe a marca.');
  if (!v.model) errors.model = t('Informe o modelo.');
  return { ok: !Object.keys(errors).length, errors, value: v };
}

const statusNeedsReason = (from, to) => to !== EQUIPMENT_STATUS.APPROVED || from === EQUIPMENT_STATUS.DECERTIFIED;

function validateStatusChange(item, input = {}, hoje) {
  const from = item ? item.status : null;
  const status = Object.values(EQUIPMENT_STATUS).includes(input.status) ? input.status : (item ? '' : EQUIPMENT_STATUS.APPROVED);
  const date = isIso(input.date) ? input.date : hoje;
  const reason = str(input.reason, 300);
  const errors = {};
  if (!status) errors.status = t('Escolha a situação.');
  else if (from === status) errors.status = t('O equipamento já está nessa situação.');
  if (date > hoje) errors.date = t('A data não pode ser no futuro.');
  else if (item && isIso(item.status_at) && date < item.status_at) errors.date = t('A data não pode ser anterior à situação atual.');
  if (status && statusNeedsReason(from, status) && reason.length < 5) errors.reason = t('Diga o motivo (aparece na lista pública).');
  return { ok: !Object.keys(errors).length, errors, value: { status, date, reason } };
}

const tem = (perms, ...ps) => Array.isArray(perms) && ps.some((p) => perms.includes(p));
const canManageEquipment = (perms) => tem(perms, 'competitions', 'admin');

module.exports = {
  EQUIPMENT_KINDS, EQUIPMENT_STATUS, EQUIPMENT_NOTES_MAX, EQUIPMENT_HISTORY_MAX, validateEquipment, statusNeedsReason, validateStatusChange, canManageEquipment,
};
