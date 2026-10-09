/**
 * Aba Alunos (professor) — a parte pura: quem é aluno ativo, o que cada um
 * treinou nesta semana, o que foi enviado e ainda não foi feito.
 */
import { STUDENT_STATUS } from '@/modules/coaches/domain/student';
import { weekKeyOf } from '@/modules/training/domain/dates';

/** Ativos primeiro, depois convidados (pendentes); pausados ficam de fora. Por nome. */
export function rosterForTraining(students = []) {
  const nome = (s) => String(s.student_name || '');
  const ativos = students.filter((s) => s.status === STUDENT_STATUS.ACTIVE && s.student_id);
  const convidados = students.filter((s) => s.status === STUDENT_STATUS.INVITED);
  const ordem = (a, b) => nome(a).localeCompare(nome(b), 'pt-BR');
  return { ativos: [...ativos].sort(ordem), convidados: [...convidados].sort(ordem) };
}

/**
 * Por aluno: sessões compartilhadas (mais recentes primeiro), quantas nesta
 * semana, envios do professor e quantos ainda não foram feitos.
 * Totais: alunos que treinaram nesta semana e envios pendentes.
 */
export function studentsOverview({ ativos = [], sessions = [], sent = [], today }) {
  const semana = weekKeyOf(today);
  const porAluno = ativos.map((s) => {
    const sess = sessions.filter((x) => x.uid === s.student_id)
      .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
    const envios = sent.filter((x) => x.to_uid === s.student_id && x.kind === 'aluno');
    return {
      student: s,
      sessions: sess,
      thisWeek: sess.filter((x) => (x.week_key || weekKeyOf(x.date)) === semana).length,
      toConfirm: sess.filter((x) => !x.coach_confirmed_at).length,
      sent: envios,
      pending: envios.filter((x) => !x.done_at).length,
    };
  });
  return {
    porAluno,
    treinaramNaSemana: porAluno.filter((a) => a.thisWeek > 0).length,
    enviosPendentes: porAluno.reduce((t, a) => t + a.pending, 0),
  };
}
