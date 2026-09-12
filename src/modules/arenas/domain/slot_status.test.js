/**
 * Tests do domínio slot_status.
 * Sem I/O — só funções puras.
 */

import { describe, it, expect } from 'vitest';
import {
  getSlotStatus, generateTimeSlots, isSlotSelectable, isSlotClickable,
  summarizeSlotStatuses, SLOT_STATUS, slotEndTime,
} from './slot_status.js';
import { BOOKING_STATUS } from './constants.js';

const date = '2026-07-22'; // quarta
describe('getSlotStatus', () => {
  it('retorna closed se sem schedule', () => {
    const r = getSlotStatus({ date, time: '10:00' });
    expect(r.status).toBe(SLOT_STATUS.CLOSED);
  });
  it('retorna available dentro do schedule', () => {
    const schedules = [{ weekdays: [3], start_time: '08:00', end_time: '18:00', is_active: true }];
    const r = getSlotStatus({ date, time: '10:00', schedules });
    expect(r.status).toBe(SLOT_STATUS.AVAILABLE);
    expect(r.schedule).toBeTruthy();
  });
  it('retorna closed fora do schedule', () => {
    const schedules = [{ weekdays: [3], start_time: '08:00', end_time: '12:00', is_active: true }];
    const r = getSlotStatus({ date, time: '14:00', schedules });
    expect(r.status).toBe(SLOT_STATUS.CLOSED);
  });
  it('schedule inativo não conta', () => {
    const schedules = [{ weekdays: [3], start_time: '08:00', end_time: '18:00', is_active: false }];
    const r = getSlotStatus({ date, time: '10:00', schedules });
    expect(r.status).toBe(SLOT_STATUS.CLOSED);
  });
  it('schedule em outro dia não conta', () => {
    const schedules = [{ weekdays: [1], start_time: '08:00', end_time: '18:00', is_active: true }]; // segunda
    const r = getSlotStatus({ date, time: '10:00', schedules });
    expect(r.status).toBe(SLOT_STATUS.CLOSED);
  });
  it('booking REQUESTED = pending', () => {
    const bookings = [{
      status: BOOKING_STATUS.REQUESTED, court_id: 'c1',
      slots: [{ date, start: '10:00', end: '11:00' }],
    }];
    const r = getSlotStatus({ date, time: '10:00', courtId: 'c1', bookings });
    expect(r.status).toBe(SLOT_STATUS.PENDING);
    expect(r.booking).toBeTruthy();
  });
  it('booking NEGOTIATING = pending', () => {
    const bookings = [{
      status: BOOKING_STATUS.NEGOTIATING, court_id: 'c1',
      slots: [{ date, start: '10:00', end: '11:00' }],
    }];
    const r = getSlotStatus({ date, time: '10:00', courtId: 'c1', bookings });
    expect(r.status).toBe(SLOT_STATUS.PENDING);
  });
  it('booking CONFIRMED = confirmed', () => {
    const bookings = [{
      status: BOOKING_STATUS.CONFIRMED, court_id: 'c1',
      slots: [{ date, start: '10:00', end: '11:00' }],
    }];
    const r = getSlotStatus({ date, time: '10:00', courtId: 'c1', bookings });
    expect(r.status).toBe(SLOT_STATUS.CONFIRMED);
  });
  it('booking CANCELLED não bloqueia', () => {
    const bookings = [{
      status: BOOKING_STATUS.CANCELLED, court_id: 'c1',
      slots: [{ date, start: '10:00', end: '11:00' }],
    }];
    const schedules = [{ weekdays: [3], start_time: '08:00', end_time: '18:00', is_active: true }];
    const r = getSlotStatus({ date, time: '10:00', courtId: 'c1', bookings, schedules });
    expect(r.status).toBe(SLOT_STATUS.AVAILABLE);
  });
  it('booking em outra quadra não bloqueia', () => {
    const bookings = [{
      status: BOOKING_STATUS.CONFIRMED, court_id: 'c2',
      slots: [{ date, start: '10:00', end: '11:00' }],
    }];
    const schedules = [{ weekdays: [3], start_time: '08:00', end_time: '18:00', is_active: true }];
    const r = getSlotStatus({ date, time: '10:00', courtId: 'c1', bookings, schedules });
    expect(r.status).toBe(SLOT_STATUS.AVAILABLE);
  });
  it('unavailability = unavailable', () => {
    const unav = [{ court_id: 'c1', date, start_time: '10:00', end_time: '12:00', notes: 'Manutenção' }];
    const r = getSlotStatus({ date, time: '10:30', courtId: 'c1', unavailabilities: unav });
    expect(r.status).toBe(SLOT_STATUS.UNAVAILABLE);
    expect(r.unavailability.notes).toBe('Manutenção');
  });
  it('completed tem prioridade sobre schedule', () => {
    const completed = [{
      status: BOOKING_STATUS.COMPLETED, court_id: 'c1',
      slots: [{ date, start: '10:00', end: '11:00' }],
    }];
    const schedules = [{ weekdays: [3], start_time: '08:00', end_time: '18:00', is_active: true }];
    const r = getSlotStatus({ date, time: '10:00', courtId: 'c1', bookings_completed: completed, schedules });
    expect(r.status).toBe(SLOT_STATUS.COMPLETED);
  });
  it('booking com court_id null ("qualquer quadra", legado) bloqueia qualquer quadra', () => {
    const bookings = [{
      status: BOOKING_STATUS.CONFIRMED, court_id: null,
      slots: [{ date, start: '10:00', end: '11:00' }],
    }];
    const schedules = [{ weekdays: [3], start_time: '08:00', end_time: '18:00', is_active: true }];
    // Ocupa uma quadra não especificada → aparece reservado em cada quadra
    // (consistente com a lógica de conflito), não só no agregado.
    const r1 = getSlotStatus({ date, time: '10:00', courtId: 'c1', bookings, schedules });
    expect(r1.status).toBe(SLOT_STATUS.CONFIRMED);
    const r2 = getSlotStatus({ date, time: '10:00', courtId: 'c2', bookings, schedules });
    expect(r2.status).toBe(SLOT_STATUS.CONFIRMED);
  });
});

