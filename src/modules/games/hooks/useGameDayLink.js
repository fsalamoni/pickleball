/**
 * Hooks do VÍNCULO do dia de jogo a clube/arena (`domain/gameDayLink.js`).
 *
 * Os clubes/arenas que a pessoa pode escolher já estão no cache (`useMyClubs`
 * e `useMyManagedArenas` são buscados pelo layout), então o seletor não custa
 * consulta nova. As listas de dias vinculados leem só dias PÚBLICOS.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { linkOptions } from '../domain/gameDayLink.js';
import { listArenaLinkedGameDays, listClubLinkedGameDays } from '../services/gameDayService.js';

/** Dias de jogo do atleta vinculados a este clube. */
export function useClubLinkedGameDays(clubId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['game-days', 'linked', 'club', clubId],
    queryFn: () => listClubLinkedGameDays(clubId),
    enabled: enabled && !!clubId,
    staleTime: 20_000,
  });
}

/** Dias de jogo do atleta vinculados a esta arena. */
export function useArenaLinkedGameDays(arenaId, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['game-days', 'linked', 'arena', arenaId],
    queryFn: () => listArenaLinkedGameDays(arenaId),
    enabled: enabled && !!arenaId,
    staleTime: 20_000,
  });
}

/**
 * O que ESTA pessoa pode vincular: clubes que administra e arenas que gere.
 * `isError` = alguma das listas não carregou (a tela diz, em vez de afirmar que
 * a pessoa "não administra nada").
 */
export function useGameDayLinkOptions({ enabled = true } = {}) {
  const clubsQ = useMyClubs({ enabled });
  const arenasQ = useMyManagedArenas();
  const options = useMemo(
    () => linkOptions({ clubs: clubsQ.data || [], arenas: arenasQ.data || [] }),
    [clubsQ.data, arenasQ.data],
  );
  return {
    options,
    isLoading: enabled && (clubsQ.isLoading || arenasQ.isLoading),
    isError: !!(clubsQ.isError || arenasQ.isError),
    retry: () => { if (clubsQ.isError) clubsQ.refetch(); if (arenasQ.isError) arenasQ.refetch(); },
  };
}
