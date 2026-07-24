import { describe, it, expect } from 'vitest';
import {
  activeCourts, isCourtFreeForSlot, pickAvailableCourt,
  courtAvailabilityForSlot, countAvailableCourts,
} from './court_assignment.js';

const courts = [
  { id: 'c2', name: 'Quadra 2', is_active: true, sort_order: 2 },
  { id: 'c1', name: 'Quadra 1', is_active: true, sort_order: 1 },
  { id: 'c3', name: 'Quadra 3', is_active: false, sort_order: 3 },
];

const slot = { date: '2026-08-01', start: '18:00', end: '19:00' };

describe('activeCourts', () => {
  it('filtra inativas e ordena por sort_order', () => {
    expect(activeCourts(courts).map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

describe('isCourtFreeForSlot', () => {
  it('livre quando não há conflito', () => {
    expect(isCourtFreeForSlot('c1', slot, [])).toBe(true);
  });
  it('ocupada quando há reserva ativa sobreposta na mesma quadra', () => {
    const existing = [{ id: 'b1', status: 'confirmed', court_id: 'c1', slots: [{ date: '2026-08-01', start: '18:00', end: '19:00' }] }];
    expect(isCourtFreeForSlot('c1', slot, existing)).toBe(false);
    expect(isCourtFreeForSlot('c2', slot, existing)).toBe(true); // outra quadra livre
  });
});

describe('pickAvailableCourt', () => {
  it('escolhe a primeira quadra livre (por ordem)', () => {
    expect(pickAvailableCourt(courts, slot, [])).toBe('c1');
  });
  it('pula a quadra ocupada', () => {
    const existing = [{ id: 'b1', status: 'requested', court_id: 'c1', slots: [{ date: '2026-08-01', start: '18:30', end: '19:30' }] }];
    expect(pickAvailableCourt(courts, slot, existing)).toBe('c2');
  });
  it('retorna null quando todas ocupadas', () => {
    const existing = [
      { id: 'b1', status: 'confirmed', court_id: 'c1', slots: [{ date: '2026-08-01', start: '18:00', end: '19:00' }] },
      { id: 'b2', status: 'confirmed', court_id: 'c2', slots: [{ date: '2026-08-01', start: '18:00', end: '19:00' }] },
    ];
    expect(pickAvailableCourt(courts, slot, existing)).toBeNull();
  });
});

describe('courtAvailabilityForSlot', () => {
  it('marca cada quadra como disponível/ocupada', () => {
    const existing = [{ id: 'b1', status: 'confirmed', court_id: 'c1', slots: [{ date: '2026-08-01', start: '18:00', end: '19:00' }] }];
    const av = courtAvailabilityForSlot(courts, slot, existing);
    expect(av).toHaveLength(2);
    expect(av.find((c) => c.court_id === 'c1').available).toBe(false);
    expect(av.find((c) => c.court_id === 'c1').booking_id).toBe('b1');
    expect(av.find((c) => c.court_id === 'c2').available).toBe(true);
  });
  it('countAvailableCourts', () => {
    const existing = [{ id: 'b1', status: 'confirmed', court_id: 'c1', slots: [{ date: '2026-08-01', start: '18:00', end: '19:00' }] }];
    expect(countAvailableCourts(courts, slot, existing)).toBe(1);
    expect(countAvailableCourts(courts, slot, [])).toBe(2);
  });
});
