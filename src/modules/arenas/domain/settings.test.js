import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ARENA_SETTINGS,
  normalizeArenaSettings,
  isVisibleToPublic,
  canBookSlot,
  calculateCancellationRefund,
  getActiveNotificationChannels,
  mergeSettings,
} from './settings.js';

describe('normalizeArenaSettings', () => {
  it('retorna defaults quando input vazio', () => {
    const { valid, value } = normalizeArenaSettings({});
    expect(valid).toBe(true);
    expect(value.operational.timezone).toBe('America/Sao_Paulo');
    expect(value.branding.primary_color).toBe('#10b981');
  });

  it('aceita null/undefined', () => {
    const r1 = normalizeArenaSettings(null);
    const r2 = normalizeArenaSettings(undefined);
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
  });

  it('sobrescreve campos parciais', () => {
    const { valid, value } = normalizeArenaSettings({
      operational: { booking_window_days: 30 },
    });
    expect(valid).toBe(true);
    expect(value.operational.booking_window_days).toBe(30);
    // outros campos preservam o default
    expect(value.operational.timezone).toBe('America/Sao_Paulo');
  });

  it('rejeita booking_window_days > 365', () => {
    const { valid, errors } = normalizeArenaSettings({
      operational: { booking_window_days: 400 },
    });
    expect(valid).toBe(false);
    expect(errors['operational.booking_window_days']).toBeTruthy();
  });

  it('rejeita booking_window_days < 0', () => {
    const { valid } = normalizeArenaSettings({
      operational: { booking_window_days: -1 },
    });
    expect(valid).toBe(false);
  });

  it('rejeita cor inválida', () => {
    const { valid, errors } = normalizeArenaSettings({
      branding: { primary_color: 'not-a-color' },
    });
    expect(valid).toBe(false);
    expect(errors['branding.primary_color']).toBeTruthy();
  });

  it('rejeita refund_pct > 100', () => {
    const { valid } = normalizeArenaSettings({
      operational: { cancellation_refund_pct: 150 },
    });
    expect(valid).toBe(false);
  });

  it('filtra métodos de pagamento inválidos', () => {
    const { valid, value } = normalizeArenaSettings({
      payments: { accepted_methods: ['pix', 'bitcoin', 'cash'] },
    });
    expect(valid).toBe(true);
    expect(value.payments.accepted_methods).toEqual(['pix', 'cash']);
  });
});

describe('isVisibleToPublic', () => {
  it('retorna true por padrão se settings vazio', () => {
    expect(isVisibleToPublic(null, 'pricing')).toBe(true);
  });
  it('retorna false se explicitamente false', () => {
    expect(isVisibleToPublic({ visibility: { show_pricing: false } }, 'pricing')).toBe(false);
  });
  it('retorna true se explicitamente true', () => {
    expect(isVisibleToPublic({ visibility: { show_pricing: true } }, 'pricing')).toBe(true);
  });
  it('retorna true se não definido', () => {
    expect(isVisibleToPublic({ visibility: {} }, 'pricing')).toBe(true);
  });
});

describe('canBookSlot', () => {
  const now = new Date('2026-07-15T10:00:00Z');
  const settings = {
    operational: {
      min_booking_lead_minutes: 60,
      booking_window_days: 15,
    },
  };

  it('permite slot dentro da janela', () => {
    const slotStart = new Date('2026-07-16T10:00:00Z');
    const r = canBookSlot({ settings, slotStart, now });
    expect(r.ok).toBe(true);
  });

  it('rejeita slot com antecedência menor que a mínima', () => {
    const slotStart = new Date('2026-07-15T10:30:00Z');
    const r = canBookSlot({ settings, slotStart, now });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('Antecedência');
  });

  it('rejeita slot além da janela máxima', () => {
    const slotStart = new Date('2026-08-15T10:00:00Z');
    const r = canBookSlot({ settings, slotStart, now });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('Janela');
  });

  it('rejeita slot no passado', () => {
    const slotStart = new Date('2026-07-15T09:00:00Z');
    const r = canBookSlot({ settings, slotStart, now });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('passado');
  });

  it('aceita número como slotStart', () => {
    const slotStart = new Date('2026-07-16T10:00:00Z').getTime();
    const r = canBookSlot({ settings, slotStart, now });
    expect(r.ok).toBe(true);
  });
});

describe('calculateCancellationRefund', () => {
  const settings = {
    operational: {
      cancellation_window_hours: 24,
      cancellation_refund_pct: 100,
    },
  };

  it('reembolsa 100% se cancelado dentro da janela (25h antes)', () => {
    // slotStart: 2026-07-16 10:00, cancelAt: 2026-07-15 09:00 → 25h de antecedência
    const slotStart = new Date('2026-07-16T10:00:00Z');
    const cancelAt = new Date('2026-07-15T09:00:00Z');
    const r = calculateCancellationRefund({ settings, slotStart, cancelAt, paidAmount: 100, now: cancelAt });
    expect(r.refundPct).toBe(100);
    expect(r.refundAmount).toBe(100);
    expect(r.feeAmount).toBe(0);
  });

  it('não reembolsa se cancelado fora da janela (23h antes)', () => {
    // slotStart: 2026-07-16 10:00, cancelAt: 2026-07-15 11:00 → 23h < 24h janela
    const slotStart = new Date('2026-07-16T10:00:00Z');
    const cancelAt = new Date('2026-07-15T11:00:00Z');
    const r = calculateCancellationRefund({ settings, slotStart, cancelAt, paidAmount: 100, now: cancelAt });
    expect(r.refundPct).toBe(0);
    expect(r.refundAmount).toBe(0);
    expect(r.feeAmount).toBe(100);
  });

  it('reembolsa parcialmente se refund_pct < 100 (50%, 25h antes)', () => {
    const s2 = { operational: { cancellation_window_hours: 24, cancellation_refund_pct: 50 } };
    const slotStart = new Date('2026-07-16T10:00:00Z');
    const cancelAt = new Date('2026-07-15T09:00:00Z');
    const r = calculateCancellationRefund({ settings: s2, slotStart, cancelAt, paidAmount: 100, now: cancelAt });
    expect(r.refundPct).toBe(50);
    expect(r.refundAmount).toBe(50);
    expect(r.feeAmount).toBe(50);
  });
});

describe('getActiveNotificationChannels', () => {
  it('retorna canais configurados', () => {
    expect(getActiveNotificationChannels({ notifications: { send_booking_reminder_channels: ['push', 'email'] } })).toEqual(['push', 'email']);
  });
  it('retorna [] se settings vazio', () => {
    expect(getActiveNotificationChannels(null)).toEqual([]);
    expect(getActiveNotificationChannels({})).toEqual([]);
  });
});

describe('mergeSettings', () => {
  it('merge parcial', () => {
    const old = { operational: { timezone: 'X', booking_window_days: 15 } };
    const next = mergeSettings(old, { operational: { booking_window_days: 30 } });
    expect(next.operational.timezone).toBe('X');
    expect(next.operational.booking_window_days).toBe(30);
  });
});
