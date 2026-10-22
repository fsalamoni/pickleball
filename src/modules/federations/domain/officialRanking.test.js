import { describe, it, expect } from 'vitest';
import {
  aggregateSeason, awardPoints, memberValidOn, normalizeRankingConfig, openSeasons, personPointsHistory, pointsFor,
  rankingCategoryKey, rankingSeasons, resultSeason, seasonClosed, seasonClosesAtMs, seasonLastDay, tournamentDay,
} from './officialRanking.js';

const MEMBERS = [
  { user_id: 'ana', tier: 'federated', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
  { user_id: 'bia', tier: 'federated', status: 'expired', valid_from: '2025-09-01', valid_until: '2026-08-31' },
  { user_id: 'caio', tier: 'registered', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
];
const r = (extra) => ({ federation_id: 'f', season: 2026, status: 'sent', tournament_id: 't', tournament_name: 'T', gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'regional', date: '2026-08-10', rows: [], ...extra });
/** Um lançamento como o servidor grava. */
const e = (id, uid, points, extra = {}) => ({ id, result_id: id.split('_')[0], uid, name: uid, points, position: 1, season: 2026, status: 'awarded', category: 'male_open_doubles', date: '2026-08-10', tournament_name: id, ...extra });

describe('ranking oficial (domínio)', () => {
  it('configuração: completa o que falta e saneia o inválido', () => {
    const cfg = normalizeRankingConfig({ best_n: -1, participation: 'x', points_by_place: { 1: 200 }, tier_multipliers: { major: 5 } });
    expect(cfg.best_n).toBe(6);
    expect(cfg.participation).toBe(10);
    expect(cfg.points_by_place[1]).toBe(200);
    expect(cfg.points_by_place[2]).toBe(70);
    expect(cfg.tier_multipliers).toEqual({ regional: 1, state: 1.5, major: 5 });
    expect(cfg.members_only).toBe(true);
  });
  it('pontos: tabela × peso; fora dos 8 vale a participação; quem não jogou não pontua', () => {
    expect(pointsFor({ position: 1 }, 'major', {})).toBe(200);
    expect(pointsFor({ position: 2 }, 'state', {})).toBe(105);
    expect(pointsFor({ position: 9, played: 2 }, 'regional', {})).toBe(10);
    expect(pointsFor({ position: null, played: 0 }, 'regional', {})).toBe(0);
    expect(pointsFor({ position: 1 }, 'desconhecido', {})).toBe(100);
  });
  it('só o federado em dia NA DATA pontua; suspenso e cadastrado não', () => {
    expect(memberValidOn(MEMBERS[0], '2026-08-10')).toBe(true);
    expect(memberValidOn(MEMBERS[1], '2026-08-10')).toBe(true);
    expect(memberValidOn(MEMBERS[1], '2026-09-10')).toBe(false);
    expect(memberValidOn(MEMBERS[2], '2026-08-10')).toBe(false);
    expect(memberValidOn({ ...MEMBERS[0], status: 'suspended' }, '2026-08-10')).toBe(false);
    expect(memberValidOn(undefined, '2026-08-10')).toBe(false);
  });
  it('lançamento: um por pessoa com conta que pontua, com a tabela e o peso gravados', () => {
    const out = awardPoints({ result: r({ tier: 'state', rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 3 }, { uid: 'bia', name: 'Bia', position: 2, played: 3 }, { uid: 'caio', position: 3, played: 3 }, { uid: null, name: 'Visitante', position: 4, played: 3 }, { uid: 'ana', position: 5, played: 1 }] }), members: MEMBERS });
    expect(out).toEqual([
      { uid: 'ana', name: 'Ana', photo_url: null, position: 1, played: 3, base_points: 100, multiplier: 1.5, points: 150 },
      { uid: 'bia', name: 'Bia', photo_url: null, position: 2, played: 3, base_points: 70, multiplier: 1.5, points: 105 },
    ]);
    expect(awardPoints({ result: r({ rows: [{ uid: 'caio', position: 1, played: 2 }] }), members: MEMBERS, config: { members_only: false } })).toHaveLength(1);
    expect(awardPoints({})).toEqual([]);
  });
  it('soma do ano: só lançamentos ativos daquele ano; best_n por classe; empate divide a posição', () => {
    const out = aggregateSeason({
      entries: [
        e('t1_ana', 'ana', 100), e('t1_bia', 'bia', 70, { position: 2 }),
        e('t2_ana', 'ana', 70, { position: 2, date: '2026-08-20' }), e('t2_bia', 'bia', 100, { date: '2026-08-20' }),
        e('t3_ana', 'ana', 30, { position: 5, category: 'mixed_open_doubles', gender_category: 'mixed' }),
        e('t4_ana', 'ana', 999, { status: 'cancelled' }),
        e('t5_ana', 'ana', 999, { season: 2025 }),
      ],
      config: { best_n: 1 }, season: 2026,
    });
    expect(out.results_count).toBe(3);
    expect(out.entries_count).toBe(5);
    expect(out.categories.map((c) => c.key)).toEqual(['male_open_doubles', 'mixed_open_doubles']);
    expect(out.categories[0].rows.map((l) => [l.uid, l.points, l.position, l.events])).toEqual([['ana', 100, 1, 2], ['bia', 100, 1, 2]]);
    expect(out.categories[0].rows[0].results.map((x) => [x.entry_id, x.counts])).toEqual([['t1_ana', true], ['t2_ana', false]]);
    expect(out.general.find((l) => l.uid === 'ana').points).toBe(130); // 100 (masc, melhor 1) + 30 (misto)
  });
  it('⭐ fechamento: o ano fecha em 1º/fev do seguinte, 00:00 de Brasília; janeiro ainda aceita o ano anterior', () => {
    expect(seasonClosesAtMs(2026)).toBe(Date.UTC(2027, 1, 1, 3));
    expect(seasonLastDay(2026)).toBe('2027-01-31');
    expect(seasonClosed(2026, Date.UTC(2027, 1, 1, 2, 59))).toBe(false);
    expect(seasonClosed(2026, Date.UTC(2027, 1, 1, 3))).toBe(true);
    expect(seasonClosed('nada')).toBe(true);
    expect(openSeasons(Date.UTC(2027, 0, 20))).toEqual([2026, 2027]);
    expect(openSeasons(Date.UTC(2027, 5, 1))).toEqual([2027]);
    // 31/12 às 22h em Brasília ainda é o ano velho.
    expect(openSeasons(Date.UTC(2027, 0, 1, 1))).toEqual([2026]);
  });
  it('histórico da pessoa: ano a ano, com o que conta, a posição oficial e o total de todos os anos', () => {
    const entries = [
      e('t1_ana', 'ana', 100), e('t2_ana', 'ana', 70, { date: '2026-09-01' }), e('t3_ana', 'ana', 40, { date: '2026-10-01', status: 'cancelled', cancel_reason: 'result_rejected' }),
      e('t9_ana', 'ana', 50, { season: 2025, date: '2025-05-01' }), e('t1_bia', 'bia', 70),
    ];
    const rankings = { 2025: { config: { best_n: 6 }, general: [{ uid: 'zed', position: 1 }, { uid: 'ana', position: 2 }] } };
    const h = personPointsHistory({ entries, uid: 'ana', rankings, config: { best_n: 1 }, nowMs: Date.UTC(2026, 9, 22) });
    expect(h.seasons.map((s) => [s.season, s.points, s.awarded, s.position, s.field, s.closed])).toEqual([[2026, 100, 2, null, null, false], [2025, 50, 1, 2, 2, true]]);
    expect(h.seasons[0].entries.map((x) => [x.id, x.counts])).toEqual([['t3_ana', false], ['t2_ana', false], ['t1_ana', true]]);
    expect(h.total).toBe(150);
    expect(personPointsHistory({ entries: [], uid: 'ana' })).toEqual({ seasons: [], total: 0 });
  });
  it('anos oferecidos: da criação da federação até hoje (máx. 15); sem data, os três últimos', () => {
    const agora = Date.UTC(2026, 9, 22);
    expect(rankingSeasons({ created_at: { toMillis: () => Date.UTC(2024, 4, 1) } }, agora)).toEqual([2026, 2025, 2024]);
    expect(rankingSeasons({ created_at: Date.UTC(2026, 0, 5) }, agora)).toEqual([2026]);
    expect(rankingSeasons({}, agora)).toEqual([2026, 2025, 2024]);
    expect(rankingSeasons({ created_at: Date.UTC(1990, 0, 1) }, agora)).toHaveLength(15);
  });
  it('temporada e dia do torneio saem de ends_at, depois starts_at', () => {
    expect(resultSeason({ starts_at: '2026-03-01T12:00:00Z', ends_at: '2027-01-02' })).toBe(2027);
    expect(resultSeason({ starts_at: '2026-03-01' })).toBe(2026);
    expect(tournamentDay({ starts_at: '2026-03-01T12:00:00Z' })).toBe('2026-03-01');
    expect(rankingCategoryKey({})).toBe('open_open_doubles');
  });
});
