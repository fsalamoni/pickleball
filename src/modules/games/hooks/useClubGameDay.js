/**
 * Hooks que amarram uma DATA de evento de clube ao módulo de dia de jogo.
 *
 * Vivem no módulo `games` (e não em `clubs`) porque quem manda aqui é o dia de
 * jogo: o clube é só a origem. `clubs/services` não conhece `games`, então não
 * há ciclo — a seta aponta sempre de quem NASCE para quem HOSPEDA.
 *
 * Nada aqui toca no legado. Uma data sem `game_day_id` nunca passa por estas
 * funções.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { addEventDate } from '@/modules/clubs/services/clubService';
import {
  createClubGameDay, discardClubGameDay, syncClubGameDayFromDate, archiveClubGameDay,
} from '../services/clubGameDayService.js';

/**
 * Cria a DATA do evento já como módulo: primeiro o `game_days`, depois a data
 * apontando para ele.
 *
 * Se a data falhar, o dia de jogo recém-criado é descartado — sem isso
 * sobraria um dia órfão na lista de quem agendou, sem data nenhuma por trás.
 */
export function useCreateEventGameDay(event, club) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const eventId = event?.id;
  return useMutation({
    mutationFn: async (input) => {
      const { id: gameDayId } = await createClubGameDay(
        { clubId: club?.id || event?.club_id, club, event, input }, user,
      );
      try {
        const dateId = await addEventDate(eventId, {
          club_id: club?.id || event?.club_id || '',
          date_time: input.date_time,
          location: input.location,
          note: input.note,
          game_day_id: gameDayId,
        }, user);
        return { dateId, gameDayId };
      } catch (err) {
        await discardClubGameDay(gameDayId);
        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-dates', eventId] });
      qc.invalidateQueries({ queryKey: ['game-days'] });
    },
  });
}

/** Repassa ao dia de jogo a data/hora/local editados na data do evento. */
export function useSyncEventGameDay(event) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gameDayId, date }) => syncClubGameDayFromDate(gameDayId, { event, date }, user),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['game-days', 'detail', vars?.gameDayId] });
    },
  });
}

/** Arquiva o dia de jogo antes de a data do evento ser removida. */
export function useArchiveEventGameDay() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameDayId) => archiveClubGameDay(gameDayId, user),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['game-days'] }),
  });
}
