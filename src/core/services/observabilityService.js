import { analyticsPromise, performancePromise } from '@/core/config/firebase';
import { logger } from '@/core/lib/logger';

const noopTrace = { stop: () => {} };

export function recordPageView(pathname) {
  const pagePath = sanitizePath(pathname);

  void analyticsPromise
    .then(async (analytics) => {
      if (!analytics) return;
      const { logEvent } = await import('firebase/analytics');
      logEvent(analytics, 'page_view', {
        page_path: pagePath,
        page_title: typeof document === 'undefined' ? 'Pickleball' : document.title,
      });
    })
    .catch((error) => logger.debug('page_view telemetry skipped:', error));
}

export function recordClientError(error, context = {}) {
  logger.error(context.source || 'Client error', error, context.info || '');

  void analyticsPromise
    .then(async (analytics) => {
      if (!analytics) return;
      const { logEvent } = await import('firebase/analytics');
      logEvent(analytics, 'exception', {
        description: summarizeError(error, context),
        fatal: context.fatal === true,
      });
    })
    .catch((telemetryError) => logger.debug('exception telemetry skipped:', telemetryError));
}

export function startPerformanceTrace(name) {
  const traceName = sanitizeTraceName(name);
  const tracePromise = performancePromise
    .then(async (performance) => {
      if (!performance) return null;
      const { trace } = await import('firebase/performance');
      const activeTrace = trace(performance, traceName);
      activeTrace.start();
      return activeTrace;
    })
    .catch((error) => {
      logger.debug('performance trace skipped:', error);
      return null;
    });

  return {
    stop: () => {
      void tracePromise.then((activeTrace) => activeTrace?.stop()).catch(() => {});
    },
  };
}

export function startOptionalTrace(name) {
  if (!name) return noopTrace;
  return startPerformanceTrace(name);
}

function sanitizePath(pathname = '/') {
  return pathname
    .replace(/\/boloes\/[^/]+/g, '/boloes/:poolId')
    .replace(/\/[A-Za-z0-9_-]{20,}(?=\/|$)/g, '/:id');
}

function sanitizeTraceName(name) {
  return String(name)
    .replace(/[^A-Za-z0-9_]/g, '_')
    .slice(0, 100) || 'app_trace';
}

function summarizeError(error, context) {
  const source = context.source || 'client_error';
  const name = error?.name || 'Error';
  return `${source}:${name}`.slice(0, 100);
}
