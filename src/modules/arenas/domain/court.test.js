/**
 * Tests do domínio puro de Court.
 * Cobre validação, ordenação, filtros, renumeração e helpers de label.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeCourtInput,
  sortCourts,
  activeCourts,
  renumberSortOrder,
  nextSortOrder,
  COURT,
} from './court.js';

describe('normalizeCourtInput', () => {
  it('aceita input válido com defaults', () => {
    const { valid, errors, value } = normalizeCourtInput({ name: 'Quadra 1' });
    expect(valid).toBe(true);
    expect(errors).toEqual({});
    expect(value).toMatchObject({
      name: 'Quadra 1',
      court_type: 'outdoor', // default
      surface_type: null,
      is_active: true,
      sort_order: 0,
      notes: '',
    });
  });

  it('rejeita input sem nome', () => {
    const { valid, errors } = normalizeCourtInput({});
    expect(valid).toBe(false);
    expect(errors.name).toBe('Informe o nome da quadra.');
  });

  it('trunca nome > 60 chars', () => {
    const long = 'A'.repeat(80);
    const { valid, errors } = normalizeCourtInput({ name: long });
    expect(valid).toBe(false);
    expect(errors.name).toContain('muito longo');
  });

  it('trunca notes > 500 chars sem rejeitar', () => {
    const { valid, value } = normalizeCourtInput({
      name: 'X', notes: 'n'.repeat(800),
    });
    expect(valid).toBe(true);
    expect(value.notes).toHaveLength(500);
  });

  it('rejeita court_type inválido', () => {
    const { valid, errors } = normalizeCourtInput({ name: 'X', court_type: 'invalid' });
    expect(valid).toBe(false);
    expect(errors.court_type).toBe('Tipo de quadra inválido.');
  });

  it('aceita court_type válido (lowercased)', () => {
    expect(normalizeCourtInput({ name: 'X', court_type: 'INDOOR' }).value.court_type).toBe('indoor');
    expect(normalizeCourtInput({ name: 'X', court_type: 'Covered' }).value.court_type).toBe('covered');
  });

  it('rejeita surface_type inválido', () => {
    const { valid, errors } = normalizeCourtInput({ name: 'X', surface_type: 'plasma' });
    expect(valid).toBe(false);
    expect(errors.surface_type).toBe('Superfície inválida.');
  });

  it('clamp sort_order entre 0 e 9999', () => {
    expect(normalizeCourtInput({ name: 'X', sort_order: 5000 }).value.sort_order).toBe(5000);
    expect(normalizeCourtInput({ name: 'X', sort_order: -10 }).value.sort_order).toBe(0);
    expect(normalizeCourtInput({ name: 'X', sort_order: 99999 }).value.sort_order).toBe(9999);
    expect(normalizeCourtInput({ name: 'X', sort_order: 'abc' }).value.sort_order).toBe(0);
    expect(normalizeCourtInput({ name: 'X', sort_order: 4.7 }).value.sort_order).toBe(4);
  });

  it('is_active=false é explícito', () => {
    expect(normalizeCourtInput({ name: 'X', is_active: false }).value.is_active).toBe(false);
    expect(normalizeCourtInput({ name: 'X', is_active: true }).value.is_active).toBe(true);
    expect(normalizeCourtInput({ name: 'X' }).value.is_active).toBe(true); // default
  });
});

describe('sortCourts', () => {
  it('ordena por sort_order, depois nome', () => {
    const courts = [
      { id: 'a', name: 'Quadra 2', sort_order: 1 },
      { id: 'b', name: 'Quadra 1', sort_order: 0 },
      { id: 'c', name: 'Quadra 3', sort_order: 0 }, // desempate por nome
    ];
    expect(sortCourts(courts).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('não muta o array original', () => {
    const courts = [
      { id: 'b', name: 'B', sort_order: 1 },
      { id: 'a', name: 'A', sort_order: 0 },
    ];
    const before = JSON.stringify(courts);
    sortCourts(courts);
    expect(JSON.stringify(courts)).toBe(before);
  });

  it('lida com sort_order inválido (cai pro 0)', () => {
    const courts = [
      { id: 'a', name: 'A', sort_order: 'abc' },
      { id: 'b', name: 'B', sort_order: 1 },
    ];
    expect(sortCourts(courts).map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('activeCourts', () => {
  it('filtra só as ativas', () => {
    const courts = [
      { id: 'a', is_active: true },
      { id: 'b', is_active: false },
      { id: 'c' }, // default ativo
    ];
    expect(activeCourts(courts).map((c) => c.id)).toEqual(['a', 'c']);
  });
});

describe('renumberSortOrder', () => {
  it('renumera sequencialmente preservando ordem', () => {
    const courts = [
      { id: 'b', name: 'B', sort_order: 5 },
      { id: 'a', name: 'A', sort_order: 1 },
      { id: 'c', name: 'C', sort_order: 10 },
    ];
    const result = renumberSortOrder(courts);
    expect(result.map((c) => c.sort_order)).toEqual([0, 1, 2]);
    expect(result.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('nextSortOrder', () => {
  it('retorna 0 para lista vazia', () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder(null)).toBe(0);
  });
  it('retorna max + 1', () => {
    expect(nextSortOrder([{ sort_order: 0 }, { sort_order: 3 }, { sort_order: 5 }])).toBe(6);
  });
  it('ignora sort_order inválido', () => {
    expect(nextSortOrder([{ sort_order: 'abc' }, { sort_order: 2 }])).toBe(3);
  });
});

describe('COURT (constantes exportadas)', () => {
  it('TYPES contém os 3 tipos', () => {
    expect(COURT.TYPES).toEqual({ INDOOR: 'indoor', OUTDOOR: 'outdoor', COVERED: 'covered' });
  });
  it('SURFACES contém as 4 superfícies', () => {
    expect(Object.keys(COURT.SURFACES)).toEqual(
      expect.arrayContaining(['CONCRETE', 'SYNTHETIC', 'WOOD', 'ASPHALT']),
    );
  });
  it('TYPE_LABELS e SURFACE_LABELS são pt-BR', () => {
    expect(COURT.TYPE_LABELS.indoor).toBe('Coberta');
    expect(COURT.SURFACE_LABELS.wood).toBe('Madeira');
  });
});
