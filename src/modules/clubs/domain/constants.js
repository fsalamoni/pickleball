/**
 * Constantes do domínio de Clubes.
 *
 * Coleções Firestore:
 *  - clubs                   (dados do clube)
 *  - club_members            (vínculo usuário↔clube, id = `${clubId}_${uid}`)
 *  - club_events             (eventos: confraternização, torneio interno, dia de jogo…)
 *  - club_event_rsvps        (presença em evento, id = `${eventId}_${uid}`)
 *  - club_events/{id}/dates        (datas do evento: data, local, horário)
 *  - club_events/{id}/date_rsvps   (resposta por data, id = `${dateId}_${uid}`)
 *  - club_events/{id}/messages     (chat cronológico do evento)
 *  - club_events/{id}/participants (participantes do dia de jogo)
 *  - club_events/{id}/games        (jogos organizados/sorteados do dia de jogo)
 *  - club_posts              (mural de avisos/interação)
 *  - club_forum_threads      (tópicos de fórum do clube)
 *  - club_forum_threads/{id}/comments    (subcoleção de comentários do tópico)
 *  - club_forum_threads/{id}/poll_votes  (subcoleção de votos; id do doc = uid)
 */

export const CLUB_COLLECTIONS = Object.freeze({
  clubs: 'clubs',
  members: 'club_members',
  joinRequests: 'club_join_requests',
  memberInvites: 'club_member_invites',
  events: 'club_events',
  rsvps: 'club_event_rsvps',
  eventInvites: 'event_invites',
  posts: 'club_posts',
  forumThreads: 'club_forum_threads',
  forumComments: 'comments',
  forumPollVotes: 'poll_votes',
  // Subcoleções de um evento (club_events/{eventId}/...).
  eventDates: 'dates',
  eventDateRsvps: 'date_rsvps',
  eventMessages: 'messages',
  eventParticipants: 'participants',
  eventGames: 'games',
});

/** Limites e regras das enquetes do fórum. */
export const FORUM_POLL = Object.freeze({
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 10,
  OPTION_MAX_CHARS: 120,
  QUESTION_MAX_CHARS: 200,
});

/** Limites gerais do fórum. */
export const FORUM_LIMITS = Object.freeze({
  TITLE_MAX: 140,
  BODY_MAX: 20000,
  COMMENT_MAX: 20000,
  MAX_ATTACHMENTS: 10,
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

/** Estado de um pedido de ingresso (não-membro pede para entrar no clube). */
export const JOIN_REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/** Estado de um convite de associação (admin convida atleta para o clube). */
export const MEMBER_INVITE_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
});

/** Tipos de evento do clube. */
export const CLUB_EVENT_TYPE = Object.freeze({
  GAME_DAY: 'game_day',
  SOCIAL: 'social',
  TOURNAMENT: 'tournament',
  MEETING: 'meeting',
  OTHER: 'other',
});

export const CLUB_EVENT_TYPE_LABELS = Object.freeze({
  [CLUB_EVENT_TYPE.GAME_DAY]: 'Dia de jogo',
  [CLUB_EVENT_TYPE.SOCIAL]: 'Confraternização',
  [CLUB_EVENT_TYPE.TOURNAMENT]: 'Torneio interno',
  [CLUB_EVENT_TYPE.MEETING]: 'Reunião',
  [CLUB_EVENT_TYPE.OTHER]: 'Outro',
});

/**
 * Rótulo do tipo do evento, tolerante a dados legados (ex.: o antigo tipo
 * `training` passa a ser apresentado como "Dia de jogo").
 */
export function eventTypeLabel(type) {
  if (type === 'training') return CLUB_EVENT_TYPE_LABELS[CLUB_EVENT_TYPE.GAME_DAY];
  return CLUB_EVENT_TYPE_LABELS[type] || 'Evento';
}

/** Indica se o evento é um "Dia de jogo" (inclui o tipo legado `training`). */
export function isGameDayEvent(type) {
  return type === CLUB_EVENT_TYPE.GAME_DAY || type === 'training';
}

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

/** Visibilidade do evento. */
export const EVENT_VISIBILITY = Object.freeze({
  PUBLIC: 'public',
  PRIVATE: 'private',
});

export const EVENT_VISIBILITY_LABELS = Object.freeze({
  [EVENT_VISIBILITY.PUBLIC]: 'Público (todo o clube)',
  [EVENT_VISIBILITY.PRIVATE]: 'Privado (somente convidados)',
});

/** Trata a ausência do campo como público (compatibilidade com eventos antigos). */
export function isPrivateEvent(event) {
  return (event?.visibility || EVENT_VISIBILITY.PUBLIC) === EVENT_VISIBILITY.PRIVATE;
}

/**
 * Estado do convite/participação de um atleta em um evento.
 * `invited` = convidado e ainda sem resposta; demais reaproveitam o RSVP.
 */
export const INVITE_STATUS = Object.freeze({
  INVITED: 'invited',
  GOING: RSVP_STATUS.GOING,
  MAYBE: RSVP_STATUS.MAYBE,
  NOT_GOING: RSVP_STATUS.NOT_GOING,
});

export const INVITE_STATUS_LABELS = Object.freeze({
  [INVITE_STATUS.INVITED]: 'Convidado',
  [INVITE_STATUS.GOING]: 'Vou',
  [INVITE_STATUS.MAYBE]: 'Talvez',
  [INVITE_STATUS.NOT_GOING]: 'Não vou',
});

/** Origem do participante do evento. */
export const INVITE_SOURCE = Object.freeze({
  CLUB: 'club', // atleta do clube
  PLATFORM: 'platform', // outro atleta da plataforma (convidado em evento privado)
});

/** Origem de um participante do dia de jogo. */
export const PARTICIPANT_SOURCE = Object.freeze({
  CONFIRMED: 'confirmed', // confirmou presença no evento
  PLATFORM: 'platform', // atleta da plataforma (membro/atleta)
  GUEST: 'guest', // convidado avulso (somente nome)
});

/** Limites do dia de jogo. */
export const GAME_DAY_LIMITS = Object.freeze({
  MAX_PARTICIPANTS: 64,
  MAX_ROUNDS: 30,
  MESSAGE_MAX: 4000,
});
