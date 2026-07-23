/**
 * Domínio puro de aulas do professor (Sistema A — produto de aulas).
 *
 * Uma aula (`coach_lessons/{lessonId}`) é avulsa ou recorrente, entre um
 * professor e um aluno (ou turma, nos formatos group/clinic). A máquina de
 * status reusa `BOOKING_STATUS`/`canTransition` das reservas de arena
 * (solicitada → confirmada → concluída, com recusa/cancelamento). Horários e
 * recorrência reusam o domínio de booking. Pagamento reusa `PAYMENT_STATUS`.
 *
 * Sem I/O — testável isoladamente.
 */

import {
  BOOKING_STATUS,
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS,
  BOOKING_KIND,
} from '../../arenas/domain/constants.js';
import {
  canTransition,
  bookingSlots,
  isValidSlot,
  sortSlots,
} from '../../arenas/domain/booking.js';

// Reexporta para consumidores do módulo de aulas (não precisam conhecer arenas).
export {
  BOOKING_STATUS as LESSON_STATUS,
  BOOKING_STATUS_LABELS as LESSON_STATUS_LABELS,
  PAYMENT_STATUS,
  BOOKING_KIND as LESSON_KIND,
  canTransition,
};

const str = (v) => String(v ?? '').trim();

/** Formatos de aula e capacidade de alunos por formato. */
export const LESSON_FORMAT = Object.freeze({
  PRIVATE: 'private',
  DUO: 'duo',
  GROUP: 'group',
  CLINIC: 'clinic',
});

export const LESSON_FORMAT_LABELS = Object.freeze({
  [LESSON_FORMAT.PRIVATE]: 'Individual',
  [LESSON_FORMAT.DUO]: 'Dupla',
  [LESSON_FORMAT.GROUP]: 'Grupo',
  [LESSON_FORMAT.CLINIC]: 'Clínica',
});

/** Capacidade padrão de alunos por formato (turma). */
export const LESSON_FORMAT_CAPACITY = Object.freeze({
  [LESSON_FORMAT.PRIVATE]: 1,
  [LESSON_FORMAT.DUO]: 2,
  [LESSON_FORMAT.GROUP]: 8,
  [LESSON_FORMAT.CLINIC]: 20,
});

/** Cor (tom V2Badge) por status — dentro dos tons suportados. */
export const LESSON_STATUS_TONE = Object.freeze({
  [BOOKING_STATUS.REQUESTED]: 'amber',
  [BOOKING_STATUS.NEGOTIATING]: 'blue',
  [BOOKING_STATUS.CONFIRMED]: 'green',
  [BOOKING_STATUS.DECLINED]: 'red',
  [BOOKING_STATUS.CANCELLED]: 'neutral',
  [BOOKING_STATUS.COMPLETED]: 'ink',
});

function normFormat(value) {
  const v = str(value).toLowerCase();
  return Object.values(LESSON_FORMAT).includes(v) ? v : LESSON_FORMAT.PRIVATE;
}

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Capacidade efetiva de uma aula (max_students informado ou padrão do formato). */
export function capacityFor(format, maxStudents) {
  const cap = Math.trunc(Number(maxStudents));
  if (Number.isFinite(cap) && cap >= 1) return cap;
  return LESSON_FORMAT_CAPACITY[normFormat(format)] || 1;
}

/**
 * Normaliza/valida uma aula.
 * @returns {{ valid, error, value }}
 */
