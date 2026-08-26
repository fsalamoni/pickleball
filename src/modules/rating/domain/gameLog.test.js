import { describe, it, expect } from 'vitest';
import { normalizeFinishedGames } from './gameLog.js';
import { MODALITY_FORMAT } from '@/modules/tournament/domain/constants';

describe('gameLog — normalizeFinishedGames', () => {
  const regById = new Map([
    ['rA', { format: MODALITY_FORMAT.SINGLES, player_a_user_id: 'uA' }],
    ['rB', { format: MODALITY_FORMAT.SINGLES, player_a_user_id: 'uB' }],
    ['rDup1', { format: MODALITY_FORMAT.DOUBLES, player_a_user_id: 'uA', player_b_user_id: 'uB' }],
    ['rDup2', { format: MODALITY_FORMAT.DOUBLES, player_a_user_id: 'uC', player_b_user_id: 'uD' }],
    ['rIncomplete', { format: MODALITY_FORMAT.DOUBLES, player_a_user_id: 'uE', player_b_user_id: null }],
  ]);

  it('normaliza jogo de simples de torneio (regId → uid) com pontos somados por set', () => {
    const out = normalizeFinishedGames({
      tournamentMatches: [{
        tournament_id: 't1', winner_side: 'a', side_a_ids: ['rA'], side_b_ids: ['rB'],
        games: [{ a: 11, b: 5 }, { a: 9, b: 11 }, { a: 11, b: 7 }], result_recorded_at: 1000,
      }],
      regById,
    });
    expect(out).toHaveLength(1);
    expect(out[0].side_a).toEqual(['uA']);
    expect(out[0].side_b).toEqual(['uB']);
    expect(out[0].winner).toBe('a');
    expect(out[0].points_a).toBe(31);
    expect(out[0].points_b).toBe(23);
    expect(out[0].tournament_id).toBe('t1');
  });

  it('normaliza jogo de duplas (2 uids por lado)', () => {
    const out = normalizeFinishedGames({
      tournamentMatches: [{
        tournament_id: 't1', winner_side: 'b', side_a_ids: ['rDup1'], side_b_ids: ['rDup2'],
        games: [{ a: 8, b: 11 }], result_recorded_at: 1,
      }],
      regById,
    });
    expect(out).toHaveLength(1);
    expect(out[0].side_a.sort()).toEqual(['uA', 'uB']);
    expect(out[0].side_b.sort()).toEqual(['uC', 'uD']);
    expect(out[0].winner).toBe('b');
  });

  it('ignora inscrições incompletas, sem vencedor e confrontos de equipe', () => {
    const out = normalizeFinishedGames({
      tournamentMatches: [
        { winner_side: 'a', side_a_ids: ['rDup1'], side_b_ids: ['rIncomplete'], result_recorded_at: 1 },
        { winner_side: null, side_a_ids: ['rA'], side_b_ids: ['rB'], result_recorded_at: 1 },
        { winner_side: 'a', side_a_ids: ['rA'], side_b_ids: ['rB'], team_confrontation: true, result_recorded_at: 1 },
      ],
      regById,
    });
    expect(out).toHaveLength(0);
  });

  it('inclui jogos de dia de jogo (club_event_games) com uids diretos', () => {
    const out = normalizeFinishedGames({
      clubEventMatches: [{
        winner_side: 'a', side_a_ids: ['uA'], side_b_ids: ['uB'], score_a: 11, score_b: 9,
        tournament_id: null, result_recorded_at: 5,
      }],
      regById,
    });
    expect(out).toHaveLength(1);
    expect(out[0].side_a).toEqual(['uA']);
    expect(out[0].points_a).toBe(11);
    expect(out[0].points_b).toBe(9);
  });

  it('ignora club_event_games com uid vazio', () => {
    const out = normalizeFinishedGames({
      clubEventMatches: [{ winner_side: 'a', side_a_ids: ['uA', null], side_b_ids: ['uB'], result_recorded_at: 5 }],
      regById,
    });
    expect(out).toHaveLength(0);
  });
});
