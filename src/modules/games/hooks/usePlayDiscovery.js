/**
 * JOGOS COM VAGA — as leituras do "Jogar" (início), do Procura-se jogo e do
 * "Com vaga para você" do Dia de jogo.
 *
 * Junta as fontes e entrega a lista única de `buildPlayList`:
 *  - os dias de jogo PÚBLICOS dos próximos 30 dias (do atleta e da ARENA —
 *    esta última só com a flag `arena_game_day`, como na página da arena);
 *  - ⭐ os dias de jogo dos CLUBES da pessoa (privados: só quem é do clube os
 *    lê — uma consulta por clube, recortada por `club_id`, que é o que a regra
 *    consegue provar);
 *  - os jogos abertos das arenas (com a chave dos módulos e o módulo ligado
 *    em cada arena), com o nível da pessoa para dizer se ela cabe na faixa;
 *  - os convites de Procura-se jogo.
 *
 * O que custa leitura, e por quê:
 *  - UMA consulta de dias públicos (igualdades, sem índice novo) e UMA por
 *    clube da pessoa (no máximo `CLUBES_ATE`);
 *  - os inscritos só dos dias em que a LISTA decide algo — o da arena com TETO
 *    (quantas vagas sobram) e o do clube que a própria pessoa agendou (quem
 *    agenda organiza sem ser jogador: só a lista diz se ela vai jogar) —, e
 *    só dos `CONTAR_ATE` mais próximos, com a mesma chave de cache da página
 *    do dia de jogo, que é para onde a pessoa vai ao tocar;
 *  - a arena (cidade e nome) só de quem precisa: a vaga aberta não guarda a
 *    cidade, e o dia de jogo antigo pode não ter a cópia.
 *
 * Cada fonte falha sozinha e diz que falhou — a lista não afirma "nenhum jogo"
 * com uma delas fora do ar.
 */
import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useGlobalOpenSlots } from '@/modules/arenas/hooks/useArenaV3';
import { useModuleOnInArenas } from '@/modules/arenas/hooks/useArenaModules';
import { arenaQueries } from '@/modules/arenas/hooks/arenaQueries';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import { openSlotsForDiscovery } from '@/modules/arenas/domain/openMatchView';
import {
  listGameDayParticipants, listUpcomingClubGameDays, listUpcomingPublicGameDays,
} from '../services/gameDayService.js';
import {
  arenaGameDayHasLimit, buildPlayList, gameDayEndsAt, gameDayStartsAt, nextDaysISO,
} from '../domain/playDiscovery.js';
import { isArenaGameDay } from '../domain/arenaGameDay.js';
import { isClubGameDay } from '../domain/clubGameDay.js';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { useOpenGames } from './useOpenGames.js';
import { useMyGameDays } from './useGameDays.js';

/** Quantos dias têm os inscritos contados (os mais próximos). */
const CONTAR_ATE = 16;
/** De quantos clubes da pessoa os dias de jogo são lidos (uma consulta cada). */
const CLUBES_ATE = 10;

/** Os dias de jogo públicos dos próximos 30 dias. */
export function usePublicGameDaysAhead({ hoje, enabled = true } = {}) {
  const dias = useMemo(() => nextDaysISO(hoje), [hoje]);
  return useQuery({
    queryKey: ['game-days', 'public-ahead', hoje],
    queryFn: () => listUpcomingPublicGameDays({ dias }),
    enabled: enabled && dias.length > 0,
    staleTime: 60_000,
  });
}

/**
 * Os dias de jogo dos CLUBES da pessoa nos próximos 30 dias — uma consulta por
 * clube (a regra só prova a leitura com o `club_id` fixo).
 */
export function useClubGameDaysAhead({ hoje, enabled = true } = {}) {
  const dias = useMemo(() => nextDaysISO(hoje), [hoje]);
  const clubesQ = useMyClubs({ enabled });
  const clubes = useMemo(() => (clubesQ.data || []).slice(0, CLUBES_ATE), [clubesQ.data]);
  const diasQ = useQueries({
    queries: clubes.map((c) => ({
      queryKey: ['game-days', 'club-ahead', c.id, hoje],
      queryFn: () => listUpcomingClubGameDays({ clubId: c.id, dias }),
      enabled: enabled && dias.length > 0,
      staleTime: 60_000,
    })),
  });
  const chave = diasQ.map((q) => q.dataUpdatedAt).join(',');
  const dados = useMemo(
    () => diasQ.flatMap((q) => q.data || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chave],
  );
  const clubesById = useMemo(() => new Map(clubes.map((c) => [c.id, c])), [clubes]);
  return {
    data: dados,
    clubesById,
    isLoading: enabled && (clubesQ.isLoading || diasQ.some((q) => q.isLoading)),
    isError: Boolean(clubesQ.isError) || diasQ.some((q) => q.isError),
    refetch: () => {
      if (clubesQ.isError) clubesQ.refetch();
      diasQ.forEach((q) => { if (q.isError) q.refetch(); });
    },
  };
}

/**
 * @param {{ hoje: string, agora: number, enabled?: boolean }} p
 * @returns {{
 *   itens: ReturnType<typeof buildPlayList>,
 *   carregando: boolean,
 *   isError: boolean,
 *   falhas: { dias: boolean, clubes: boolean, convites: boolean, vagas: boolean },
 *   recarregar: { dias: Function, clubes: Function, convites: Function, vagas: Function },
 *   convites: object[],
 * }}
 */
