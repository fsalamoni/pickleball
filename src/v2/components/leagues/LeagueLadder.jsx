/**
 * A ESCADA (aba "Escada" das ligas em escada) e as SESSÕES (aba "Sessões"):
 * a posição de cada um, refeita dos jogos a cada leitura (`computeLadder`),
 * e cada sessão com as quadras, quem sobe e quem desce e os jogos — onde a
 * organização lança o placar, com o mesmo editor das rodadas.
 */
import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Layers, Minus, Swords } from 'lucide-react';
import { t, fmtLista } from '@/core/i18n';
import { describeTiebreakOrder } from '@/core/domain/tiebreak';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Badge, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { computeLadder, ladderTiebreakOrder } from '@/modules/leagues/domain/leagueLadder';
import { matchWinner } from '@/modules/leagues/domain/leagueResults';
import { normalizeSeason, roundCalendar } from '@/modules/leagues/domain/leagueSeason';
import { DivisionChips } from './LeagueStandings';
import { MatchRow } from './LeagueRounds';
import { divisionSummary, entryNoun, shortDate } from './leagueUi';

/** A escada da divisão escolhida, com quem é "meu". */
export function useDivisionLadder({ league, divisions, entries, matches }) {
  const { user } = useAuth();
  const divs = divisions.data || [];
  const [escolhida, setEscolhida] = useState(null);
  const div = divs.find((d) => d.id === escolhida) || divs[0];
  const dados = useMemo(() => {
    if (!div) return null;
    const es = (entries.data || []).filter((e) => e.division_id === div.id);
    const ms = (matches.data || []).filter((m) => m.division_id === div.id);
    const ladder = computeLadder(es, ms, league.standings);
    const meus = new Set(es.filter((e) => (e.player_uids || []).includes(user?.uid)).map((e) => e.id));
    const porId = new Map(es.map((e) => [e.id, e]));
    return { ladder, meus, porId };
  }, [div, entries.data, matches.data, league.standings, user?.uid]);
  const falhou = [divisions, entries, matches].find((q) => q.isError);
  const carregando = divisions.isLoading || entries.isLoading || matches.isLoading;
  const tentar = () => [divisions, entries, matches].forEach((q) => q.isError && q.refetch());
  return { divs, div, setEscolhida, dados, falhou, carregando, tentar };
}

function Movimento({ row }) {
  if (row.movement === 'up') return <span className="inline-flex items-center text-green-700" title={t('Subiu de quadra')}><ArrowUp className="h-4 w-4" aria-hidden="true" /><span className="sr-only">{t('Subiu de quadra')}</span></span>;
  if (row.movement === 'down') return <span className="inline-flex items-center text-red-600" title={t('Desceu de quadra')}><ArrowDown className="h-4 w-4" aria-hidden="true" /><span className="sr-only">{t('Desceu de quadra')}</span></span>;
  return <Minus className="h-4 w-4 text-gray-300" aria-hidden="true" />;
}

