/**
 * Domínio: Classes & Coaches (Arena V3 — sprint 4).
 */

export const COACH_LEVEL = Object.freeze({
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  PRO: 'pro',
});

export const CLASS_FORMAT = Object.freeze({
  PRIVATE: 'private',
  GROUP: 'group',
  CLINIC: 'clinic',
});

export const CLASS_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

/** Normaliza input de coach. */
export function normalizeCoachInput(input = {}) {
  const errors = {};
  const name = String(input.name || '').trim();
  if (!name) errors.name = 'Nome obrigatório.';
  const level = Object.values(COACH_LEVEL).includes(input.level) ? input.level : COACH_LEVEL.INTERMEDIATE;
  const pricePerHour = Number(input.price_per_hour);
  const bio = String(input.bio || '').trim().slice(0, 1000);
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      level,
      bio,
      price_per_hour: Number.isFinite(pricePerHour) && pricePerHour >= 0 ? pricePerHour : 0,
      specialties: Array.isArray(input.specialties) ? input.specialties.slice(0, 10) : [],
      photo_url: String(input.photo_url || '').trim(),
      active: input.active !== false,
    },
  };
}

/** Normaliza input de class. */
export function normalizeClassInput(input = {}) {
  const errors = {};
  const date = String(input.date || '').trim();
  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) errors.date = 'Data inválida.';
  const start = String(input.start || '').trim();
  if (!start.match(/^\d{2}:\d{2}$/)) errors.start = 'Horário inválido.';
  const end = String(input.end || '').trim();
  if (!end.match(/^\d{2}:\d{2}$/)) errors.end = 'Horário inválido.';
  const maxStudents = Number(input.max_students);
  if (!Number.isFinite(maxStudents) || maxStudents < 1 || maxStudents > 50) errors.max_students = '1-50 alunos.';
  const price = Number(input.price) || 0;
  if (price < 0) errors.price = 'Preço inválido.';
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      date, start, end,
      max_students: Number.isFinite(maxStudents) ? maxStudents : 1,
      price,
      format: Object.values(CLASS_FORMAT).includes(input.format) ? input.format : CLASS_FORMAT.GROUP,
      level: Object.values(COACH_LEVEL).includes(input.level) ? input.level : COACH_LEVEL.BEGINNER,
      notes: String(input.notes || '').trim().slice(0, 500),
    },
  };
}

/** Calcula comissão do instrutor. */
export function calculateCommission(price, pct = 50) {
  if (!Number.isFinite(price) || price < 0) return 0;
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return 0;
  return Math.round(price * pct / 100 * 100) / 100;
}
