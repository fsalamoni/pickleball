/**
 * "Hoje" do painel do professor: o que depende dele agora — pedidos esperando
 * resposta, aulas do dia, dúvidas de alunos e pagamentos a receber — e, para o
 * professor novo, o checklist de ativação. Monta-se com as consultas que as
 * outras abas já fazem; fonte que falhou vira "ficou de fora", nunca zero.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, Circle, MessageCircleQuestion, Wallet } from 'lucide-react';
import { todayISO } from '@/modules/arenas/domain/calendar';
import { useCoachAvailability } from '../hooks/useLessons';
import { useCoachStudents } from '../hooks/useStudents';
import { useCoachTrainingQuestions } from '@/modules/training/hooks/useTrainingQuestions';
import { coachActivation, coachToday } from '../domain/coachToday';
import CoachWaitlistSection from './CoachWaitlistSection';
import { lessonFirstSlot } from '../domain/lesson';
import { V2Badge, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t, fmtNumero } from '@/core/i18n';

const brl = (n) => fmtNumero(n, { style: 'currency', currency: 'BRL' });

function Checklist({ coach, lessons, availability, students, onAbrir }) {
  const { items, completo, feitos } = coachActivation({ coach, availability, students, lessons });
  if (completo) return null;
  return (
    <V2Surface className="border-acid/60 bg-acid/10" data-secao-professor="ativacao">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink">{t('Primeiros passos')}</h2>
        <V2Badge tone="neutral">{feitos} de {items.length}</V2Badge>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 text-sm text-ink">
            {i.done === true
              ? <Check className="h-4 w-4 shrink-0 text-green-600" aria-label={t('Feito')} />
              : <Circle className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />}
            {i.done === true ? <span className="text-gray-500 line-through">{i.label}</span> : (
              <button type="button" onClick={() => onAbrir(i.aba)} className="text-left font-semibold underline-offset-2 hover:underline">
                {i.label}
              </button>
            )}
            {i.done === null && <span className="text-xs text-gray-500">{t('(não deu para conferir)')}</span>}
          </li>
        ))}
      </ul>
    </V2Surface>
  );
}

export default function CoachTodaySection({
  coachId, coach, lessons, lessonsLoading, lessonsFailed, onRetryLessons, renderLesson, onAbrir,
}) {
  const duvidasQ = useCoachTrainingQuestions(coachId);
  const dispQ = useCoachAvailability(coachId);
  const alunosQ = useCoachStudents(coachId);
  const hoje = todayISO();
  const resumo = useMemo(
    () => coachToday(lessons, { hoje, questions: duvidasQ.isSuccess ? duvidasQ.data : undefined }),
    [lessons, hoje, duvidasQ.isSuccess, duvidasQ.data],
  );
  const foraDoAr = [duvidasQ.isError && t('dúvidas dos alunos')].filter(Boolean);

  return (
    <div className="space-y-6" data-secao-professor="hoje">
      {!lessonsLoading && !lessonsFailed && (
        <Checklist
          coach={coach}
          lessons={lessons}
          availability={dispQ.isSuccess ? dispQ.data : undefined}
          students={alunosQ.isSuccess ? alunosQ.data : undefined}
          onAbrir={onAbrir}
        />
      )}

      <V2Surface>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold text-ink">{t('Esperando a sua resposta')}</h2>
          {!lessonsLoading && !lessonsFailed && resumo.pedidos.length > 0 && (
            <V2Badge tone="amber">{resumo.pedidos.length === 1 ? '1 pedido' : `${resumo.pedidos.length} pedidos`}</V2Badge>
          )}
        </div>
        {lessonsLoading ? <V2Skeleton lines={2} /> : lessonsFailed ? (
          <V2ErrorState inline title={t('Não foi possível carregar as suas aulas')} description={t('Pode haver pedido de aula esperando resposta.')} onRetry={onRetryLessons} />
        ) : resumo.pedidos.length === 0 ? (
          <p className="text-sm text-gray-500">{t('Nenhum pedido pendente. Os novos aparecem aqui primeiro.')}</p>
        ) : (
          <div className="space-y-2">{resumo.pedidos.map(renderLesson)}</div>
        )}
      </V2Surface>

      <CoachWaitlistSection coachId={coachId} compact onAbrir={onAbrir} />

      <V2Surface>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">{t('Aulas de hoje')}</h2>
        {lessonsLoading ? <V2Skeleton lines={2} /> : lessonsFailed ? (
          <p className="text-sm text-gray-500">{t('Ficou de fora: as aulas não carregaram.')}</p>
        ) : resumo.aulasHoje.length === 0 ? (
          <V2EmptyState icon={CalendarDays} title={t('Nenhuma aula confirmada para hoje')} description={t('As próximas estão na Agenda.')} action={<button type="button" onClick={() => onAbrir('agenda')} className="text-sm font-bold text-ink underline">{t('Abrir a agenda')}</button>} />
        ) : (
          <div className="space-y-2">{resumo.aulasHoje.map(renderLesson)}</div>
        )}
      </V2Surface>

      <div className="grid gap-4 sm:grid-cols-2">
        <V2Surface variant="compacto">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="h-5 w-5 text-ink" aria-hidden />
            <h2 className="font-display text-base font-bold text-ink">{t('Dúvidas de alunos')}</h2>
          </div>
          {duvidasQ.isLoading ? <V2Skeleton lines={1} /> : duvidasQ.isError ? (
            <p className="mt-2 text-sm text-gray-500">{t('Não deu para conferir agora.')} <button type="button" className="font-bold underline" onClick={() => duvidasQ.refetch()}>{t('Tentar de novo')}</button></p>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              {resumo.duvidas === 0 ? t('Nenhuma esperando resposta.') : t('{n} esperando a sua resposta.', { n: resumo.duvidas })}{' '}
              <Link to="/treino?aba=duvidas" className="font-bold text-ink underline">{t('Abrir dúvidas')}</Link>
            </p>
          )}
        </V2Surface>
        <V2Surface variant="compacto">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-ink" aria-hidden />
            <h2 className="font-display text-base font-bold text-ink">{t('Pagamentos a receber')}</h2>
          </div>
          {lessonsLoading ? <V2Skeleton lines={1} /> : lessonsFailed ? (
            <p className="mt-2 text-sm text-gray-500">{t('Ficou de fora: as aulas não carregaram.')}</p>
          ) : resumo.pagamentos.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">{t('Nada pendente.')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {resumo.pagamentos.slice(0, 5).map((l) => {
                const s = lessonFirstSlot(l);
                return <li key={l.id} className="flex justify-between gap-2"><span className="truncate text-ink">{l.student_name || t('Aluno')}{s ? ` · ${s.date.slice(8, 10)}/${s.date.slice(5, 7)}` : ''}</span><span className="font-bold text-ink">{brl(l.price)}</span></li>;
              })}
              {resumo.pagamentos.length > 5 && <li className="text-xs text-gray-500">{t('+{n} na Agenda', { n: resumo.pagamentos.length - 5 })}</li>}
            </ul>
          )}
        </V2Surface>
      </div>

      {foraDoAr.length > 0 && <p className="text-xs text-gray-500">Ficou de fora: {foraDoAr.join(', ')}.</p>}
    </div>
  );
}
