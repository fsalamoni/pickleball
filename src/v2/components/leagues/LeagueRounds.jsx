/**
 * As RODADAS da liga, divisão a divisão: cada rodada com a data e o prazo
 * (do calendário da temporada), os jogos com o placar e quem folga. Quem
 * organiza lança o placar ali mesmo (até 5 games, ou W.O.).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Swords, Trash2 } from 'lucide-react';
import { t } from '@/core/i18n';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { useLeagueAction } from '@/modules/leagues/hooks/useLeagues';
import { normalizeSeason, roundCalendar } from '@/modules/leagues/domain/leagueSeason';
import { MAX_GAMES, RESULT_ERROR_LABELS, matchWinner, validateResult } from '@/modules/leagues/domain/leagueResults';
import { DivisionChips } from './LeagueStandings';
import { shortDate } from './leagueUi';

export default function LeagueRounds({ league, divisions, entries, matches, canManage }) {
  const { user } = useAuth();
  const divs = divisions.data || [];
  const [escolhida, setEscolhida] = useState(null);
  const [soMeus, setSoMeus] = useState(false);
  const div = divs.find((d) => d.id === escolhida) || divs[0];
  const porId = useMemo(() => new Map((entries.data || []).map((e) => [e.id, e])), [entries.data]);
  const meus = useMemo(() => new Set((entries.data || []).filter((e) => (e.player_uids || []).includes(user?.uid)).map((e) => e.id)), [entries.data, user?.uid]);

  const rodadas = useMemo(() => {
    if (!div) return [];
    const ms = (matches.data || []).filter((m) => m.division_id === div.id);
    const total = Math.max(0, ...ms.map((m) => m.round || 0));
    const cal = roundCalendar(normalizeSeason(league.season), total);
    const ativos = (entries.data || []).filter((e) => e.division_id === div.id && e.status === 'active');
    return cal.map((c) => {
      const jogos = ms.filter((m) => m.round === c.round);
      const jogam = new Set(jogos.flatMap((m) => [m.side_a, m.side_b]));
      return { ...c, jogos, folga: ativos.filter((e) => !jogam.has(e.id)) };
    });
  }, [div, matches.data, entries.data, league.season]);

  const falhou = [divisions, entries, matches].find((q) => q.isError);
  if (falhou) return <V2Surface><V2ErrorState title={t('Não carregaram as rodadas')} onRetry={() => [divisions, entries, matches].forEach((q) => q.isError && q.refetch())} /></V2Surface>;
  if (divisions.isLoading || entries.isLoading || matches.isLoading) return <V2Skeleton className="h-64" />;

  const nome = (id) => porId.get(id)?.name || t('Inscrição removida');
  const editavel = canManage && !['finished', 'cancelled'].includes(league.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DivisionChips divisions={divs} value={div?.id} onChange={setEscolhida} />
        {meus.size > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} className="h-4 w-4 accent-ink" />
            {t('Só os meus jogos')}
          </label>
        )}
      </div>

      {!rodadas.length ? (
        <V2Surface>
          <V2EmptyState
            icon={Swords}
            title={t('As rodadas ainda não foram geradas')}
            description={canManage ? t('Em Gerir → Rodadas, gere o calendário de cada divisão quando as inscrições fecharem.') : t('A organização gera os jogos quando as inscrições fecharem.')}
          />
        </V2Surface>
      ) : rodadas.map((r) => {
        const jogos = soMeus ? r.jogos.filter((m) => meus.has(m.side_a) || meus.has(m.side_b)) : r.jogos;
        if (soMeus && !jogos.length) return null;
        return (
          <V2Surface key={r.round} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-ink">{t('Rodada {n}', { n: r.round })}</h3>
              <p className="text-sm text-gray-500">
                {r.date ? shortDate(r.date) : t('Data a definir')}
                {r.deadline && r.deadline !== r.date ? ` · ${t('prazo até {data}', { data: shortDate(r.deadline) })}` : ''}
              </p>
            </div>
            <ul className="space-y-2">
              {jogos.map((m) => <MatchRow key={m.id} league={league} match={m} nome={nome} meu={meus.has(m.side_a) || meus.has(m.side_b)} editavel={editavel} />)}
            </ul>
            {!soMeus && r.folga.length > 0 && (
              <p className="text-xs text-gray-500">{t('Folga: {nomes}', { nomes: r.folga.map((e) => e.name).join(', ') })}</p>
            )}
          </V2Surface>
        );
      })}
    </div>
  );
}

/** O nome de um lado do jogo: a inscrição ou, na escada individual, a dupla da vez. */
export function sideName(match, side, nome) {
  const time = match?.[`team_${side}`];
  return Array.isArray(time) ? time.map(nome).join(' / ') : nome(match?.[`side_${side}`]);
}

function placarTexto(m) {
  if (m.wo_winner) return t('W.O.');
  return (m.games || []).map((g) => `${g.a}–${g.b}`).join(' · ');
}

