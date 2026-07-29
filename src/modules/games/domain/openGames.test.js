import { describe, it, expect } from 'vitest';
import {
  normalizeOpenGameInput,
  filterAndSortOpenGames,
  partitionOpenGamesByDate,
  OPEN_GAME_FORMAT,
  OPEN_GAME_STATUS,
} from './openGames.js';

describe('normalizeOpenGameInput', () => {
  it('valida campos obrigatórios (quando e cidade)', () => {
    const r = normalizeOpenGameInput({});
    expect(r.valid).toBe(false);
    expect(r.errors.when_text).toBeTruthy();
    expect(r.errors.city).toBeTruthy();
  });

  it('normaliza UF, formato e limita observações', () => {
    const r = normalizeOpenGameInput({
      when_text: '  Sábado de manhã ',
      city: ' São Paulo ',
      state: 'sp',
      format: 'doubles',
      notes: 'x'.repeat(500),
    });
    expect(r.valid).toBe(true);
    expect(r.value.when_text).toBe('Sábado de manhã');
    expect(r.value.city).toBe('São Paulo');
    expect(r.value.state).toBe('SP');
    expect(r.value.format).toBe('doubles');
    expect(r.value.notes).toHaveLength(400);
  });

  it('usa formato "any" quando inválido', () => {
    expect(normalizeOpenGameInput({ when_text: 'hj', city: 'X', format: 'zzz' }).value.format)
      .toBe(OPEN_GAME_FORMAT.ANY);
  });
});

describe('filterAndSortOpenGames', () => {
  const games = [
    { id: '1', status: OPEN_GAME_STATUS.OPEN, city: 'São Paulo', level: 'inter', format: 'doubles', created_at: 100 },
    { id: '2', status: OPEN_GAME_STATUS.OPEN, city: 'Rio', level: 'avancado', format: 'singles', created_at: 300 },
    { id: '3', status: OPEN_GAME_STATUS.CLOSED, city: 'São Paulo', level: 'inter', format: 'any', created_at: 200 },
    { id: '4', status: OPEN_GAME_STATUS.OPEN, city: 'Santos', level: 'inter', format: 'any', created_at: 250 },
  ];

  it('mostra só abertos, ordenados do mais recente', () => {
    const r = filterAndSortOpenGames(games);
    expect(r.map((g) => g.id)).toEqual(['2', '4', '1']);
  });

  it('filtra por cidade (substring, case-insensitive)', () => {
    const r = filterAndSortOpenGames(games, { city: 'são' });
    expect(r.map((g) => g.id)).toEqual(['1']);
  });

  it('filtra por nível e por formato (incluindo "any")', () => {
    expect(filterAndSortOpenGames(games, { level: 'inter' }).map((g) => g.id)).toEqual(['4', '1']);
    // formato doubles casa com posts doubles e com posts "any"
    expect(filterAndSortOpenGames(games, { format: 'doubles' }).map((g) => g.id)).toEqual(['4', '1']);
  });

  it('ignora filtros com valor "all"', () => {
    expect(filterAndSortOpenGames(games, { level: 'all', format: 'all' })).toHaveLength(3);
  });
});

describe('normalizeOpenGameInput — data', () => {
  it('aceita data sem "quando"', () => {
    const r = normalizeOpenGameInput({ city: 'SP', date: ' 2026-08-01 ' });
    expect(r.valid).toBe(true);
    expect(r.value.date).toBe('2026-08-01');
  });
  it('exige data OU quando', () => {
    expect(normalizeOpenGameInput({ city: 'SP' }).valid).toBe(false);
  });
});

describe('partitionOpenGamesByDate', () => {
  const today = '2026-08-10';
  const g = (id, date, created = 0, status = OPEN_GAME_STATUS.OPEN) => ({ id, date, status, created_at: { seconds: created } });

  it('separa passados (data < hoje) dos próximos e inclui sem-data e hoje nos próximos', () => {
    const games = [g('a', '2026-08-05'), g('b', '2026-08-15'), g('c', null, 100), g('d', '2026-08-10')];
    const { upcoming, past } = partitionOpenGamesByDate(games, today);
    expect(past.map((x) => x.id)).toEqual(['a']);
    expect(upcoming.map((x) => x.id).sort()).toEqual(['b', 'c', 'd']);
  });

  it('ordena próximos: datados por data asc, depois sem data', () => {
    const games = [g('semdata', null, 50), g('longe', '2026-09-01'), g('perto', '2026-08-11')];
    expect(partitionOpenGamesByDate(games, today).upcoming.map((x) => x.id)).toEqual(['perto', 'longe', 'semdata']);
  });

  it('ordena passados por data desc (mais recente primeiro)', () => {
    const games = [g('velho', '2026-07-01'), g('recente', '2026-08-09')];
    expect(partitionOpenGamesByDate(games, today).past.map((x) => x.id)).toEqual(['recente', 'velho']);
  });

  it('ignora convites fechados', () => {
    const games = [g('x', '2026-08-15', 0, OPEN_GAME_STATUS.CLOSED)];
    const { upcoming, past } = partitionOpenGamesByDate(games, today);
    expect(upcoming).toHaveLength(0);
    expect(past).toHaveLength(0);
  });
});
