/**
 * Domínio puro do roster de alunos do professor (Fase B — PRO-10/11/12).
 *
 * Vínculo aluno↔professor (`coach_students/{coachId_studentId}`) com ficha de
 * evolução: nível, tags (pontos fortes/fracos), notas privadas (só o professor
 * vê), presença (aulas feitas) e status (convidado/ativo/pausado/encerrado).
 *
 * O vínculo vale ENQUANTO o professor for professor daquele aluno (decisão do
 * dono, 2026-10-09): qualquer um dos dois encerra (`ended`, com `ended_at` e
 * `ended_by`). Encerrado, ele fica na ficha do professor como histórico e só
 * volta a valer se o ALUNO aceitar um novo convite — o professor não reativa
 * nem apaga um vínculo encerrado (a regra do Firestore confere o mesmo).
 *
 * Sem I/O — testável isoladamente.
 */

const str = (v) => String(v ?? '').trim();

export const STUDENT_STATUS = Object.freeze({
  INVITED: 'invited',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended',
});

export const STUDENT_STATUS_LABELS = Object.freeze({
  [STUDENT_STATUS.INVITED]: 'Convidado',
  [STUDENT_STATUS.ACTIVE]: 'Ativo',
  [STUDENT_STATUS.PAUSED]: 'Pausado',
  [STUDENT_STATUS.ENDED]: 'Encerrado',
});

export const STUDENT_STATUS_TONE = Object.freeze({
  [STUDENT_STATUS.INVITED]: 'amber',
  [STUDENT_STATUS.ACTIVE]: 'green',
  [STUDENT_STATUS.PAUSED]: 'neutral',
  [STUDENT_STATUS.ENDED]: 'neutral',
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
  [STUDENT_STATUS.INVITED]: [STUDENT_STATUS.ACTIVE, STUDENT_STATUS.PAUSED, STUDENT_STATUS.ENDED],
  [STUDENT_STATUS.ACTIVE]: [STUDENT_STATUS.PAUSED, STUDENT_STATUS.ENDED],
  [STUDENT_STATUS.PAUSED]: [STUDENT_STATUS.ACTIVE, STUDENT_STATUS.ENDED],
  [STUDENT_STATUS.ENDED]: [STUDENT_STATUS.INVITED],
};

export function canTransitionStudent(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

/**
 * O vínculo já foi encerrado alguma vez e ainda não foi aceito de novo pelo
 * aluno (encerrado, ou o novo convite esperando resposta). Enquanto isso o
 * professor só convida ou encerra — nunca ativa, pausa ou apaga.
 */
export function isLinkEndedHistory(link) {
  return Boolean(link?.ended_at) || link?.status === STUDENT_STATUS.ENDED;
}

/** Quem pode levar o vínculo de `link.status` para `to`. */
export function canSetStudentStatus(link, to, role) {
  const from = link?.status;
  if (!canTransitionStudent(from, to)) return false;
  if (role === 'aluno') {
    return (from === STUDENT_STATUS.INVITED && to === STUDENT_STATUS.ACTIVE) || to === STUDENT_STATUS.ENDED;
  }
  if (role === 'professor') {
    return !isLinkEndedHistory(link) || [STUDENT_STATUS.ENDED, STUDENT_STATUS.INVITED].includes(to);
  }
  return false;
}

/** O professor pode apagar a ficha? Encerrada (ou convite depois do fim) fica. */
export function canCoachRemoveStudent(link) {
  // Conta do aluno excluída: a regra confere que `users/{aluno}` não existe.
  return link?.ended_reason === 'conta_excluida' || !isLinkEndedHistory(link);
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
  const summary = { total: students.length, active: 0, invited: 0, paused: 0, ended: 0 };
  students.forEach((s) => {
    if (s.status === STUDENT_STATUS.ACTIVE) summary.active += 1;
    else if (s.status === STUDENT_STATUS.INVITED) summary.invited += 1;
    else if (s.status === STUDENT_STATUS.PAUSED) summary.paused += 1;
    else if (s.status === STUDENT_STATUS.ENDED) summary.ended += 1;
  });
  return summary;
}

export function studentStatusLabel(status) {
  return STUDENT_STATUS_LABELS[status] || status;
}

export function studentStatusTone(status) {
  return STUDENT_STATUS_TONE[status] || 'neutral';
}

/** Ordena alunos: ativos primeiro, encerrados por último, depois por nome. */
export function sortStudents(students = []) {
  const rank = {
    [STUDENT_STATUS.ACTIVE]: 0, [STUDENT_STATUS.INVITED]: 1, [STUDENT_STATUS.PAUSED]: 2, [STUDENT_STATUS.ENDED]: 4,
  };
  return [...students].sort((a, b) => {
    const ra = rank[a.status] ?? 3;
    const rb = rank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return str(a.student_name).localeCompare(str(b.student_name));
  });
}
