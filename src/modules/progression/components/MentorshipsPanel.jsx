import React from 'react';
import { GraduationCap, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';

const STATUS_META = {
  active: { label: 'Ativa', tone: 'green' },
  paused: { label: 'Pausada', tone: 'amber' },
  completed: { label: 'Concluída', tone: 'blue' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
};

/**
 * MentorshipsPanel — mentorias do atleta, como mentor e como aprendiz.
 *
 * Só mostra e encerra o que já existe. Iniciar mentoria é um convite entre
 * duas pessoas, e o fluxo de convite ainda não existe — oferecer um botão
 * "iniciar" aqui criaria um vínculo unilateral, sem o outro lado aceitar.
 *
 * @param {{
 *   uid: string,
 *   mentorships?: Array<object>,
 *   isLoading?: boolean,
 *   onRecordLesson?: (pairKey: string) => void,
 *   onEnd?: (pairKey: string) => void,
 *   isBusy?: boolean,
 *   className?: string,
 * }} props
 */
export default function MentorshipsPanel({
  uid,
  mentorships = [],
  isLoading = false,
  onRecordLesson,
  onEnd,
  isBusy = false,
  className,
}) {
  if (isLoading) return <V2Skeleton className={cn('h-40 rounded-4xl', className)} />;

  if (mentorships.length === 0) {
    return (
      <V2Surface className={className}>
        <V2EmptyState
          icon={GraduationCap}
          title="Nenhuma mentoria"
          description="Mentoria liga um atleta mais experiente a quem está começando. Combine com a pessoa e o vínculo aparece aqui."
        />
      </V2Surface>
    );
  }

  return (
    <V2Surface className={className}>
      <ul className="space-y-2" data-testid="mentorships-list">
        {mentorships.map((m) => {
          const souMentor = m.mentorUid === uid;
          const meta = STATUS_META[m.status] || STATUS_META.active;
          const ativa = m.status === 'active';
          return (
            <li
              key={m.pairKey}
              data-testid="mentorship-item"
              data-pair-key={m.pairKey}
              data-role={souMentor ? 'mentor' : 'aprendiz'}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {souMentor ? 'Você é o mentor' : 'Você é o aprendiz'}
                </p>
                <p className="text-xs text-gray-500">
                  {m.lessonsCompleted} {m.lessonsCompleted === 1 ? 'aula registrada' : 'aulas registradas'}
                </p>
              </div>
              <V2Badge tone={meta.tone}>{meta.label}</V2Badge>
              {ativa && (
                <div className="flex gap-2">
                  <V2Button
                    variant="secondary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => onRecordLesson?.(m.pairKey)}
                    data-testid="mentorship-lesson-btn"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Registrar aula
                  </V2Button>
                  <V2Button
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => onEnd?.(m.pairKey)}
                    data-testid="mentorship-end-btn"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" /> Encerrar
                  </V2Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </V2Surface>
  );
}
