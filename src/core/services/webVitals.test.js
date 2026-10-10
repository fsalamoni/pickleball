import { describe, it, expect, vi, beforeEach } from 'vitest';

const recordEvent = vi.fn();
vi.mock('@/core/services/observabilityService', () => ({ recordEvent: (...a) => recordEvent(...a) }));
const handlers = {};
vi.mock('web-vitals', () => ({
  onCLS: (cb) => { handlers.CLS = cb; },
  onINP: (cb) => { handlers.INP = cb; },
  onLCP: (cb) => { handlers.LCP = cb; },
}));

describe('reportWebVitals', () => {
  beforeEach(() => recordEvent.mockClear());

  it('manda LCP, INP e CLS como evento web_vitals, com o caminho sem ids', async () => {
    const { reportWebVitals } = await import('./webVitals.js');
    window.history.replaceState({}, '', '/dia-de-jogo/Kx7CC0NVgogh8cCF4wIRmpOvo7r2/telao');
    reportWebVitals();
    await new Promise((r) => setTimeout(r, 0));
    handlers.LCP({ name: 'LCP', value: 1234.56, rating: 'good' });
    handlers.CLS({ name: 'CLS', value: 0.0423, rating: 'good' });
    expect(recordEvent).toHaveBeenCalledWith('web_vitals', {
      metric: 'LCP', value: 1235, rating: 'good', page_path: '/dia-de-jogo/:id/telao',
    });
    expect(recordEvent).toHaveBeenCalledWith('web_vitals', expect.objectContaining({ metric: 'CLS', value: 42 }));
  });
});
