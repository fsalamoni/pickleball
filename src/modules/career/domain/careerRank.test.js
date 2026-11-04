import { describe, it, expect } from 'vitest';
import { normalizeCareerRank, officialRankPoints, rankSeries, rankTrend } from './careerRank.js';

const HOJE = '2026-11-04';

describe('a posição digitada', () => {
  it('normaliza e limita', () => {
    const r = normalizeCareerRank({ federation_name: ' FPP ', ranking_label: 'Duplas mistas 4.0', date: '2026-03-01', position: '12', points_total: '850' }, { uid: 'u1', today: HOJE, nowMs: 5 });
    expect(r.valid).toBe(true);
    expect(r.value).toEqual({ uid: 'u1', federation_id: null, federation_name: 'FPP', ranking_label: 'Duplas mistas 4.0', date: '2026-03-01', position: 12, points_total: 850, created_at_ms: 5, updated_at_ms: 5 });
  });
  it('recusa sem nome, data futura ou posição < 1', () => {
    expect(normalizeCareerRank({ date: '2026-03-01', position: 1 }, { today: HOJE }).valid).toBe(false);
    expect(normalizeCareerRank({ ranking_label: 'x', date: '2027-01-01', position: 1 }, { today: HOJE }).valid).toBe(false);
    expect(normalizeCareerRank({ ranking_label: 'x', date: '2026-01-01', position: 0 }, { today: HOJE }).valid).toBe(false);
  });
});

describe('a posição oficial (do ranking que o servidor grava)', () => {
  const rankings = [
    { federation_id: 'f1', acronym: 'FX', season: 2025, doc: { general: [{ uid: 'u1', position: 8, points: 300 }], categories: [{ key: 'k', gender_category: 'mixed', rows: [{ uid: 'u1', position: 3, points: 200 }] }] } },
    { federation_id: 'f1', acronym: 'FX', season: 2026, doc: { general: [{ uid: 'u2', position: 1 }, { uid: 'u1', position: 5, points: 500 }] } },
  ];
  it('uma posição por ranking e temporada; a aberta é a de hoje', () => {
    const p = officialRankPoints(rankings, 'u1', HOJE);
    expect(p.map((x) => [x.ranking_label, x.date, x.position])).toEqual([
      ['Geral', '2025-12-31', 8], ['Misto', '2025-12-31', 3], ['Geral', HOJE, 5],
    ]);
    expect(p.every((x) => x.official)).toBe(true);
  });
  it('as séries: digitada e oficial nunca na mesma linha', () => {
    const s = rankSeries(
      [{ federation_name: 'FX', ranking_label: 'Geral', date: '2026-01-10', position: 9 }],
      officialRankPoints(rankings, 'u1', HOJE),
    );
    const geralOficial = s.find((x) => x.official && x.label === 'FX · Geral');
    expect(geralOficial.points.map((p) => p.position)).toEqual([8, 5]);
    expect(s.find((x) => !x.official).points).toHaveLength(1);
    expect(rankTrend(geralOficial)).toMatchObject({ delta: 3, text: 'Subiu 3' });
    expect(rankTrend(s.find((x) => !x.official))).toBeNull();
  });
});
