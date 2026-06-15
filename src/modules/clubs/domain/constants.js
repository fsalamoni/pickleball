/**
 * Constantes do domínio de Clubes.
 *
 * Coleções Firestore:
 *  - clubs               (dados do clube)
 *  - club_members        (vínculo usuário↔clube, id = `${clubId}_${uid}`)
 *  - club_events         (eventos: confraternização, torneio interno, treino…)
 *  - club_event_rsvps    (presença em evento, id = `${eventId}_${uid}`)
 *  - club_posts          (mural de avisos/interação)
 */

export const CLUB_COLLECTIONS = Object.freeze({
  clubs: 'clubs',
  members: 'club_members',
  events: 'club_events',
  rsvps: 'club_event_rsvps',
  posts: 'club_posts',
});

/** Papel do membro dentro do clube. */
export const CLUB_ROLE = Object.freeze({
  ADMIN: 'admin',
  MEMBER: 'member',
});

export const CLUB_ROLE_LABELS = Object.freeze({
  [CLUB_ROLE.ADMIN]: 'Administrador',
  [CLUB_ROLE.MEMBER]: 'Membro',
});

/** Tipos de evento do clube. */
export const CLUB_EVENT_TYPE = Object.freeze({
  SOCIAL: 'social',
  TOURNAMENT: 'tournament',
  TRAINING: 'training',
  MEETING: 'meeting',
  OTHER: 'other',
});

export const CLUB_EVENT_TYPE_LABELS = Object.freeze({
  [CLUB_EVENT_TYPE.SOCIAL]: 'Confraternização',
  [CLUB_EVENT_TYPE.TOURNAMENT]: 'Torneio interno',
  [CLUB_EVENT_TYPE.TRAINING]: 'Treino',
  [CLUB_EVENT_TYPE.MEETING]: 'Reunião',
  [CLUB_EVENT_TYPE.OTHER]: 'Outro',
});

/** Resposta de presença em um evento. */
export const RSVP_STATUS = Object.freeze({
  GOING: 'going',
  MAYBE: 'maybe',
  NOT_GOING: 'not_going',
});

export const RSVP_STATUS_LABELS = Object.freeze({
  [RSVP_STATUS.GOING]: 'Vou',
  [RSVP_STATUS.MAYBE]: 'Talvez',
  [RSVP_STATUS.NOT_GOING]: 'Não vou',
});
