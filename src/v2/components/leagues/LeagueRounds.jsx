/**
 * As RODADAS da liga, divisão a divisão: cada rodada com a data e o prazo
 * (do calendário da temporada), os jogos com o placar e quem folga. Quem
 * organiza lança o placar ali mesmo (até 5 games, ou W.O.). Nas EQUIPES o
 * jogo é o confronto: um game por linha (feminina, masculina, mistas…) e, no
 * empate, o DreamBreaker.
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
import { formatMeta, resultRules } from '@/modules/leagues/domain/leagueFormats';
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

/** As linhas do confronto de equipe (`null` fora das equipes e na escada). */
function linhasDoJogo(league, match) {
  if (match?.phase === 'ladder') return null;
  return resultRules(league?.format).lines ? formatMeta(league.format).lines : null;
}

function placarTexto(m, linhas) {
  if (m.wo_winner) return t('W.O.');
  if (linhas) {
    const ga = (m.games || []).filter((g) => g.a > g.b).length;
    const db = m.dreambreaker ? ` · ${t('DB {a}–{b}', { a: m.dreambreaker.a, b: m.dreambreaker.b })}` : '';
    return `${ga}–${(m.games || []).length - ga}${db}`;
  }
  return (m.games || []).map((g) => `${g.a}–${g.b}`).join(' · ');
}

export function MatchRow({ league, match, nome, meu, editavel }) {
  const [editando, setEditando] = useState(false);
  const venc = matchWinner(match);
  const linhas = linhasDoJogo(league, match);
  const lado = (side) => (
    <span className={cn('min-w-0 flex-1 truncate', side === 'b' && 'text-right', venc === side ? 'font-bold text-ink' : 'text-gray-600')}>{sideName(match, side, nome)}</span>
  );
  return (
    <li className={cn('rounded-2xl border p-3', meu ? 'border-acid bg-acid/5' : 'border-gray-100')}>
      <div className="flex items-center gap-3">
        {lado('a')}
        <span className="shrink-0 text-center text-sm tabular-nums">
          {venc ? <span className="font-bold text-ink">{placarTexto(match, linhas)}</span> : <V2Badge tone="neutral">{t('A jogar')}</V2Badge>}
        </span>
        {lado('b')}
        {editavel && !editando && (
          <V2Button type="button" size="icon" variant="subtle" onClick={() => setEditando(true)} aria-label={venc ? t('Corrigir o placar') : t('Lançar o placar')}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </V2Button>
        )}
      </div>
      {linhas && venc && !match.wo_winner && !editando && (
        <ul className="mt-2 grid gap-x-4 gap-y-1 text-xs text-gray-500 sm:grid-cols-2">
          {linhas.map((l, i) => match.games?.[i] && (
            <li key={l.key} className="flex justify-between gap-2">
              <span className="truncate">{t(l.label)}</span>
              <span className="tabular-nums">{match.games[i].a}–{match.games[i].b}</span>
            </li>
          ))}
          {match.dreambreaker && (
            <li className="flex justify-between gap-2 font-semibold text-gray-600">
              <span>{t('DreamBreaker')}</span>
              <span className="tabular-nums">{match.dreambreaker.a}–{match.dreambreaker.b}</span>
            </li>
          )}
        </ul>
      )}
      {editando && <ResultEditor league={league} match={match} nome={nome} linhas={linhas} onDone={() => setEditando(false)} />}
    </li>
  );
}

const paraTexto = (g) => ({ a: g?.a == null ? '' : String(g.a), b: g?.b == null ? '' : String(g.b) });
const paraNumero = (v) => (v === '' ? undefined : Number(v));

function ResultEditor({ league, match, nome, linhas, onDone }) {
  const acao = useLeagueAction();
  const [games, setGames] = useState(() => {
    if (linhas) return linhas.map((_, i) => paraTexto(match.games?.[i]));
    return match.games?.length ? match.games.map(paraTexto) : [{ a: '', b: '' }];
  });
  const [db, setDb] = useState(() => paraTexto(match.dreambreaker));
  const [wo, setWo] = useState(match.wo_winner || '');
  const [data, setData] = useState(match.scheduled_date || '');
  const regras = linhas ? resultRules(league.format) : {};
  const r = validateResult({
    // Na equipe, linha meio preenchida conta como "falta jogo" (e não "placar inválido").
    games: (linhas ? games.filter((g) => g.a !== '' && g.b !== '') : games).map((g) => ({ a: paraNumero(g.a), b: paraNumero(g.b) })),
    wo_winner: wo || null,
    dreambreaker: { a: paraNumero(db.a), b: paraNumero(db.b) },
  }, regras);
  const setGame = (i, k, v) => setGames((gs) => gs.map((g, j) => (j === i ? { ...g, [k]: v } : g)));
  // O DreamBreaker só aparece quando os jogos do confronto empataram.
  const pedeDb = regras.dreambreaker && (r.error === 'needs_db' || r.error === 'db_tie' || Boolean(r.dreambreaker));
  const rotulo = (i) => (linhas ? t(linhas[i].label) : t('Game {n}', { n: i + 1 }));

  async function salvar(clear = false) {
    try {
      await acao.mutateAsync(clear
        ? { action: 'result', leagueId: league.id, matchId: match.id, clear: true }
        : { action: 'result', leagueId: league.id, matchId: match.id, games: r.games, wo_winner: r.wo_winner, dreambreaker: r.dreambreaker, played_date: data || undefined });
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
              <span className={cn('shrink-0 text-xs font-bold leading-tight text-gray-500', linhas ? 'w-24 sm:w-32' : 'w-16')}>{rotulo(i)}</span>
              <V2Input type="number" inputMode="numeric" min={0} max={99} value={g.a} onChange={(e) => setGame(i, 'a', e.target.value)} className="w-20 text-center" aria-label={t('{jogo}: {nome}', { jogo: rotulo(i), nome: sideName(match, 'a', nome) })} />
              <span aria-hidden="true">–</span>
              <V2Input type="number" inputMode="numeric" min={0} max={99} value={g.b} onChange={(e) => setGame(i, 'b', e.target.value)} className="w-20 text-center" aria-label={t('{jogo}: {nome}', { jogo: rotulo(i), nome: sideName(match, 'b', nome) })} />
              {!linhas && games.length > 1 && (
                <V2Button type="button" size="icon" variant="subtle" onClick={() => setGames((gs) => gs.filter((_, j) => j !== i))} aria-label={t('Tirar o game {n}', { n: i + 1 })}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </V2Button>
              )}
            </div>
          ))}
          {pedeDb && (
            <div className="space-y-2 rounded-2xl bg-paper p-3">
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs font-bold leading-tight text-ink sm:w-32">{t('DreamBreaker')}</span>
                <V2Input type="number" inputMode="numeric" min={0} max={99} value={db.a} onChange={(e) => setDb((x) => ({ ...x, a: e.target.value }))} className="w-20 text-center" aria-label={t('DreamBreaker: {nome}', { nome: sideName(match, 'a', nome) })} />
                <span aria-hidden="true">–</span>
                <V2Input type="number" inputMode="numeric" min={0} max={99} value={db.b} onChange={(e) => setDb((x) => ({ ...x, b: e.target.value }))} className="w-20 text-center" aria-label={t('DreamBreaker: {nome}', { nome: sideName(match, 'b', nome) })} />
              </div>
              <p className="text-xs leading-5 text-gray-500">{t('Empate nos jogos: decide o DreamBreaker, simples em rodízio (todos da equipe jogam, trocando a cada 4 pontos), até 21.')}</p>
            </div>
          )}
          {!linhas && games.length < MAX_GAMES && (
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
