import { describe, it, expect } from 'vitest';
import {
  normalizeOpenGameInput,
  filterAndSortOpenGames,
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
