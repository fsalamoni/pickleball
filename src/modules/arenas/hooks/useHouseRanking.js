/**
 * O RANKING DA CASA na tela (Onda CB).
 *
 * Junta, para UMA temporada, o que já existe:
 *  - os dias de jogo da arena com placar (participantes + jogos de cada um);
 *  - os torneios da plataforma sediados na arena que já terminaram
 *    (categorias + inscrições + partidas);
 *  - o ladder dos torneios internos antigos.
 *
 * As chaves de cada leitura são AS MESMAS dos hooks da tela do dia de jogo e
 * do torneio: quem abriu o jogo de ontem já trouxe metade do ranking, e quem
 * abriu o ranking já trouxe o jogo de ontem. Chave diferente para o mesmo
 * dado não dá erro — dá a mesma leitura paga duas vezes.
 *
 * ⚠️ Falha não é vazio. Uma leitura que falha NÃO some da conta em silêncio:
 * vai para `failures`, e a tela diz "ficou de fora" em vez de afirmar um
 * ranking que ela não sabe se está completo.
 */
import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useArenaGameDays } from '@/modules/games/hooks/useArenaGameDays';
import { listGameDayGames, listGameDayParticipants } from '@/modules/games/services/gameDayService';
import { useArenaTournaments as useArenaPlatformTournaments } from '@/modules/tournament/hooks/useTournament';
import { listModalities } from '@/modules/tournament/services/modalityService';
import { listRegistrationsByTournament } from '@/modules/tournament/services/registrationService';
import { listMatchesByTournament } from '@/modules/tournament/services/matchService';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import {
  HOUSE_ALL, buildHouseRanking, gameDayHouseEvent, houseFormats, houseGameDaysToLoad,
  houseRankingSummary, houseRankingWaiting, houseSeasonsFromSources, houseTournamentsToLoad,
  legacyLadderGameDayIds, legacyLadderHouseEvent, tournamentHouseEvents,
} from '@/modules/arenas/domain/houseRanking';
import { getLegacyHouseLadder } from '@/modules/arenas/services/houseRankingService';
import { arenaKeys } from './arenaKeys';
import { useArenaInternalTournaments } from './useArenaV3';

/** O resultado de um dia que já passou quase nunca muda: não vale reler a cada foco. */
const STALE = 5 * 60_000;

/** `combine` fora do componente: com referência estável, o React Query memoiza. */
function resumir(resultados) {
  return resultados.map((r) => ({
    data: r.data,
    isSuccess: r.isSuccess,
    isError: r.isError,
    isPending: r.isPending,
    refetch: r.refetch,
  }));
}

function rotuloDoDia(g) {
  const data = g.date ? formatDateShortBR(g.date) : '';
  return data ? `${g.title || 'Dia de jogo'} (${data})` : (g.title || 'Dia de jogo');
}

/**
 * @param {string|null} arenaId
 * @param {{ season?: number|'all', format?: string, enabled?: boolean }} [opts]
 */
