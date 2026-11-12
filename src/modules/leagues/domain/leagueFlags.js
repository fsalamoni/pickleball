/**
 * As flags das LIGAS — uma por grupo de quem cria (arquivo-folha e leve: a
 * barra lateral importa daqui para decidir se mostra "Ligas").
 *
 * Com qualquer uma ligada, a área Ligas aparece para todos (ver e se
 * inscrever: uma liga de clube precisa de atletas). O admin da plataforma vê e
 * cria sempre. A cópia do servidor está em `functions/leaguePolicy.js`.
 */
import { FEATURE_FLAG } from '@/core/featureFlags';

/** Em nome de quem a liga é criada. O valor é gravado (`leagues.organizer.type`). */
export const LEAGUE_ORGANIZER = Object.freeze({
  ATHLETE: 'athlete',
  CLUB: 'club',
  ARENA: 'arena',
  COACH: 'coach',
  FEDERATION: 'federation',
});

/** A flag que libera cada grupo. */
export const LEAGUE_FLAG_BY_ORGANIZER = Object.freeze({
  [LEAGUE_ORGANIZER.ATHLETE]: FEATURE_FLAG.LEAGUES_ATHLETES,
  [LEAGUE_ORGANIZER.CLUB]: FEATURE_FLAG.LEAGUES_CLUBS,
  [LEAGUE_ORGANIZER.ARENA]: FEATURE_FLAG.LEAGUES_ARENAS,
  [LEAGUE_ORGANIZER.COACH]: FEATURE_FLAG.LEAGUES_COACHES,
  [LEAGUE_ORGANIZER.FEDERATION]: FEATURE_FLAG.LEAGUES_FEDERATIONS,
});

export const LEAGUE_FLAGS = Object.freeze(Object.values(LEAGUE_FLAG_BY_ORGANIZER));

/** A área Ligas aparece? Qualquer flag de ligas ligada, ou o admin da plataforma. */
export function leaguesVisible(flags, { isPlatformAdmin = false } = {}) {
  return Boolean(isPlatformAdmin) || LEAGUE_FLAGS.some((k) => flags?.[k] === true);
}
