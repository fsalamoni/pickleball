/**
 * A seção CARREIRA da Minha área (`?secao=carreira`, flag `athlete_career`):
 * quantos torneios de fora, o último registro e o que falta nele, o atalho
 * "Registrar torneio" e o link para `/carreira`. Só consulta quando aberta.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Route } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCareerEvents } from '@/modules/career/hooks/useCareer';
import { useMyDebriefs } from '@/modules/training/hooks/useDebriefs';
import { careerAreaSummary } from '@/modules/career/domain/timeline.js';
import { CAREER_STATUS } from '@/modules/career/domain/careerEvent.js';
import { V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { careerDateLabel } from './careerUi';
import { t, tn } from '@/core/i18n';

export default function CareerAreaSection() {
  const { user } = useAuth();
  const q = useCareerEvents();
  // O balanço entra na conta da ficha ("N de 4"); sem os balanços, a conta não aparece.
  // Só consulta quando há um torneio JOGADO para conferir.
  const temJogado = Boolean(q.data?.some((e) => e.status === CAREER_STATUS.PLAYED));
  const balancos = useMyDebriefs(user?.uid, { enabled: temJogado });
  if (q.isPending) return <V2Skeleton lines={3} />;
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram os seus torneios de fora')} onRetry={() => q.refetch()} />;
  const r = careerAreaSummary(q.data, { debriefs: balancos.isSuccess ? balancos.data : undefined });
  const c = balancos.isSuccess ? r.lastCompleteness : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {r.total > 0
          ? [tn(r.played, '{n} torneio de fora registrado', '{n} torneios de fora registrados'), r.podiums ? tn(r.podiums, '{n} pódio', '{n} pódios') : '', r.planned ? tn(r.planned, '{n} planejado', '{n} planejados') : ''].filter(Boolean).join(' · ')
          : t('Registre os torneios que você jogou fora do PickleRush: eles entram na sua linha do tempo, com os daqui.')}
      </p>
      {r.last && (
        <Link
          to={`/carreira?evento=${encodeURIComponent(r.last.id)}`}
          className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper p-3 transition-colors hover:border-ink/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <Route className="h-5 w-5 shrink-0 text-ink" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{r.last.name}</span>
            <span className="block text-xs text-gray-500">
              {[careerDateLabel(r.last.start_date, r.last.date_precision), c ? t('{feito} de {total}', { feito: c.done, total: c.total }) : '', c?.next ? t('Falta: {passo}', { passo: c.next.label }) : ''].filter(Boolean).join(' · ')}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        </Link>
      )}
      {r.last && balancos.isError && (
        <V2ErrorState inline title={t('Não carregaram os seus balanços')} description={t('Sem eles não dá para saber o que falta na ficha.')} onRetry={() => balancos.refetch()} />
      )}
      <div className="flex flex-wrap gap-2">
        <V2Button asChild variant="primary" size="sm"><Link to="/carreira?registrar=1"><Plus className="h-4 w-4" /> {t('Registrar torneio')}</Link></V2Button>
        <V2Button asChild variant="secondary" size="sm"><Link to="/carreira">{t('Abrir a Minha carreira')}</Link></V2Button>
      </div>
    </div>
  );
}
