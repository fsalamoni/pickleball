/**
 * PARIDADE cliente × servidor do ranking oficial: o lançamento, a soma do ano
 * e a data de fechamento que a tela mostra são os que o servidor grava.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/officialRanking.js';
import { DEFAULT_RANKING_CONFIG, POINTS_CANCEL_REASON, POINTS_STATUS } from '@/modules/federations/domain/constants.js';

const require = createRequire(import.meta.url);
const s = require('./federationRanking.js');

const MEMBERS = [
  { user_id: 'ana', tier: 'federated', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
  { user_id: 'bia', tier: 'federated', status: 'expired', valid_from: '2025-09-01', valid_until: '2026-08-31' },
  { user_id: 'caio', tier: 'registered', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
  { user_id: 'dani', tier: 'federated', status: 'suspended', valid_from: '2026-01-01', valid_until: '2026-12-31' },
];
const RESULTS = [
  { federation_id: 'f', season: 2026, status: 'sent', tournament_id: 't1', tournament_name: 'T1', modality_name: 'DM', gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'state', date: '2026-08-10', rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 4 }, { uid: 'bia', name: 'Bia', position: 2, played: 4 }, { uid: 'caio', name: 'Caio', position: 3, played: 4 }, { uid: 'dani', name: 'Dani', position: 4, played: 4 }, { uid: 'eva', name: 'Eva', position: 12, played: 1 }, { uid: 'ana', name: 'Ana', position: 5, played: 2 }] },
  { federation_id: 'f', season: 2026, status: 'sent', tournament_id: 't2', tournament_name: 'T2', modality_name: 'DM', gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'major', date: '2026-09-10', rows: [{ uid: 'ana', name: 'Ana', position: 3, played: 4 }, { uid: 'bia', name: 'Bia', position: 1, played: 4 }] },
  { federation_id: 'f', season: 2026, status: 'sent', tournament_id: 't3', tournament_name: 'T3', modality_name: 'MX', gender_category: 'mixed', age_category: '35plus', format: 'doubles', tier: 'regional', date: '2026-10-01', rows: [{ uid: 'ana', name: 'Ana', position: 2, played: 3 }, { uid: 'zed', name: 'Zed', position: 1, played: 3 }] },
  { federation_id: 'f', season: 2026, status: 'sent', tournament_id: 't4', tournament_name: 'T4', gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'outro', date: '2026-10-02', rows: [{ uid: 'ana', name: 'Ana', position: null, played: 0 }] },
];
const CONFIGS = [{}, { best_n: 1 }, { best_n: 0, members_only: false }, { points_by_place: { 1: 50 }, participation: 0, tier_multipliers: { major: 3 } }, { participation: 'x', best_n: -4 }];

/** Os lançamentos como o servidor grava (um por pessoa por resultado), para a soma do ano. */
const lancamentos = (cfg) => RESULTS.flatMap((r, i) => s.awardPoints({ result: r, members: MEMBERS, config: cfg }).map((a) => ({
  id: `r${i}_${a.uid}`, result_id: `r${i}`, federation_id: 'f', season: r.season, tournament_id: r.tournament_id, tournament_name: r.tournament_name, modality_name: r.modality_name || '', date: r.date,
  category: s.rankingCategoryKey(r), gender_category: r.gender_category, age_category: r.age_category, format: r.format, status: 'awarded', ...a,
}))).concat([{ id: 'x_ana', result_id: 'x', federation_id: 'f', season: 2026, uid: 'ana', points: 999, status: 'cancelled', category: 'male_open_doubles' }, { id: 'y_ana', result_id: 'y', federation_id: 'f', season: 2025, uid: 'ana', points: 999, status: 'awarded', category: 'male_open_doubles' }]);

describe('paridade: ranking oficial', () => {
  it('a configuração padrão, os estados e os motivos são os mesmos', () => {
    expect(s.DEFAULT_RANKING_CONFIG).toEqual(DEFAULT_RANKING_CONFIG);
    expect(s.POINTS_STATUS).toEqual(POINTS_STATUS);
    expect(s.POINTS_CANCEL_REASON).toEqual(POINTS_CANCEL_REASON);
    CONFIGS.forEach((cfg) => expect(s.normalizeRankingConfig(cfg)).toEqual(c.normalizeRankingConfig(cfg)));
  });
  it('o lançamento de cada resultado sai igual nos dois lados', () => {
    CONFIGS.forEach((cfg) => RESULTS.forEach((r) => {
      expect(s.awardPoints({ result: r, members: MEMBERS, config: cfg })).toEqual(c.awardPoints({ result: r, members: MEMBERS, config: cfg }));
    }));
    expect(s.awardPoints({})).toEqual(c.awardPoints({}));
  });
  it('a soma do ano sai igual nos dois lados (só lançamentos ativos daquele ano)', () => {
    CONFIGS.forEach((cfg) => {
      const entries = lancamentos(cfg);
      expect(s.aggregateSeason({ entries, config: cfg, season: 2026 })).toEqual(c.aggregateSeason({ entries, config: cfg, season: 2026 }));
    });
  });
  it('a data de fechamento da temporada é a mesma', () => {
    [2025, 2026, 2030].forEach((ano) => {
      expect(s.seasonClosesAtMs(ano)).toBe(c.seasonClosesAtMs(ano));
      expect(s.seasonLastDay(ano)).toBe(c.seasonLastDay(ano));
    });
    [Date.UTC(2026, 9, 1), Date.UTC(2027, 0, 31, 12), Date.UTC(2027, 1, 1, 3), Date.UTC(2027, 1, 1, 2, 59)].forEach((t) => {
      expect(s.openSeasons(t)).toEqual(c.openSeasons(t));
      expect(s.seasonClosed(2026, t)).toBe(c.seasonClosed(2026, t));
    });
    expect(s.seasonClosesAtMs('x')).toBe(c.seasonClosesAtMs('x'));
  });
  it('pontos e filiação em dia batem', () => {
    expect(s.pointsFor({ position: 3 }, 'major', {})).toBe(c.pointsFor({ position: 3 }, 'major', {}));
    expect(s.pointsFor({ position: 20, played: 2 }, 'state', {})).toBe(c.pointsFor({ position: 20, played: 2 }, 'state', {}));
    MEMBERS.forEach((m) => expect(s.memberValidOn(m, '2026-08-10')).toBe(c.memberValidOn(m, '2026-08-10')));
    expect(s.memberValidOn(MEMBERS[0], '')).toBe(c.memberValidOn(MEMBERS[0], ''));
  });
});
