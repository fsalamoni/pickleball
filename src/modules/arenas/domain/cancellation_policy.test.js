import { describe, it, expect } from 'vitest';
import {
  normalizeCancellationPolicy, slotStartMs, evaluateCancellation, lateCancellationMessage,
  DEFAULT_CANCELLATION_HOURS,
} from './cancellation_policy.js';

describe('normalizeCancellationPolicy', () => {
  it('usa default quando ausente/ inválido', () => {
    expect(normalizeCancellationPolicy({}).deadlineHours).toBe(DEFAULT_CANCELLATION_HOURS);
    expect(normalizeCancellationPolicy({ cancellation_deadline_hours: -5 }).deadlineHours).toBe(DEFAULT_CANCELLATION_HOURS);
  });
  it('lê os campos da arena', () => {
    const p = normalizeCancellationPolicy({ cancellation_policy_enabled: true, cancellation_deadline_hours: 24, cancellation_notes: 'ligue antes' });
    expect(p.enabled).toBe(true);
    expect(p.deadlineHours).toBe(24);
    expect(p.notes).toBe('ligue antes');
  });
});

describe('slotStartMs', () => {
  it('interpreta a data/hora no fuso de Brasília (UTC-3)', () => {
    // 18:00 BRT = 21:00 UTC
    const ms = slotStartMs({ date: '2026-08-01', start: '18:00' });
    expect(new Date(ms).toISOString()).toBe('2026-08-01T21:00:00.000Z');
  });
  it('retorna NaN para data inválida', () => {
    expect(Number.isNaN(slotStartMs({ date: 'x' }))).toBe(true);
  });
});

describe('evaluateCancellation', () => {
  const slot = { date: '2026-08-01', start: '18:00' }; // 21:00 UTC
  const policy = { cancellation_policy_enabled: true, cancellation_deadline_hours: 12 };

  it('não se aplica quando a política está desligada', () => {
    const r = evaluateCancellation(slot, { cancellation_policy_enabled: false }, Date.UTC(2026, 7, 1, 0, 0));
    expect(r.applies).toBe(false);
    expect(r.late).toBe(false);
  });

  it('no prazo quando faltam mais horas que o limite', () => {
    // agora = 2026-08-01 06:00 UTC → faltam 15h (>12)
    const r = evaluateCancellation(slot, policy, Date.UTC(2026, 7, 1, 6, 0));
    expect(r.applies).toBe(true);
    expect(r.late).toBe(false);
    expect(Math.round(r.hoursUntilStart)).toBe(15);
  });

  it('tardio quando faltam menos horas que o limite', () => {
    // agora = 2026-08-01 12:00 UTC → faltam 9h (<12)
    const r = evaluateCancellation(slot, policy, Date.UTC(2026, 7, 1, 12, 0));
    expect(r.late).toBe(true);
  });
});

describe('lateCancellationMessage', () => {
  it('inclui o prazo e a observação', () => {
    const msg = lateCancellationMessage({ cancellation_policy_enabled: true, cancellation_deadline_hours: 24, cancellation_notes: 'Avise no WhatsApp.' });
    expect(msg).toContain('24h');
    expect(msg).toContain('Avise no WhatsApp.');
  });
});
