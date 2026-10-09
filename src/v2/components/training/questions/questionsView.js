/**
 * Dúvidas ao professor — a parte pura da TELA (quem é quem na conversa, de
 * quem é a vez, quando foi). As regras da dúvida em si (validação, status,
 * ordem) moram em `modules/training/domain/question.js`.
 */
import { instanteEmMs } from '@/core/domain/instant';
import { addDays, toISODate } from '@/modules/training/domain/dates';
import { QUESTION_STATUS } from '@/modules/training/domain/question';

const pad = (n) => String(n).padStart(2, '0');

/** Nesta conversa, eu sou o professor? (é a mesma conta do serviço ao responder) */
export function souProfessorDa(question, uid) {
  return !!uid && question?.coach_uid === uid;
}

/** O nome de quem está do OUTRO lado: o professor para o aluno, o aluno para o professor. */
export function outroLado(question, uid) {
  return souProfessorDa(question, uid)
    ? (question?.asker_name || 'Aluno')
    : (question?.coach_name || 'Professor');
}

/** A conversa espera uma resposta MINHA? Encerrada nunca espera. */
export function esperaPorMim(question, uid) {
  if (!question || question.status === QUESTION_STATUS.ENCERRADA) return false;
  return souProfessorDa(question, uid)
    ? question.status === QUESTION_STATUS.ABERTA
    : question.status === QUESTION_STATUS.RESPONDIDA;
}

/**
 * "hoje, 14:05" · "ontem, 09:10" · "08/10, 14:05" (e o ano quando não é o
 * corrente). Sem instante (gravação ainda pendente), devolve ''.
 */
export function quandoFoi(valor, agora = new Date()) {
  const ms = instanteEmMs(valor);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const dia = toISODate(d);
  const hoje = toISODate(agora);
  if (dia === hoje) return `hoje, ${hora}`;
  if (dia === addDays(hoje, -1)) return `ontem, ${hora}`;
  const ano = d.getFullYear() !== agora.getFullYear() ? `/${d.getFullYear()}` : '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}${ano}, ${hora}`;
}
