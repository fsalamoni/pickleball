/**
 * useGamificationPrefs — as preferências da pessoa, em tempo real, e o jeito de
 * mudá-las.
 *
 * `update(patch)` grava por seção (privacy, social, notifications, display) e o
 * doc em memória muda NA HORA (otimista): o interruptor responde ao toque, e se
 * a gravação falhar volta ao que estava e avisa — nunca fica ligado na tela e
 * desligado no banco.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  watchGamificationPrefs, savePrefsPatch,
} from '@/modules/progression/services/gamificationPrefsService';
import {
  normalizeGamificationPrefs, mergeGamificationPrefs,
} from '@/modules/progression/domain/gamificationPrefs';
import { logger } from '@/core/lib/logger';

/**
 * @param {string} uid
 * @param {boolean} [enabled]
 */
export function useGamificationPrefs(uid, enabled = true) {
  const [prefs, setPrefs] = useState(() => normalizeGamificationPrefs(null, uid));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const atual = useRef(prefs);
  atual.current = prefs;

  useEffect(() => {
    if (!uid || !enabled) return undefined;
    return watchGamificationPrefs(
      uid,
      (p) => { setPrefs(p); setLoaded(true); setError(null); },
      (err) => { setError(err); setLoaded(true); logger.warn('[useGamificationPrefs] leitura falhou', err); },
    );
  }, [uid, enabled]);

  const update = useCallback(async (patch) => {
    if (!uid) return null;
    const antes = atual.current;
    setPrefs(mergeGamificationPrefs(antes, patch, uid)); // otimista
    setSaving(true);
    try {
      const gravado = await savePrefsPatch(uid, patch, antes);
      setPrefs(gravado);
      setError(null);
      return gravado;
    } catch (err) {
      setPrefs(antes); // volta ao que estava
      setError(err);
      logger.warn('[useGamificationPrefs] gravação falhou', err);
      return null;
    } finally {
      setSaving(false);
    }
  }, [uid]);

  return { prefs, loaded, error, saving, update };
}
