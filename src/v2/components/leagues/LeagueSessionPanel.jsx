/**
 * Gerir → Sessões (escada): para cada divisão, a CHAMADA de quem veio, na
 * ordem da escada, com a prévia das quadras que sairão — a mesma conta que o
 * servidor faz (`buildSessionGroups`). Gerar é a ação `session` da função.
 */
import React, { useMemo, useState } from 'react';
import { CheckSquare, Shuffle, Square } from 'lucide-react';
import { t } from '@/core/i18n';
import { cn } from '@/core/lib/utils';
import { V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import {
  LADDER_GROUP_ERROR_LABELS, buildSessionGroups, computeLadder, ladderNearestFits, nextSessionState,
} from '@/modules/leagues/domain/leagueLadder';
import { entryNoun } from './leagueUi';

export default function LeagueSessionPanel({ league, divisions, entries, matches, salvar, pending }) {
  const falhou = [divisions, entries, matches].find((q) => q.isError);
  if (falhou) return <V2Surface><V2ErrorState inline title={t('Não carregaram as sessões')} onRetry={() => [divisions, entries, matches].forEach((q) => q.isError && q.refetch())} /></V2Surface>;
  if (![divisions, entries, matches].every((q) => q.isSuccess)) return <V2Skeleton className="h-40" />;
  const bloqueada = ['draft', 'finished', 'cancelled'].includes(league.status);
  return (
    <div className="space-y-4">
      {bloqueada && <p className="rounded-2xl bg-paper p-4 text-sm text-gray-500">{league.status === 'draft' ? t('Abra as inscrições antes de gerar uma sessão.') : t('A liga está encerrada.')}</p>}
      {(divisions.data || []).map((d) => (
        <DivisionSession
          key={d.id}
          league={league}
          division={d}
          entries={(entries.data || []).filter((e) => e.division_id === d.id)}
          matches={(matches.data || []).filter((m) => m.division_id === d.id)}
          bloqueada={bloqueada}
          salvar={salvar}
          pending={pending}
        />
      ))}
      {league.status === 'open' && <p className="text-xs text-gray-500">{t('Gerar a primeira sessão começa a temporada. Na escada, a organização pode inscrever gente nova a qualquer momento: entra embaixo.')}</p>}
    </div>
  );
}

function DivisionSession({ league, division, entries, matches, bloqueada, salvar, pending }) {
  const ladder = useMemo(() => computeLadder(entries, matches, league.standings), [entries, matches, league.standings]);
  const estado = nextSessionState(ladder);
  const porId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const ordem = ladder.order.filter((id) => porId.get(id)?.status === 'active');
  // A chamada guarda quem FALTOU: vazia = todos presentes (o padrão).
  const [faltas, setFaltas] = useState(() => new Set());
  const presentes = ordem.filter((id) => !faltas.has(id));
  const previa = buildSessionGroups(league.format, presentes);
  const perto = previa.ok ? null : ladderNearestFits(league.format, presentes.length);
  const alternar = (id) => setFaltas((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const posicao = new Map(ladder.rows.map((r) => [r.entry_id, r.position]));
  const gerar = () => salvar(
    { action: 'session', leagueId: league.id, divisionId: division.id, present: presentes, start: league.status === 'open' },
    estado.redo ? t('Sessão {n} refeita.', { n: estado.number }) : t('Sessão {n} gerada.', { n: estado.number }),
  );

  return (
    <V2Surface className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">{division.name}</p>
        <p className="text-sm text-gray-500">
          {ordem.length} {entryNoun(league.format, true)} · {ladder.sessions.length ? t('{n} sessões', { n: ladder.sessions.length }) : t('nenhuma sessão ainda')}
        </p>
      </div>

      {estado.blocked ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">{t('Lance todos os placares da sessão {n} (aba Sessões) para gerar a próxima.', { n: estado.number })}</p>
      ) : bloqueada ? null : ordem.length < 2 ? (
        <p className="text-sm text-gray-500">{t('Precisa de pelo menos 2 inscritos.')}</p>
      ) : (
        <>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{t('Quem veio à sessão {n}', { n: estado.number })}</p>
              <div className="flex gap-1">
                <V2Button type="button" size="sm" variant="ghost" onClick={() => setFaltas(new Set())}>{t('Todos')}</V2Button>
                <V2Button type="button" size="sm" variant="ghost" onClick={() => setFaltas(new Set(ordem))}>{t('Ninguém')}</V2Button>
              </div>
            </div>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {ordem.map((id) => {
                const veio = !faltas.has(id);
                const Icone = veio ? CheckSquare : Square;
                return (
                  <li key={id}>
                    <button type="button" role="checkbox" aria-checked={veio} onClick={() => alternar(id)}
                      className={cn('flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition coarse:min-h-11 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30', veio ? 'border-ink bg-paper-pure' : 'border-gray-100 bg-paper text-gray-500')}>
                      <Icone className={cn('h-4 w-4 shrink-0', veio ? 'text-ink' : 'text-gray-500')} aria-hidden="true" />
                      <span className="w-6 shrink-0 text-right font-bold tabular-nums">{posicao.get(id)}</span>
                      <span className="min-w-0 flex-1 truncate">{porId.get(id)?.name || id}</span>
                      {!veio && <span className="text-xs">{t('faltou')}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div aria-live="polite">
            {previa.ok ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-ink">{t('{n} presentes em {q} quadras', { n: presentes.length, q: previa.groups.length })}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {previa.groups.map((g, i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 p-3">
                      <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Quadra {n}', { n: i + 1 })}</p>
                      <p className="mt-1 text-sm text-ink">{g.map((id) => porId.get(id)?.name || id).join(' · ')}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                {t(LADDER_GROUP_ERROR_LABELS[previa.error] || LADDER_GROUP_ERROR_LABELS.no_fit)}{' '}
                {perto?.below && perto?.above ? t('Fecha com {a} ou {b} presentes.', { a: perto.below, b: perto.above })
                  : perto?.below || perto?.above ? t('Fecha com {a} presentes.', { a: perto.below || perto.above }) : null}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <V2Button type="button" disabled={pending || !previa.ok} onClick={gerar}>
              <Shuffle className="h-4 w-4" aria-hidden="true" /> {estado.redo ? t('Refazer a sessão {n}', { n: estado.number }) : t('Gerar a sessão {n}', { n: estado.number })}
            </V2Button>
            {estado.redo && <V2Badge tone="amber">{t('A sessão {n} ainda não tem placar: dá para refazer com outra chamada.', { n: estado.number })}</V2Badge>}
          </div>
        </>
      )}
    </V2Surface>
  );
}
