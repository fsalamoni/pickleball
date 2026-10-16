/**
 * A lista de espera no PAINEL DO PROFESSOR (Agenda): quem quer aula e não
 * achou horário, com as preferências e o recado, para o professor abrir os
 * horários certos — ou conversar com a pessoa. Salvar horários novos avisa a
 * lista sozinho (servidor, `functions/coachWaitlist.js`).
 *
 * `compact`: a linha do "Hoje" — só o número e o atalho, e some sem ninguém.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BellRing } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useCoachWaitlist, useLeaveCoachWaitlist } from '../hooks/useCoachWaitlist';
import { LESSON_FORMAT_LABELS } from '../domain/lesson';
import { sortWaitlist, waitlistPreferenceText } from '../domain/waitlist';
import { t, tk, tn, fmtData } from '@/core/i18n';

const WEEKDAY_SHORT = [tk('Dom'), tk('Seg'), tk('Ter'), tk('Qua'), tk('Qui'), tk('Sex'), tk('Sáb')];

function quando(ms) {
  return ms ? fmtData(ms, { day: '2-digit', month: '2-digit' }) : '';
}
const msDe = (v, alt) => (v && typeof v.toMillis === 'function' ? v.toMillis() : Number(alt) || null);

export default function CoachWaitlistSection({ coachId, compact = false, onAbrir }) {
  const q = useCoachWaitlist(coachId);
  const tirar = useLeaveCoachWaitlist();
  const [remover, setRemover] = useState(null);
  const lista = useMemo(() => sortWaitlist(q.data || []), [q.data]);
  const dias = WEEKDAY_SHORT.map((d) => t(d));

  if (compact) {
    if (!q.isSuccess || lista.length === 0) return null;
    return (
      <V2Surface className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <BellRing className="h-4 w-4" aria-hidden />
          {tn(lista.length, '{n} aluno esperando você abrir horários', '{n} alunos esperando você abrir horários')}
        </p>
        <V2Button size="sm" variant="secondary" onClick={() => onAbrir?.('agenda')}>{t('Ver a lista de espera')}</V2Button>
      </V2Surface>
    );
  }

  const confirmarRemocao = async () => {
    try {
      await tirar.mutateAsync({ coachId, uid: remover.user_id });
      toast.success(t('Removido da lista de espera.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível remover.'));
    } finally {
      setRemover(null);
    }
  };

  return (
    <V2Surface data-secao-professor="lista-de-espera">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-lg font-bold text-ink">{t('Lista de espera')}</h2>
        {q.isSuccess && lista.length > 0 && <V2Badge tone="amber">{lista.length}</V2Badge>}
      </div>
      <p className="mb-4 text-sm text-gray-500">
        {t('Alunos que querem aula e não acharam horário. Quando você salvar horários novos, avisamos todos da lista automaticamente.')}
      </p>
      {q.isLoading ? <V2Skeleton lines={2} /> : q.isError ? (
        <V2ErrorState inline title={t('Não foi possível carregar a lista de espera')} onRetry={() => q.refetch()} />
      ) : lista.length === 0 ? (
        <V2EmptyState icon={BellRing} title={t('Ninguém na lista de espera')} description={t('Quem não achar horário livre pode entrar aqui pelo seu perfil.')} />
      ) : (
        <ul className="space-y-2">
          {lista.map((e) => {
            const prefs = waitlistPreferenceText(e, dias);
            const avisado = msDe(e.notified_at);
            return (
              <li key={e.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{e.student_name || t('Aluno')}</p>
                    <p className="text-xs text-gray-500">
                      {t('Na lista desde {data}', { data: quando(msDe(e.created_at, e.created_at_ms)) })}
                      {e.format && LESSON_FORMAT_LABELS[e.format] ? ` · ${t(LESSON_FORMAT_LABELS[e.format])}` : ''}
                      {prefs ? ` · ${prefs}` : ''}
                      {avisado ? ` · ${t('avisado em {data}', { data: quando(avisado) })}` : ''}
                    </p>
                    {e.note && <p className="mt-1 whitespace-pre-line text-sm text-ink">{e.note}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <V2ChatLauncherButton athlete={{ id: e.user_id, platform_name: e.student_name }} variant="outline" label={t('Conversar')} />
                    <V2Button size="sm" variant="ghost" onClick={() => setRemover(e)}>{t('Remover')}</V2Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={!!remover}
        onOpenChange={(v) => { if (!v) setRemover(null); }}
        title={t('Tirar da lista de espera?')}
        description={t('{nome} deixa de ser avisado quando você abrir horários.', { nome: remover?.student_name || t('O aluno') })}
        confirmLabel={t('Remover')}
        onConfirm={confirmarRemocao}
      />
    </V2Surface>
  );
}
