/**
 * Carreira — a LINHA DO TEMPO. Mora fora de `useCareer.js` porque é o único
 * hook que precisa dos torneios, dos pódios e dos dias de jogo da plataforma:
 * quem só quer `useCareerEvents` (estante de troféus, balanço do jogo, card do
 * início) não pode pagar esse peso. Importe daqui em `V2Career` e onde a linha
 * do tempo for montada.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { useMyTournaments } from '@/modules/tournament/hooks/useTournament';
import { useTrophies } from '@/modules/trophies/hooks/useTrophies';
import { usePublishedGameDayGames } from '@/modules/games/hooks/usePublishedGameDayGames';
import { useLeagueActivityOf } from '@/modules/leagues/hooks/useLeagues';
import { buildCareerTimeline } from '../domain/timeline.js';
import { careerKeys, useCareerEvents, useCareerPartners } from './useCareer.js';

/** Os pontos lançados no ranking oficial das federações (leitura pública, `uid ==`). */
function useOfficialPoints(uid, enabled) {
  return useQuery({
    queryKey: careerKeys.officialPoints(uid),
    // Import dinâmico: o serviço das federações só desce quando a consulta roda.
    queryFn: async () => (await import('@/modules/federations/services/federationService')).listMyFederationPoints(uid),
    enabled: Boolean(uid) && enabled,
    staleTime: 5 * 60_000,
  });
}

/** A escolha "Incluir dias de jogo" na linha do tempo — por pessoa, no navegador (zero banco). */
export const CAREER_GAMEDAYS_PREF = 'carreira:linha:dias-de-jogo';

/**
 * A linha do tempo é de TORNEIOS. Dia de jogo só entra quando a pessoa pede
 * (`includeGameDays`), e só então é buscado. `isPending` enquanto alguma fonte ainda não respondeu;
 * depois, `timeline.faltou` lista as que falharam e `retry` tenta de novo só elas.
 * `isPaused`: sem conexão o React Query PAUSA as consultas e `isPending` não
 * termina — a tela mostra os rascunhos do aparelho em vez do esqueleto.
 */
export function useCareerTimeline({ enabled = true } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;
  const careerQ = useCareerEvents({ enabled });
  // A mesma chave do início e da Minha área (cache compartilhado).
  const tournamentsQ = useMyTournaments({ enabled });
  const trophiesQ = useTrophies(uid, { enabled });
  const [includeGameDays, setIncludeState] = useState(() => readViewPreference(uid, CAREER_GAMEDAYS_PREF) === '1');
  useEffect(() => { setIncludeState(readViewPreference(uid, CAREER_GAMEDAYS_PREF) === '1'); }, [uid]);
  const setIncludeGameDays = useCallback((v) => {
    setIncludeState(Boolean(v));
    writeViewPreference(uid, CAREER_GAMEDAYS_PREF, v ? '1' : null);
  }, [uid]);
  const gamesQ = usePublishedGameDayGames(uid, enabled && includeGameDays);
  const pointsQ = useOfficialPoints(uid, enabled);
  const partnersQ = useCareerPartners({ enabled });
  // As ligas em que a pessoa jogou: a MESMA consulta de Meu desempenho (cache compartilhado).
  const leaguesQ = useLeagueActivityOf(uid, enabled);
  const qs = [careerQ, tournamentsQ, trophiesQ, ...(includeGameDays ? [gamesQ] : []), pointsQ, partnersQ, leaguesQ];
  const pending = qs.some((q) => q.isPending);
  const ok = (q) => (q.isSuccess ? q.data : undefined);
  const timeline = useMemo(() => (pending ? null : buildCareerTimeline({
    career: ok(careerQ),
    tournaments: ok(tournamentsQ),
    trophies: trophiesQ.isSuccess ? trophiesQ.data : undefined,
    includeGameDays,
    gameDayGames: includeGameDays ? ok(gamesQ) : undefined,
    federationPoints: ok(pointsQ),
    partners: ok(partnersQ),
    leagues: leaguesQ.isSuccess ? leaguesQ.data.seasons : undefined,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [pending, leaguesQ.data, leaguesQ.isSuccess, careerQ.data, careerQ.isSuccess, tournamentsQ.data, tournamentsQ.isSuccess, trophiesQ.data, trophiesQ.isSuccess, includeGameDays, gamesQ.data, gamesQ.isSuccess, pointsQ.data, pointsQ.isSuccess, partnersQ.data, partnersQ.isSuccess]);
  const retry = () => qs.filter((q) => q.isError).forEach((q) => q.refetch());
  return {
    timeline,
    isPending: pending,
    isPaused: enabled && qs.some((q) => q.isPending && q.fetchStatus === 'paused'),
    // Tudo falhou: não há linha do tempo para mostrar.
    isError: !pending && qs.every((q) => q.isError),
    retry,
    includeGameDays,
    setIncludeGameDays,
    events: careerQ.data,
    // Atualização em curso: quem vai AFIRMAR "não existe mais" espera por ela.
    eventsFetching: careerQ.isFetching,
    partnersFetching: partnersQ.isFetching,
    myTournaments: tournamentsQ.isSuccess ? tournamentsQ.data : undefined,
    // Os pódios da plataforma (com a dupla): a retrospectiva da temporada acha a melhor parceria.
    trophies: trophiesQ.isSuccess ? trophiesQ.data : undefined,
    partners: partnersQ.isSuccess ? partnersQ.data : undefined,
    // Os lançamentos oficiais: de que federações sair a posição oficial no ranking.
    federationPoints: pointsQ.isSuccess ? pointsQ.data : undefined,
    // Os jogos de liga que ainda vêm (aba Próximos). `undefined` = não carregou.
    leagueUpcoming: leaguesQ.isSuccess ? leaguesQ.data.upcoming : undefined,
    leaguesError: leaguesQ.isError,
    retryLeagues: () => leaguesQ.refetch(),
    partnersError: partnersQ.isError,
    retryPartners: () => partnersQ.refetch(),
  };
}
