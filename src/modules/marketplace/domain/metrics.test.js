import { describe, expect, it } from 'vitest';
import { marketMetrics } from './metrics.js';

const now = Date.UTC(2026, 9, 14);
const dia = 86400000;

describe('marketMetrics', () => {
  it('só o concluído conta como vendido', () => {
    const m = marketMetrics([
      { status: 'completed', total_cents: 10000, placed_at_ms: now - 2 * dia },
      { status: 'completed', total_cents: 5000, placed_at_ms: now - 60 * dia },
      { status: 'cancelled', total_cents: 9999 },
      { status: 'expired', total_cents: 1 },
      { status: 'paid', total_cents: 300 },
      { status: 'disputed', total_cents: 700 },
    ], { now });
    expect(m.completedCents).toBe(15000);
    expect(m.recentCompletedCents).toBe(10000);
    expect(m.recentCompletedCount).toBe(1);
    expect(m.activeCount).toBe(1);
    expect(m.disputedCount).toBe(1);
    expect(m.lostCount).toBe(2);
    expect(m.completionRate).toBe(0.5);
    expect(m.avgTicketCents).toBe(7500);
  });

  it('sem pedido decidido, a taxa é desconhecida (não zero)', () => {
    const m = marketMetrics([{ status: 'placed' }], { now });
    expect(m.completionRate).toBeNull();
    expect(m.avgTicketCents).toBeNull();
  });
});