describe('generateTimeSlots', () => {
  it('gera slots de hora em hora', () => {
    expect(generateTimeSlots('08:00', '11:00', 60)).toEqual(['08:00', '09:00', '10:00']);
  });
  it('passo 30min', () => {
    expect(generateTimeSlots('08:00', '10:00', 30)).toEqual(['08:00', '08:30', '09:00', '09:30']);
  });
  it('end <= start = []', () => {
    expect(generateTimeSlots('10:00', '10:00', 60)).toEqual([]);
    expect(generateTimeSlots('11:00', '10:00', 60)).toEqual([]);
  });
  it('invalido = []', () => {
    expect(generateTimeSlots('abc', '10:00', 60)).toEqual([]);
  });
});

describe('isSlotSelectable', () => {
  it('só available é selecionável (público)', () => {
    expect(isSlotSelectable(SLOT_STATUS.AVAILABLE)).toBe(true);
    expect(isSlotSelectable(SLOT_STATUS.CLOSED)).toBe(false);
    expect(isSlotSelectable(SLOT_STATUS.PENDING)).toBe(false);
    expect(isSlotSelectable(SLOT_STATUS.CONFIRMED)).toBe(false);
    expect(isSlotSelectable(SLOT_STATUS.UNAVAILABLE)).toBe(false);
    expect(isSlotSelectable(SLOT_STATUS.COMPLETED)).toBe(false);
  });
});

describe('isSlotClickable', () => {
  it('admin pode clicar em qualquer coisa exceto closed', () => {
    expect(isSlotClickable(SLOT_STATUS.CLOSED)).toBe(false);
    expect(isSlotClickable(SLOT_STATUS.AVAILABLE)).toBe(true);
    expect(isSlotClickable(SLOT_STATUS.PENDING)).toBe(true);
    expect(isSlotClickable(SLOT_STATUS.CONFIRMED)).toBe(true);
    expect(isSlotClickable(SLOT_STATUS.UNAVAILABLE)).toBe(true);
    expect(isSlotClickable(SLOT_STATUS.COMPLETED)).toBe(true);
  });
});

