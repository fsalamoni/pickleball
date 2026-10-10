import { describe, it, expect } from 'vitest';
import { gameDayEvent, tournamentEvent, bookingEvents } from './debriefEvents.js';

describe('gameDayEvent', () => {
  const gd = { id: 'gd1', title: 'Sábado', date: '2026-10-07', time: '08:00' };
  const parts = [{ id: 'p1', user_id: 'u1', name: 'Ana' }, { id: 'p2', user_id: 'u2', name: 'Bia' }];
  it('conta os jogos em que a pessoa entrou e as vitórias dos decididos', () => {
    const games = [
      { side_a: [{ id: 'p1' }], side_b: [{ id: 'p2' }], score_a: 11, score_b: 5 },
      { side_a: [{ id: 'p2' }], side_b: [{ id: 'p1' }], score_a: 11, score_b: 9 },
      { side_a: [{ id: 'p1' }], side_b: [{ id: 'p2' }] }, // Play, sem placar
      { side_a: [{ id: 'p2' }], side_b: [{ id: 'x' }], score_a: 11, score_b: 0 },
    ];
    expect(gameDayEvent('u1', gd, games, parts)).toMatchObject({
      type: 'dia_de_jogo', ref_id: 'gd1', title: 'Sábado', date: '2026-10-07', games: 3, wins: 1,
    });
  });
  it('organizar sem jogar não é jogo; só Play dá vitórias desconhecidas', () => {
    expect(gameDayEvent('u9', gd, [{ side_a: [{ id: 'p1' }], side_b: [{ id: 'p2' }] }], parts)).toBeNull();
    expect(gameDayEvent('u1', gd, [{ side_a: [{ id: 'p1' }], side_b: [{ id: 'p2' }] }], parts).wins).toBeNull();
  });
});

describe('tournamentEvent', () => {
  it('vale a data de fim; encerrado já terminou; rascunho e cancelado não contam', () => {
    expect(tournamentEvent({ id: 't1', name: 'Open', status: 'finished', starts_at: '2026-10-04', ends_at: '2026-10-05' }))
      .toMatchObject({ type: 'torneio', date: '2026-10-05', ends_at_ms: 0 });
    expect(tournamentEvent({ id: 't2', status: 'in_progress', starts_at: '2026-10-06' }).ends_at_ms).toBeGreaterThan(0);
    expect(tournamentEvent({ id: 't3', status: 'draft', starts_at: '2026-10-06' })).toBeNull();
    expect(tournamentEvent({ id: 't4', status: 'cancelled', starts_at: '2026-10-06' })).toBeNull();
  });
});

describe('bookingEvents', () => {
  it('um evento por dia reservado; pedido, recusa e falta não contam', () => {
    const r = bookingEvents({
      id: 'b1', status: 'confirmed', arena_name: 'Arena Sol',
      slots: [{ date: '2026-10-07', start: '19:00', end: '20:00' }, { date: '2026-10-07', start: '20:00', end: '21:00' }, { date: '2026-10-14', start: '19:00', end: '20:00' }],
    });
    expect(r.map((e) => e.ref_id)).toEqual(['b1_2026-10-07', 'b1_2026-10-14']);
    expect(r[0].title).toBe('Jogo na Arena Sol');
    expect(new Date(r[0].ends_at_ms).getHours()).toBe(21);
    expect(bookingEvents({ id: 'b2', status: 'requested', date: '2026-10-07' })).toEqual([]);
    expect(bookingEvents({ id: 'b3', status: 'completed', no_show: true, date: '2026-10-07' })).toEqual([]);
  });
});
