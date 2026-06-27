import { describe, it, expect } from 'vitest';
import { buildFeed, filterFeedByFollowing, FEED_ITEM_TYPE } from './feed.js';

describe('buildFeed', () => {
  const tournaments = [
    { id: 't1', name: 'Aberto', city: 'SP', owner_id: 'u1', created_at: 100 },
  ];
  const openGames = [
    { id: 'g1', creator_name: 'Ana', when_text: 'Sábado', city: 'Rio', created_by: 'u2', created_at: 300 },
  ];

  it('normaliza e ordena por data desc', () => {
    const feed = buildFeed({ tournaments, openGames });
    expect(feed.map((i) => i.id)).toEqual(['g_g1', 't_t1']);
    expect(feed[0].type).toBe(FEED_ITEM_TYPE.OPEN_GAME);
    expect(feed[1].link).toBe('/p/t1');
  });

  it('respeita o limite', () => {
    expect(buildFeed({ tournaments, openGames }, { limit: 1 })).toHaveLength(1);
  });
});

describe('filterFeedByFollowing', () => {
  it('mantém só itens de autores seguidos', () => {
    const feed = buildFeed({
      tournaments: [{ id: 't1', owner_id: 'u1', created_at: 1 }],
      openGames: [{ id: 'g1', created_by: 'u2', created_at: 2 }],
    });
    const filtered = filterFeedByFollowing(feed, ['u2']);
    expect(filtered.map((i) => i.id)).toEqual(['g_g1']);
  });
});