export function usePlayDiscovery({ hoje, agora, enabled = true }) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const arenaModulesOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const arenaGameDayOn = useFeatureFlag(FEATURE_FLAG.ARENA_GAME_DAY);

  const diasQ = usePublicGameDaysAhead({ hoje, enabled });
  const clubeQ = useClubGameDaysAhead({ hoje, enabled });
  const convitesQ = useOpenGames({ enabled });
  const vagasOn = enabled && arenaModulesOn;
  const vagasQ = useGlobalOpenSlots({ limit: 100 }, { enabled: vagasOn });
  // O nível na régua 2.0–8.0 decide se a pessoa cabe na faixa do jogo aberto.
  // Em cache pela página da arena e pelo Procura-se jogo.
  const { level: nivel } = useMyUnifiedLevel();
  // Já em cache pela agenda da tela inicial: não custa leitura a mais.
  const meusQ = useMyGameDays({ enabled });

  const slotArenaIds = useMemo(
    () => (vagasOn ? (vagasQ.data || []).map((s) => s.arena_id).filter(Boolean) : []),
    [vagasOn, vagasQ.data],
  );
  const { isOnIn, isLoading: modulosCarregando } = useModuleOnInArenas(slotArenaIds, ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH);

  const meusDias = useMemo(() => new Set((meusQ.data || []).map((g) => g.id)), [meusQ.data]);
  const diasPublicos = useMemo(
    () => (diasQ.data || []).filter((g) => arenaGameDayOn || !isArenaGameDay(g)),
    [diasQ.data, arenaGameDayOn],
  );

  // Os dias cuja LISTA de inscritos decide algo: o da arena com teto (quantas
  // vagas sobram) e o do clube que a própria pessoa agendou (se ela vai jogar).
  const paraContar = useMemo(() => [...diasPublicos, ...(clubeQ.data || [])]
    .filter((g) => !g.open_slot_id && gameDayEndsAt(g) > agora && (
      (arenaGameDayHasLimit(g) && g.created_by !== uid)
      || (isClubGameDay(g) && Boolean(uid) && g.created_by === uid)
    ))
    .sort((a, b) => gameDayStartsAt(a) - gameDayStartsAt(b))
    .slice(0, CONTAR_ATE), [diasPublicos, clubeQ.data, uid, agora]);
  const inscritosQ = useQueries({
    queries: paraContar.map((g) => ({
      queryKey: ['game-days', g.id, 'participants'],
      queryFn: () => listGameDayParticipants(g.id),
      staleTime: 30_000,
    })),
  });
  const inscritosChave = inscritosQ.map((q) => q.dataUpdatedAt).join(',');
  const inscritosPorDia = useMemo(
    () => new Map(paraContar.map((g, i) => [g.id, inscritosQ[i]?.data]).filter(([, lista]) => Array.isArray(lista))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paraContar, inscritosChave],
  );

  // A arena de quem não traz a cidade consigo.
  const arenaIds = useMemo(() => [...new Set([
    ...slotArenaIds,
    ...diasPublicos.filter((g) => g.arena_id && (!g.arena_city || !g.arena_name)).map((g) => g.arena_id),
  ])].sort(), [slotArenaIds, diasPublicos]);
  const arenasQ = useQueries({
    queries: arenaIds.map((id) => ({ ...arenaQueries.arena(id), staleTime: 5 * 60_000 })),
  });
  const arenasChave = arenasQ.map((q) => q.dataUpdatedAt).join(',');
  const arenasById = useMemo(
    () => new Map(arenaIds.map((id, i) => [id, arenasQ[i]?.data]).filter(([, a]) => a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arenaIds, arenasChave],
  );

  const vagas = useMemo(
    () => (vagasOn && !modulosCarregando ? openSlotsForDiscovery(vagasQ.data || [], isOnIn, agora, { uid }) : []),
    [vagasOn, modulosCarregando, vagasQ.data, isOnIn, agora, uid],
  );

  const itens = useMemo(() => buildPlayList({
    diasPublicos,
    diasDoClube: clubeQ.data,
    clubesById: clubeQ.clubesById,
    vagas,
    convites: convitesQ.data || [],
    inscritosPorDia,
    arenasById,
    uid,
    meusDias,
    nivel,
    hoje,
    agora,
  }), [diasPublicos, clubeQ.data, clubeQ.clubesById, vagas, convitesQ.data, inscritosPorDia, arenasById, uid, meusDias, nivel, hoje, agora]);

  return {
    itens,
    convites: convitesQ.data || [],
    carregando: diasQ.isLoading || clubeQ.isLoading || convitesQ.isLoading
      || (vagasOn && (vagasQ.isLoading || modulosCarregando)),
    // Alguma fonte falhou? (a tela não afirma "nenhum jogo" com uma delas fora)
    isError: diasQ.isError || clubeQ.isError || convitesQ.isError || (vagasOn && vagasQ.isError),
    falhas: {
      dias: diasQ.isError,
      clubes: clubeQ.isError,
      convites: convitesQ.isError,
      vagas: vagasOn && vagasQ.isError,
    },
    recarregar: {
      dias: diasQ.refetch,
      clubes: clubeQ.refetch,
      convites: convitesQ.refetch,
      vagas: vagasQ.refetch,
    },
  };
}
