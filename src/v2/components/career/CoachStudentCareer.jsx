/**
 * O que o ALUNO mandou ao professor da Carreira (docs/54 §4.12): os
 * torneios de fora e o balanço de cada um. Só aparece com a flag
 * `athlete_career` e o aluno aberto (a consulta fixa `uid ==` o aluno — é o
 * que a regra `hasActiveStudent` prova). Vínculo encerrado ⇒ a regra recusa:
 * a tela diz que o acesso fechou, nunca "nada mandado".
 */
import React from 'react';
import { useStudentCareerShares } from '@/modules/career/hooks/useCareer';
import { PLACEMENT_LABEL, entryLabel } from '@/modules/career/domain/careerEvent.js';
import { careerDebriefDocId } from '@/modules/career/domain/careerDebrief.js';
import { aspectLabel } from '@/modules/training/domain/debrief.js';
import { V2Badge, V2ErrorState } from '@/v2/ui/primitives';
import { careerDateLabel } from './careerUi';
import { t } from '@/core/i18n';

export default function CoachStudentCareer({ coachUid, studentUid, nome }) {
  const q = useStudentCareerShares(coachUid, studentUid);
  let corpo;
  if (q.isPending) corpo = <p className="text-sm text-gray-500">{t('Carregando…')}</p>;
  else if (q.isError) {
    corpo = q.error?.code === 'permission-denied'
      ? <p className="text-sm text-gray-500">{t('O acesso fechou: o vínculo com este aluno não está ativo.')}</p>
      : <V2ErrorState inline onRetry={() => q.refetch()} />;
  } else if (!q.data.events.length) corpo = <p className="text-sm text-gray-500">{t('Nenhum ainda. Na ficha de um torneio, o aluno escolhe “Mandar ao meu professor”.')}</p>;
  else {
    const balancos = new Map(q.data.debriefs.map((d) => [d.id, d]));
    corpo = (
      <ul className="space-y-2">
        {q.data.events.map((ev) => {
          const b = balancos.get(careerDebriefDocId(studentUid, ev.id));
          return (
            <li key={ev.id} className="space-y-1 rounded-2xl bg-gray-50 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">{ev.name}</p>
                <span className="text-xs text-gray-500">{careerDateLabel(ev.start_date, ev.date_precision)}</span>
              </div>
              {(ev.entries || []).map((e, i) => (
                <p key={i} className="text-gray-600">{[entryLabel(e), e.placement ? t(PLACEMENT_LABEL[e.placement]) : ''].filter(Boolean).join(' · ')}</p>
              ))}
              {ev.status === 'planned' && <V2Badge tone="neutral">{t('Planejado')}</V2Badge>}
              {ev.aim && <p className="text-gray-600">{t('Meta: {m}', { m: ev.aim })}</p>}
              {ev.focus_aspect && <p className="text-gray-600">{t('Foco: {aspecto}', { aspecto: aspectLabel(ev.focus_aspect) })}</p>}
              {b?.status === 'respondido' && (
                <p className="text-gray-600">
                  {[
                    b.strengths?.length ? t('Funcionou: {lista}.', { lista: b.strengths.map((a) => aspectLabel(a).toLowerCase()).join(', ') }) : '',
                    b.weaknesses?.length ? t('Faltou: {lista}.', { lista: b.weaknesses.map((a) => aspectLabel(a).toLowerCase()).join(', ') }) : '',
                  ].filter(Boolean).join(' ')}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <section className="space-y-2" aria-label={t('Torneios de {nome}', { nome })}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">{t('Torneios que mostrou a você')}</h3>
      {corpo}
    </section>
  );
}
