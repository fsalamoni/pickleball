/**
 * Dúvidas ao professor (`training_questions` + `messages`).
 * Privadas: só quem pergunta e o professor (vínculo ATIVO) leem.
 */

export const QUESTION_STATUS = Object.freeze({ ABERTA: 'aberta', RESPONDIDA: 'respondida', ENCERRADA: 'encerrada' });
export const QUESTION_STATUS_LABELS = Object.freeze({ aberta: 'Esperando resposta', respondida: 'Respondida', encerrada: 'Encerrada' });
export const QUESTION_SUBJECT_MAX = 120;
export const MESSAGE_MAX = 2000;

const str = (v, max) => String(v ?? '').trim().slice(0, max);

/** @returns {{ valid: boolean, error: string, value: object }} */
export function normalizeQuestion(input = {}) {
  const subject = str(input.subject, QUESTION_SUBJECT_MAX);
  const text = str(input.text, MESSAGE_MAX);
  if (!input.coach_uid) return { valid: false, error: 'Escolha o professor.', value: {} };
  if (subject.length < 3) return { valid: false, error: 'Escreva o assunto.', value: {} };
  if (text.length < 3) return { valid: false, error: 'Escreva a sua dúvida.', value: {} };
  return {
    valid: true,
    error: '',
    value: {
      coach_uid: String(input.coach_uid),
      coach_name: str(input.coach_name, 80),
      subject,
      item_id: input.item_id ? String(input.item_id) : null,
      item_title: str(input.item_title, 120),
      text,
    },
  };
}

/** Status depois de uma mensagem de `from` ('aluno' | 'professor'). */
export function statusAfterMessage(from) {
  return from === 'professor' ? QUESTION_STATUS.RESPONDIDA : QUESTION_STATUS.ABERTA;
}

const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : (typeof t?.seconds === 'number' ? t.seconds * 1000 : 0));

/** Abertas primeiro (a quem precisa agir), depois por atualização. */
export function sortQuestions(list = [], { viewerIsCoach = false } = {}) {
  const needsMe = (q) => (viewerIsCoach ? q.status === QUESTION_STATUS.ABERTA : q.status === QUESTION_STATUS.RESPONDIDA);
  return [...list].sort((a, b) => {
    if (needsMe(a) !== needsMe(b)) return needsMe(a) ? -1 : 1;
    if ((a.status === 'encerrada') !== (b.status === 'encerrada')) return a.status === 'encerrada' ? 1 : -1;
    return ms(b.updated_at || b.created_at) - ms(a.updated_at || a.created_at);
  });
}
