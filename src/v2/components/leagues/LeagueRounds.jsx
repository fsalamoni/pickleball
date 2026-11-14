/**
 * As RODADAS da liga, divisão a divisão: cada rodada com a data e o prazo
 * (do calendário da temporada), os jogos com o placar e quem folga. Quem
 * organiza lança o placar ali mesmo (até 5 games, ou W.O.). Nas EQUIPES o
 * jogo é o confronto: um game por linha (feminina, masculina, mistas…) e, no
 * empate, o DreamBreaker. Na liga FLEXÍVEL quem joga lança o placar e o outro
 * lado confirma ou contesta (a organização segue podendo lançar e corrigir).
 * Nas equipes a organização diz QUEM jogou cada linha: é a escalação que leva
 * a linha ao ranking e ao DUPR (sem ela, a linha conta só na tabela da liga).
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
import { AUTO_CONFIRM_HOURS, formatMeta, resultRules, suggestedLineup, teamPairs } from '@/modules/leagues/domain/leagueFormats';
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
    const ms = (matches.data || []).filter((m) => m.division_id === div.id && m.phase !== 'playoff');
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
            description={canManage ? t('Em "Gerenciar liga" → Rodadas, gere o calendário de cada divisão quando as inscrições fecharem.') : t('A organização gera os jogos quando as inscrições fecharem.')}
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
              {jogos.map((m) => <MatchRow key={m.id} league={league} match={m} nome={nome} porId={porId} meu={meus.has(m.side_a) || meus.has(m.side_b)} meuLado={ladoMeu(meus, m)} editavel={editavel} />)}
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

/** De que lado do jogo eu estou (`null` = não jogo). */
export const ladoMeu = (meus, m) => (meus.has(m.side_a) ? 'a' : meus.has(m.side_b) ? 'b' : null);

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

/** Os atletas de cada lado do jogo (pelas inscrições) e o nome de cada conta. */
function atletasDoJogo(match, porId) {
  const lado = (s) => porId?.get(match?.[`side_${s}`])?.players || [];
  const a = lado('a');
  const b = lado('b');
  const nomes = new Map([...a, ...b].filter((p) => p?.uid).map((p) => [p.uid, p.name || t('Atleta')]));
  return { a, b, nomeDe: (uid) => nomes.get(uid) || t('Atleta') };
}

const duplaTexto = (uids, nomeDe) => (uids || []).map(nomeDe).join(' + ');

