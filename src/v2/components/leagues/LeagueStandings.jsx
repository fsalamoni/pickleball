/**
 * A CLASSIFICAÇÃO da liga, divisão a divisão. Derivada dos jogos com placar
 * (`computeLeagueStandings`) — nada gravado, sempre igual para todo mundo.
 */
import React, { useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { t, fmtNumero, fmtLista } from '@/core/i18n';
import { describeTiebreakOrder } from '@/core/domain/tiebreak';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Badge, V2EmptyState, V2ErrorState, V2FilterChip, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { computeLeagueStandings, leagueTiebreakOrder } from '@/modules/leagues/domain/leagueResults';
import { divisionSummary } from './leagueUi';

export function DivisionChips({ divisions, value, onChange }) {
  if ((divisions || []).length < 2) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('Divisões')}>
      {divisions.map((d) => (
        <V2FilterChip key={d.id} active={value === d.id} onClick={() => onChange(d.id)}>{d.name}</V2FilterChip>
      ))}
    </div>
  );
}

export default function LeagueStandings({ league, divisions, entries, matches }) {
  const { user } = useAuth();
  const divs = divisions.data || [];
  const [escolhida, setEscolhida] = useState(null);
  const div = divs.find((d) => d.id === escolhida) || divs[0];
  const pontos = league.standings?.mode !== 'win_pct';
  const linhas = useMemo(() => {
    if (!div) return [];
    const es = (entries.data || []).filter((e) => e.division_id === div.id);
    const ms = (matches.data || []).filter((m) => m.division_id === div.id && m.phase !== 'playoff');
    const porId = new Map(es.map((e) => [e.id, e]));
    return computeLeagueStandings(
      es.map((e) => ({ id: e.id, name: e.name, status: e.status })),
      ms,
      league.standings,
    ).map((r) => ({ ...r, minha: (porId.get(r.entry_id)?.player_uids || []).includes(user?.uid) }));
  }, [div, entries.data, matches.data, league.standings, user?.uid]);

  const falhou = [divisions, entries, matches].find((q) => q.isError);
  if (falhou) return <V2Surface><V2ErrorState title={t('Não carregou a classificação')} onRetry={() => [divisions, entries, matches].forEach((q) => q.isError && q.refetch())} /></V2Surface>;
  if (divisions.isLoading || entries.isLoading || matches.isLoading) return <V2Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <DivisionChips divisions={divs} value={div?.id} onChange={setEscolhida} />
      <V2Surface className="overflow-hidden p-0">
        {div && <p className="border-b border-gray-100 px-5 py-3 text-sm text-gray-500"><span className="font-bold text-ink">{div.name}</span> · {divisionSummary(div)}</p>}
        {!linhas.length ? (
          <V2EmptyState icon={Trophy} title={t('Ninguém nesta divisão ainda')} description={t('A tabela aparece com os primeiros inscritos.')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('Classificação da divisão {nome}', { nome: div?.name || '' })}</caption>
              <thead className="bg-paper text-2xs font-bold uppercase tracking-widest text-gray-500">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">#</th>
                  <th scope="col" className="px-3 py-2 text-left">{t('Inscrição')}</th>
                  <th scope="col" className="px-2 py-2 text-center" title={t('Jogos')}>{t('J')}</th>
                  <th scope="col" className="px-2 py-2 text-center" title={t('Vitórias')}>{t('V')}</th>
                  <th scope="col" className="px-2 py-2 text-center" title={t('Derrotas')}>{t('D')}</th>
                  <th scope="col" className="hidden px-2 py-2 text-center sm:table-cell" title={t('Saldo de games')}>{t('SG')}</th>
                  <th scope="col" className="hidden px-2 py-2 text-center sm:table-cell" title={t('Saldo de pontos')}>{t('SP')}</th>
                  <th scope="col" className="px-3 py-2 text-right">{pontos ? t('Pts') : '%'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linhas.map((r) => (
                  <tr key={r.entry_id} className={cn(r.minha && 'bg-acid/10', r.withdrawn && 'text-gray-500')}>
                    <td className="px-3 py-3 font-bold text-ink">{r.position}</td>
                    <td className="px-3 py-3">
                      <span className="font-semibold text-ink">{r.name}</span>
                      {r.withdrawn && <V2Badge tone="neutral" className="ml-2">{t('Desistiu')}</V2Badge>}
                    </td>
                    <td className="px-2 py-3 text-center tabular-nums">{r.played}</td>
                    <td className="px-2 py-3 text-center tabular-nums">{r.wins}</td>
                    <td className="px-2 py-3 text-center tabular-nums">{r.losses}</td>
                    <td className="hidden px-2 py-3 text-center tabular-nums sm:table-cell">{r.games_won - r.games_lost}</td>
                    <td className="hidden px-2 py-3 text-center tabular-nums sm:table-cell">{r.points_for - r.points_against}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">
                      {pontos ? r.points : fmtNumero(r.win_pct * 100, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </V2Surface>
      <p className="px-1 text-xs leading-5 text-gray-500">
        {pontos ? t('Ordem: pontos.') : t('Ordem: aproveitamento.')}{' '}
        {t('Desempate: {criterios}.', { criterios: fmtLista(describeTiebreakOrder(leagueTiebreakOrder(league.standings?.tiebreak_order)).map((c) => t(c.label))) })}
      </p>
    </div>
  );
}