describe('summarizeSlotStatuses', () => {
  it('conta slots por status', () => {
    const summary = summarizeSlotStatuses([
      { status: 'available' }, { status: 'available' },
      { status: 'confirmed' },
      { status: 'pending' }, { status: 'pending' }, { status: 'pending' },
      { status: 'closed' },
    ]);
    expect(summary.available).toBe(2);
    expect(summary.confirmed).toBe(1);
    expect(summary.pending).toBe(3);
    expect(summary.closed).toBe(1);
  });
  it('vazio = zeros', () => {
    const s = summarizeSlotStatuses([]);
    expect(s.available).toBe(0);
    expect(s.closed).toBe(0);
  });
});

/* ============================================================ slotEndTime === */

describe('slotEndTime — o fim de um slot', () => {
  // Horário PARTIDO: manhã e noite. É onde o bug morava.
  const partido = [
    { is_active: true, weekdays: [0, 1, 2, 3, 4, 5, 6], start_time: '08:00', end_time: '10:00' },
    { is_active: true, weekdays: [0, 1, 2, 3, 4, 5, 6], start_time: '18:00', end_time: '22:00' },
  ];
  const data = '2026-10-02';

  it('uma hora, no caso normal', () => {
    expect(slotEndTime('19:00', { date: data, schedules: partido })).toBe('20:00');
  });

  it('⭐ NÃO pula para a próxima janela (era reserva de nove horas)', () => {
    // A grade do dia é 08,09,18,19,20,21. O slot das 09:00 termina às 10:00 —
    // não às 18:00, que é onde a próxima janela começa.
    expect(slotEndTime('09:00', { date: data, schedules: partido })).toBe('10:00');
  });

  it('⭐ NÃO passa do fechamento quando a janela acaba na meia hora', () => {
    const meia = [{ is_active: true, weekdays: [5], start_time: '18:00', end_time: '21:30' }];
    expect(slotEndTime('21:00', { date: '2026-10-02', schedules: meia })).toBe('21:30');
    expect(slotEndTime('20:00', { date: '2026-10-02', schedules: meia })).toBe('21:00');
  });

  it('janelas sobrepostas: vale a que vai mais longe', () => {
    const sobrepostas = [
      { is_active: true, weekdays: [5], start_time: '18:00', end_time: '19:00' },
      { is_active: true, weekdays: [5], start_time: '18:00', end_time: '22:00' },
    ];
    expect(slotEndTime('18:00', { date: '2026-10-02', schedules: sobrepostas })).toBe('19:00');
  });

  it('ignora janela de outro dia da semana', () => {
    const soSegunda = [{ is_active: true, weekdays: [1], start_time: '08:00', end_time: '09:30' }];
    // 2026-10-02 é sexta: a janela não vale, então sobra o passo puro.
    expect(slotEndTime('08:00', { date: '2026-10-02', schedules: soSegunda })).toBe('09:00');
  });

  it('ignora janela desativada', () => {
    const off = [{ is_active: false, weekdays: [5], start_time: '18:00', end_time: '18:30' }];
    expect(slotEndTime('18:00', { date: '2026-10-02', schedules: off })).toBe('19:00');
  });

  it('sem janela nenhuma, é o passo puro', () => {
    expect(slotEndTime('19:00')).toBe('20:00');
    expect(slotEndTime('19:00', { schedules: [] })).toBe('20:00');
  });

  it('respeita um passo diferente', () => {
    expect(slotEndTime('19:00', { stepMinutes: 30 })).toBe('19:30');
    expect(slotEndTime('19:00', { stepMinutes: 90 })).toBe('20:30');
  });

  it('⭐ não vira o dia', () => {
    expect(slotEndTime('23:00')).toBe('23:59');
    expect(slotEndTime('23:30')).toBe('23:59');
  });

  it('horário inválido devolve null em vez de inventar', () => {
    [null, undefined, '', 'abc', '99:99'].forEach((t) => expect(slotEndTime(t)).toBeNull());
  });

  it('nunca devolve fim antes ou igual ao início', () => {
    expect(slotEndTime('23:59')).toBeNull();
    const janelaJaFechada = [{ is_active: true, weekdays: [5], start_time: '18:00', end_time: '18:00' }];
    expect(slotEndTime('18:00', { date: '2026-10-02', schedules: janelaJaFechada })).toBe('19:00');
  });
});
