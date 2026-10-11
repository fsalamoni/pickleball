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
import { FEATURE_FLAG, normalizeFeatureFlags } from '@/core/featureFlags';

const COL = 'platform_settings';
const DOC_ID = 'global';

/**
 * O que a plataforma mostra a TODO MUNDO no início, decidido pelo admin.
 * `promocoes`: a área "Promoções e destaques" (cupons e campanhas da região da
 * pessoa). Nasce LIGADA — sem o campo no documento, vale `true`.
 */
export const DEFAULT_PLATFORM_HOME = Object.freeze({ promocoes: true });

/** @param {unknown} raw o campo `inicio` do documento (ou nada) */
export function normalizePlatformHome(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return { promocoes: r.promocoes !== false };
}

function settingsFrom(data) {
  return {
    feature_flags: normalizeFeatureFlags(data?.feature_flags),
    inicio: normalizePlatformHome(data?.inicio),
  };
}

function settingsRef() {
  return doc(db, COL, DOC_ID);
}

/**
 * Lê (uma vez) as configurações da plataforma. Nunca lança: na ausência do
 * documento ou em erro de permissão, devolve os padrões (todas as flags off).
 * @returns {Promise<{ feature_flags: Record<string, boolean>, inicio: { promocoes: boolean } }>}
 */
export async function getPlatformSettings() {
  try {
    if (!db) return settingsFrom(null);
    const snap = await getDoc(settingsRef());
    return settingsFrom(snap.exists() ? snap.data() : null);
  } catch {
    return settingsFrom(null);
  }
}

/**
 * Observa as configurações em tempo real. Retorna a função de unsubscribe.
 * Em qualquer erro, entrega os padrões e segue (sem quebrar a aplicação).
 * @param {(settings: { feature_flags: Record<string, boolean>, inicio: { promocoes: boolean } }) => void} cb
 * @returns {() => void}
 */
export function subscribePlatformSettings(cb) {
  if (!db) {
    cb(settingsFrom(null));
    return () => {};
  }
  try {
    return onSnapshot(
      settingsRef(),
      (snap) => cb(settingsFrom(snap.exists() ? snap.data() : null)),
      () => cb(settingsFrom(null)),
    );
  } catch {
    cb(settingsFrom(null));
    return () => {};
  }
}

/**
 * Liga/desliga, para TODO MUNDO, a área "Promoções e destaques" do início.
 * Só o admin da plataforma (a regra de `platform_settings` reforça).
 * @param {boolean} enabled
 * @param {object} actor
 */
export async function setHomePromosEnabled(enabled, actor) {
  await setDoc(
    settingsRef(),
    { inicio: { promocoes: Boolean(enabled) }, updated_at: serverTimestamp() },
    { merge: true },
  );
  await createAuditLog({
    action: 'platform_home_promos_changed',
    actor,
    details: { enabled: Boolean(enabled) },
  });
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
