import { recordEvent } from '@/core/services/observabilityService';
import { logger } from '@/core/lib/logger';

/**
 * Web Vitals (LCP, INP, CLS) → evento `web_vitals` no Analytics. Mede o que a
 * pessoa sente: quanto demora a tela, quanto demora o toque, quanto a tela
 * pula. Uma vez por carregamento; sem Analytics ligado, não faz nada.
 * Carregado sob demanda para não pesar o início.
 */
export function reportWebVitals() {
  if (typeof window === 'undefined') return;
  void import('web-vitals')
    .then(({ onCLS, onINP, onLCP }) => {
      const envia = (m) => recordEvent('web_vitals', {
        metric: m.name,
        value: Math.round(m.name === 'CLS' ? m.value * 1000 : m.value),
        rating: m.rating,
        page_path: window.location.pathname.replace(/[^/]*[0-9A-Za-z]{16,}[^/]*/g, ':id'),
      });
      onCLS(envia);
      onINP(envia);
      onLCP(envia);
    })
    .catch((error) => logger.debug('web vitals skipped:', error));
}
