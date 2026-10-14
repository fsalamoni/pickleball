/**
 * O "Hoje" do painel do professor (Fase 3.1 do plano de UX): o que depende dele
 * agora, montado SÓ com o que as outras abas já consultam — zero leitura nova.
 *
 * Regra de honestidade: fonte que não respondeu é `undefined` e vira `null`
 * aqui (a tela diz "ficou de fora"), nunca zero.
 */
import { BOOKING_STATUS, PAYMENT_STATUS } from '../../arenas/domain/constants';
import { lessonFirstSlot, lessonsAwaitingReply } from './lesson';
import { STUDENT_STATUS } from './student';
import { QUESTION_STATUS } from '../../training/domain/question';
import { t } from '@/core/i18n';

const porHorario = (a, b) => {
  const sa = lessonFirstSlot(a); const sb = lessonFirstSlot(b);
  return `${sa?.date || ''}_${sa?.start || ''}`.localeCompare(`${sb?.date || ''}_${sb?.start || ''}`);
};

/**
 * @param {Array} lessons aulas do professor (todas, como `useCoachLessons` devolve)
 * @param {{ hoje: string, questions?: Array|undefined }} opts `hoje` em ISO local; `questions` indefinido = não carregou
 */
export function coachToday(lessons = [], { hoje, questions } = {}) {
  const aulas = Array.isArray(lessons) ? lessons : [];
  const aulasHoje = aulas
    .filter((l) => l.status === BOOKING_STATUS.CONFIRMED && (l.slots || []).some((s) => s.date === hoje))
    .sort(porHorario);
  const pedidos = lessonsAwaitingReply(aulas).sort(porHorario);
  const pagamentos = aulas
    .filter((l) => (l.status === BOOKING_STATUS.CONFIRMED || l.status === BOOKING_STATUS.COMPLETED)
      && l.payment_status === PAYMENT_STATUS.PENDING && Number(l.price) > 0)
    .sort(porHorario);
  const duvidas = Array.isArray(questions)
    ? questions.filter((q) => q.status === QUESTION_STATUS.ABERTA).length
    : null;
  return { aulasHoje, pedidos, pagamentos, duvidas };
}

/**
 * Checklist de ativação do professor novo. Cada item: `done` true/false, ou
 * `null` quando a fonte não respondeu (não se afirma "falta" sobre o que não
 * se leu). `completo` só com os quatro verdadeiros.
 */
export function coachActivation({ coach, availability, students, lessons } = {}) {
  const tri = (fonte, teste) => (fonte === undefined ? null : Boolean(teste(fonte)));
  const items = [
    { id: 'perfil', label: t('Complete o perfil (bio e valor da hora)'), aba: 'info',
      done: coach ? Boolean(String(coach.bio || '').trim()) && Number(coach.hourly_rate) > 0 : null },
    { id: 'disponibilidade', label: t('Publique a sua disponibilidade semanal'), aba: 'agenda',
      done: tri(availability, (a) => (a?.windows || []).length > 0) },
    { id: 'aluno', label: t('Convide o primeiro aluno'), aba: 'alunos',
      done: tri(students, (s) => (s || []).some((x) => x.status === STUDENT_STATUS.ACTIVE || x.status === STUDENT_STATUS.INVITED)) },
    { id: 'aula', label: t('Receba o primeiro pedido de aula'), aba: 'agenda',
      done: tri(lessons, (l) => (l || []).length > 0) },
  ];
  return { items, completo: items.every((i) => i.done === true), feitos: items.filter((i) => i.done === true).length };
}