export default function LeagueLadder(props) {
  const { league } = props;
  const { divs, div, setEscolhida, dados, falhou, carregando, tentar } = useDivisionLadder(props);
  if (falhou) return <V2Surface><V2ErrorState title={t('Não carregou a escada')} onRetry={tentar} /></V2Surface>;
  if (carregando) return <V2Skeleton className="h-64" />;
  const rows = dados?.ladder.rows || [];
  const fechadas = (dados?.ladder.sessions || []).filter((s) => s.complete);
  const ultima = fechadas[fechadas.length - 1];
  const criterios = fmtLista(describeTiebreakOrder(ladderTiebreakOrder(league.standings?.tiebreak_order)).map((c) => t(c.label)));

  return (
    <div className="space-y-4">
      <DivisionChips divisions={divs} value={div?.id} onChange={setEscolhida} />
      <V2Surface className="overflow-hidden p-0">
        {div && (
          <p className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 text-sm text-gray-500">
            <span><span className="font-bold text-ink">{div.name}</span> · {divisionSummary(div)}</span>
            <span>{ultima ? t('Depois da sessão {n}', { n: ultima.session }) : t('Ordem inicial (pelo DUPR)')}</span>
          </p>
        )}
        {!rows.length ? (
          <V2EmptyState icon={Layers} title={t('Ninguém nesta divisão ainda')} description={t('A escada aparece com os primeiros inscritos.')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('Escada da divisão {nome}', { nome: div?.name || '' })}</caption>
              <thead className="bg-paper text-2xs font-bold uppercase tracking-widest text-gray-500">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">#</th>
                  <th scope="col" className="w-8 px-1 py-2"><span className="sr-only">{t('Última sessão')}</span></th>
                  <th scope="col" className="px-3 py-2 text-left">{t('Inscrição')}</th>
                  <th scope="col" className="px-2 py-2 text-center" title={t('Sessões jogadas')}>{t('S')}</th>
                  <th scope="col" className="px-2 py-2 text-center" title={t('Jogos')}>{t('J')}</th>
                  <th scope="col" className="px-2 py-2 text-center" title={t('Vitórias')}>{t('V')}</th>
                  <th scope="col" className="hidden px-2 py-2 text-center sm:table-cell" title={t('Derrotas')}>{t('D')}</th>
                  <th scope="col" className="hidden px-3 py-2 text-right sm:table-cell" title={t('Saldo de pontos')}>{t('SP')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.entry_id} className={cn(dados.meus.has(r.entry_id) && 'bg-acid/10', r.withdrawn && 'text-gray-500')}>
                    <td className="px-3 py-3 font-bold text-ink">{r.position ?? '—'}</td>
                    <td className="px-1 py-3"><Movimento row={r} /></td>
                    <td className="px-3 py-3">
                      <span className="font-semibold text-ink">{r.name}</span>
                      {r.withdrawn && <V2Badge tone="neutral" className="ml-2">{t('Desistiu')}</V2Badge>}
                    </td>
                    <td className="px-2 py-3 text-center tabular-nums">{r.sessions}</td>
                    <td className="px-2 py-3 text-center tabular-nums">{r.played}</td>
                    <td className="px-2 py-3 text-center tabular-nums">{r.wins}</td>
                    <td className="hidden px-2 py-3 text-center tabular-nums sm:table-cell">{r.losses}</td>
                    <td className="hidden px-3 py-3 text-right tabular-nums sm:table-cell">{r.points_for - r.points_against}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </V2Surface>
      <p className="px-1 text-xs leading-5 text-gray-500">
        {t('A cada sessão o 1º de cada quadra sobe e o último desce; quem falta fica no mesmo lugar. Quem entra depois começa embaixo.')}{' '}
        {t('Na quadra fica à frente: {criterios}; empate em tudo fica com quem estava acima.', { criterios })}
      </p>
    </div>
  );
}

/** As SESSÕES da escada, da mais nova para a mais antiga. */
export function LeagueSessions(props) {
  const { league, canManage } = props;
  const { divs, div, setEscolhida, dados, falhou, carregando, tentar } = useDivisionLadder(props);
  const [soMeus, setSoMeus] = useState(false);
  if (falhou) return <V2Surface><V2ErrorState title={t('Não carregaram as sessões')} onRetry={tentar} /></V2Surface>;
  if (carregando) return <V2Skeleton className="h-64" />;
  const sessoes = (dados?.ladder.sessions || []).slice().reverse();
  const total = sessoes.length ? sessoes[0].session : 0;
  const cal = roundCalendar(normalizeSeason(league.season), total);
  const nome = (id) => dados?.porId.get(id)?.name || t('Inscrição removida');
  const editavel = canManage && !['finished', 'cancelled'].includes(league.status);
  const meuJogo = (m) => [...(m.team_a || []), ...(m.team_b || [])].some((id) => dados?.meus.has(id));
  const noun = entryNoun(league.format);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DivisionChips divisions={divs} value={div?.id} onChange={setEscolhida} />
        {dados?.meus.size > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} className="h-4 w-4 accent-ink" />
            {t('Só a minha quadra')}
          </label>
        )}
      </div>

      {!sessoes.length ? (
        <V2Surface>
          <V2EmptyState
            icon={Swords}
            title={t('Nenhuma sessão ainda')}
            description={canManage ? t('Em "Gerenciar liga" → Sessões, marque quem veio e gere as quadras da sessão.') : t('A organização monta as quadras de cada sessão com quem vier.')}
          />
        </V2Surface>
      ) : sessoes.map((s) => {
        const dia = cal[s.session - 1]?.date;
        const jogos = s.groups.flatMap((g) => g.matches);
        const lancados = jogos.filter((m) => matchWinner(m) != null).length;
        const quadras = soMeus ? s.groups.filter((g) => g.members.some((id) => dados.meus.has(id))) : s.groups;
        if (soMeus && !quadras.length) return null;
        return (
          <V2Surface key={s.session} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-ink">{t('Sessão {n}', { n: s.session })}</h3>
              <p className="flex items-center gap-2 text-sm text-gray-500">
                {dia ? shortDate(dia) : t('Data a definir')}
                {s.complete ? <V2Badge tone="green">{t('Fechada')}</V2Badge> : <V2Badge tone="blue">{t('{n} de {total} placares', { n: lancados, total: jogos.length })}</V2Badge>}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {quadras.map((g) => (
                <div key={g.index} className={cn('space-y-3 rounded-3xl border p-4', g.members.some((id) => dados.meus.has(id)) ? 'border-acid' : 'border-gray-100')}>
                  <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Quadra {n}', { n: g.index + 1 })} · {g.members.length} {entryNoun(league.format, true)}</p>
                  <ol className="space-y-1 text-sm">
                    {g.ranking.map((id, i) => {
                      const st = g.stats[id] || {};
                      return (
                        <li key={id} className={cn('flex items-center gap-2', dados.meus.has(id) && 'font-semibold')}>
                          <span className="w-5 shrink-0 text-right font-bold tabular-nums text-gray-500">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-ink">{nome(id)}</span>
                          <span className="shrink-0 tabular-nums text-xs text-gray-500">{t('{v} V · saldo {s}', { v: st.wins || 0, s: (st.points_for || 0) - (st.points_against || 0) })}</span>
                          {s.complete && g.up === id && <V2Badge tone="green">{t('Sobe')}</V2Badge>}
                          {s.complete && g.down === id && <V2Badge tone="red">{t('Desce')}</V2Badge>}
                        </li>
                      );
                    })}
                  </ol>
                  <ul className="space-y-2">
                    {g.matches.slice().sort((a, b) => (a.round || 0) - (b.round || 0)).map((m) => (
                      <MatchRow key={m.id} league={league} match={m} nome={nome} meu={meuJogo(m)} editavel={editavel} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {!s.complete && (
              <p className="text-xs text-gray-500">{t('Quem sobe e quem desce aparece quando todos os placares da sessão estiverem lançados.')}</p>
            )}
          </V2Surface>
        );
      })}
      {sessoes.length > 0 && <p className="px-1 text-xs text-gray-500">{t('Cada {quem} joga só com quem está na mesma quadra.', { quem: noun })}</p>}
    </div>
  );
}
