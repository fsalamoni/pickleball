/**
 * Planilha DUPR do torneio chancelado (rodada 3, Bloco 6c): a federação manda
 * as partidas do torneio dela; a exportação geral do admin as deixa de fora.
 */
import { describe, it, expect } from 'vitest';
import { buildDuprCsv, sentByFederation, tournamentDuprExport, tournamentMatchUids } from './duprMatchExport.js';

const regById = new Map([
  ['rA', { format: 'doubles', player_a_user_id: 'u1', player_b_user_id: 'u2' }],
  ['rB', { format: 'doubles', player_a_user_id: 'u3', player_b_user_id: 'u4' }],
]);
const tournament = { id: 't1', name: 'Etapa FGP 1000', city: 'Porto Alegre', state: 'RS', federation_id: 'fgp', federation_sanction: { status: 'approved' } };
const jogo = (id, extra = {}) => ({ id, tournament_id: 't1', side_a_ids: ['rA'], side_b_ids: ['rB'], winner_side: 'a', games: [{ a: 11, b: 6 }, { a: 11, b: 9 }], result_recorded_at: '2026-10-20T15:00:00Z', ...extra });
const profilesById = new Map([
  ['u1', { full_name: 'Ana', dupr_id: 'AAA111' }],
  ['u2', { full_name: 'Bia', dupr_id: 'BBB222' }],
  ['u3', { full_name: 'Caio', dupr_id: 'CCC333' }],
  ['u4', { full_name: 'Duda', dupr_id: '' }],
]);

describe('torneio chancelado no DUPR', () => {
  it('só chancela APROVADA com federação faz a federação ser a remetente', () => {
    const byId = (t) => new Map([['t1', t]]);
    expect(sentByFederation({ tournament_id: 't1' }, byId(tournament))).toBe(true);
    expect(sentByFederation({ tournament_id: 't1' }, byId({ ...tournament, federation_sanction: { status: 'pending' } }))).toBe(false);
    expect(sentByFederation({ tournament_id: 't1' }, byId({ id: 't1' }))).toBe(false);
    expect(sentByFederation({ game_day_id: 'g' }, byId(tournament))).toBe(false);
  });

  it('a planilha leva só as partidas com todos os IDs DUPR e diz quem falta', () => {
    const r = tournamentDuprExport({ tournament, matches: [jogo('m1'), jogo('m2', { games: [] })], regById, profilesById });
    expect(r.summary).toMatchObject({ total: 1, ready: 0, incomplete: 1 });
    expect(r.rows).toEqual([]);
    expect(r.missing).toEqual(['Duda']);
    const ok = tournamentDuprExport({ tournament, matches: [jogo('m1')], regById, profilesById: new Map([...profilesById, ['u4', { full_name: 'Duda', dupr_id: 'DDD444' }]]) });
    expect(ok.rows).toHaveLength(1);
    expect(ok.rows[0]).toMatchObject({ matchType: 'D', event: 'Etapa FGP 1000', date: '2026-10-20', playerB2DuprId: 'DDD444', teamAGame1: 11, teamBGame2: 9 });
    expect(buildDuprCsv(ok.rows).startsWith('matchType,')).toBe(true);
  });

  it('lê só os perfis de quem jogou', () => {
    expect(tournamentMatchUids([jogo('m1')], regById).sort()).toEqual(['u1', 'u2', 'u3', 'u4']);
  });
});