export function useHouseRanking(arenaId, { season = new Date().getFullYear(), format = HOUSE_ALL, enabled = true } = {}) {
  const ativo = enabled && !!arenaId;
  const today = todayISO();

  const diasQ = useArenaGameDays(ativo ? arenaId : null);
  const torneiosQ = useArenaPlatformTournaments(ativo ? arenaId : null);
  const legadoQ = useQuery({
    queryKey: arenaKeys.ladderLegado(arenaId),
    queryFn: () => getLegacyHouseLadder(arenaId),
    enabled: ativo,
    staleTime: STALE,
  });

  // Os torneios internos antigos: o dia de jogo de um torneio ENCERRADO já
  // somou no ladder, e somá-lo de novo pelo placar contaria em dobro.
  const internosQ = useArenaInternalTournaments(ativo ? arenaId : null);
  const jaNoLadder = useMemo(
    () => (internosQ.isSuccess ? legacyLadderGameDayIds(internosQ.data) : null),
    [internosQ.isSuccess, internosQ.data],
  );
  // Sem saber quais dias já estão no ladder, o ladder sai da soma (abaixo) e
  // todos os dias contam pelo placar: o mesmo torneio nunca entra duas vezes.
  const internosResolvidos = !ativo || internosQ.isSuccess || internosQ.isError;

  const dias = useMemo(
    () => (internosResolvidos
      ? houseGameDaysToLoad(diasQ.data || [], { season, today, excludeIds: jaNoLadder })
      : []),
    [diasQ.data, season, today, jaNoLadder, internosResolvidos],
  );
  const torneios = useMemo(
    () => houseTournamentsToLoad(torneiosQ.data || [], { season }),
    [torneiosQ.data, season],
  );

  const participantesQs = useQueries({
    queries: dias.map((g) => ({
      queryKey: ['game-days', g.id, 'participants'],
      queryFn: () => listGameDayParticipants(g.id),
      staleTime: STALE,
    })),
    combine: resumir,
  });
  const jogosQs = useQueries({
    queries: dias.map((g) => ({
      queryKey: ['game-days', g.id, 'games'],
      queryFn: () => listGameDayGames(g.id),
      staleTime: STALE,
    })),
    combine: resumir,
  });
  const categoriasQs = useQueries({
    queries: torneios.map((t) => ({
      queryKey: ['modalities', t.id],
      queryFn: () => listModalities(t.id),
      staleTime: STALE,
    })),
    combine: resumir,
  });
  const inscricoesQs = useQueries({
    queries: torneios.map((t) => ({
      queryKey: ['registrations-tournament', t.id],
      queryFn: () => listRegistrationsByTournament(t.id),
      staleTime: STALE,
    })),
    combine: resumir,
  });
  const partidasQs = useQueries({
    queries: torneios.map((t) => ({
      queryKey: ['matches-tournament', t.id],
      queryFn: () => listMatchesByTournament(t.id),
      staleTime: STALE,
    })),
    combine: resumir,
  });

  const { events, failures, pending, total } = useMemo(() => {
    const evs = [];
    const falhas = [];
    let pendentes = 0;

    dias.forEach((g, i) => {
      const p = participantesQs[i];
      const j = jogosQs[i];
      if (p?.isSuccess && j?.isSuccess) {
        evs.push(gameDayHouseEvent({ gameDay: g, participants: p.data || [], games: j.data || [] }));
      } else if (p?.isError || j?.isError) {
        falhas.push({ key: `gd:${g.id}`, label: rotuloDoDia(g) });
      } else {
        pendentes += 1;
      }
    });

    torneios.forEach((t, i) => {
      const trio = [categoriasQs[i], inscricoesQs[i], partidasQs[i]];
      if (trio.every((q) => q?.isSuccess)) {
        evs.push(...tournamentHouseEvents({
          tournament: t, modalities: trio[0].data || [], registrations: trio[1].data || [], matches: trio[2].data || [],
        }));
      } else if (trio.some((q) => q?.isError)) {
        falhas.push({ key: `t:${t.id}`, label: t.name || 'Torneio' });
      } else {
        pendentes += 1;
      }
    });

    if (legadoQ.isError || internosQ.isError) {
      falhas.push({ key: 'legacy', label: 'Os torneios internos antigos' });
    } else if (legadoQ.isSuccess && internosQ.isSuccess) {
      const legado = legacyLadderHouseEvent(legadoQ.data);
      if (legado) evs.push(legado);
    } else if (ativo) {
      pendentes += 1;
    }

    return { events: evs, failures: falhas, pending: pendentes, total: dias.length + torneios.length + 1 };
  }, [dias, torneios, participantesQs, jogosQs, categoriasQs, inscricoesQs, partidasQs, legadoQ.isSuccess,
    legadoQ.isError, legadoQ.data, internosQ.isSuccess, internosQ.isError, ativo]);

  // As listas-base: sem elas não se sabe nem O QUE carregar.
  const baseFalhou = diasQ.isError || torneiosQ.isError;
  const baseFalhas = [
    ...(diasQ.isError ? [{ key: 'base:gd', label: 'Os dias de jogo da arena' }] : []),
    ...(torneiosQ.isError ? [{ key: 'base:t', label: 'Os torneios da casa' }] : []),
  ];

  const ranking = useMemo(() => buildHouseRanking(events, { season, format }), [events, season, format]);
  const seasons = useMemo(() => houseSeasonsFromSources({
    gameDays: diasQ.data || [], tournaments: torneiosQ.data || [], legacy: legadoQ.data, today, excludeIds: jaNoLadder,
  }), [diasQ.data, torneiosQ.data, legadoQ.data, today, jaNoLadder]);
  const formats = useMemo(() => houseFormats(events, { season }), [events, season]);
  const waiting = useMemo(() => houseRankingWaiting({
    gameDays: diasQ.data || [], tournaments: torneiosQ.data || [], events, season, today, excludeIds: jaNoLadder,
  }), [diasQ.data, torneiosQ.data, events, season, today, jaNoLadder]);
  const summary = useMemo(() => houseRankingSummary(ranking.events), [ranking.events]);

  const refetch = () => {
    if (diasQ.isError) diasQ.refetch();
    if (torneiosQ.isError) torneiosQ.refetch();
    if (legadoQ.isError) legadoQ.refetch();
    if (internosQ.isError) internosQ.refetch();
    [participantesQs, jogosQs, categoriasQs, inscricoesQs, partidasQs]
      .forEach((lista) => lista.forEach((q) => q.isError && q.refetch()));
  };

  const baseCarregando = ativo && (diasQ.isLoading || torneiosQ.isLoading || !internosResolvidos);
  return {
    rows: ranking.rows,
    events: ranking.events,
    allEvents: events,
    seasons,
    formats,
    waiting,
    summary,
    failures: [...baseFalhas, ...failures],
    /** Alguma leitura falhou: o ranking mostrado pode estar INCOMPLETO. */
    isError: baseFalhou || failures.length > 0,
    /** As DUAS listas-base falharam: não há o que mostrar. */
    fatal: diasQ.isError && torneiosQ.isError,
    baseFailed: baseFalhou,
    isLoading: baseCarregando,
    /** Base carregada, detalhe ainda chegando. */
    isFetchingDetails: !baseCarregando && pending > 0,
    progress: { done: Math.max(0, total - pending), total },
    /** Tudo carregou e nada falhou: só então a tela pode AFIRMAR o vazio. */
    complete: ativo && !baseCarregando && pending === 0 && failures.length === 0 && !baseFalhou,
    refetch,
  };
}
