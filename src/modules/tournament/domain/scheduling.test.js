import { describe, it, expect } from 'vitest';
import {
  normalizeSchedulingConfig,
  normalizeTimeString,
  normalizeDateString,
  buildStartAtISO,
  computeWindowSlots,
  buildCourts,
  assignSchedule,
  DEFAULT_COURT_COUNT,
  DEFAULT_MATCH_DURATION_MINUTES,
  MAX_COURT_COUNT,
} from './scheduling.js';

describe('normalizeSchedulingConfig', () => {
  it('aplica defaults quando vazio', () => {
    const cfg = normalizeSchedulingConfig({});
    expect(cfg.court_count).toBe(DEFAULT_COURT_COUNT);
    expect(cfg.match_duration_minutes).toBe(DEFAULT_MATCH_DURATION_MINUTES);
    expect(cfg.play_date).toBeNull();
    expect(cfg.play_start_time).toBeNull();
    expect(cfg.play_end_time).toBeNull();
  });

  it('limita quadras e duração aos intervalos válidos', () => {
    expect(normalizeSchedulingConfig({ court_count: 0 }).court_count).toBe(1);
    expect(normalizeSchedulingConfig({ court_count: 9999 }).court_count).toBe(MAX_COURT_COUNT);
    expect(normalizeSchedulingConfig({ match_duration_minutes: 1 }).match_duration_minutes).toBe(5);
    expect(normalizeSchedulingConfig({ match_duration_minutes: 99999 }).match_duration_minutes).toBe(600);
  });

  it('aceita horários/datas válidos e rejeita inválidos', () => {
    const ok = normalizeSchedulingConfig({
      court_count: 2,
      match_duration_minutes: 40,
      play_date: '2026-06-20',
      play_start_time: '14:00',
      play_end_time: '18:30',
    });
    expect(ok).toEqual({
      court_count: 2,
      match_duration_minutes: 40,
      play_date: '2026-06-20',
      play_start_time: '14:00',
      play_end_time: '18:30',
    });
    const bad = normalizeSchedulingConfig({
      play_date: '20/06/2026',
      play_start_time: '25:00',
      play_end_time: 'abc',
    });
    expect(bad.play_date).toBeNull();
    expect(bad.play_start_time).toBeNull();
    expect(bad.play_end_time).toBeNull();
  });
});

describe('normalizeTimeString / normalizeDateString', () => {
  it('valida horários', () => {
    expect(normalizeTimeString('09:05')).toBe('09:05');
    expect(normalizeTimeString('23:59')).toBe('23:59');
    expect(normalizeTimeString('24:00')).toBeNull();
    expect(normalizeTimeString('9:5')).toBeNull();
    expect(normalizeTimeString(null)).toBeNull();
  });
  it('valida datas', () => {
    expect(normalizeDateString('2026-01-31')).toBe('2026-01-31');
    expect(normalizeDateString('2026-13-01')).toBeNull();
    expect(normalizeDateString('not-a-date')).toBeNull();
  });
});

describe('buildStartAtISO', () => {
  it('combina data e horário', () => {
    const iso = buildStartAtISO('2026-06-20', '14:00');
    expect(iso).toBe(new Date('2026-06-20T14:00:00').toISOString());
  });
  it('usa fallback de data quando ausente', () => {
    const iso = buildStartAtISO(null, '08:00', '2026-06-20T00:00:00.000Z');
    expect(iso).not.toBeNull();
    expect(new Date(iso).getHours()).toBe(8);
  });
  it('retorna null sem horário', () => {
    expect(buildStartAtISO('2026-06-20', null)).toBeNull();
  });
});

describe('computeWindowSlots', () => {
  it('calcula quantos jogos cabem na janela', () => {
    expect(computeWindowSlots('14:00', '18:00', 30)).toBe(8);
    expect(computeWindowSlots('14:00', '15:00', 45)).toBe(1);
    expect(computeWindowSlots('14:00', '14:20', 30)).toBe(0);
  });
  it('retorna null quando faltam dados ou janela inválida', () => {
    expect(computeWindowSlots(null, '18:00', 30)).toBeNull();
    expect(computeWindowSlots('18:00', '14:00', 30)).toBeNull();
  });
});

describe('buildCourts', () => {
  it('gera N quadras nomeadas', () => {
    const courts = buildCourts(3);
    expect(courts).toHaveLength(3);
    expect(courts[0]).toEqual({ id: 'court-1', name: 'Quadra 1', index: 1 });
    expect(courts[2].name).toBe('Quadra 3');
  });
});

describe('assignSchedule', () => {
  const makeMatches = () => [
    { id: 'm1', round: 1, position: 1, side_a_ids: ['a'], side_b_ids: ['b'] },
    { id: 'm2', round: 1, position: 2, side_a_ids: ['c'], side_b_ids: ['d'] },
    { id: 'm3', round: 1, position: 3, side_a_ids: ['a'], side_b_ids: ['c'] },
  ];

  it('marca quadra, slot e horário sem conflito de jogadores', () => {
    const cfg = {
      court_count: 2,
      match_duration_minutes: 30,
      play_date: '2026-06-20',
      play_start_time: '14:00',
      play_end_time: null,
    };
    const { byMatchId, warnings } = assignSchedule(makeMatches(), cfg);
    expect(warnings).toEqual([]);
    expect(byMatchId.size).toBe(3);

    const m1 = byMatchId.get('m1');
    const m3 = byMatchId.get('m3');
    // m1 e m3 compartilham o jogador "a" → horários diferentes
    expect(m1.scheduled_at).not.toBe(m3.scheduled_at);
    expect(m1.court).toMatch(/Quadra/);
    expect(new Date(m1.scheduled_at).getHours()).toBe(14);
  });

  it('respeita a janela de término emitindo avisos', () => {
    const cfg = {
      court_count: 1,
      match_duration_minutes: 60,
      play_date: '2026-06-20',
      play_start_time: '14:00',
      play_end_time: '15:00', // cabe apenas 1 jogo em 1 quadra
    };
    const { byMatchId, warnings } = assignSchedule(makeMatches(), cfg);
    expect(warnings.length).toBeGreaterThan(0);
    // apenas 1 jogo coube
    const scheduled = [...byMatchId.values()].filter((v) => v.scheduled_at);
    expect(scheduled).toHaveLength(1);
  });

  it('janela menor que a duração de um jogo não agenda nada (todos avisados)', () => {
    const cfg = {
      court_count: 2,
      match_duration_minutes: 60,
      play_date: '2026-06-20',
      play_start_time: '14:00',
      play_end_time: '14:30', // 0 jogos cabem
    };
    const { byMatchId, warnings } = assignSchedule(makeMatches(), cfg);
    expect(warnings.length).toBe(3);
    expect(byMatchId.size).toBe(0);
  });

  it('funciona sem horário definido (apenas quadras/slots)', () => {
    const cfg = { court_count: 2, match_duration_minutes: 30 };
    const { byMatchId } = assignSchedule(makeMatches(), cfg);
    expect(byMatchId.get('m1').court).toMatch(/Quadra/);
    expect(byMatchId.get('m1').scheduled_at).toBeNull();
  });
});
