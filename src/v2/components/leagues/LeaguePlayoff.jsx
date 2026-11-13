/**
 * O PLAYOFF da liga, divisão a divisão: a chave do mata-mata do fim da
 * temporada (os N primeiros da tabela), fase a fase, e o campeão. Tudo é
 * derivado dos jogos (`playoffState`); quem organiza monta a chave e gera a
 * fase seguinte quando a atual fecha — o servidor confere e grava.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Medal, RefreshCw, Trophy } from 'lucide-react';
import { t } from '@/core/i18n';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useLeagueAction } from '@/modules/leagues/hooks/useLeagues';
import { normalizeSeason } from '@/modules/leagues/domain/leagueSeason';
import { computeLeagueStandings, matchWinner } from '@/modules/leagues/domain/leagueResults';
import { playoffRoundLabel, playoffSize, playoffState } from '@/modules/leagues/domain/leaguePlayoff';
import { DivisionChips } from './LeagueStandings';
import { MatchRow } from './LeagueRounds';

export default function LeaguePlayoff({ league, divisions, entries, matches, canManage }) {
  const { user } = useAuth();
  const acao = useLeagueAction();
  const divs = divisions.data || [];
  const [escolhida, setEscolhida] = useState(null);
  const div = divs.find((d) => d.id === escolhida) || divs[0];
  const season = normalizeSeason(league.season);
  const porId = useMemo(() => new Map((entries.data || []).map((e) => [e.id, e])), [entries.data]);
  const meus = useMemo(() => new Set((entries.data || []).filter((e) => (e.player_uids || []).includes(user?.uid)).map((e) => e.id)), [entries.data, user?.uid]);

  const quadro = useMemo(() => {
    if (!div) return null;
    const ms = (matches.data || []).filter((m) => m.division_id === div.id);
    const temporada = ms.filter((m) => m.phase !== 'playoff');
    const po = ms.filter((m) => m.phase === 'playoff');
    const es = (entries.data || []).filter((e) => e.division_id === div.id);
    const seeds = computeLeagueStandings(es.map((e) => ({ id: e.id, name: e.name, status: e.status })), temporada, league.standings)
      .filter((r) => !r.withdrawn).map((r) => r.entry_id);
    const estado = playoffState(po, { thirdPlace: season.playoff.third_place });
    const tamanho = estado.stage === 'none' ? playoffSize(season.playoff.size, seeds.length) : 2 ** estado.total;
    const total = estado.total || (tamanho ? Math.log2(tamanho) : 0);
    const fases = Array.from({ length: total }, (_, i) => ({
      round: i + 1,
      jogos: po.filter((m) => m.round === i + 1 && !m.third).sort((a, b) => (a.slot || 0) - (b.slot || 0)),
    }));
    const cabecas = new Map(po.filter((m) => m.round === 1).flatMap((m) => [[m.side_a, m.seed_a], [m.side_b, m.seed_b]]));
    return {
      seeds, estado, tamanho, total, fases, cabecas, terceiro: po.find((m) => m.third) || null,
      semPlacar: temporada.filter((m) => !matchWinner(m)).length,
      comPlacar: po.some((m) => matchWinner(m)),
    };
  }, [div, matches.data, entries.data, league.standings, season.playoff.third_place, season.playoff.size]);

  const falhou = [divisions, entries, matches].find((q) => q.isError);
  if (falhou) return <V2Surface><V2ErrorState title={t('Não carregou o playoff')} onRetry={() => [divisions, entries, matches].forEach((q) => q.isError && q.refetch())} /></V2Surface>;
  if (divisions.isLoading || entries.isLoading || matches.isLoading) return <V2Skeleton className="h-64" />;
  if (!quadro) return <V2Surface><V2EmptyState icon={Medal} title={t('Nenhuma divisão ainda')} /></V2Surface>;

  const nomeSo = (id) => porId.get(id)?.name || t('Inscrição removida');
  const nome = (id) => (quadro.cabecas.get(id) ? `(${quadro.cabecas.get(id)}) ${nomeSo(id)}` : nomeSo(id));
  const andando = league.status === 'running';
  const editavel = canManage && andando;
  const { estado } = quadro;
  const rodar = async (payload, ok) => {
    try {
      await acao.mutateAsync({ leagueId: league.id, divisionId: div.id, ...payload });
      toast.success(ok);
    } catch (err) {
      toast.error(err.message);
    }
  };
  const montar = () => rodar({ action: 'playoff', seeds: quadro.seeds }, t('A chave do playoff está pronta.'));
  const proxima = estado.stage === 'ready' ? playoffRoundLabel(estado.round + 1, estado.total) : null;

  return (
    <div className="space-y-4">
      <DivisionChips divisions={divs} value={div.id} onChange={setEscolhida} />

      {estado.stage === 'done' && (
        <V2Surface className="flex items-start gap-4 bg-ink text-white">
          <Trophy className="mt-1 h-8 w-8 shrink-0 text-acid" aria-hidden="true" />
          <div>
            <p className="text-2xs font-bold uppercase tracking-widest text-acid">{t('Campeão da divisão {nome}', { nome: div.name })}</p>
            <p className="mt-1 font-display text-2xl font-bold">{nomeSo(estado.champion)}</p>
            <p className="mt-1 text-sm text-gray-300">
              {t('Vice: {nome}', { nome: nomeSo(estado.runner_up) })}
              {estado.third ? ` · ${t('3º lugar: {nome}', { nome: nomeSo(estado.third) })}` : ''}
            </p>
          </div>
        </V2Surface>
      )}

      {estado.stage === 'none' ? (
        <V2Surface className="space-y-4">
          <V2EmptyState
            icon={Medal}
            title={quadro.tamanho ? t('Playoff com os {n} primeiros', { n: quadro.tamanho }) : t('Faltam inscrições para o playoff')}
            description={canManage
              ? t('Quando a temporada acabar, monte a chave: a cabeça 1 enfrenta a última classificada e as duas primeiras só se cruzam na final.')
              : t('A chave sai da classificação quando a temporada acabar.')}
          />
          {canManage && quadro.tamanho > 0 && (
            <div className="space-y-3">
              <ol className="grid gap-2 sm:grid-cols-2">
                {quadro.seeds.slice(0, quadro.tamanho).map((id, i) => (
                  <li key={id} className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-2 text-sm">
                    <span className="w-6 font-bold tabular-nums text-gray-500">{i + 1}</span>
                    <span className="font-semibold text-ink">{nomeSo(id)}</span>
                  </li>
                ))}
              </ol>
              {quadro.semPlacar > 0 && (
                <p className="text-xs text-gray-500">{t('{n} jogos da temporada ainda sem placar: a tabela, e com ela a chave, ainda pode mudar.', { n: quadro.semPlacar })}</p>
              )}
              {andando ? (
                <V2Button type="button" onClick={montar} disabled={acao.isPending}>{t('Montar a chave')}</V2Button>
              ) : (
                <p className="text-xs text-gray-500">{t('A chave é montada com a liga em andamento.')}</p>
              )}
            </div>
          )}
        </V2Surface>
      ) : (
        <>
          {quadro.fases.map((f) => (
            <V2Surface key={f.round} className="space-y-3">
              <h3 className="font-display text-lg font-bold text-ink">{t(playoffRoundLabel(f.round, quadro.total))}</h3>
              {f.jogos.length ? (
                <ul className="space-y-2">
                  {f.jogos.map((m) => <MatchRow key={m.id} league={league} match={m} nome={nome} porId={porId} meu={meus.has(m.side_a) || meus.has(m.side_b)} editavel={editavel} />)}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">{t('Sai quando a fase anterior terminar.')}</p>
              )}
              {f.round === quadro.total && quadro.terceiro && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{t('Disputa do 3º lugar')}</p>
                  <ul><MatchRow league={league} match={quadro.terceiro} nome={nome} porId={porId} meu={meus.has(quadro.terceiro.side_a) || meus.has(quadro.terceiro.side_b)} editavel={editavel} /></ul>
                </div>
              )}
            </V2Surface>
          ))}
          {editavel && (estado.stage === 'ready' || !quadro.comPlacar) && (
            <div className="flex flex-wrap gap-2">
              {estado.stage === 'ready' && (
                <V2Button type="button" onClick={() => rodar({ action: 'playoff' }, t('Fase gerada.'))} disabled={acao.isPending}>
                  {t('Gerar: {fase}', { fase: t(proxima) })}
                </V2Button>
              )}
              {!quadro.comPlacar && (
                <V2Button type="button" variant="ghost" onClick={() => rodar({ action: 'playoff', reseed: true, seeds: quadro.seeds }, t('A chave do playoff está pronta.'))} disabled={acao.isPending}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t('Refazer a chave pela tabela')}
                </V2Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
