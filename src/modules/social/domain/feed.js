/**
 * Montagem pura do feed da comunidade (sem I/O).
 *
 * Normaliza torneios públicos e convites de "procura-se jogo" em itens de feed
 * homogêneos e os ordena por data (mais recentes primeiro).
 */

import { toMillis } from '@/modules/tournament/domain/participation';

export const FEED_ITEM_TYPE = Object.freeze({ TOURNAMENT: 'tournament', OPEN_GAME: 'open_game' });

function tournamentToItem(t) {
  const place = [t.city, t.state].filter(Boolean).join(' / ');
  return {
    id: `t_${t.id}`,
    type: FEED_ITEM_TYPE.TOURNAMENT,
    at: toMillis(t.created_at),
    title: t.name || 'Novo torneio',
    subtitle: place || 'Torneio público',
    link: `/p/${t.id}`,
    actorUid: t.owner_id || null,
  };
}

function openGameToItem(g) {
  const place = [g.city, g.state].filter(Boolean).join(' / ');
  return {
    id: `g_${g.id}`,
    type: FEED_ITEM_TYPE.OPEN_GAME,
    at: toMillis(g.created_at),
    title: `${g.creator_name || 'Um atleta'} procura jogo`,
    subtitle: [g.when_text, place].filter(Boolean).join(' · ') || 'Convite aberto',
    link: '/procura-jogo',
    actorUid: g.created_by || null,
  };
}

/**
 * @param {{ tournaments?: Array<object>, openGames?: Array<object> }} sources
 * @param {{ limit?: number }} [options]
 * @returns {Array<object>} itens de feed ordenados por data desc
 */
export function buildFeed({ tournaments = [], openGames = [] } = {}, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 50;
  const items = [
    ...tournaments.map(tournamentToItem),
    ...openGames.map(openGameToItem),
  ];
  items.sort((a, b) => (b.at || 0) - (a.at || 0));
  return items.slice(0, limit);
}

/** Mantém só itens cujo autor está no conjunto de seguidos. */
export function filterFeedByFollowing(items, followingUids) {
  const set = followingUids instanceof Set ? followingUids : new Set(followingUids || []);
  return (items || []).filter((it) => it.actorUid && set.has(it.actorUid));
}
