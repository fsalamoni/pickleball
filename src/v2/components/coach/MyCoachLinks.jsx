/**
 * "Meus professores" — os vínculos de aluno da pessoa, em /minhas-aulas (para
 * onde o aviso "Você foi adicionado por um professor" leva).
 *
 * O vínculo vale enquanto o professor for professor da pessoa: aqui ela aceita
 * ou recusa o convite e deixa de ser aluno. Encerrado, só volta se ela aceitar
 * um novo convite. Sem vínculo aberto, a seção não aparece (não afirma nada).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, GraduationCap } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { useSetStudentStatus, useStudentCoaches } from '@/modules/coaches/hooks/useStudents';
import { STUDENT_STATUS, studentStatusLabel, studentStatusTone } from '@/modules/coaches/domain/student';
import ConfirmDialog from '@/components/ConfirmDialog';
import { V2Badge, V2ErrorState, V2Surface } from '@/v2/ui/primitives';

const ABERTOS = [STUDENT_STATUS.INVITED, STUDENT_STATUS.ACTIVE, STUDENT_STATUS.PAUSED];

function LinkRow({ link, onStatus, pending }) {
  const coach = useCoach(link.coach_id);
  const nome = coach.data?.display_name || 'Professor';
  const convite = link.status === STUDENT_STATUS.INVITED;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/coaches/${link.coach_id}`} className="font-bold text-ink underline-offset-4 hover:underline">{nome}</Link>
          <V2Badge tone={studentStatusTone(link.status)}>{studentStatusLabel(link.status)}</V2Badge>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {convite ? 'Convidou você para ser aluno.' : link.status === STUDENT_STATUS.PAUSED ? 'O professor pausou o vínculo.' : 'Você é aluno deste professor.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {convite && (
          <button type="button" disabled={pending} onClick={() => onStatus(link, STUDENT_STATUS.ACTIVE)} className="rounded-full border border-ink bg-ink px-3 py-1 text-xs font-bold text-white hover:bg-ink/90 disabled:opacity-50">
            <Check className="mr-1 inline h-3 w-3" aria-hidden="true" /> Aceitar
          </button>
        )}
        <ConfirmDialog
          title={convite ? 'Recusar o convite?' : 'Deixar de ser aluno?'}
          description={convite
            ? `${nome} não vira seu professor. Ele só pode convidar de novo.`
            : `${nome} deixa de ver o diário que você compartilhou e de enviar treinos, e o conteúdo só para alunos some. Aulas e pacotes não mudam. O vínculo só volta se você aceitar um novo convite.`}
          confirmLabel={convite ? 'Recusar' : 'Deixar de ser aluno'}
          onConfirm={() => onStatus(link, STUDENT_STATUS.ENDED)}
          trigger={(
            <button type="button" disabled={pending} className="rounded-full border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600 hover:bg-white disabled:opacity-50">
              {convite ? 'Recusar' : 'Deixar de ser aluno'}
            </button>
          )}
        />
      </div>
    </li>
  );
}

export default function MyCoachLinks() {
  const { user } = useAuth();
  const links = useStudentCoaches(user?.uid);
  const setStatus = useSetStudentStatus();

  if (links.isError) {
    return (
      <V2Surface>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">Meus professores</h2>
        <V2ErrorState inline title="Não foi possível carregar os seus professores" onRetry={() => links.refetch()} />
      </V2Surface>
    );
  }
  const abertos = (links.data || []).filter((l) => ABERTOS.includes(l.status));
  if (abertos.length === 0) return null;

  const mudar = async (link, next) => {
    const feito = {
      [STUDENT_STATUS.ACTIVE]: 'Convite aceito.',
      [STUDENT_STATUS.ENDED]: link.status === STUDENT_STATUS.INVITED ? 'Convite recusado.' : 'Você não é mais aluno deste professor.',
    };
    try {
      await setStatus.mutateAsync({ student: link, nextStatus: next });
      toast.success(feito[next]);
    } catch (err) {
      toast.error(err?.message || 'Não foi possível mudar agora.');
    }
  };

  return (
    <V2Surface>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
        <GraduationCap className="h-5 w-5" aria-hidden="true" /> Meus professores
      </h2>
      <ul className="space-y-2">
        {abertos.map((l) => <LinkRow key={l.id || l.coach_id} link={l} onStatus={mudar} pending={setStatus.isPending} />)}
      </ul>
    </V2Surface>
  );
}
