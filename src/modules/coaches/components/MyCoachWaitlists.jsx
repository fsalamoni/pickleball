/**
 * "Esperando horário" em Minhas aulas: as listas de espera de professores em
 * que a pessoa está, com o atalho para o perfil (pedir a aula quando abrir) e
 * o "Sair da lista". Some sem nenhuma lista — não há o que dizer.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BellRing } from 'lucide-react';
import { V2Button, V2ErrorState, V2Surface } from '@/v2/ui/primitives';
import { useLeaveCoachWaitlist, useMyCoachWaitlists } from '../hooks/useCoachWaitlist';
import { sortWaitlist } from '../domain/waitlist';
import { t } from '@/core/i18n';

export default function MyCoachWaitlists() {
  const q = useMyCoachWaitlists();
  const sair = useLeaveCoachWaitlist();

  if (q.isError) {
    return <V2ErrorState inline title={t('Não foi possível carregar as suas listas de espera')} onRetry={() => q.refetch()} />;
  }
  const lista = sortWaitlist(q.data || []);
  if (lista.length === 0) return null;

  const sairDe = async (coachId) => {
    try {
      await sair.mutateAsync({ coachId });
      toast.success(t('Você saiu da lista de espera.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível sair da lista de espera.'));
    }
  };

  return (
    <V2Surface>
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-bold text-ink">
        <BellRing className="h-5 w-5" aria-hidden /> {t('Esperando horário')}
      </h2>
      <p className="mb-3 text-sm text-gray-500">{t('Avisamos você quando estes professores abrirem horários ou vagas.')}</p>
      <ul className="space-y-2">
        {lista.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-paper p-3">
            <Link to={`/coaches/${e.coach_id}?marcar=1`} className="font-semibold text-ink hover:underline">
              {e.coach_name || t('Professor')}
            </Link>
            <V2Button size="sm" variant="ghost" disabled={sair.isPending} onClick={() => sairDe(e.coach_id)}>
              {t('Sair da lista')}
            </V2Button>
          </li>
        ))}
      </ul>
    </V2Surface>
  );
}
