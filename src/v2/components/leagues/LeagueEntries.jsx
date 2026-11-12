/**
 * Os INSCRITOS da liga, por divisão: o nome da inscrição, os atletas e o
 * DUPR que valeu na inscrição. Sem contato de ninguém (não está gravado).
 */
import React from 'react';
import { Users } from 'lucide-react';
import { t, fmtNumero } from '@/core/i18n';
import { V2Badge, V2EmptyState, V2ErrorState, V2SectionHeader, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { divisionSummary, entryNoun } from './leagueUi';

const dupr = (v) => (Number(v) > 0 ? fmtNumero(Number(v), { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : null);

export default function LeagueEntries({ league, divisions, entries }) {
  if (divisions.isError || entries.isError) {
    return <V2Surface><V2ErrorState title={t('Não carregaram os inscritos')} onRetry={() => { divisions.refetch(); entries.refetch(); }} /></V2Surface>;
  }
  if (divisions.isLoading || entries.isLoading) return <V2Skeleton className="h-64" />;
  const divs = divisions.data || [];
  const todos = entries.data || [];
  if (!todos.length) {
    return <V2Surface><V2EmptyState icon={Users} title={t('Ninguém inscrito ainda')} description={t('Os inscritos aparecem aqui, divisão por divisão.')} /></V2Surface>;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {divs.map((d) => {
        const es = todos.filter((e) => e.division_id === d.id);
        return (
          <V2Surface key={d.id} className="space-y-3">
            <V2SectionHeader eyebrow={`${es.filter((e) => e.status === 'active').length} ${entryNoun(league.format, true)}`} title={d.name} description={divisionSummary(d)} />
            {!es.length ? (
              <p className="text-sm text-gray-500">{t('Ninguém nesta divisão ainda.')}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {es.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{e.name}</p>
                      <p className="text-sm text-gray-500">
                        {(e.players || []).map((p) => (dupr(p.dupr) ? `${p.name} (${dupr(p.dupr)})` : p.name)).join(' · ')}
                      </p>
                    </div>
                    {e.status === 'withdrawn' && <V2Badge tone="neutral">{t('Desistiu')}</V2Badge>}
                    {e.eligibility?.override && e.status === 'active' && <V2Badge tone="amber">{t('Por exceção')}</V2Badge>}
                  </li>
                ))}
              </ul>
            )}
          </V2Surface>
        );
      })}
    </div>
  );
}
