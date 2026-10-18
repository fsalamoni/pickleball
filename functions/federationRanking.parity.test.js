/**
 * PARIDADE cliente × servidor do ranking oficial: o que a tela mostra como
 * "pontos que este resultado vai dar" é o que o servidor grava.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/officialRanking.js';
import { DEFAULT_RANKING_CONFIG } from '@/modules/federations/domain/constants.js';

const require = createRequire(import.meta.url);
const s = require('./federationRanking.js');

const MEMBERS = [
  { user_id: 'ana', tier: 'federated', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
  { user_id: 'bia', tier: 'federated', status: 'expired', valid_from: '2025-09-01', valid_until: '2026-08-31' },
  { user_id: 'caio', tier: 'registered', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
  { user_id: 'dani', tier: 'federated', status: 'suspended', valid_from: '2026-01-01', valid_until: '2026-12-31' },
];
const RESULTS = [
  { federation_id: 'f', season: 2026, status: 'sent', tournament_id: 't1', tournament_name: 'T1', modality_name: 'DM', gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'state', date: '2026-08-10', rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 4 }, { uid: 'bia', name: 'Bia', position: 2, played: 4 }, { uid: 'caio', name: 'Caio', position: 3, played: 4 }, { uid: 'dani', name: 'Dani', position: 4, played: 4 }, { uid: 'eva', name: 'Eva', position: 12, played: 1 }] },
  { federation_id: 'f', season: 2026, status: 'sent', tournament_id: 't2', tournament_name: 'T2', modality_name: 'DM', gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'major', date: '2026-09-10', rows: [{ uid: 'ana', name: 'Ana', position: 3, played: 4 }, { uid: 'bia', name: 'Bia', position: 1, played: 4 }] },
  { federation_id: 'f', season: 2026, status: 'sent', tournament_id: 't3', tournament_name: 'T3', modality_name: 'MX', gender_category: 'mixed', age_category: '35plus', format: 'doubles', tier: 'regional', date: '2026-10-01', rows: [{ uid: 'ana', name: 'Ana', position: 2, played: 3 }, { uid: 'zed', name: 'Zed', position: 1, played: 3 }] },
  { federation_id: 'f', season: 2026, status: 'rejected', tournament_id: 't4', tournament_name: 'T4', gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'major', date: '2026-10-02', rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 3 }] },
  { federation_id: 'f', season: 2025, status: 'sent', tournament_id: 't5', tournament_name: 'T5', gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'major', date: '2025-10-02', rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 3 }] },
];
const CONFIGS = [{}, { best_n: 1 }, { best_n: 0, members_only: false }, { points_by_place: { 1: 50 }, participation: 0, tier_multipliers: { major: 3 } }, { participation: 'x', best_n: -4 }];

describe('paridade: ranking oficial', () => {
  it('a configuração padrão e a saneada são as mesmas', () => {
    expect(s.DEFAULT_RANKING_CONFIG).toEqual(DEFAULT_RANKING_CONFIG);
    CONFIGS.forEach((cfg) => expect(s.normalizeRankingConfig(cfg)).toEqual(c.normalizeRankingConfig(cfg)));
  });
  it('a classificação sai igual nos dois lados', () => {
    CONFIGS.forEach((cfg) => {
      expect(s.computeOfficialRanking({ results: RESULTS, members: MEMBERS, config: cfg, season: 2026 }))
        .toEqual(c.computeOfficialRanking({ results: RESULTS, members: MEMBERS, config: cfg, season: 2026 }));
    });
  });
  it('pontos e filiação em dia batem', () => {
    expect(s.pointsFor({ position: 3 }, 'major', {})).toBe(c.pointsFor({ position: 3 }, 'major', {}));
    expect(s.pointsFor({ position: 20, played: 2 }, 'state', {})).toBe(c.pointsFor({ position: 20, played: 2 }, 'state', {}));
    MEMBERS.forEach((m) => expect(s.memberValidOn(m, '2026-08-10')).toBe(c.memberValidOn(m, '2026-08-10')));
    expect(s.memberValidOn(MEMBERS[0], '')).toBe(c.memberValidOn(MEMBERS[0], ''));
  });
});
