/**
 * "Suas aulas" (lado do PROFESSOR) na tela inicial.
 *
 * O que tem prazo primeiro: os pedidos de aula esperando a resposta dele (o
 * aluno está esperando para marcar). Depois o panorama — próximas aulas,
 * alunos ativos, clínicas por vir — e a porta para o painel.
 *
 * Quem marcou "dou aulas" e ainda não tem perfil de professor vê o caminho
 * para ativar.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, Megaphone, Sparkles, Users } from 'lucide-react';
import { useCoachLessons } from '@/modules/coaches/hooks/useLessons';
import { useCoachStudents } from '@/modules/coaches/hooks/useStudents';
import { useCoachClinics } from '@/modules/coaches/hooks/useClinics';
import { lessonsAwaitingReply, partitionLessons } from '@/modules/coaches/domain/lesson';
import { upcomingClinics } from '@/modules/coaches/domain/clinic';
import { STUDENT_STATUS } from '@/modules/coaches/domain/student';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { HomeAction, HomeEmpty, HomeSection } from './HomeSection';

function Numero({ to, label, value, icon: Icon }) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-3xl border border-gray-100 bg-paper p-4 transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
    >
      <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-gray-400">
        {label} <Icon className="h-4 w-4 text-ink" aria-hidden="true" />
      </span>
      <span className="mt-1 font-display text-2xl font-black text-ink">{value}</span>
    </Link>
  );
}

export default function HomeCoachSection({
  reason, coachId, ehProfessor, marketingOn = false, perfilQ,
}) {
  const aulas = useCoachLessons(ehProfessor ? coachId : null);
  const alunos = useCoachStudents(ehProfessor ? coachId : null);
  const clinicas = useCoachClinics(ehProfessor ? coachId : null);

  const { upcoming } = useMemo(() => partitionLessons(aulas.data || []), [aulas.data]);
  const pedidos = useMemo(() => lessonsAwaitingReply(upcoming).length, [upcoming]);
  const ativos = useMemo(
    () => (alunos.data || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE).length,
    [alunos.data],
  );
  const proxClinicas = useMemo(() => upcomingClinics(clinicas.data || []).length, [clinicas.data]);

  // Falha não é "você não é professor": o convite a ativar mandaria recadastrar.
  if (!ehProfessor && perfilQ?.isError) {
    return (
      <HomeSection id="professor" icon={GraduationCap} title="Suas aulas" reason={reason} action={{ to: '/aulas', label: 'Painel do professor' }}>
        <V2ErrorState inline title="Não carregou o seu perfil de professor" description="O seu perfil continua lá." onRetry={perfilQ.refetch} />
      </HomeSection>
    );
  }
  if (!ehProfessor && perfilQ?.isLoading) {
    return (
      <HomeSection id="professor" icon={GraduationCap} title="Suas aulas" reason={reason}>
        <V2Skeleton className="h-20 rounded-3xl" />
      </HomeSection>
    );
  }
  if (!ehProfessor) {
    return (
      <HomeSection id="professor" icon={GraduationCap} title="Dar aulas" reason={reason}>
        <HomeEmpty icon={GraduationCap} actions={<HomeAction to="/perfil/editar" primary>Ativar perfil de professor</HomeAction>}>
          Ative o seu perfil de professor para publicar horários, receber pedidos de aula e montar clínicas.
        </HomeEmpty>
      </HomeSection>
    );
  }

  const falhou = aulas.isError || alunos.isError || clinicas.isError;
  return (
    <HomeSection id="professor" icon={GraduationCap} title="Suas aulas" reason={reason} action={{ to: '/aulas', label: 'Painel do professor' }}>
      {aulas.isLoading ? (
        <V2Skeleton className="h-28 rounded-3xl" />
      ) : (
        <div className="space-y-3">
          {falhou && (
            <V2ErrorState
              inline
              title="Parte do painel não carregou"
              description="Pode haver pedido de aula esperando resposta."
              onRetry={() => { aulas.refetch(); alunos.refetch(); clinicas.refetch(); }}
            />
          )}
          {!aulas.isError && pedidos > 0 && (
            <Link
              to="/aulas"
              className="group flex items-center justify-between gap-3 rounded-3xl bg-acid px-4 py-3 text-ink transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/20"
            >
              <span className="font-semibold">
                {pedidos === 1 ? '1 pedido de aula esperando a sua resposta' : `${pedidos} pedidos de aula esperando a sua resposta`}
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Numero to="/aulas" label="Próximas" value={aulas.isError ? '—' : upcoming.length} icon={GraduationCap} />
            <Numero to="/aulas" label="Alunos ativos" value={alunos.isError ? '—' : ativos} icon={Users} />
            <Numero to="/aulas" label="Clínicas" value={clinicas.isError ? '—' : proxClinicas} icon={Sparkles} />
          </div>
          {marketingOn && (
            <div className="flex flex-wrap gap-2">
              <HomeAction to="/aulas?secao=divulgacao"><Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> Divulgar com cupom ou campanha</HomeAction>
            </div>
          )}
        </div>
      )}
    </HomeSection>
  );
}
