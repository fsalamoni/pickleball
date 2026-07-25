import { describe, it, expect } from 'vitest';
import {
  activeCourts, isCourtFreeForSlot, pickAvailableCourt, pickAvailableCourtForSlots,
  courtAvailabilityForSlot, countAvailableCourts,
  resolveTargetCourts, unavailableCourtsForSlots, availableCourtsForSlots,
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

describe('pickAvailableCourtForSlots (recorrente/multi-slot)', () => {
  const slotA = { date: '2026-08-01', start: '18:00', end: '19:00' };
  const slotB = { date: '2026-08-08', start: '18:00', end: '19:00' };

  it('escolhe uma quadra livre em TODOS os slots', () => {
    expect(pickAvailableCourtForSlots(courts, [slotA, slotB], [])).toBe('c1');
  });

  it('pula quadra ocupada em qualquer um dos slots', () => {
    // c1 ocupada só na 2ª data → deve escolher c2 (livre nas duas)
    const existing = [{ id: 'b1', status: 'confirmed', court_id: 'c1', slots: [{ date: '2026-08-08', start: '18:00', end: '19:00' }] }];
    expect(pickAvailableCourtForSlots(courts, [slotA, slotB], existing)).toBe('c2');
  });

  it('retorna null quando nenhuma quadra cobre todos os slots', () => {
    const existing = [
      { id: 'b1', status: 'confirmed', court_id: 'c1', slots: [{ date: '2026-08-08', start: '18:00', end: '19:00' }] },
      { id: 'b2', status: 'confirmed', court_id: 'c2', slots: [{ date: '2026-08-01', start: '18:00', end: '19:00' }] },
    ];
    expect(pickAvailableCourtForSlots(courts, [slotA, slotB], existing)).toBeNull();
  });

  it('retorna null para lista vazia', () => {
    expect(pickAvailableCourtForSlots(courts, [], [])).toBeNull();
  });
});

describe('resolveTargetCourts', () => {
  it("mode 'all' → todas as quadras ativas (ordenadas), ignora inativas", () => {
    expect(resolveTargetCourts(courts, { mode: 'all' })).toEqual(['c1', 'c2']);
  });
  it("mode 'specific' → só as escolhidas que estão ativas", () => {
    expect(resolveTargetCourts(courts, { mode: 'specific', courtIds: ['c2'] })).toEqual(['c2']);
    // c3 é inativa → descartada mesmo se escolhida
    expect(resolveTargetCourts(courts, { mode: 'specific', courtIds: ['c1', 'c3'] })).toEqual(['c1']);
  });
  it("mode 'specific' com id inexistente → vazio", () => {
    expect(resolveTargetCourts(courts, { mode: 'specific', courtIds: ['zzz'] })).toEqual([]);
  });
  it("mode 'any' (ou desconhecido) → vazio (chamador atribui automaticamente)", () => {
    expect(resolveTargetCourts(courts, { mode: 'any' })).toEqual([]);
    expect(resolveTargetCourts(courts, {})).toEqual([]);
  });
});

describe('unavailableCourtsForSlots', () => {
  const slotA = { date: '2026-08-01', start: '18:00', end: '19:00' };
  const slotB = { date: '2026-08-08', start: '18:00', end: '19:00' };

  it('todas livres → nenhuma indisponível', () => {
    expect(unavailableCourtsForSlots(['c1', 'c2'], [slotA, slotB], [])).toEqual([]);
  });
  it('aponta a quadra ocupada em qualquer slot', () => {
    const existing = [{ id: 'b1', status: 'confirmed', court_id: 'c1', slots: [{ date: '2026-08-08', start: '18:00', end: '19:00' }] }];
    expect(unavailableCourtsForSlots(['c1', 'c2'], [slotA, slotB], existing)).toEqual(['c1']);
  });
  it('reservar TODAS falha se ao menos uma está ocupada', () => {
    const existing = [{ id: 'b1', status: 'confirmed', court_id: 'c2', slots: [slotA] }];
    expect(unavailableCourtsForSlots(['c1', 'c2'], [slotA], existing)).toEqual(['c2']);
  });
  it('lista de slots vazia → nenhuma indisponível', () => {
    expect(unavailableCourtsForSlots(['c1', 'c2'], [], [])).toEqual([]);
  });
});

describe('availableCourtsForSlots (todas as disponíveis)', () => {
  const slotA = { date: '2026-08-01', start: '18:00', end: '19:00' };
  const slotB = { date: '2026-08-08', start: '18:00', end: '19:00' };

  it('todas livres → todas as ativas', () => {
    expect(availableCourtsForSlots(courts, [slotA, slotB], [])).toEqual(['c1', 'c2']);
  });
  it('exclui a quadra ocupada em algum slot', () => {
    const existing = [{ id: 'b1', status: 'confirmed', court_id: 'c1', slots: [slotA] }];
    expect(availableCourtsForSlots(courts, [slotA], existing)).toEqual(['c2']);
  });
  it('reserva legada sem court_id ocupa todas → nenhuma disponível', () => {
    const existing = [{ id: 'b1', status: 'confirmed', court_id: null, slots: [slotA] }];
    expect(availableCourtsForSlots(courts, [slotA], existing)).toEqual([]);
  });
  it('lista de slots vazia → vazio', () => {
    expect(availableCourtsForSlots(courts, [], [])).toEqual([]);
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
