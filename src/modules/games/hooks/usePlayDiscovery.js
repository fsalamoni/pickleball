/**
 * JOGOS COM VAGA — as leituras do "Jogar" (início) e do Procura-se jogo.
 *
 * Junta as três fontes e entrega a lista única de `buildPlayList`:
 *  - os dias de jogo PÚBLICOS dos próximos 30 dias (do atleta e da ARENA —
 *    esta última só com a flag `arena_game_day`, como na página da arena);
 *  - os jogos abertos das arenas (com a chave dos módulos e o módulo ligado
 *    em cada arena);
 *  - os convites de Procura-se jogo.
 *
 * O que custa leitura, e por quê:
 *  - UMA consulta de dias de jogo (igualdades, sem índice novo);
 *  - os inscritos só dos dias da ARENA que têm TETO de vagas (sem teto não há
 *    o que contar), e só dos 12 primeiros — com a mesma chave de cache da
 *    página do dia de jogo, que é para onde a pessoa vai ao tocar;
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
import { listGameDayParticipants, listUpcomingPublicGameDays } from '../services/gameDayService.js';
import {
  arenaGameDayHasLimit, buildPlayList, gameDayEndsAt, gameDayStartsAt, nextDaysISO,
} from '../domain/playDiscovery.js';
import { isArenaGameDay } from '../domain/arenaGameDay.js';
import { useOpenGames } from './useOpenGames.js';
import { useMyGameDays } from './useGameDays.js';

/** Quantos dias da arena têm os inscritos contados (os mais próximos). */
const CONTAR_ATE = 12;

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
 * @param {{ hoje: string, agora: number, enabled?: boolean }} p
 * @returns {{
 *   itens: ReturnType<typeof buildPlayList>,
 *   carregando: boolean,
 *   falhas: { dias: boolean, convites: boolean, vagas: boolean },
 *   recarregar: { dias: Function, convites: Function, vagas: Function },
 *   convites: object[],
 * }}
 */
export function usePlayDiscovery({ hoje, agora, enabled = true }) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const arenaModulesOn = useFeatureFlag(FEATURE_FLAG.ARENA_MODULES);
  const arenaGameDayOn = useFeatureFlag(FEATURE_FLAG.ARENA_GAME_DAY);

  const diasQ = usePublicGameDaysAhead({ hoje, enabled });
  const convitesQ = useOpenGames({ enabled });
  const vagasOn = enabled && arenaModulesOn;
  const vagasQ = useGlobalOpenSlots({ limit: 100 }, { enabled: vagasOn });
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

  // Os dias da arena cujos inscritos decidem se ainda há vaga.
  const paraContar = useMemo(() => diasPublicos
    .filter((g) => !g.open_slot_id && arenaGameDayHasLimit(g) && g.created_by !== uid
      && !meusDias.has(g.id) && !(g.member_uids || []).includes(uid) && gameDayEndsAt(g) > agora)
    .sort((a, b) => gameDayStartsAt(a) - gameDayStartsAt(b))
    .slice(0, CONTAR_ATE), [diasPublicos, uid, meusDias, agora]);
  const inscritosQ = useQueries({
    queries: paraContar.map((g) => ({
      queryKey: ['game-days', g.id, 'participants'],
      queryFn: () => listGameDayParticipants(g.id),
      staleTime: 30_000,
    })),
  });
  const inscritosChave = inscritosQ.map((q) => q.dataUpdatedAt).join(',');
  const inscritosPorDia = useMemo(
    () => new Map(paraContar.map((g, i) => [g.id, inscritosQ[i]?.data])),
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
    () => (vagasOn && !modulosCarregando ? openSlotsForDiscovery(vagasQ.data || [], isOnIn, agora) : []),
    [vagasOn, modulosCarregando, vagasQ.data, isOnIn, agora],
  );

  const itens = useMemo(() => buildPlayList({
    diasPublicos,
    vagas,
    convites: convitesQ.data || [],
    inscritosPorDia,
    arenasById,
    uid,
    meusDias,
    hoje,
    agora,
  }), [diasPublicos, vagas, convitesQ.data, inscritosPorDia, arenasById, uid, meusDias, hoje, agora]);

  return {
    itens,
    convites: convitesQ.data || [],
    carregando: diasQ.isLoading || convitesQ.isLoading || (vagasOn && (vagasQ.isLoading || modulosCarregando)),
    // Alguma fonte falhou? (a tela não afirma "nenhum jogo" com uma delas fora)
    isError: diasQ.isError || convitesQ.isError || (vagasOn && vagasQ.isError),
    falhas: {
      dias: diasQ.isError,
      convites: convitesQ.isError,
      vagas: vagasOn && vagasQ.isError,
    },
    recarregar: {
      dias: diasQ.refetch,
      convites: convitesQ.refetch,
      vagas: vagasQ.refetch,
    },
  };
}