export function normalizeLesson(input = {}) {
  const coach_id = str(input.coach_id);
  if (!coach_id) return { valid: false, error: 'coach_id é obrigatório.', value: {} };

  const kind = str(input.kind).toLowerCase() === BOOKING_KIND.RECURRING
    ? BOOKING_KIND.RECURRING
    : BOOKING_KIND.SINGLE;
  const format = normFormat(input.format);

  const rawSlots = Array.isArray(input.slots)
    ? input.slots
    : (input.date ? [{ date: input.date, start: input.start, end: input.end }] : []);
  const slots = sortSlots(rawSlots.filter((s) => isValidSlot(s)).map((s) => ({
    date: str(s.date), start: str(s.start), end: str(s.end),
  })));
  if (slots.length === 0) {
    return { valid: false, error: 'Informe ao menos um horário válido (data, início e fim).', value: { coach_id } };
  }

  const requestedBy = str(input.requested_by).toLowerCase();
  const status = Object.values(BOOKING_STATUS).includes(str(input.status))
    ? str(input.status)
    : BOOKING_STATUS.REQUESTED;
  const paymentStatus = Object.values(PAYMENT_STATUS).includes(str(input.payment_status))
    ? str(input.payment_status)
    : PAYMENT_STATUS.NONE;

  return {
    valid: true,
    error: null,
    value: {
      coach_id,
      student_id: str(input.student_id) || null,
      student_name: str(input.student_name).slice(0, 120),
      student_email: str(input.student_email).slice(0, 160),
      requested_by: requestedBy === 'coach' ? 'coach' : 'student',
      format,
      kind,
      slots,
      recurrence: (kind === BOOKING_KIND.RECURRING && input.recurrence && typeof input.recurrence === 'object')
        ? input.recurrence : null,
      max_students: capacityFor(format, input.max_students),
      arena_id: str(input.arena_id) || null,
      location: str(input.location).slice(0, 120) || null,
      price: num(input.price, null),
      payment_status: paymentStatus,
      status,
      package_sale_id: str(input.package_sale_id) || null,
      notes: str(input.notes).slice(0, 1000),
    },
  };
}

/** Slots de uma aula (reusa booking). */
export function lessonSlots(lesson = {}) {
  return bookingSlots(lesson);
}

/** Data/horário do primeiro slot (para ordenação/exibição). */
export function lessonFirstSlot(lesson = {}) {
  return sortSlots(lessonSlots(lesson))[0] || null;
}

/** Indica se a aula está no passado (todos os slots antes de `nowDate`). */
export function isPastLesson(lesson = {}, nowDate = new Date()) {
  const slots = lessonSlots(lesson);
  if (slots.length === 0) return false;
  const today = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
  return slots.every((s) => s.date < today);
}

/** Rótulo legível do status. */
export function lessonStatusLabel(status) {
  return BOOKING_STATUS_LABELS[status] || status;
}

/** Tom (V2Badge) do status. */
export function lessonStatusTone(status) {
  return LESSON_STATUS_TONE[status] || 'neutral';
}

/** Rótulo do formato. */
export function lessonFormatLabel(format) {
  return LESSON_FORMAT_LABELS[normFormat(format)] || format;
}

/**
 * Ações disponíveis para um ator (coach ou student) numa aula, dado o status.
 * Espelha a máquina de status das reservas, restringindo por papel.
 * @returns {Array<{ to, label }>}
 */
export function availableActions(lesson = {}, actor = 'coach') {
  const from = lesson.status;
  const targets = [];
  if (actor === 'coach') {
    if (canTransition(from, BOOKING_STATUS.CONFIRMED)) targets.push({ to: BOOKING_STATUS.CONFIRMED, label: 'Confirmar' });
    if (canTransition(from, BOOKING_STATUS.DECLINED)) targets.push({ to: BOOKING_STATUS.DECLINED, label: 'Recusar' });
    if (canTransition(from, BOOKING_STATUS.COMPLETED)) targets.push({ to: BOOKING_STATUS.COMPLETED, label: 'Concluir' });
    if (canTransition(from, BOOKING_STATUS.CANCELLED)) targets.push({ to: BOOKING_STATUS.CANCELLED, label: 'Cancelar' });
  } else {
    // Aluno: só pode cancelar a própria solicitação/aula antes de concluída.
    if (canTransition(from, BOOKING_STATUS.CANCELLED)) targets.push({ to: BOOKING_STATUS.CANCELLED, label: 'Cancelar' });
  }
  return targets;
}

/** Ordena aulas pela data do primeiro slot (mais próximas primeiro). */
export function sortLessons(lessons = []) {
  const key = (l) => {
    const s = lessonFirstSlot(l);
    return s ? `${s.date}_${s.start}` : '9999';
  };
  return [...lessons].sort((a, b) => key(a).localeCompare(key(b)));
}

/** Separa aulas em próximas (ativas/futuras) e histórico (concluídas/passadas). */
export function partitionLessons(lessons = [], nowDate = new Date()) {
  const upcoming = [];
  const history = [];
  lessons.forEach((l) => {
    const done = l.status === BOOKING_STATUS.COMPLETED
      || l.status === BOOKING_STATUS.CANCELLED
      || l.status === BOOKING_STATUS.DECLINED
      || isPastLesson(l, nowDate);
    (done ? history : upcoming).push(l);
  });
  return { upcoming: sortLessons(upcoming), history: sortLessons(history).reverse() };
}
