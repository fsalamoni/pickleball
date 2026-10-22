import { describe, it, expect } from 'vitest';
import { computeOfficialRanking, memberValidOn, nextExpiry, normalizeRankingConfig, pointsFor, resultExpiry, resultSeason, tournamentDay, rankingCategoryKey } from './officialRanking.js';

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

describe('ranking corrido (validade do resultado)', () => {
  const res = (date, uid, position, season) => ({ status: 'sent', season, date, tier: 'regional', gender_category: 'male', age_category: 'open', format: 'doubles', tournament_id: date, rows: [{ uid, name: uid, position, played: 3 }] });
  const RES = [res('2025-10-17', 'ana', 1, 2025), res('2025-10-19', 'bia', 1, 2025), res('2026-03-01', 'ana', 2, 2026), res('2026-11-01', 'ana', 1, 2026)];

  it('o padrão é a temporada; o corrido vem saneado (1 a 36 meses)', () => {
    expect(normalizeRankingConfig({})).toMatchObject({ period: 'season', validity_months: 12 });
    expect(normalizeRankingConfig({ period: 'rolling', validity_months: 6.7 })).toMatchObject({ period: 'rolling', validity_months: 6 });
    expect(normalizeRankingConfig({ period: 'rolling', validity_months: 400 }).validity_months).toBe(36);
  });

  it('vale da data do torneio por N meses, sem contar o futuro; cada resultado diz quando vence', () => {
    const r = computeOfficialRanking({ results: RES, config: { members_only: false, period: 'rolling' }, asOf: '2026-10-18' });
    expect(r).toMatchObject({ season: null, as_of: '2026-10-18' });
    // Ana: 17/10/2025 venceu, 01/11/2026 ainda não aconteceu — só o 2º lugar de março (70). Bia: 19/10/2025 vale até 19/10/2026.
    expect(r.general.map((l) => [l.uid, l.points])).toEqual([['bia', 100], ['ana', 70]]);
    expect(r.general[0].results[0].expires_on).toBe('2026-10-19');
    expect(computeOfficialRanking({ results: RES, config: { members_only: false }, season: 2026 }).general[0].results[0].expires_on).toBeUndefined();
  });

  it('a data em que vence e o próximo vencimento da linha', () => {
    expect(resultExpiry('2026-01-31', 1)).toBe('2026-02-28');
    expect(resultExpiry('2026-12-15', 1)).toBe('2027-01-15');
    expect(resultExpiry('', 12)).toBe('');
    expect(nextExpiry([{ points: 50, expires_on: '2027-03-01' }, { points: 30, expires_on: '2026-11-02' }, { points: 5, expires_on: '2026-11-02' }])).toEqual({ date: '2026-11-02', points: 35 });
    expect(nextExpiry([{ points: 50 }])).toBeNull();
  });
});
