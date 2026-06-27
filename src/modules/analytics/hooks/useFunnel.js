import { useCallback } from 'react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { recordEvent } from '@/core/services/observabilityService';
import { sanitizeFunnelParams } from '../domain/funnelEvents.js';

/**
 * Hook de instrumentação de funil. Retorna `track(eventName, params)` que só
 * envia o evento ao Analytics quando a flag `funnel_analytics` está ligada.
 * Estável (useCallback) para uso seguro em efeitos e onSuccess de mutações.
 */
export function useFunnel() {
  const enabled = useFeatureFlag(FEATURE_FLAG.FUNNEL_ANALYTICS);
  const track = useCallback(
    (eventName, params = {}) => {
      if (!enabled || !eventName) return;
      recordEvent(eventName, sanitizeFunnelParams(params));
    },
    [enabled],
  );
  return { track, enabled };
}
