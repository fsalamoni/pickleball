/**
 * Configurações globais da plataforma (documento único `platform_settings/global`).
 *
 * Hoje guarda apenas o mapa de feature flags, ligado/desligado pelo admin
 * master na página de Métricas. Mantido propositadamente enxuto e isolado para
 * não interferir em nenhum outro dado.
 */

import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/core/config/firebase';
import { createAuditLog } from '@/core/services/auditService';
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG,
  normalizeFeatureFlags,
} from '@/core/featureFlags';

const COL = 'platform_settings';
const DOC_ID = 'global';

function settingsRef() {
  return doc(db, COL, DOC_ID);
}

/**
 * Lê (uma vez) as configurações da plataforma. Nunca lança: na ausência do
 * documento ou em erro de permissão, devolve os padrões (todas as flags off).
 * @returns {Promise<{ feature_flags: Record<string, boolean> }>}
 */
export async function getPlatformSettings() {
  try {
    if (!db) return { feature_flags: { ...DEFAULT_FEATURE_FLAGS } };
    const snap = await getDoc(settingsRef());
    const data = snap.exists() ? snap.data() : null;
    return { feature_flags: normalizeFeatureFlags(data?.feature_flags) };
  } catch {
    return { feature_flags: { ...DEFAULT_FEATURE_FLAGS } };
  }
}

/**
 * Observa as configurações em tempo real. Retorna a função de unsubscribe.
 * Em qualquer erro, entrega os padrões e segue (sem quebrar a aplicação).
 * @param {(settings: { feature_flags: Record<string, boolean> }) => void} cb
 * @returns {() => void}
 */
export function subscribePlatformSettings(cb) {
  if (!db) {
    cb({ feature_flags: { ...DEFAULT_FEATURE_FLAGS } });
    return () => {};
  }
  try {
    return onSnapshot(
      settingsRef(),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        cb({ feature_flags: normalizeFeatureFlags(data?.feature_flags) });
      },
      () => cb({ feature_flags: { ...DEFAULT_FEATURE_FLAGS } }),
    );
  } catch {
    cb({ feature_flags: { ...DEFAULT_FEATURE_FLAGS } });
    return () => {};
  }
}

/**
 * Liga/desliga uma feature flag. Faz merge para não tocar em outras chaves.
 * Apenas admin master deve chamar (as regras do Firestore reforçam isso).
 * @param {string} flagKey
 * @param {boolean} enabled
 * @param {object} actor — usuário autenticado (para auditoria)
 */
export async function setFeatureFlag(flagKey, enabled, actor) {
  if (!Object.values(FEATURE_FLAG).includes(flagKey)) {
    throw new Error(`Feature flag desconhecida: ${flagKey}`);
  }
  await setDoc(
    settingsRef(),
    {
      feature_flags: { [flagKey]: Boolean(enabled) },
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
  await createAuditLog({
    action: 'platform_feature_flag_changed',
    actor,
    details: { flag: flagKey, enabled: Boolean(enabled) },
  });
}
