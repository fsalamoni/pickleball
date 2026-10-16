import { describe, it, expect } from 'vitest';
import {
  normalizeWaitlistInput, sortWaitlist, waitlistDocId, waitlistPreferenceText, WAITLIST_NOTE_MAX,
} from './waitlist.js';

describe('lista de espera do professor', () => {
  it('id único por professor e aluno', () => {
    expect(waitlistDocId('P', 'ana')).toBe('P_ana');
  });

  it('normaliza preferências: só períodos e dias conhecidos, recado cortado', () => {
    const { valid, value } = normalizeWaitlistInput({
      coach_id: 'P', user_id: 'ana', format: 'duo', periods: ['noite', 'madrugada', 'manha'],
      weekdays: [3, 1, 9, 1], note: 'x'.repeat(600),
    });
    expect(valid).toBe(true);
    expect(value.format).toBe('duo');
    expect(value.periods).toEqual(['manha', 'noite']);
    expect(value.weekdays).toEqual([1, 3]);
    expect(value.note).toHaveLength(WAITLIST_NOTE_MAX);
  });

  it('recusa sem professor/aluno e na própria lista; formato desconhecido vira nulo', () => {
    expect(normalizeWaitlistInput({ coach_id: 'P' }).valid).toBe(false);
    expect(normalizeWaitlistInput({ coach_id: 'P', user_id: 'P' }).valid).toBe(false);
    expect(normalizeWaitlistInput({ coach_id: 'P', user_id: 'a', format: 'x' }).value.format).toBeNull();
  });

  it('quem espera há mais tempo vem primeiro', () => {
    const lista = sortWaitlist([
      { id: 'b', created_at_ms: 20 },
      { id: 'a', created_at: { toMillis: () => 10 } },
    ]);
    expect(lista.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('preferência em uma linha', () => {
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    expect(waitlistPreferenceText({ periods: ['noite', 'manha'], weekdays: [1, 3] }, dias)).toBe('Manhã, Noite · Seg, Qua');
    expect(waitlistPreferenceText({}, dias)).toBe('');
  });
});