export function MatchRow({ league, match, nome, porId, meu, meuLado = null, editavel }) {
  const [editando, setEditando] = useState(false);
  const venc = matchWinner(match);
  const linhas = linhasDoJogo(league, match);
  // Liga flexível: quem joga lança; o outro lado confirma ou contesta.
  const autoLanca = Boolean(formatMeta(league?.format)?.self_report) && league?.status === 'running'
    && match.phase === 'season' && !venc && Boolean(meuLado);
  const lancado = !venc && match.status === 'reported' ? match.report : null;
  const contestado = !venc && match.status === 'disputed' ? match.dispute : null;
  const possoLancar = autoLanca && (!lancado || lancado.side === meuLado);
  const possoConfirmar = autoLanca && Boolean(lancado) && lancado.side !== meuLado;
  const modo = editavel ? 'result' : possoLancar ? 'report' : null;
  const situacao = venc ? <span className="font-bold text-ink">{placarTexto(match, linhas)}</span>
    : lancado ? <V2Badge tone="amber">{t('A confirmar')}</V2Badge>
      : contestado ? <V2Badge tone="red">{t('Contestado')}</V2Badge>
        : <V2Badge tone="neutral">{t('A jogar')}</V2Badge>;
  const { nomeDe } = atletasDoJogo(match, porId);
  const lado = (side) => (
    <span className={cn('min-w-0 flex-1 truncate', side === 'b' && 'text-right', venc === side ? 'font-bold text-ink' : 'text-gray-600')}>{sideName(match, side, nome)}</span>
  );
  return (
    <li className={cn('rounded-2xl border p-3', meu ? 'border-acid bg-acid/5' : 'border-gray-100')}>
      <div className="flex items-center gap-3">
        {lado('a')}
        <span className="shrink-0 text-center text-sm tabular-nums">
          {situacao}
        </span>
        {lado('b')}
        {modo && !editando && (
          <V2Button type="button" size="icon" variant="subtle" onClick={() => setEditando(true)} aria-label={venc ? t('Corrigir o placar') : t('Lançar o placar')}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </V2Button>
        )}
      </div>
      {linhas && venc && !match.wo_winner && !editando && (
        <ul className="mt-2 grid gap-x-4 gap-y-1 text-xs text-gray-500 sm:grid-cols-2">
          {linhas.map((l, i) => match.games?.[i] && (
            <li key={l.key} className="min-w-0">
              <div className="flex justify-between gap-2">
                <span className="truncate">{t(l.label)}</span>
                <span className="tabular-nums">{match.games[i].a}–{match.games[i].b}</span>
              </div>
              {match.lineups?.[i] && (
                <p className="truncate">{t('{a} × {b}', { a: duplaTexto(match.lineups[i].a, nomeDe), b: duplaTexto(match.lineups[i].b, nomeDe) })}</p>
              )}
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
      {!editando && (lancado || contestado) && (
        <div className="mt-2 space-y-2 text-xs text-gray-500">
          {lancado && <p>{t('Lançado por {nome}: {placar}', { nome: sideName(match, lancado.side, nome), placar: placarTexto(lancado, linhas) })}</p>}
          {contestado && <p className="text-red-600">{t('Contestado: {motivo}', { motivo: contestado.reason })}</p>}
          {possoConfirmar && <ConfirmBox league={league} match={match} />}
        </div>
      )}
      {editando && <ResultEditor league={league} match={match} nome={nome} porId={porId} linhas={linhas} modo={modo} onDone={() => setEditando(false)} />}
    </li>
  );
}

/** O outro lado confirma o placar lançado ou contesta, dizendo o que está errado. */
function ConfirmBox({ league, match }) {
  const acao = useLeagueAction();
  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const enviar = async (payload, ok) => {
    try {
      await acao.mutateAsync({ action: 'confirm', leagueId: league.id, matchId: match.id, ...payload });
      toast.success(ok);
    } catch (err) {
      toast.error(err.message);
    }
  };
  if (contestando) {
    return (
      <div className="space-y-2">
        <V2Field label={t('O que está errado?')} htmlFor={`motivo-${match.id}`}>
          <V2Input id={`motivo-${match.id}`} value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder={t('Ex.: foi 11 a 8 no segundo game')} />
        </V2Field>
        <div className="flex flex-wrap gap-2">
          <V2Button type="button" size="sm" variant="danger" disabled={motivo.trim().length < 3 || acao.isPending} onClick={() => enviar({ reason: motivo.trim() }, t('Contestação enviada à organização.'))}>{t('Enviar contestação')}</V2Button>
          <V2Button type="button" size="sm" variant="ghost" onClick={() => setContestando(false)}>{t('Cancelar')}</V2Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <V2Button type="button" size="sm" disabled={acao.isPending} onClick={() => enviar({ accept: true }, t('Placar confirmado.'))}>{t('Confirmar o placar')}</V2Button>
        <V2Button type="button" size="sm" variant="ghost" onClick={() => setContestando(true)}>{t('Contestar')}</V2Button>
      </div>
      <p className="text-xs text-gray-500">{t('Sem resposta em {n} horas, o placar lançado vale.', { n: AUTO_CONFIRM_HOURS })}</p>
    </div>
  );
}

const paraTexto = (g) => ({ a: g?.a == null ? '' : String(g.a), b: g?.b == null ? '' : String(g.b) });
const paraNumero = (v) => (v === '' ? undefined : Number(v));

const duplaValor = (uids) => (Array.isArray(uids) && uids.length === 2 ? uids.join('|') : '');
const duplaDoValor = (v) => (v ? v.split('|') : null);

function ResultEditor({ league, match, nome, porId, linhas, modo = 'result', onDone }) {
  const acao = useLeagueAction();
  const lancar = modo === 'report';
  // Sem placar gravado, parte do que um dos lados lançou (a organização decide em cima dele).
  const base = match.games?.length ? match : (match.report || match);
  const [games, setGames] = useState(() => {
    if (linhas) return linhas.map((_, i) => paraTexto(base.games?.[i]));
    return base.games?.length ? base.games.map(paraTexto) : [{ a: '', b: '' }];
  });
  const [db, setDb] = useState(() => paraTexto(base.dreambreaker));
  const [wo, setWo] = useState(match.wo_winner || '');
  const [data, setData] = useState(match.scheduled_date || '');
  // Equipes: quem jogou cada linha. Parte do que está gravado ou da ordem da equipe.
  const atletas = atletasDoJogo(match, porId);
  const pedeEscalacao = Boolean(linhas) && !lancar;
  const [escalacao, setEscalacao] = useState(() => {
    if (!linhas) return [];
    const sa = suggestedLineup(league.format, atletas.a);
    const sb = suggestedLineup(league.format, atletas.b);
    return linhas.map((_, i) => ({
      a: duplaValor(match.lineups?.[i]?.a || (match.lineups ? null : sa[i])),
      b: duplaValor(match.lineups?.[i]?.b || (match.lineups ? null : sb[i])),
    }));
  });
  const opcoes = (side) => [
    { value: '', label: t('Não informada') },
    ...teamPairs(atletas[side]).map((d) => ({ value: duplaValor(d), label: duplaTexto(d, atletas.nomeDe) })),
  ];
  const setLinha = (i, side, v) => setEscalacao((es) => es.map((e, j) => (j === i ? { ...e, [side]: v } : e)));
  const lineups = pedeEscalacao ? escalacao.map((e) => (e.a && e.b ? { a: duplaDoValor(e.a), b: duplaDoValor(e.b) } : null)) : null;
  const semEscalacao = pedeEscalacao && lineups.some((l) => !l);
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
        : {
          action: lancar ? 'report' : 'result', leagueId: league.id, matchId: match.id, games: r.games, wo_winner: lancar ? undefined : r.wo_winner, dreambreaker: r.dreambreaker, played_date: data || undefined,
          ...(pedeEscalacao && !r.wo_winner ? { lineups: lineups.some(Boolean) ? lineups : null } : {}),
        });
      toast.success(clear ? t('Placar apagado.') : lancar ? t('Placar enviado: o outro lado confirma.') : t('Placar lançado.'));
      onDone();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      {lancar && <p className="text-xs text-gray-500">{t('O outro lado confirma o placar (sem resposta em {n} horas, ele vale). W.O. só a organização lança.', { n: AUTO_CONFIRM_HOURS })}</p>}
      {!lancar && <V2Field label={t('Resultado')} htmlFor={`wo-${match.id}`}>
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
      </V2Field>}
      {!wo && (
        <div className="space-y-2">
          {games.map((g, i) => (
            <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
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
            {pedeEscalacao && (
              <div className="grid gap-2 sm:grid-cols-2 sm:pl-32">
                {['a', 'b'].map((side) => (
                  <V2Select
                    key={side}
                    value={escalacao[i]?.[side] || ''}
                    onChange={(e) => setLinha(i, side, e.target.value)}
                    options={opcoes(side)}
                    aria-label={t('Quem jogou {jogo} por {nome}', { jogo: rotulo(i), nome: sideName(match, side, nome) })}
                  />
                ))}
              </div>
            )}
            </div>
          ))}
          {semEscalacao && <p className="text-xs leading-5 text-gray-500">{t('Linha sem escalação conta só na tabela da liga: para ir ao ranking e ao DUPR, diga quem jogou.')}</p>}
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
        {!lancar && matchWinner(match) && <V2Button type="button" size="sm" variant="danger" onClick={() => salvar(true)} disabled={acao.isPending}>{t('Apagar placar')}</V2Button>}
      </div>
    </div>
  );
}
