import { useCallback } from 'react';
import { recordEvent } from '@/core/services/observabilityService';
import { sanitizeFunnelParams } from '../domain/funnelEvents.js';

/**
 * Hook de instrumentação de funil. Retorna `track(eventName, params)` que
 * envia o evento ao Analytics. Estável (useCallback) para uso seguro em
 * efeitos e onSuccess de mutações.
 */
export function useFunnel() {
  const track = useCallback((eventName, params = {}) => {
    if (!eventName) return;
    recordEvent(eventName, sanitizeFunnelParams(params));
  }, []);
  return { track, enabled: true };
}
