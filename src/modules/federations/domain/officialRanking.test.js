import { describe, it, expect } from 'vitest';
import { computeOfficialRanking, memberValidOn, normalizeRankingConfig, pointsFor, resultSeason, tournamentDay, rankingCategoryKey } from './officialRanking.js';

const MEMBERS = [
  { user_id: 'ana', tier: 'federated', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
  { user_id: 'bia', tier: 'federated', status: 'expired', valid_from: '2025-09-01', valid_until: '2026-08-31' },
  { user_id: 'caio', tier: 'registered', status: 'active', valid_from: '2026-01-01', valid_until: '2026-12-31' },
];
const r = (extra) => ({ federation_id: 'f', season: 2026, status: 'sent', tournament_id: 't', tournament_name: 'T', gender_category: 'male', age_category: 'open', format: 'doubles', tier: 'regional', date: '2026-08-10', rows: [], ...extra });

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
  it('classifica por classe e na geral, com empate dividindo a posição e best_n cortando', () => {
    const out = computeOfficialRanking({
      results: [
        r({ tournament_id: 't1', rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 3 }, { uid: 'bia', name: 'Bia', position: 2, played: 3 }, { uid: 'caio', name: 'Caio', position: 3, played: 3 }] }),
        r({ tournament_id: 't2', date: '2026-08-20', rows: [{ uid: 'ana', name: 'Ana', position: 2, played: 3 }, { uid: 'bia', name: 'Bia', position: 1, played: 3 }] }),
        r({ tournament_id: 't3', date: '2026-08-25', gender_category: 'mixed', rows: [{ uid: 'ana', name: 'Ana', position: 5, played: 2 }] }),
        r({ tournament_id: 't4', status: 'rejected', rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 2 }] }),
        r({ tournament_id: 't5', season: 2025, rows: [{ uid: 'ana', name: 'Ana', position: 1, played: 2 }] }),
      ],
      members: MEMBERS, config: { best_n: 1 }, season: 2026,
    });
    expect(out.results_count).toBe(3);
    expect(out.categories.map((c) => c.key)).toEqual(['male_open_doubles', 'mixed_open_doubles']);
    const masc = out.categories[0].rows;
    expect(masc.map((l) => [l.uid, l.points, l.position, l.events])).toEqual([['ana', 100, 1, 2], ['bia', 100, 1, 2]]);
    expect(out.general.find((l) => l.uid === 'ana').points).toBe(130); // 100 (masc, melhor 1) + 30 (misto)
    expect(out.general.find((l) => l.uid === 'caio')).toBeUndefined();
  });
  it('temporada e dia do torneio saem de ends_at, depois starts_at', () => {
    expect(resultSeason({ starts_at: '2026-03-01T12:00:00Z', ends_at: '2027-01-02' })).toBe(2027);
    expect(resultSeason({ starts_at: '2026-03-01' })).toBe(2026);
    expect(tournamentDay({ starts_at: '2026-03-01T12:00:00Z' })).toBe('2026-03-01');
    expect(rankingCategoryKey({})).toBe('open_open_doubles');
  });
});