export function MatchRow({ league, match, nome, meu, editavel }) {
  const [editando, setEditando] = useState(false);
  const venc = matchWinner(match);
  const lado = (side) => (
    <span className={cn('min-w-0 flex-1 truncate', side === 'b' && 'text-right', venc === side ? 'font-bold text-ink' : 'text-gray-600')}>{sideName(match, side, nome)}</span>
  );
  return (
    <li className={cn('rounded-2xl border p-3', meu ? 'border-acid bg-acid/5' : 'border-gray-100')}>
      <div className="flex items-center gap-3">
        {lado('a')}
        <span className="shrink-0 text-center text-sm tabular-nums">
          {venc ? <span className="font-bold text-ink">{placarTexto(match)}</span> : <V2Badge tone="neutral">{t('A jogar')}</V2Badge>}
        </span>
        {lado('b')}
        {editavel && !editando && (
          <V2Button type="button" size="icon" variant="subtle" onClick={() => setEditando(true)} aria-label={venc ? t('Corrigir o placar') : t('Lançar o placar')}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </V2Button>
        )}
      </div>
      {editando && <ResultEditor league={league} match={match} nome={nome} onDone={() => setEditando(false)} />}
    </li>
  );
}

function ResultEditor({ league, match, nome, onDone }) {
  const acao = useLeagueAction();
  const [games, setGames] = useState(() => (match.games?.length ? match.games.map((g) => ({ a: String(g.a), b: String(g.b) })) : [{ a: '', b: '' }]));
  const [wo, setWo] = useState(match.wo_winner || '');
  const [data, setData] = useState(match.scheduled_date || '');
  const r = validateResult({ games: games.map((g) => ({ a: g.a === '' ? undefined : Number(g.a), b: g.b === '' ? undefined : Number(g.b) })), wo_winner: wo || null });
  const setGame = (i, k, v) => setGames((gs) => gs.map((g, j) => (j === i ? { ...g, [k]: v } : g)));

  async function salvar(clear = false) {
    try {
      await acao.mutateAsync(clear
        ? { action: 'result', leagueId: league.id, matchId: match.id, clear: true }
        : { action: 'result', leagueId: league.id, matchId: match.id, games: r.games, wo_winner: r.wo_winner, played_date: data || undefined });
      toast.success(clear ? t('Placar apagado.') : t('Placar lançado.'));
      onDone();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      <V2Field label={t('Resultado')} htmlFor={`wo-${match.id}`}>
        <V2Select
          id={`wo-${match.id}`}
          value={wo}
          onChange={(e) => setWo(e.target.value)}
          options={[
            { value: '', label: t('Jogo disputado') },
            { value: 'a', label: t('W.O.: vence {nome}', { nome: sideName(match, 'a', nome) }) },
            { value: 'b', label: t('W.O.: vence {nome}', { nome: sideName(match, 'b', nome) }) },
          ]}
        />
      </V2Field>
      {!wo && (
        <div className="space-y-2">
          {games.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs font-bold text-gray-500">{t('Game {n}', { n: i + 1 })}</span>
              <V2Input type="number" inputMode="numeric" min={0} max={99} value={g.a} onChange={(e) => setGame(i, 'a', e.target.value)} className="w-20 text-center" aria-label={t('Game {n}: {nome}', { n: i + 1, nome: sideName(match, 'a', nome) })} />
              <span aria-hidden="true">–</span>
              <V2Input type="number" inputMode="numeric" min={0} max={99} value={g.b} onChange={(e) => setGame(i, 'b', e.target.value)} className="w-20 text-center" aria-label={t('Game {n}: {nome}', { n: i + 1, nome: sideName(match, 'b', nome) })} />
              {games.length > 1 && (
                <V2Button type="button" size="icon" variant="subtle" onClick={() => setGames((gs) => gs.filter((_, j) => j !== i))} aria-label={t('Tirar o game {n}', { n: i + 1 })}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </V2Button>
              )}
            </div>
          ))}
          {games.length < MAX_GAMES && (
            <V2Button type="button" size="sm" variant="ghost" onClick={() => setGames((gs) => [...gs, { a: '', b: '' }])}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('Mais um game')}
            </V2Button>
          )}
        </div>
      )}
      <V2Field label={t('Dia do jogo')} htmlFor={`dia-${match.id}`} hint={t('Opcional.')}>
        <V2Input id={`dia-${match.id}`} type="date" value={data} onChange={(e) => setData(e.target.value)} className="max-w-[12rem]" />
      </V2Field>
      {!r.ok && (games.some((g) => g.a !== '' || g.b !== '') || wo) && <p className="text-sm text-red-600">{t(RESULT_ERROR_LABELS[r.error] || '')}</p>}
      <div className="flex flex-wrap gap-2">
        <V2Button type="button" size="sm" onClick={() => salvar(false)} disabled={!r.ok || acao.isPending}>{t('Salvar placar')}</V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={onDone}>{t('Cancelar')}</V2Button>
        {matchWinner(match) && <V2Button type="button" size="sm" variant="danger" onClick={() => salvar(true)} disabled={acao.isPending}>{t('Apagar placar')}</V2Button>}
      </div>
    </div>
  );
}
