import { useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  GAMIFICATION_EVENT,
  createTracker,
  buildGamificationEvent,
} from '../domain/gamificationEvents.js';

/**
 * Hook que cria um tracker de gamificação automaticamente.
 *
 * Quando `GAMIFICATION_V2` está ON, eventos de XP/achievements/streak são
 * automaticamente emitidos para o consumidor configurado (ex: Firebase
 * Analytics via `logEvent`, ou um dispatcher custom).
 *
 * **Comportamento**:
 *  - Retorna sempre um `track(name, params)` seguro (noop se flag OFF).
 *  - Não lê Firestore nem muta nada.
 *  - Pode ser plugado em qualquer componente que deseje emitir.
 *
 * @param {{ track?: (name: string, params: object) => void }} [options]
 * @returns {{ track, enabled, GAMIFICATION_EVENT }}
 */
export function useGamificationTracker(options = {}) {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  const { user } = useAuth();
  const trackRef = useRef(options.track);

  // atualiza ref quando options.track muda
  useEffect(() => {
    trackRef.current = options.track;
  }, [options.track]);

  const track = useMemo(() => {
    if (!gamificationOn) return () => {};
    const dispatcher = (name, params) => {
      try {
        if (typeof trackRef.current === 'function') {
          trackRef.current(name, { ...params, uid: user?.uid || null });
        } else if (typeof window !== 'undefined' && window?.gtag) {
          // fallback pra Google Analytics se disponível
          window.gtag('event', name, { ...params, uid: user?.uid || null });
        } else if (typeof window !== 'undefined' && window?.firebase?.analytics) {
          // fallback pra Firebase Analytics
          window.firebase.analytics().logEvent(name, { ...params, uid: user?.uid || null });
        }
        // em produção sem nenhum destino, é noop silencioso
      } catch (e) {
        // nunca deve quebrar a app
        if (typeof console !== 'undefined') {
          console.warn('[gamification] track error', e);
        }
      }
    };
    // createTracker espera { track: fn } — wrap
    return createTracker({ track: dispatcher });
  }, [gamificationOn, user?.uid]);

  return {
    track,
    enabled: gamificationOn,
    GAMIFICATION_EVENT,
    buildEvent: buildGamificationEvent,
  };
}

/**
 * Helper para emitir uma vez só (sem hook). Útil em callbacks one-off.
 *
 * @param {string} eventName
 * @param {object} params
 * @param {(name: string, params: object) => void} [dispatcher]
 */
export function trackOnce(eventName, params = {}, dispatcher) {
  if (!Object.values(GAMIFICATION_EVENT).includes(eventName)) return;
  if (typeof dispatcher === 'function') {
    dispatcher(eventName, params);
    return;
  }
  if (typeof window !== 'undefined' && window?.gtag) {
    window.gtag('event', eventName, params);
  } else if (typeof window !== 'undefined' && window?.firebase?.analytics) {
    window.firebase.analytics().logEvent(eventName, params);
  }
  // noop se nada configurado
}
