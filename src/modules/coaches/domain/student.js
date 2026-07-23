/**
 * Domínio puro do roster de alunos do professor (Fase B — PRO-10/11/12).
 *
 * Vínculo aluno↔professor (`coach_students/{coachId_studentId}`) com ficha de
 * evolução: nível, tags (pontos fortes/fracos), notas privadas (só o professor
 * vê), presença (aulas feitas) e status (convidado/ativo/pausado).
 *
 * Sem I/O — testável isoladamente.
 */

const str = (v) => String(v ?? '').trim();

export const STUDENT_STATUS = Object.freeze({
  INVITED: 'invited',
  ACTIVE: 'active',
  PAUSED: 'paused',
});

export const STUDENT_STATUS_LABELS = Object.freeze({
  [STUDENT_STATUS.INVITED]: 'Convidado',
  [STUDENT_STATUS.ACTIVE]: 'Ativo',
  [STUDENT_STATUS.PAUSED]: 'Pausado',
});

export const STUDENT_STATUS_TONE = Object.freeze({
  [STUDENT_STATUS.INVITED]: 'amber',
  [STUDENT_STATUS.ACTIVE]: 'green',
  [STUDENT_STATUS.PAUSED]: 'neutral',
});

export const STUDENT_TAGS_MAX = 12;
export const STUDENT_TAG_MAX = 30;
export const STUDENT_NOTES_MAX = 2000;
export const STUDENT_LEVEL_MAX = 40;

/** id determinístico do vínculo. */
export function studentDocId(coachId, studentId) {
  return `${str(coachId)}_${str(studentId)}`;
}

/** Transições de status permitidas do vínculo. */
const TRANSITIONS = {
  [STUDENT_STATUS.INVITED]: [STUDENT_STATUS.ACTIVE, STUDENT_STATUS.PAUSED],
  [STUDENT_STATUS.ACTIVE]: [STUDENT_STATUS.PAUSED],
  [STUDENT_STATUS.PAUSED]: [STUDENT_STATUS.ACTIVE],
};

export function canTransitionStudent(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

/** Normaliza a lista de tags. */
export function normalizeTags(input) {
  return (Array.isArray(input) ? input : [])
    .map((t) => str(t).slice(0, STUDENT_TAG_MAX))
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, STUDENT_TAGS_MAX);
}

/**
 * Normaliza/valida um vínculo de aluno.
 * @returns {{ valid, error, value }}
 */
export function normalizeStudent(input = {}) {
  const coach_id = str(input.coach_id);
  const student_id = str(input.student_id);
  if (!coach_id) return { valid: false, error: 'coach_id é obrigatório.', value: {} };
  if (!student_id) return { valid: false, error: 'student_id é obrigatório.', value: { coach_id } };

  const status = Object.values(STUDENT_STATUS).includes(str(input.status))
    ? str(input.status)
    : STUDENT_STATUS.INVITED;
  const lessonsDone = Math.max(0, Math.trunc(Number(input.lessons_done)) || 0);

  return {
    valid: true,
    error: null,
    value: {
      coach_id,
      student_id,
      student_name: str(input.student_name).slice(0, 120),
      student_email: str(input.student_email).slice(0, 160),
      status,
      level: str(input.level).slice(0, STUDENT_LEVEL_MAX),
      tags: normalizeTags(input.tags),
      private_notes: str(input.private_notes).slice(0, STUDENT_NOTES_MAX),
      lessons_done: lessonsDone,
      last_lesson_at: input.last_lesson_at || null,
    },
  };
}

/** Filtra e ordena o roster para exibição. */
export function filterStudents(students = [], { status, query } = {}) {
  const q = str(query).toLowerCase();
  return students.filter((s) => {
    if (status && s.status !== status) return false;
    if (q && !`${s.student_name} ${s.student_email} ${(s.tags || []).join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Resumo do roster (contadores por status). */
export function rosterSummary(students = []) {
  const summary = { total: students.length, active: 0, invited: 0, paused: 0 };
  students.forEach((s) => {
    if (s.status === STUDENT_STATUS.ACTIVE) summary.active += 1;
    else if (s.status === STUDENT_STATUS.INVITED) summary.invited += 1;
    else if (s.status === STUDENT_STATUS.PAUSED) summary.paused += 1;
  });
  return summary;
}

export function studentStatusLabel(status) {
  return STUDENT_STATUS_LABELS[status] || status;
}

export function studentStatusTone(status) {
  return STUDENT_STATUS_TONE[status] || 'neutral';
}

/** Ordena alunos: ativos primeiro, depois por nome. */
export function sortStudents(students = []) {
  const rank = { [STUDENT_STATUS.ACTIVE]: 0, [STUDENT_STATUS.INVITED]: 1, [STUDENT_STATUS.PAUSED]: 2 };
  return [...students].sort((a, b) => {
    const ra = rank[a.status] ?? 3;
    const rb = rank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return str(a.student_name).localeCompare(str(b.student_name));
  });
}
