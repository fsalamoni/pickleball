import { describe, it, expect } from 'vitest';
import {
  LESSON_STATUS,
  LESSON_KIND,
  LESSON_FORMAT,
  PAYMENT_STATUS,
  normalizeLesson,
  capacityFor,
  lessonSlots,
  lessonFirstSlot,
  isPastLesson,
  lessonStatusLabel,
  lessonStatusTone,
  lessonFormatLabel,
  availableActions,
  sortLessons,
  partitionLessons,
} from './lesson.js';

describe('capacityFor', () => {
  it('usa padrão do formato quando max não informado', () => {
    expect(capacityFor(LESSON_FORMAT.PRIVATE)).toBe(1);
    expect(capacityFor(LESSON_FORMAT.DUO)).toBe(2);
    expect(capacityFor(LESSON_FORMAT.GROUP)).toBe(8);
    expect(capacityFor(LESSON_FORMAT.CLINIC)).toBe(20);
  });
  it('respeita max_students explícito', () => {
    expect(capacityFor(LESSON_FORMAT.GROUP, 5)).toBe(5);
  });
  it('cai no padrão para formato desconhecido', () => {
    expect(capacityFor('xyz')).toBe(1);
  });
});

describe('normalizeLesson', () => {
  const base = {
    coach_id: 'c1',
    format: 'private',
    slots: [{ date: '2026-08-01', start: '08:00', end: '09:00' }],
  };

  it('normaliza aula avulsa válida', () => {
    const r = normalizeLesson(base);
    expect(r.valid).toBe(true);
    expect(r.value.kind).toBe(LESSON_KIND.SINGLE);
    expect(r.value.status).toBe(LESSON_STATUS.REQUESTED);
    expect(r.value.payment_status).toBe(PAYMENT_STATUS.NONE);
    expect(r.value.max_students).toBe(1);
    expect(r.value.requested_by).toBe('student');
  });

  it('exige coach_id', () => {
    expect(normalizeLesson({ ...base, coach_id: '' }).valid).toBe(false);
  });

  it('exige ao menos um slot válido', () => {
    expect(normalizeLesson({ coach_id: 'c1', slots: [] }).valid).toBe(false);
    expect(normalizeLesson({ coach_id: 'c1', slots: [{ date: 'x', start: '08:00', end: '09:00' }] }).valid).toBe(false);
  });

  it('aceita forma date/start/end achatada', () => {
    const r = normalizeLesson({ coach_id: 'c1', date: '2026-08-01', start: '10:00', end: '11:00' });
    expect(r.valid).toBe(true);
    expect(r.value.slots).toHaveLength(1);
  });

  it('ordena e filtra slots inválidos', () => {
    const r = normalizeLesson({
      coach_id: 'c1',
      slots: [
        { date: '2026-08-03', start: '08:00', end: '09:00' },
        { date: '2026-08-01', start: '08:00', end: '09:00' },
        { date: '2026-08-02', start: '08:00', end: '07:00' }, // inválido
      ],
    });
    expect(r.value.slots.map((s) => s.date)).toEqual(['2026-08-01', '2026-08-03']);
  });

  it('mantém recurrence só em aula recorrente', () => {
    const rec = normalizeLesson({ ...base, kind: 'recurring', recurrence: { weekday: 1, weeks: 4 } });
    expect(rec.value.kind).toBe(LESSON_KIND.RECURRING);
    expect(rec.value.recurrence).toEqual({ weekday: 1, weeks: 4 });
    const single = normalizeLesson({ ...base, kind: 'single', recurrence: { weekday: 1 } });
    expect(single.value.recurrence).toBeNull();
  });

  it('deriva capacidade do formato group', () => {
    expect(normalizeLesson({ ...base, format: 'group' }).value.max_students).toBe(8);
  });

  it('normaliza requested_by=coach', () => {
    expect(normalizeLesson({ ...base, requested_by: 'coach' }).value.requested_by).toBe('coach');
  });
});

describe('slots helpers', () => {
  const lesson = { slots: [{ date: '2026-08-05', start: '10:00', end: '11:00' }, { date: '2026-08-01', start: '08:00', end: '09:00' }] };
  it('lessonSlots retorna os slots', () => {
    expect(lessonSlots(lesson)).toHaveLength(2);
  });
  it('lessonFirstSlot retorna o mais cedo', () => {
    expect(lessonFirstSlot(lesson).date).toBe('2026-08-01');
  });
  it('isPastLesson detecta aula totalmente no passado', () => {
    const now = new Date(2026, 7, 10); // 2026-08-10
    expect(isPastLesson(lesson, now)).toBe(true);
    expect(isPastLesson({ slots: [{ date: '2026-08-20', start: '08:00', end: '09:00' }] }, now)).toBe(false);
  });
});

describe('labels e tons', () => {
  it('status label/tone', () => {
    expect(lessonStatusLabel(LESSON_STATUS.CONFIRMED)).toBe('Confirmada');
    expect(lessonStatusTone(LESSON_STATUS.CONFIRMED)).toBe('green');
    expect(lessonStatusTone(LESSON_STATUS.REQUESTED)).toBe('amber');
    expect(lessonStatusTone('bogus')).toBe('neutral');
  });
  it('format label', () => {
    expect(lessonFormatLabel('duo')).toBe('Dupla');
  });
});

describe('availableActions', () => {
  it('professor confirma/recusa/cancela solicitação', () => {
    const acts = availableActions({ status: LESSON_STATUS.REQUESTED }, 'coach').map((a) => a.to);
    expect(acts).toContain(LESSON_STATUS.CONFIRMED);
    expect(acts).toContain(LESSON_STATUS.DECLINED);
    expect(acts).toContain(LESSON_STATUS.CANCELLED);
  });
  it('professor conclui/cancela aula confirmada', () => {
    const acts = availableActions({ status: LESSON_STATUS.CONFIRMED }, 'coach').map((a) => a.to);
    expect(acts).toEqual([LESSON_STATUS.COMPLETED, LESSON_STATUS.CANCELLED]);
  });
  it('aluno só cancela', () => {
    const acts = availableActions({ status: LESSON_STATUS.REQUESTED }, 'student').map((a) => a.to);
    expect(acts).toEqual([LESSON_STATUS.CANCELLED]);
  });
  it('aula concluída não tem ações', () => {
    expect(availableActions({ status: LESSON_STATUS.COMPLETED }, 'coach')).toEqual([]);
  });
});

describe('sortLessons / partitionLessons', () => {
  const now = new Date(2026, 7, 10); // 2026-08-10
  const lessons = [
    { id: 'a', status: LESSON_STATUS.CONFIRMED, slots: [{ date: '2026-08-20', start: '08:00', end: '09:00' }] },
    { id: 'b', status: LESSON_STATUS.COMPLETED, slots: [{ date: '2026-08-01', start: '08:00', end: '09:00' }] },
    { id: 'c', status: LESSON_STATUS.CONFIRMED, slots: [{ date: '2026-08-05', start: '08:00', end: '09:00' }] }, // passada
    { id: 'd', status: LESSON_STATUS.REQUESTED, slots: [{ date: '2026-08-15', start: '08:00', end: '09:00' }] },
  ];

  it('ordena por primeiro slot', () => {
    expect(sortLessons(lessons).map((l) => l.id)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('separa próximas de histórico', () => {
    const { upcoming, history } = partitionLessons(lessons, now);
    expect(upcoming.map((l) => l.id)).toEqual(['d', 'a']);
    // b (completed) e c (passada) vão para histórico
    expect(history.map((l) => l.id).sort()).toEqual(['b', 'c']);
  });
});
