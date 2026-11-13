/**
 * LIGAS — os hooks (React Query). Leitura direta; escrita pela função
 * `leagues`, e toda mutação invalida a liga inteira (a classificação é
 * derivada dos jogos, então basta reler).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import {
  getLeague, leagueAction, listDivisions, listEntries, listLeagueActivityOf, listMatches, listMyLeagues, listPublicLeagues,
} from '../services/leagueService.js';
import { leaguesVisible } from '../domain/leagueFlags.js';

export const leagueKeys = Object.freeze({
  all: ['leagues'],
  public: () => ['leagues', 'public'],
  mine: (uid) => ['leagues', 'mine', uid],
  one: (id) => ['leagues', 'one', id],
  divisions: (id) => ['leagues', 'one', id, 'divisions'],
  entries: (id) => ['leagues', 'one', id, 'entries'],
  matches: (id) => ['leagues', 'one', id, 'matches'],
  activityOf: (uid) => ['leagues', 'activity-of', uid],
});

/** A área Ligas aparece para esta pessoa? `loading` enquanto as flags carregam. */
export function useLeaguesVisible() {
  const { isPlatformAdmin } = useAuth();
  const { flags, isLoading } = useFeatureFlags();
  return { visible: leaguesVisible(flags, { isPlatformAdmin }), loading: Boolean(isLoading), flags: flags || {} };
}

export const usePublicLeagues = ({ enabled = true } = {}) => useQuery({
  queryKey: leagueKeys.public(), queryFn: listPublicLeagues, enabled, staleTime: 60_000,
});

export function useMyLeagues({ enabled = true } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: leagueKeys.mine(user?.uid), queryFn: () => listMyLeagues(user?.uid), enabled: enabled && Boolean(user?.uid), staleTime: 60_000,
  });
}

export const useLeague = (id) => useQuery({ queryKey: leagueKeys.one(id), queryFn: () => getLeague(id), enabled: Boolean(id) });
export const useLeagueDivisions = (id) => useQuery({ queryKey: leagueKeys.divisions(id), queryFn: () => listDivisions(id), enabled: Boolean(id) });
export const useLeagueEntries = (id) => useQuery({ queryKey: leagueKeys.entries(id), queryFn: () => listEntries(id), enabled: Boolean(id) });
export const useLeagueMatches = (id) => useQuery({ queryKey: leagueKeys.matches(id), queryFn: () => listMatches(id), enabled: Boolean(id) });

/**
 * A liga na vida de uma pessoa — `{ games, upcoming, seasons }`, a MESMA
 * consulta em Meu desempenho, no perfil, no confronto direto, na gamificação,
 * em "Próximos" e na Carreira (uma chave, um pedido). Cada hook recorta a sua
 * parte com `select`.
 */
export const leagueActivityQuery = (uid) => ({
  queryKey: leagueKeys.activityOf(uid), queryFn: () => listLeagueActivityOf(uid), staleTime: 60_000,
});

const soJogos = (a) => a.games;

/** Para `qc.fetchQuery` (que ignora `select`): os jogos decididos, do mesmo cache. */
export const fetchLeagueGames = (qc, uid) => qc.fetchQuery(leagueActivityQuery(uid)).then(soJogos);

export const useLeagueActivityOf = (uid, enabled = true) => useQuery({ ...leagueActivityQuery(uid), enabled: Boolean(uid) && enabled });

/** Os jogos de liga DECIDIDOS de uma pessoa (o formato de `games/domain/myGames.js`). */
export const useLeagueGamesOf = (uid, enabled = true) => useQuery({ ...leagueActivityQuery(uid), select: soJogos, enabled: Boolean(uid) && enabled });

export function useMyLeagueGames({ enabled = true } = {}) {
  const { user } = useAuth();
  return useLeagueGamesOf(user?.uid, enabled);
}

/** `{ games, upcoming, seasons }` de quem está logado. */
export function useMyLeagueActivity({ enabled = true } = {}) {
  const { user } = useAuth();
  return useLeagueActivityOf(user?.uid, enabled);
}

/** Uma ação da liga no servidor; ao terminar, relê a liga e as listas. */
export function useLeagueAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, ...payload }) => leagueAction(action, payload),
    onSuccess: (_d, vars) => {
      if (vars?.leagueId) qc.invalidateQueries({ queryKey: leagueKeys.one(vars.leagueId) });
      qc.invalidateQueries({ queryKey: ['leagues', 'public'] });
      qc.invalidateQueries({ queryKey: ['leagues', 'mine'] });
      qc.invalidateQueries({ queryKey: ['leagues', 'activity-of'] });
      // O pódio da liga sai dos jogos: encerrar, reabrir ou corrigir placar muda a estante.
      qc.invalidateQueries({ queryKey: ['trophies'] });
    },
  });
}
