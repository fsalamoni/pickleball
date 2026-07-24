/**
 * Agrupamento das feature flags por assunto/matéria, para o painel admin
 * exibir as funcionalidades de forma organizada. Puro (sem I/O) — os grupos
 * apenas definem rótulo e ordem; a completude (renderizar TODAS as flags) é
 * garantida iterando `FEATURE_FLAG` e caindo em `other` o que não foi mapeado.
 */

import { FEATURE_FLAG } from './featureFlags.js';

/** Grupos "normais" (fora Arena V3), na ordem de exibição. */
export const FLAG_GROUPS = Object.freeze([
  {
    id: 'core',
    label: 'Núcleo e plataforma',
    keys: [
      FEATURE_FLAG.ADMIN_CONSOLE, FEATURE_FLAG.ADMIN_ATHLETE_REGISTRATION,
      FEATURE_FLAG.FUNNEL_ANALYTICS, FEATURE_FLAG.SHARE_CARDS,
      FEATURE_FLAG.PAGE_TITLES, FEATURE_FLAG.SPORT_HISTORY, FEATURE_FLAG.PUBLIC_SEO,
    ],
  },
  {
    id: 'nav',
    label: 'Navegação e onboarding',
    keys: [
      FEATURE_FLAG.NAV_USER_MENU, FEATURE_FLAG.MOBILE_BOTTOM_NAV,
      FEATURE_FLAG.PROFILE_ONBOARDING, FEATURE_FLAG.ONBOARDING_WIZARD,
      FEATURE_FLAG.NOT_FOUND_PAGE, FEATURE_FLAG.SETTINGS_PAGE, FEATURE_FLAG.GLOBAL_SEARCH,
    ],
  },
  {
    id: 'athlete',
    label: 'Atleta, rating e social',
    keys: [
      FEATURE_FLAG.PLAYER_RATING, FEATURE_FLAG.PLAYER_PERFORMANCE, FEATURE_FLAG.PLAYER_PROGRESSION,
      FEATURE_FLAG.RATING_HISTORY, FEATURE_FLAG.RANKING_FILTERS, FEATURE_FLAG.HEAD_TO_HEAD,
      FEATURE_FLAG.FOLLOW_ATHLETES, FEATURE_FLAG.ATHLETE_PROFILE_PAGE,
      FEATURE_FLAG.MATCHMAKING, FEATURE_FLAG.OPEN_GAMES, FEATURE_FLAG.ACHIEVEMENTS,
      FEATURE_FLAG.CALENDAR_EXPORT, FEATURE_FLAG.DOUBLES_RANKING, FEATURE_FLAG.ATHLETE_AGENDA,
    ],
  },
  {
    id: 'tournaments',
    label: 'Torneios',
    keys: [
      FEATURE_FLAG.MULTI_PHASE_TOURNAMENTS, FEATURE_FLAG.TOURNAMENT_LIFECYCLE, FEATURE_FLAG.TOURNAMENT_UX,
      FEATURE_FLAG.TOURNAMENT_CANCEL_ACTION, FEATURE_FLAG.TOURNAMENT_CHECKIN, FEATURE_FLAG.TOURNAMENT_OPS_DASHBOARD,
      FEATURE_FLAG.TOURNAMENT_ANNOUNCEMENTS, FEATURE_FLAG.TOURNAMENT_DUPLICATION, FEATURE_FLAG.TOURNAMENT_WAITLIST,
      FEATURE_FLAG.TOURNAMENT_GALLERY, FEATURE_FLAG.TOURNAMENT_CERTIFICATES, FEATURE_FLAG.TOURNAMENT_PLACEHOLDER_DRAW,
      FEATURE_FLAG.MODALITY_PAGES, FEATURE_FLAG.NOTIFICATIONS_MARK_ALL, FEATURE_FLAG.PAYMENT_INSTRUCTIONS,
      FEATURE_FLAG.CIRCUITS, FEATURE_FLAG.REGISTRATIONS_CSV,
      FEATURE_FLAG.TOURNAMENT_TV_MODE, FEATURE_FLAG.TOURNAMENT_TEMPLATES,
      FEATURE_FLAG.COURTSIDE_SCORING, FEATURE_FLAG.BRACKET_TREE,
    ],
  },
  {
    id: 'arenas',
    label: 'Arenas e reservas',
    keys: [
      FEATURE_FLAG.ARENAS, FEATURE_FLAG.ATHLETE_SELF_CHECKIN, FEATURE_FLAG.PARTNER_INVITES,
      FEATURE_FLAG.SHARED_BOOKINGS, FEATURE_FLAG.CANCELLATION_POLICY, FEATURE_FLAG.NO_SHOW_TRACKING,
      FEATURE_FLAG.ARENA_CRM, FEATURE_FLAG.BOOKING_WAITLIST,
    ],
  },
  {
    id: 'coaches',
    label: 'Professores',
    keys: [
      FEATURE_FLAG.COACH_DIRECTORY, FEATURE_FLAG.COACH_RESIDENT, FEATURE_FLAG.COACH_LESSONS,
      FEATURE_FLAG.PARTNERSHIP_MUTUAL,
    ],
  },
  {
    id: 'community',
    label: 'Comunidade e parceiros',
    keys: [
      FEATURE_FLAG.COMMUNITY_FEED, FEATURE_FLAG.LINKED_CLUBS, FEATURE_FLAG.AFFILIATE_LINKS,
      FEATURE_FLAG.GAMEDAY_FORMATS, FEATURE_FLAG.CLUB_INTERNAL_RANKING,
      FEATURE_FLAG.CLUB_INVITE_LINK, FEATURE_FLAG.CLUB_RECURRING_EVENTS,
    ],
  },
]);

export const FLAG_GROUP_OTHER = Object.freeze({ id: 'other', label: 'Outras' });
export const FLAG_GROUP_ARENA_V3 = Object.freeze({ id: 'arena_v3', label: 'Arena V3 (módulos)' });

/** Retorna o id do grupo de uma flag. Arena V3 e desconhecidas têm tratamento próprio. */
export function flagGroupId(key) {
  if (key === 'arena_modules' || String(key).startsWith('arena_module_')) return FLAG_GROUP_ARENA_V3.id;
  for (const g of FLAG_GROUPS) {
    if (g.keys.includes(key)) return g.id;
  }
  return FLAG_GROUP_OTHER.id;
}

/**
 * Agrupa TODAS as flags (valores de FEATURE_FLAG) por grupo, garantindo que
 * nenhuma fique de fora. Retorna { groupId: [flagKey, ...] }.
 */
export function bucketAllFlags() {
  const buckets = {};
  Object.values(FEATURE_FLAG).forEach((key) => {
    const g = flagGroupId(key);
    (buckets[g] ||= []).push(key);
  });
  return buckets;
}
