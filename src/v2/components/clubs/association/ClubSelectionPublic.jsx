/**
 * A SELEÇÃO DO CLUBE na página pública (Bloco E3): as delegações abertas ou já encerradas, com a
 * lista dos confirmados (atletas e comissão técnica). A lista não leva identificador de conta e o
 * menor de idade aparece só com o primeiro nome e a inicial. Sem nenhuma convocação publicada a
 * seção não existe; falha de consulta diz que não carregou, nunca "sem seleção".
 */
import React from 'react';
import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import { usePublicCallups } from '@/modules/clubs/hooks/useClubSelection';
import { CALLUP_ROLE_LABELS, CALLUP_STATUS } from '@/modules/clubs/domain/selection';
import { dataCurta } from '@/v2/components/federations/referees/refUi';
import { V2Badge, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

function Delegacao({ cu }) {
  const roster = Array.isArray(cu.roster) ? cu.roster : [];
  const grupos = ['athlete', 'staff'].map((r) => ({ papel: r, itens: roster.filter((x) => x.role === r) })).filter((g) => g.itens.length);
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{cu.title}<V2Badge tone={cu.status === CALLUP_STATUS.OPEN ? 'green' : 'blue'}>{cu.status === CALLUP_STATUS.OPEN ? t('Em formação') : t('Encerrada')}</V2Badge></p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1"><Trophy className="h-4 w-4" aria-hidden="true" />{cu.event_name}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden="true" />{dataCurta(cu.starts_at)}{cu.ends_at && cu.ends_at !== cu.starts_at ? ` – ${dataCurta(cu.ends_at)}` : ''}</span>
            {cu.place && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{cu.place}</span>}
          </p>
          {cu.message && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{cu.message}</p>}
        </div>
        {grupos.length === 0
          ? <p className="text-sm text-gray-500">{t('Ninguém confirmou ainda.')}</p>
          : grupos.map((g) => (
            <div key={g.papel}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">{t(CALLUP_ROLE_LABELS[g.papel])} ({g.itens.length})</h4>
              <ul className="mt-1 flex flex-wrap gap-2">{g.itens.map((x) => <li key={x.key}><V2Badge tone="neutral">{x.name}{x.label ? ` · ${x.label}` : ''}</V2Badge></li>)}</ul>
            </div>
          ))}
      </V2Surface>
    </li>
  );
}

export default function ClubSelectionPublic({ clubId, enabled = true }) {
  // A regra só deixa ler a convocação pública com a associação publicada: fora disso nem se consulta.
  const q = usePublicCallups(clubId, { enabled });
  if (!enabled) return null;
  if (q.isLoading) return <V2Skeleton lines={2} />;
  if (q.isError) return <section id="clube-selecao" className="scroll-mt-4"><V2ErrorState inline title={t('A seleção do clube não carregou')} onRetry={() => q.refetch()} /></section>;
  const rows = (q.data || []).slice(0, 6);
  if (!rows.length) return null;
  return (
    <section id="clube-selecao" aria-labelledby="clube-selecao-titulo" className="scroll-mt-4 space-y-3" data-dica="clube-selecao-publica">
      <h2 id="clube-selecao-titulo" className="font-display text-xl font-bold text-ink">{t('Seleção do clube')}</h2>
      <ul className="space-y-3">{rows.map((cu) => <Delegacao key={cu.id} cu={cu} />)}</ul>
    </section>
  );
}
