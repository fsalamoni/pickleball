import { describe, it, expect } from 'vitest';
import { careerGoalValues, seasonGoalMetrics, splitSeasonGoals } from './careerGoals.js';
import { goalProgress, normalizeGoalInput } from '@/modules/progression/domain/progression.js';

const timeline = {
  faltou: [],
  seasons: [{
    year: 2026,
    items: [
      { source: 'fora', date: '2026-03-01', position: 1, federated: true },
      { source: 'torneio', date: '2026-05-01', position: null, federated: false },
      { source: 'dia_de_jogo', date: '2026-05-02', position: 2 },
      { source: 'fora', date: '2026-06-01', cancelled: true, position: 1 },
      { source: 'federacao', date: '2025-12-01', position: 3, federated: true },
    ],
  }],
};

describe('as métricas da carreira saem da linha do tempo', () => {
  it('jogados (sem dia de jogo nem cancelado), pódios e federados', () => {
    const { values } = careerGoalValues(timeline, { duprRating: 4.12 });
    expect(values.career_events_played).toEqual(['2026-03-01', '2026-05-01', '2025-12-01']);
    expect(values.career_podiums).toEqual(['2026-03-01', '2026-05-02', '2025-12-01']);
    expect(values.federated_events).toEqual(['2026-03-01', '2025-12-01']);
    expect(values.dupr_rating).toBe(4.12);
  });
  it('a janela da meta recorta', () => {
    const { values } = careerGoalValues(timeline);
    const g = { kind: 'outcome', metric: 'career_podiums', target: 3, since: '2026-01-01', due_date: '2026-12-31' };
    expect(goalProgress(g, values)).toMatchObject({ current: 2, target: 3, done: false, unknown: false });
  });
  it('sem linha do tempo, desconhecido — nunca zero', () => {
    const { values } = careerGoalValues(null);
    expect(goalProgress({ kind: 'outcome', metric: 'career_podiums', target: 3, due_date: '2026-12-31' }, values)).toMatchObject({ unknown: true, current: null });
  });
  it('meta DUPR só com o DUPR oficial', () => {
    expect(seasonGoalMetrics()).not.toContain('dupr_rating');
    expect(seasonGoalMetrics({ dupr: true })).toContain('dupr_rating');
  });
});

describe('a meta da temporada (player_goals com kind)', () => {
  it('as metas antigas seguem exatamente iguais', () => {
    expect(normalizeGoalInput({ metric: 'wins', target: '5', title: 'x' })).toEqual({ valid: true, errors: {}, value: { metric: 'wins', target: 5 } });
    expect(goalProgress({ metric: 'wins', target: 10 }, { wins: 5 })).toEqual({ current: 5, target: 10, ratio: 0.5, done: false });
  });
  it('preserva os campos novos', () => {
    const r = normalizeGoalInput({ kind: 'outcome', title: '3 pódios em 2027', metric: 'career_podiums', target: 3, since: '2027-01-01', due_date: '2027-12-31', if_then: 'Se perder, revejo o balanço', aspect_id: 'devolucao' });
    expect(r.valid).toBe(true);
    expect(r.value).toEqual({ kind: 'outcome', title: '3 pódios em 2027', metric: 'career_podiums', target: 3, since: '2027-01-01', due_date: '2027-12-31', status: 'active', if_then: 'Se perder, revejo o balanço', aspect_id: 'devolucao' });
  });
  it('exige título e prazo; prazo antes do início é erro', () => {
    expect(normalizeGoalInput({ kind: 'outcome' }).errors).toHaveProperty('title');
    expect(normalizeGoalInput({ kind: 'outcome', title: 'x' }).errors).toHaveProperty('due_date');
    expect(normalizeGoalInput({ kind: 'outcome', title: 'x', since: '2027-02-01', due_date: '2027-01-01' }).valid).toBe(false);
  });
  it('meta de processo: progresso à mão, 0–100', () => {
    const { value } = normalizeGoalInput({ kind: 'process', title: 'Devolução funda', due_date: '2027-06-30', progress_manual: 130 });
    expect(value.progress_manual).toBe(100);
    expect(value).not.toHaveProperty('metric');
    expect(goalProgress({ ...value, progress_manual: 40 })).toMatchObject({ current: 40, ratio: 0.4, done: false });
  });
  it('abandonar não é falha: só sai das ativas', () => {
    const goals = [
      { id: '1', kind: 'outcome', status: 'dropped', due_date: '2027-01-01' },
      { id: '2', kind: 'outcome', status: 'active', due_date: '2027-03-01' },
      { id: '3', kind: 'outcome', due_date: '2027-02-01' },
      { id: '4', metric: 'wins', target: 2 },
      { id: '5', kind: 'process', status: 'done', due_date: '2027-01-01' },
    ];
    const s = splitSeasonGoals(goals);
    expect(s.active.map((g) => g.id)).toEqual(['3', '2']);
    expect(s.dropped.map((g) => g.id)).toEqual(['1']);
    expect(s.done.map((g) => g.id)).toEqual(['5']);
    expect(goalProgress(goals[0], {})).toMatchObject({ dropped: true, done: false });
  });
});
